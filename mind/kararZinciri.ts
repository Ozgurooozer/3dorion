// mind/kararZinciri.ts — Karar kaydını GERİ OKUMAK: satırlardan zincir kurar.
//
// Kayıt (mind/kararKaydi.ts) satırları olay olduğu anda yazar: algı, sonra
// uyanış, çok sonra niyetin sonucu, belki Ozyn'in bir sözü. Anlam ancak bu
// halkalar birbirine bağlanınca çıkar: "şu algı LLM'i uyandırdı, LLM şunu
// yaptı, o iş şöyle bitti, Ozyn şöyle karşıladı". Bu modül o bağı kurar.
//
// İki okuyucusu var ve ikisi de AYNI bağı görmeli:
//   - tools/karar-ozet.ts: bugünkü elle yazılmış kapının taban çizgisi;
//   - öğrenen kapı (brain-lab/BUYUK-RESIM.md KT2): öğretmen etiketleri.
// İki ayrı bağlayıcı yazılsaydı biri "boşa uyanış"ı öbüründen farklı sayardı.
//
// BAĞLAR (hepsi kimlikle, zamanla tahmin yok — biri hariç):
//   uyanış.algilar[]   → o turu tetikleyen algı satırları
//   uyanış.niyetler[]  → sonuç algısının `niyet` alanı (son kesin durum)
//   Ozyn'in TEPKİSİ    → uyanıştan sonraki TEPKI_PENCERESI_MS içinde gelen ilk
//                        `duydum`. Tek zamana dayalı bağ bu: sözün neye cevap
//                        olduğunu kayıt bilemez. Pencere kısa tutuldu; tepki
//                        "sonra konuştu" demektir, "buna cevap verdi" değil.
//
// Bağımlılık: mind/kararKaydi.ts ve protocol/niyet.ts (tipler). Dosya sistemi yok: metin alır.
"use strict";
import type { AlgiSatiri, KararSatiri, NiyetKaydi, OgretimSatiri, RefleksSatiri, UyanisSatiri } from "./kararKaydi.ts";
import type { Niyet } from "../protocol/niyet.ts";

/** Uyanıştan sonra Ozyn'in sözü bu süre içinde gelirse tepki sayılır. */
export const TEPKI_PENCERESI_MS = 60_000;

export interface NiyetAkibeti {
  id: string;
  tur: string;
  /** Niyetin kendisi (spec 10, Faz A); eski satırlarda yok. */
  govde?: Niyet;
  /** Son kesin durum ("basladi" ara durumdur, sayılmaz). Sonuç hiç gelmediyse yok. */
  durum?: "bitti" | "iptal" | "hata";
  /** Sonuç algısının özeti (ör. "Ozyn komutu reddetti…"). */
  not?: string;
}

export interface UyanisZinciri {
  uyanis: UyanisSatiri;
  tetikleyenler: AlgiSatiri[];
  niyetler: NiyetAkibeti[];
  /** Uyanıştan sonraki pencerede Ozyn'in ilk sözü. */
  tepki?: { algi: AlgiSatiri; gecikmeMs: number };
}

/** Refleks turu (spec 10, Faz D): tetikleyen söz ve gönderilen adımların akıbeti. */
export interface RefleksZinciri {
  refleks: RefleksSatiri;
  /** Tetikleyen söz algısı; satırı okunmadıysa yok. */
  soz?: AlgiSatiri;
  niyetler: NiyetAkibeti[];
}

export interface KararZinciri {
  oturumlar: string[];
  algilar: AlgiSatiri[];
  uyanislar: UyanisZinciri[];
  /** Refleks turları (spec 10, Faz D), kayıttaki sırasıyla. */
  refleksler: RefleksZinciri[];
  /** Öğretim satırları, kayıttaki sırasıyla. */
  ogretimler: OgretimSatiri[];
  /** JSON olmayan ya da tanınmayan satır sayısı. */
  bozuk: number;
}

/** JSONL metnini satırlara ayırır; bozuk satırlar atılır ve sayılır. */
export function kayitOku(metin: string): { satirlar: KararSatiri[]; bozuk: number } {
  const satirlar: KararSatiri[] = [];
  let bozuk = 0;
  for (const ham of metin.split(/\r?\n/)) {
    if (!ham.trim()) continue;
    try {
      const s = JSON.parse(ham) as KararSatiri;
      if (s && (s.tur === "oturum" || s.tur === "algi" || s.tur === "uyanis" || s.tur === "ogretim" || s.tur === "refleks") && typeof s.o === "string") satirlar.push(s);
      else bozuk++;
    } catch {
      bozuk++;
    }
  }
  return { satirlar, bozuk };
}

