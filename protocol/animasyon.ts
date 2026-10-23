// protocol/animasyon.ts — JSON ANİMASYON KLİBİ biçimi (spec 35 Dilim 5a). Ozyn'in ve Orion'un yazdığı "hareket = veri".
//
// NEDEN PROTOKOLDE: klip, `jest` niyetinin `klip` alanıyla beyinden (ya da Ozyn'in grafiğinden) bedene giden sözleşmenin parçasıdır; `graf.ts` gibi
// bağımlılıksız ve elle doğrulanır. Burası YALNIZ BİÇİMİ bilir (alanlar, tavanlar, değer aralıkları). Klibin HANGİ GÖVDEDE hangi kemiğe/düğüme
// gittiğini gövde katmanı bilir (`world/avatar/uzuvEslemesi.ts`): biçim gövdeden bağımsızdır, eşleme gövde türü başına bir tablodur.
//
// KAVRAMLAR (Unreal'deki AnimSequence'ın küçük, okunur hâli):
//   • klip: ad, süre (sn), döngü, izler. Ad = dosya adı (`assets/animasyon/<ad>.json`), küçük harf: dosya adı olarak da güvenli.
//   • iz: bir SOYUT UZUV ("sag_kol", "bas", "govde"…) + bir kanal (dönme x/y/z derece, öteleme x/y/z metre) + anahtarlar.
//   • anahtar: zaman (sn), değer, ve BU anahtardan bir SONRAKİNE geçişin yumuşatması (CSS keyframe'deki gibi: yumuşatma segmentin başındadır).
//
// EKSENLER GÖVDE UZAYINDADIR (gövdenin kendi çerçevesi: yüzü +Z, yukarı +Y, sağı +X — Babylon sol-elli). Değer, uzvun o anki (yürüme/boşta
// klibinin verdiği) duruşunun ÜSTÜNE eklenen dönmedir; uzvun eklem noktası etrafında.
//   donme_x (yan eksen): + üst taraf öne devrilir — baş öne eğilir (selam), gövde öne eğilir; sarkık kol + ile GERİ, − ile ÖNE kalkar.
//   donme_y (dik eksen): + sağa döner (baş sağa bakar).
//   donme_z (ön eksen):  + sağ taraf yukarı kalkar — SAĞ kol + ile yana-yukarı (el sallama), SOL kol − ile; baş + ile sola yatar.
//   oteleme_*: YALNIZ `kok` uzvu (bütün beden; zıplama `oteleme_y`). Tek bir kemiği ötelemek gövdeyi yırtar, bu yüzden biçim reddeder.
// Bu yön kuralı başsız ölçümle sabitlendi (world/avatar/klipGovdesi.test.ts: sağ el başın üstüne çıkar); canlıda GÖRÜLMEDİ.
"use strict";
import type { Sonuc } from "./dogrula.ts";
import { JESTLER, type Jest } from "./niyet.ts";

export const KLIP_SURUMU = 1;

/**
 * Soyut uzuvlar. Gövdeye özgü ad (VRM "rightUpperArm", prosedürel "omuzL") burada YOK: klip bir kez yazılır, her gövde kendi tablosuyla okur.
 * `kok` bütün bedendir (ayak hizasındaki kök: eğilme, zıplama). Yeni uzuv eklemek kırıcı değil; silmek/yeniden adlandırmak eski klipleri bozar.
 */
export const UZUVLAR = [
  "kok", "govde", "gogus", "boyun", "bas",
  "sag_kol", "sag_on_kol", "sag_el", "sol_kol", "sol_on_kol", "sol_el",
  "sag_bacak", "sol_bacak",
  // Spec 37 (Kimodo hattı, 2026-10-23): tam beden hareketi (yürüme, oturma, zıplama) diz, ayak ve pelvis ister; diz olmadan bacak sopa gibi sallanır.
  // Sona eklendi (eski sıra değişmesin). Prosedürel gövdede yoklar (izleri atlanır ve sayılır).
  "kalca", "sag_diz", "sol_diz", "sag_ayak", "sol_ayak",
] as const;
export type Uzuv = (typeof UZUVLAR)[number];

export const DONME_KANALLARI = ["donme_x", "donme_y", "donme_z"] as const;
export const OTELEME_KANALLARI = ["oteleme_x", "oteleme_y", "oteleme_z"] as const;
export const KANALLAR = [...DONME_KANALLARI, ...OTELEME_KANALLARI] as const;
export type Kanal = (typeof KANALLAR)[number];

/** Segment yumuşatması: `dogrusal` (sabit hız), `yumusak` (yavaş başla, yavaş bitir: smoothstep), `basamak` (değer bir sonraki anahtara dek sabit). */
export const YUMUSATMALAR = ["dogrusal", "yumusak", "basamak"] as const;
export type Yumusatma = (typeof YUMUSATMALAR)[number];

