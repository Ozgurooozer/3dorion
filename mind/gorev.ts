// mind/gorev.ts — GÖREV (spec 10): Ozyn'in tek bir kesin sözüyle başlayan ve bedensel
// niyetlerle yapılan iş. Beceri refleksi (mind/beceriHafizasi.ts) bu görevlerden öğrenir.
//
// ÜÇ TANIM, üçü de YALNIZ burada (spec 10 kod kalitesi kuralı 2):
//   niyetSinifi — hangi niyet görevin adımıdır (bedensel), hangisi eşlik eder (söz,
//                 sorgu), hangisi beceriyi durdurur (yazı, kabuk komutu).
//   sozAnahtari — sözün çerçevesi (çapa olmayan sözcükler) ve yuvaları (çapa adları).
//   gorevSonucu — başarı: hiçbir adım hata değil, son adım bitti, hepsinin sonucu geldi.
//
// NEDEN "SON ADIM BİTTİ" (hepsi değil): dünya "en son emir kazanır" kuralıyla çalışır
// (world/avatar/yurutucu.ts). LLM aynı turda `git masa` + `otur` gönderince `otur`,
// `git`i iptal eder ve sandalyeye kendisi yürür. İlk taslaktaki "hepsi bitti" şartı
// gerçekte hiç sağlanmazdı; önceki adımın `iptal`i, sonrakinin onu geçmesidir.
//
// NEDEN YAZI ve KOMUT ENGEL: `komut` kabuk komutudur, kendiliğinden tekrarlanmaz
// (güvenlik). `yaz`ın içeriği sözden gelir ve v1 onu parametre yapmaz; yalnız
// bedensel kısmı tekrar etmek görevi yarım bırakırdı (Faz A canlı koşusunda görüldü).
// Söz (`soyle`) ve sorgu (`sor`) göreve eşlik eder ama tekrar edilmez: uydurma söz
// sessizlikten kötüdür (mind/yerelTepki.ts ilkesi).
//
// Bağımlılık: protocol/ (tipler, CAPALAR), mind/kararZinciri.ts (tipler),
// mind/durumKodu.ts (kelimeler). Saf: dosya, saat, dünya yok.
"use strict";
import { CAPALAR, type CapaAdi } from "../protocol/temel.ts";
import type { Niyet, NiyetTur } from "../protocol/niyet.ts";
import type { AlgiSatiri, KararSatiri, UyanisSatiri } from "./kararKaydi.ts";
import type { KararZinciri, NiyetAkibeti, RefleksZinciri } from "./kararZinciri.ts";
import { kelimeler, type KelimeAyari } from "./durumKodu.ts";

export type NiyetSinifi = "bedensel" | "eslik" | "engel";

/**
 * Her niyet türünün sınıfı. `Record<NiyetTur, …>`: protokole yeni bir niyet türü
 * eklenince tip denetimi onun sınıfını sorar — sınıfsız tür kalamaz (bekçi).
 */
const SINIF: Record<NiyetTur, NiyetSinifi> = {
  git: "bedensel", otur: "bedensel", kalk: "bedensel", bak: "bedensel", al: "bedensel",
  birak: "bedensel", dur: "bedensel", jest: "bedensel", poz: "bedensel", odaklan: "bedensel",
  soyle: "eslik", sor: "eslik",
  yaz: "engel", komut: "engel",
};

export function niyetSinifi(tur: NiyetTur): NiyetSinifi {
  return SINIF[tur];
}

// ── Söz anahtarı ───────────────────────────────────────────────────────────

/** Türkçe karakter katlama: "Kapıya" ile "kapiya" aynı sözcük sayılsın (çapa adları ASCII). */
const KATLAMA: Record<string, string> = { "ı": "i", "ö": "o", "ü": "u", "ş": "s", "ç": "c", "ğ": "g", "â": "a", "î": "i", "û": "u" };
const katla = (w: string): string => w.replace(/[ıöüşçğâîû]/g, (h) => KATLAMA[h]!);

/**
 * Çapa adından sonra gelebilecek ekler (katlanmış). Hal ekleri tek başına ya da 3.
 * tekil iyelikten sonra ("masasına" = masa + sı + na). Liste bilerek kapalı:
 * "masal", "kapital", "tahtalar" çapa sayılmaz (çoğul v1'de yok).
 */
