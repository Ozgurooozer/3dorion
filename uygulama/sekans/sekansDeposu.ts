// uygulama/sekans/sekansDeposu.ts — SEKANS DEPOSU (spec 36): `<userData>/orion-sekans/<ad>.json` (host/sekansDosyalari.js), `npm run dev`'de localStorage.
//
// Grafik ve NPC depolarının KOPYASI DEĞİL: kurallar ortak çekirdekte (`uygulama/dogruDosyaDeposu.ts`: yazmadan önce doğrula — bozuk JSON/biçim diske
// GİTMEZ —, ad = dosya adı, kanonik metin, bozuk dosya listede nedeniyle, yeniden adlandır = yeni + kaldır, kopya; `uygulama/dosyaDeposu.ts`: IPC /
// localStorage / çalışmayan kaynak, iş sırası). Burada sekansa özgü olan: biçim (`protocol/sekans.ts` `sekansDogrula`), kanonik metin (iz başına bir
// satır), listedeki özet (süre, ajanlar) ve "＋ Yeni"nin çalışan örneği.
// SİL = KALDIR (`.silinenler/`, kalıcı silme yok). OYNATMA burada DEĞİL: depo veriyi tutar; ▶ Ozyn'in editördeki gerçek tıklaması (oynatici.ts).
"use strict";
import { sekansAdiGecerli, sekansDogrula, SEKANS_FPS, type Sekans } from "../../protocol/sekans.ts";
import type { Sonuc } from "../../protocol/dogrula.ts";
import { kabukKoprusu } from "../kabuk.ts";
import { DosyaHatasi, kaynakSec, yerelDosyaKaynagi, type Depo, type DosyaKaynagi } from "../dosyaDeposu.ts";
import { dogruDepoKur, type DogruDepo, type DogruKayit } from "../dogruDosyaDeposu.ts";

export const YEREL_SEKANS_ANAHTARI = "orion.sekans.v1";

const sekansHatasi = (kod: string, mesaj: string): Error => new DosyaHatasi(kod, mesaj);

/** Okunur kanonik metin: üst alanlar ayrı satırda, her bağlama ve her iz TEK satırda (JSON penceresinde satır satır okunur). */
export function sekansMetni(s: Sekans): string {
  const j = (v: unknown) => JSON.stringify(v);
  const liste = (l: readonly unknown[]) => (l.length ? `[\n${l.map((x) => `    ${j(x)}`).join(",\n")}\n  ]` : "[]");
  const satirlar = [
    `  "surum": ${j(s.surum)}`, `  "ad": ${j(s.ad)}`, ...(s.aciklama !== undefined ? [`  "aciklama": ${j(s.aciklama)}`] : []),
    `  "fps": ${j(s.fps)}`, `  "sure_kare": ${j(s.sure_kare)}`, `  "aralik": ${j(s.aralik)}`,
    `  "baglamalar": ${liste(s.baglamalar)}`, `  "izler": ${liste(s.izler)}`,
  ];
  return `{\n${satirlar.join(",\n")}\n}\n`;
}

/** Metni sekansa çevirir: JSON hatası ve biçim hatası NEDENLE (düzenleyici "KAYDEDİLEMEDİ: …" der). */
export function sekansMetniCoz(metin: string): Sonuc<Sekans> {
  let ham: unknown;
  try { ham = JSON.parse(metin); }
  catch (err) { return { ok: false, hata: `JSON okunamadı: ${err instanceof Error ? err.message : String(err)}` }; }
  const r = sekansDogrula(ham);
  return r.ok ? r : { ok: false, hata: `biçim: ${r.hata}` };
}

export type SekansEki = { sure_kare: number | null; ajanlar: readonly string[]; aciklama: string | null };
export type SekansKaydi = DogruKayit<SekansEki>;
export type SekansDeposu = DogruDepo<Sekans, SekansEki>;

export function sekansDeposuKur(kaynak: DosyaKaynagi): SekansDeposu {
  return dogruDepoKur<Sekans, SekansEki>({
    kaynak, coz: sekansMetniCoz, adi: (s) => s.ad, metin: sekansMetni,
    ek: (s) => ({ sure_kare: s?.sure_kare ?? null, ajanlar: s ? s.baglamalar.map((b) => b.ajan) : [], aciklama: s?.aciklama ?? null }),
    adGecerli: sekansAdiGecerli, etiket: "sekans", adinSozu: "sekansın adı", gunluk: "[sekans]", adla: (s, ad) => ({ ...s, ad }),
  });
}

/**
 * "＋ Yeni sekans"ın ilk hâli: BOŞ SAYFA DEĞİL, çalışan küçük bir örnek (graf şablonlarının kuralı) — 3 sn, seçilen ajana bağlı, bir `el_salla` bölümü ve
 * başın iki kez öne eğildiği bir uzuv izi. Ozyn ▶'ye basınca bir şey görür, sonra değiştirir.
 */
export function yeniSekans(ad: string, ajan: string): Sekans {
  const sure = 3 * SEKANS_FPS;
  return {
    surum: 1, ad, aciklama: "Yeni sekans: el sallar, başını iki kez eğer. Değiştir, Ctrl+S, ▶.", fps: SEKANS_FPS, sure_kare: sure, aralik: { bas: 0, bit: sure },
    baglamalar: [{ id: "b1", ajan }],
    izler: [
      { id: "el", baglama: "b1", tur: "klip", gizli: false, kilitli: false, bolumler: [{ klip: "el_salla", baslangic_kare: 0, uzunluk_kare: 72, ofset_kare: 0 }] },
      { id: "bas", baglama: "b1", tur: "uzuv", gizli: false, kilitli: false, uzuv: "bas", kanal: "donme_x", anahtarlar: [
        { kare: 0, deger: 0, yumusatma: "yumusak" }, { kare: 15, deger: 10, yumusatma: "yumusak" }, { kare: 30, deger: 0, yumusatma: "yumusak" },
        { kare: 45, deger: 10, yumusatma: "yumusak" }, { kare: 60, deger: 0, yumusatma: "dogrusal" },
      ] },
    ],
  };
}

/** localStorage kaynağı (Electron'suz geliştirme): ortak yerel kaynak, ek alan yok. Ad kuralı protokolün. */
export function yerelSekansKaynagi(depo: Depo, simdi: () => number = Date.now): DosyaKaynagi {
  return yerelDosyaKaynagi<Record<never, never>>(depo, {
    anahtar: YEREL_SEKANS_ANAHTARI, adGecerli: sekansAdiGecerli, hata: sekansHatasi, etiket: "sekans", adEtiketi: "sekans adı",
    yeniEk: () => ({}), ekAl: () => ({}),
  }, simdi);
}

/** Çalışma ortamına göre kaynak (grafik/NPC ile ORTAK seçim kuralı `kaynakSec`): Electron'da host dosyaları, değilse localStorage, yoksa nedenli çalışmayan. */
export function sekansKaynaginiSec(): { kaynak: DosyaKaynagi; hata: string | null } {
  const k = kabukKoprusu();
  return kaynakSec(k ? { liste: k.sekansListe, oku: k.sekansOku, yaz: k.sekansYaz, yeni: k.sekansYeni, sil: k.sekansSil } : undefined, (d) => yerelSekansKaynagi(d), sekansHatasi,
    { ne: "sekanslar", onek: "[SEKANS]" });
}