/**
 * Tavanlar: bozuk bir dosya ya da LLM çıktısı bedeni boğmasın. Süre ≤ 10 sn (grafiğin "Bekle"siyle aynı tavan; uzun hareket klip zinciridir).
 * Dönme ±180°: daha büyüğü aynı duruşun başka yazılışıdır ve yanlışlıkla yazılmış "1500" gibi değerleri yakalar. Öteleme ±0.5 m: zıplamaya yeter.
 */
export const KLIP_SINIRLARI = { iz: 24, anahtar: 32, sure: 10, ad: 48, aciklama: 300, donme: 180, oteleme: 0.5 } as const;

export interface KlipAnahtari {
  /** Klibin başından saniye (0 ≤ t ≤ süre); bir izde kesin artan. */
  t: number;
  /** Derece (dönme) ya da metre (öteleme). */
  deger: number;
  /** Bu anahtardan sonrakine geçiş. Temiz kopyada hep dolu (yazılmadıysa `dogrusal`). */
  yumusatma: Yumusatma;
}

export interface KlipIzi {
  uzuv: Uzuv;
  kanal: Kanal;
  anahtarlar: KlipAnahtari[];
}

export interface AnimasyonKlibi {
  surum: typeof KLIP_SURUMU;
  ad: string;
  aciklama?: string;
  /**
   * Klibin ANLAMI (protokolün jest sözlüğünden): `jest` niyetinin zorunlu alanı buradan dolar, günlük "el_salliyor" der, ve uzvu olmayan gövde
   * (LED yüz) klibin yerine bu jestin yüz hâlini gösterir. Klibi oynayabilen gövdede jestin kendi (yordamsal) hareketi OYNAMAZ: klip onun yerine geçer.
   */
  jest: Jest;
  /** Saniye, 0 < süre ≤ KLIP_SINIRLARI.sure. */
  sure: number;
  /** Döngülü klip kendiliğinden BİTMEZ: `dur` ya da yeni bir jest keser (sonuç `iptal`). Yazılmadıysa false. */
  dongu: boolean;
  izler: KlipIzi[];
}

/** Grafiğin ve günlüğün gördüğü özet (izler yok): seçenek listesi, "bekle" kararı (döngü), süre. */
export interface KlipOzeti {
  ad: string;
  aciklama?: string;
  jest: Jest;
  sure: number;
  dongu: boolean;
  /** Klibin dokunduğu uzuvlar (tekil, ilk görülme sırasıyla). */
  uzuvlar: Uzuv[];
}

const AD_DESENI = /^[a-z0-9_]+$/;

/** Klip adı: küçük harf, rakam, `_`; boş değil, en çok KLIP_SINIRLARI.ad (dosya adı olarak güvenli; Türkçe harf yok: dosya sistemi farkı olmasın). */
export function klipAdiGecerli(ad: unknown): ad is string {
  return typeof ad === "string" && ad.length > 0 && ad.length <= KLIP_SINIRLARI.ad && AD_DESENI.test(ad);
}

const nesneMi = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const sonlu = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const hata = (m: string): Sonuc<never> => ({ ok: false, hata: m });

export const otelemeMi = (k: Kanal): boolean => (OTELEME_KANALLARI as readonly string[]).includes(k);

function izDogrula(v: unknown, alan: string, sure: number): Sonuc<KlipIzi> {
  if (!nesneMi(v)) return hata(`${alan}: nesne olmalı`);
  if (!UZUVLAR.includes(v.uzuv as Uzuv)) return hata(`${alan}.uzuv geçersiz: ${JSON.stringify(v.uzuv)} (geçerli: ${UZUVLAR.join(", ")})`);
  if (!KANALLAR.includes(v.kanal as Kanal)) return hata(`${alan}.kanal geçersiz: ${JSON.stringify(v.kanal)} (geçerli: ${KANALLAR.join(", ")})`);
  const uzuv = v.uzuv as Uzuv, kanal = v.kanal as Kanal;
  if (otelemeMi(kanal) && uzuv !== "kok") return hata(`${alan}: '${kanal}' yalnız 'kok' uzvunda olur (tek uzvu ötelemek gövdeyi yırtar; zıplama için kok.oteleme_y)`);
  if (!Array.isArray(v.anahtarlar) || v.anahtarlar.length === 0) return hata(`${alan}.anahtarlar: en az bir anahtar olan dizi olmalı`);
  if (v.anahtarlar.length > KLIP_SINIRLARI.anahtar) return hata(`${alan}.anahtarlar: en çok ${KLIP_SINIRLARI.anahtar} anahtar (gelen ${v.anahtarlar.length})`);
  const sinir = otelemeMi(kanal) ? KLIP_SINIRLARI.oteleme : KLIP_SINIRLARI.donme;
  const birim = otelemeMi(kanal) ? "m" : "°";
  const anahtarlar: KlipAnahtari[] = [];
  for (const [i, a] of v.anahtarlar.entries()) {
    const ya = `${alan}.anahtarlar[${i}]`;
    if (!nesneMi(a)) return hata(`${ya}: nesne olmalı`);
    if (!sonlu(a.t)) return hata(`${ya}.t: sonlu sayı olmalı`);
    if (a.t < 0 || a.t > sure) return hata(`${ya}.t: ${a.t} klibin süresi dışında (0–${sure} sn)`);
    const onceki = anahtarlar[anahtarlar.length - 1];
    if (onceki && a.t <= onceki.t) return hata(`${ya}.t: anahtarlar zamanca KESİN artmalı (${onceki.t} → ${a.t})`);
    if (!sonlu(a.deger)) return hata(`${ya}.deger: sonlu sayı olmalı`);
    if (Math.abs(a.deger) > sinir) return hata(`${ya}.deger: ${a.deger}${birim} aralık dışı (±${sinir}${birim})`);
    if (a.yumusatma !== undefined && !YUMUSATMALAR.includes(a.yumusatma as Yumusatma)) return hata(`${ya}.yumusatma geçersiz: ${JSON.stringify(a.yumusatma)} (geçerli: ${YUMUSATMALAR.join(", ")})`);
    anahtarlar.push({ t: a.t, deger: a.deger, yumusatma: (a.yumusatma as Yumusatma | undefined) ?? "dogrusal" });
  }
  return { ok: true, deger: { uzuv, kanal, anahtarlar } };
}