/** Satırlardan zincir kurar. Kimlikler oturum içinde tekildir; bağlar oturumu aşmaz. */
export function zincirKur(satirlar: KararSatiri[], bozuk = 0): KararZinciri {
  const oturumlar: string[] = [];
  const algilar: AlgiSatiri[] = [];
  const uyanislar: UyanisSatiri[] = [];
  const refleksSatirlari: RefleksSatiri[] = [];
  const ogretimler: OgretimSatiri[] = [];
  for (const s of satirlar) {
    if (s.tur === "oturum") { if (!oturumlar.includes(s.o)) oturumlar.push(s.o); }
    else if (s.tur === "algi") algilar.push(s);
    else if (s.tur === "uyanis") uyanislar.push(s);
    else if (s.tur === "refleks") refleksSatirlari.push(s);
    // Açık tür denetimi: dışarıdan gelen (ör. host'un seçtiği) tanınmayan bir satır öğretim sayılmasın.
    else if (s.tur === "ogretim") ogretimler.push(s);
  }

  const anahtar = (o: string, id: string) => `${o}/${id}`;
  const algiHaritasi = new Map(algilar.map((a) => [anahtar(a.o, a.id), a]));

  // Niyet kimliği protokolden gelir (`kimlik("n")`, zamana dayalı) ve oturumlar
  // arasında da tekildir; yine de bağ oturum içinde kurulur.
  const sonuclar = new Map<string, AlgiSatiri>();
  for (const a of algilar) {
    if (a.algi !== "sonuc" || !a.niyet || !a.durum || a.durum === "basladi") continue;
    sonuclar.set(anahtar(a.o, a.niyet), a);   // son kesin durum kazanır
  }

  const sozler = algilar.filter((a) => a.algi === "duydum");

  /** Bir turun (uyanış ya da refleks) niyetlerinin akıbeti: kimlikle, oturum içinde. */
  const akibetler = (o: string, liste: readonly NiyetKaydi[]): NiyetAkibeti[] => liste.map((n) => {
    const akibet: NiyetAkibeti = { id: n.id, tur: n.tur };
    if (n.govde) akibet.govde = n.govde;
    const s = sonuclar.get(anahtar(o, n.id));
    if (s) { akibet.durum = s.durum as NiyetAkibeti["durum"]; akibet.not = s.ozet; }
    return akibet;
  });

  const zincir: UyanisZinciri[] = uyanislar.map((u) => {
    const tetikleyenler = u.algilar
      .map((id) => algiHaritasi.get(anahtar(u.o, id)))
      .filter((a): a is AlgiSatiri => a !== undefined);
    const soz = sozler.find((a) => a.o === u.o && a.t > u.t && a.t - u.t <= TEPKI_PENCERESI_MS);
    const z: UyanisZinciri = { uyanis: u, tetikleyenler, niyetler: akibetler(u.o, u.niyetler) };
    if (soz) z.tepki = { algi: soz, gecikmeMs: soz.t - u.t };
    return z;
  });

  const refleksler: RefleksZinciri[] = refleksSatirlari.map((r) => {
    const z: RefleksZinciri = { refleks: r, niyetler: akibetler(r.o, r.niyetler) };
    const soz = algiHaritasi.get(anahtar(r.o, r.algi));
    if (soz) z.soz = soz;
    return z;
  });

  return { oturumlar, algilar, uyanislar: zincir, refleksler, ogretimler, bozuk };
}

/**
 * Uyanış bir şey yaptı mı? Dünyaya niyet gitti ya da düz metin konuşuldu.
 *
 * "Boşa uyanış" bunun değilidir: LLM uyandı, düşündü, dünyada hiçbir şey
 * değişmedi. Kapının bedeli budur — öğrenen kapının azaltmaya çalışacağı şey.
 * Susmak bazen DOĞRU karardır (inisiyatifte "yapacak bir şey yok"); bu yüzden
 * boşa uyanış bir hata sayısı değil, bir maliyet sayısıdır.
 */
export function uyanisEyleme(u: UyanisSatiri): boolean {
  return u.niyetler.length > 0 || u.konusulanMetin;
}