const HAL_EKLERI = ["", "a", "e", "ya", "ye", "da", "de", "ta", "te", "dan", "den", "tan", "ten",
  "i", "u", "yi", "yu", "in", "un", "nin", "nun", "la", "le", "yla", "yle"];
const IYELIKTEN_SONRA = ["", "na", "ne", "nda", "nde", "ndan", "nden", "ni", "nu", "nin", "nun", "yla", "yle"];
const EKLER = new Set([...HAL_EKLERI, ...["i", "u", "si", "su"].flatMap((iy) => IYELIKTEN_SONRA.map((h) => iy + h))]);

/** Ünsüz yumuşaması: "günlük" + e → "günlüğe" (katlanmış: gunlug + e). */
const yumusat = (ad: string): string => ad.replace(/k$/, "g").replace(/p$/, "b").replace(/t$/, "d");

/**
 * Sözde anılabilen çapalar: alt çizgili iç adlar ("oda_ortasi") sözde geçmez. Uzun önce: en
 * uzun eşleşme kazanır. Bugün hiçbir ad öbürünün öneki değil, sıra bir şey değiştirmiyor
 * (bozma denemesinde eşdeğer mutant); öyle bir ad eklenince doğru çapayı bu sıra seçer.
 */
const SOZ_CAPALARI = CAPALAR.filter((a) => !a.includes("_")).sort((x, y) => y.length - x.length);

/**
 * Rica ve seslenme sözcükleri: görevi değiştirmez. "Orion, lütfen masaya git otur" ile
 * "masaya git otur" aynı görevdir. `kelimeler`in dolgu listesi (bir, ve…) zaten uygulanır;
 * bu liste yalnız konuşmaya özgü olanlar (katlanmış biçimde).
 */
const SOZ_DOLGUSU = new Set(["orion", "hadi", "haydi", "lutfen", "simdi", "artik", "biraz", "bakalim",
  "hemen", "once", "sonra", "rica", "ederim", "sagol", "tesekkurler"]);

/**
 * Sözün sözcükleri kapının ayıklayıcısından gelir (tek kaynak), iki ayarla:
 *   enKisa 2 — iki harfli fiiller görevin kendisidir ("al", "aç", "at", "in"). Kapının
 *              varsayılanı (3) onları atar; o zaman "kupayı al" ile "kupayı at" aynı anahtar olurdu.
 *   sınırsız — kapının kelime sınırında kesilen iki uzun söz, sonları farklıyken aynı
 *              anahtara düşmesin.
 */
const SOZ_SOZCUKLERI: KelimeAyari = { enKisa: 2, sinir: Infinity };

/** Katlanmış bir sözcük bir çapa adı mı (ekiyle)? */
function capaSozcugu(w: string): CapaAdi | null {
  for (const ad of SOZ_CAPALARI) {
    for (const kok of new Set([ad, yumusat(ad)])) {
      if (w.startsWith(kok) && EKLER.has(w.slice(kok.length))) return ad;
    }
  }
  return null;
}

/** Sözün görev anahtarı. */
export interface SozAnahtari {
  /** Çapa ve dolgu olmayan sözcükler: katlanmış, tekil, sıralı. Sıra görevi değiştirmez. */
  cerceve: string[];
  /** Sözde geçen çapa adları, sözdeki sırayla: becerinin parametre yuvaları. */
  yuvalar: CapaAdi[];
}

/**
 * Sözü anahtara çevirir. Söz görev anahtarı olamıyorsa null:
 *   - çerçeve boş ("masa"): sözde yapılacak iş yok;
 *   - aynı çapa iki yuvada ("masaya git masada otur"): adımdaki `masa`nın hangi yuvadan
 *     geldiği belirsiz. Yanlış bağ, başka bir sözde yanlış çapaya götürür
 *     ("pencereye git kapıda otur" → pencerede otur).
 * Aynı sözcük iki kez geçerse (`kelimeler` tekrarı atar) tek yuvadır: "masaya git, masaya otur".
 */