/**
 * Gelen klip GÜVENİLMEZ girdidir (elle yazılmış dosya, ileride Orion'un önerisi): biçimi doğrular ve TEMİZ bir kopya döner (bilinmeyen alanlar atılır,
 * yumuşatma doldurulur). Hata metni neyin nerede bozuk olduğunu ve geçerli seçenekleri söyler (model/Ozyn kendini düzeltebilsin).
 */
export function klipDogrula(ham: unknown): Sonuc<AnimasyonKlibi> {
  if (!nesneMi(ham)) return hata("klip nesne olmalı");
  if (ham.surum !== KLIP_SURUMU) return hata(`surum ${KLIP_SURUMU} olmalı (gelen: ${String(ham.surum)})`);
  if (!klipAdiGecerli(ham.ad)) return hata(`ad geçersiz: ${JSON.stringify(ham.ad)} (küçük harf, rakam ve _; en çok ${KLIP_SINIRLARI.ad})`);
  if (ham.aciklama !== undefined && (typeof ham.aciklama !== "string" || ham.aciklama.length > KLIP_SINIRLARI.aciklama)) return hata(`aciklama metin olmalı (en çok ${KLIP_SINIRLARI.aciklama})`);
  if (!JESTLER.includes(ham.jest as Jest)) return hata(`jest geçersiz: ${JSON.stringify(ham.jest)} (klibin anlamı; geçerli: ${JESTLER.join(", ")})`);
  if (!sonlu(ham.sure)) return hata("sure: sonlu sayı olmalı (saniye)");
  if (ham.sure <= 0 || ham.sure > KLIP_SINIRLARI.sure) return hata(`sure: ${ham.sure} aralık dışı (0'dan büyük, en çok ${KLIP_SINIRLARI.sure} sn)`);
  if (ham.dongu !== undefined && typeof ham.dongu !== "boolean") return hata("dongu: true/false olmalı");
  if (!Array.isArray(ham.izler) || ham.izler.length === 0) return hata("izler: en az bir iz olan dizi olmalı");
  if (ham.izler.length > KLIP_SINIRLARI.iz) return hata(`izler: en çok ${KLIP_SINIRLARI.iz} iz (gelen ${ham.izler.length})`);
  const izler: KlipIzi[] = [];
  const gorulen = new Set<string>();
  for (const [i, v] of ham.izler.entries()) {
    const r = izDogrula(v, `izler[${i}]`, ham.sure);
    if (!r.ok) return r;
    // Aynı uzuv+kanal iki kez: hangisinin kazanacağı sırayla belirlenirdi (sessiz ezme). Biçim reddeder.
    const anahtar = `${r.deger.uzuv}.${r.deger.kanal}`;
    if (gorulen.has(anahtar)) return hata(`izler[${i}]: '${anahtar}' iki kez (bir uzvun bir kanalı tek izdir)`);
    gorulen.add(anahtar);
    izler.push(r.deger);
  }
  return {
    ok: true,
    deger: {
      surum: KLIP_SURUMU, ad: ham.ad,
      ...(typeof ham.aciklama === "string" ? { aciklama: ham.aciklama } : {}),
      jest: ham.jest as Jest, sure: ham.sure, dongu: ham.dongu === true, izler,
    },
  };
}

export function klipOzeti(k: AnimasyonKlibi): KlipOzeti {
  const uzuvlar: Uzuv[] = [];
  for (const iz of k.izler) if (!uzuvlar.includes(iz.uzuv)) uzuvlar.push(iz.uzuv);
  return { ad: k.ad, ...(k.aciklama !== undefined ? { aciklama: k.aciklama } : {}), jest: k.jest, sure: k.sure, dongu: k.dongu, uzuvlar };
}