export function sozAnahtari(metin: string): SozAnahtari | null {
  const cerceve = new Set<string>();
  const yuvalar: CapaAdi[] = [];
  for (const k of kelimeler(metin, SOZ_SOZCUKLERI)) {
    const w = katla(k);
    const capa = capaSozcugu(w);
    if (capa) yuvalar.push(capa);
    else if (!SOZ_DOLGUSU.has(w)) cerceve.add(w);
  }
  if (cerceve.size === 0 || new Set(yuvalar).size !== yuvalar.length) return null;
  return { cerceve: [...cerceve].sort(), yuvalar };
}

// ── Görev sonucu ───────────────────────────────────────────────────────────

export type GorevSonucu = "basari" | "hata" | "belirsiz";

/** Başarı: hiçbir adım hata değil, hepsinin sonucu geldi, son adım bitti. Hata varsa hata; kalanı belirsiz. */
export function gorevSonucu(adimlar: readonly { durum?: NiyetAkibeti["durum"] }[]): GorevSonucu {
  if (adimlar.length === 0) return "belirsiz";
  if (adimlar.some((a) => a.durum === "hata")) return "hata";
  if (adimlar.some((a) => a.durum === undefined)) return "belirsiz";
  return adimlar.at(-1)!.durum === "bitti" ? "basari" : "belirsiz";
}

// ── Kayıttan görev çıkarma ─────────────────────────────────────────────────

export interface GorevAdimi {
  govde: Niyet;
  /** Son kesin durum; sonucu gelmediyse yok. */
  durum?: "bitti" | "iptal" | "hata";
}

/** Kayıttan çıkarılmış tek bir görev yürütümü. */
export interface GorevOrnegi {
  /** Yürüten: LLM uyanışı ya da refleks (Faz D). */
  kaynak: "uyanis" | "refleks";
  /** Yürütümün kayıttaki kimliği: `oturum/satır`. Becerinin kanıtı. */
  kimlik: string;
  t: number;
  soz: string;
  anahtar: SozAnahtari;
  /** Bedensel adımlar, sırayla. */
  adimlar: GorevAdimi[];
  /**
   * Yürütümdeki eşlik niyetleri (söz, sorgu). Refleks bunları yapmaz: LLM'in bu görevde
   * konuştuğu ya da sorduğu, becerinin sessiz kalacağı yerdir (ölçüde ayrıca sayılır).
   */
  eslik: number;
  sonuc: GorevSonucu;
  /** LLM'in düşünme süresi (ms): refleksin kazanacağı süre. Refleks yürütümünde 0. */
  sureMs: number;
  /**
   * Refleks yürütümünde yürütülen becerinin kimliği (spec 10, Faz D). Sonuç doğrudan
   * onun sayacına yazılır; tarif eşlemesine bırakılmaz: hata ya da kesilmeden sonra
   * gönderilmeyen adımlar tarifi eksik gösterir ve hata başka (olmayan) bir tarife düşerdi.
   */
  beceri?: string;
}

/** Kayıttan bir satır seçimi: türü `turler`de olan satırlar ve algı türü `algilar`da olan algı satırları. */
export interface KayitSecimi {
  turler: readonly string[];
  algilar: readonly string[];
}

/**
 * Görevlerin kurulduğu satırlar: uyanışlar, sözler (tetik ve anahtar) ve sonuçlar
 * (akıbet). TEK KAYNAK: köprü kendi oturumundan bunları toplar; host geçmiş
 * oturumlardan bunları okur (seçim IPC ile gider, host/kararDosyasi.js `satirlariOku`;
 * eşitliği host/kararDosyasi.test.ts bekler). Başka satır görev kurmaz; okunmaması
 * açılışı ve belleği küçük tutar.
 */
export const GOREV_SATIRLARI: KayitSecimi = { turler: ["uyanis", "refleks"], algilar: ["duydum", "sonuc"] };

export function gorevSatiriMi(s: KararSatiri): boolean {
  return GOREV_SATIRLARI.turler.includes(s.tur) || (s.tur === "algi" && GOREV_SATIRLARI.algilar.includes(s.algi));
}

/**
 * Tek kesin sözle tetiklenmiş bir uyanıştan görev: sözün metni, bedensel adımlar.
 * Görev değilse null: kök dış değil, tetik tek söz değil, engel niyet var, bedensel
 * niyet yok, bir adımın gövdesi yok (Faz A öncesi satır) ya da söz anahtar olamıyor.
 *
 * Tetik sayısı uyanış satırının KENDİ listesinden (`algilar`) ve geri beslemesinden
 * sayılır, bulunan satırlardan değil: süzülmüş okumada (GOREV_SATIRLARI) söz dışındaki
 * tetik satırı okunmaz; bulunanları saymak iki tetikli uyanışı tek tetikli gösterirdi.
 */
function uyanistanGorev(u: UyanisSatiri, tetikleyenler: readonly AlgiSatiri[], niyetler: readonly NiyetAkibeti[]): GorevOrnegi | null {
  if (u.koken !== "dis" || u.algilar.length !== 1 || u.geriBesleme !== 0 || tetikleyenler.length !== 1) return null;
  const soz = tetikleyenler[0]!;
  if (soz.algi !== "duydum" || !soz.soz?.kesin) return null;
  const sinif = niyetler.map((n) => niyetSinifi(n.tur as NiyetTur));
  if (sinif.includes("engel")) return null;
  const bedensel = niyetler.filter((_, i) => sinif[i] === "bedensel");
  if (bedensel.length === 0 || bedensel.some((n) => !n.govde)) return null;
  const anahtar = sozAnahtari(soz.soz.metin);
  if (!anahtar) return null;
  const adimlar: GorevAdimi[] = bedensel.map((n) => (n.durum ? { govde: n.govde!, durum: n.durum } : { govde: n.govde! }));
  return {
    kaynak: "uyanis", kimlik: `${u.o}/${u.id}`, t: u.t, soz: soz.soz.metin, anahtar,
    adimlar, eslik: sinif.filter((s) => s === "eslik").length, sonuc: gorevSonucu(adimlar), sureMs: u.sureMs,
  };
}

/**
 * Zaman sırası; eşitlikte verilen sıra korunur (`sort` ES2019'dan beri kararlı).
 * Sıralı ölçüm ve hafızanın kayıttan kurulması buna dayanır: tek yerde durur.
 */
export function zamanSirali<T extends { t: number }>(liste: readonly T[]): T[] {
  return [...liste].sort((a, b) => a.t - b.t);
}

/**
 * Bir refleks turundan görev (spec 10, Faz D): sözü, gönderilen adımları ve yürütülen
 * beceriyle. Söz satırı okunmadıysa, söz anahtar olamıyorsa ya da bir adım gövdesiz veya
 * bedensel değilse null (refleks yalnız bedensel adım gönderir; bu ikinci kez sorulur).
 */
function refleksGorevi(z: RefleksZinciri): GorevOrnegi | null {
  const soz = z.soz?.soz;
  if (!soz) return null;
  const anahtar = sozAnahtari(soz.metin);
  if (!anahtar) return null;
  if (z.niyetler.some((n) => !n.govde || niyetSinifi(n.tur as NiyetTur) !== "bedensel")) return null;
  const adimlar: GorevAdimi[] = z.niyetler.map((n) => (n.durum ? { govde: n.govde!, durum: n.durum } : { govde: n.govde! }));
  return {
    kaynak: "refleks", kimlik: `${z.refleks.o}/${z.refleks.id}`, t: z.refleks.t, soz: soz.metin, anahtar,
    adimlar, eslik: 0, sonuc: gorevSonucu(adimlar), sureMs: 0, beceri: z.refleks.beceri,
  };
}

/** Kayıttaki bütün görevler — LLM'in uyanışları ve refleks turları — zaman sırasıyla (eşitlikte kayıt sırası). */
export function gorevler(z: KararZinciri): GorevOrnegi[] {
  const out: GorevOrnegi[] = [];
  for (const { uyanis, tetikleyenler, niyetler } of z.uyanislar) {
    const g = uyanistanGorev(uyanis, tetikleyenler, niyetler);
    if (g) out.push(g);
  }
  for (const r of z.refleksler) {
    const g = refleksGorevi(r);
    if (g) out.push(g);
  }
  return zamanSirali(out);
}
