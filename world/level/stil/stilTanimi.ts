// world/level/stil/stilTanimi.ts — Görsel STİL verisi: ışık bantları, çizgi, renk sonrası + ÖNAYARLAR. Saf.
//
// Stil level tanımının bir bölümüdür (`tanim.stil`): panelde görünür, Kaydet ile dosyaya gider. Önayar = bu
// bölümün hazır bir doldurulmuşu (+ piksel boyu); seçilince alanlar dolar, sonra ince ayar yapılır. Hangi
// teknik nereden: docs/arastirma/stil-shaderlari.md. Uygulayan: stil/stilSistemi.ts (ışık eklentisi, çizgi ve
// renk efektleri).
//
// Kural (modul.ts ile aynı): metin değerler RENK başvurusudur (palet adı ya da "#rrggbb"); seçim gerekiyorsa sayı.
"use strict";
import type { LevelTanimi } from "../cekirdek/levelTanimi.ts";

export interface IsikStili {
  acik: boolean;
  /** Ton sayısı (1–6): ışık bu kadar basamağa bölünür. */
  bant: number;
  /** Basamak kenarının yumuşaklığı (0 = keskin). */
  yumusaklik: number;
  /** En koyu basamağın ışık düzeyi (tam ışığa oranla). */
  enKoyu: number;
  /** Gölge tarafının TONU: karartmak yerine bu renge kaydırır (anime: mavi-mor). */
  golgeRengi: string;
  golgeKarisim: number;
  /** Eşikli parlama (Blinn) gücü ve sıkılığı; 0 = yok. */
  parlama: number;
  parlamaBoyu: number;
  /** Kenar ışığı (rim) gücü ve eşiği; 0 = yok. */
  kenarIsik: number;
  kenarEsik: number;
  /** Moebius taraması: gölgede ekran uzayı çizgileri (0 = yok). */
  tarama: number;
  /**
   * Gölge tonu ne kadar dünya paletinin O SAATTEKİ `dolgu` renginden gelsin (0 = yalnız `golgeRengi`, 1 = yalnız dolgu).
   * Işık dili (docs/arastirma/isik-dili-kararlari-2026-10-14.md): gölge tarafı gökten gelen soğuk dolgunun rengidir ve saatle
   * akar. Zaman tanımsızsa etkisiz. Sonradan eklendi: eski dosyalarda yok → 0 (`stilTamamla`); bu yüzden alan SONDA durur.
   */
  golgeDolgudan: number;
}

export interface CizgiStili {
  acik: boolean;
  /** 0 = Sobel (derinlik + normal; anime, Moebius) · 1 = t3ssel8r (koyu dış çizgi + açık iç vurgu). */
  kip: number;
  /** Örnekleme aralığı (piksel). */
  kalinlik: number;
  /** Göreli derinlik eşiği: komşu bu oranda uzaksa kenar (uzak düzlemde sahte kenar olmasın). */
  derinlikEsik: number;
  /** Normal farkı eşiği. */
  normalEsik: number;
  renk: string;
  guc: number;
  /** t3ssel8r iç kenar vurgusu (açık çizgi) gücü. */
  vurgu: number;
  /** Moebius el titremesi (piksel). */
  titreme: number;
  /** Çizginin söndüğü uzaklık (m): efekt sisten sonra gelir — uzak dağlar çizgiye boğulmasın. */
  uzaklik: number;
}

export interface RenkStili {
  acik: boolean;
  /** Level paletine yuvarlama gücü (0–1). */
  palet: number;
  /** 4×4 Bayer titremesi gücü (0–1). */
  titreme: number;
  /** Kanal başına basamak (0 = kapalı). */
  posterize: number;
  doygunluk: number;
  /** Film greni (0 = yok). */
  gren: number;
}

/**
 * IŞIK SONRASI (spec 19): Babylon'un hazır sonrası işlemleri, stile göre ayarlı. Sıra (stil/isikSonrasi.ts): sahne →
 * AO → huzme → boru hattı (bloom, alan derinliği, keskinlik, renk sapması, görüntü işleme: ton eşleme + eğri +
 * vinyet, gren) → çizgi → renk/palet. Değer aralıkları Babylon'unkiler (eğriler: ton 0–360, yoğunluk ve doygunluk
 * −100…100).
 */
export interface SonStili {
  /** 0 yok · 1 standart · 2 ACES · 3 nötr (KHR PBR Neutral: renk tonu ve doygunluğu korur). */
  tonlama: { tur: number };
  bloom: { acik: boolean; esik: number; guc: number; cekirdek: number; olcek: number };
  /** Güneş huzmesi (hacimsel ışık saçılması, güneş diskinden). */
  huzme: { acik: boolean; yogunluk: number; azalma: number; agirlik: number; parlaklik: number; ornek: number };
  /** Kendinden ışıklının parıltısı (güneş diski). */
  parilti: { acik: boolean; guc: number; cekirdek: number };
  /** Ortam kapanması (SSAO2): köşe, dip, temas karartısı. */
  ao: { acik: boolean; yaricap: number; guc: number; ornek: number };
  egri: {
    acik: boolean; genelTon: number; genelDoygunluk: number;
    golgeTon: number; golgeYogunluk: number; golgeDoygunluk: number;
    parlakTon: number; parlakYogunluk: number; parlakDoygunluk: number;
  };
  vinyet: { acik: boolean; guc: number; renk: string };
  gren: { acik: boolean; guc: number };
  sapma: { acik: boolean; guc: number };
  keskinlik: { acik: boolean; guc: number };
  /** Alan derinliği (minyatür görünümü): odak uzaklığı (m) ve açıklık (f sayısı; küçük = daha bulanık). */
  derinlik: { acik: boolean; odak: number; aciklik: number };
  /**
   * Küresel aydınlatma (Babylon GIRSMManager, yansıtıcı gölge haritası — Lumen'e en yakın yerleşik araç): güneş ışığı
   * bir kez seker, yüzeyler komşularını kendi renginde aydınlatır. Kameranın çevresindeki `alan` (m) içinde hesaplanır.
   */
  gi: { acik: boolean; guc: number; yaricap: number; ornek: number; alan: number };
}

export interface StilAyari { isik: IsikStili; cizgi: CizgiStili; renk: RenkStili; son: SonStili }

const KAPALI: StilAyari = {
  isik: { acik: false, bant: 3, yumusaklik: 0.02, enKoyu: 0.35, golgeRengi: "#4b4f8f", golgeKarisim: 0, parlama: 0, parlamaBoyu: 32, kenarIsik: 0, kenarEsik: 0.72, tarama: 0, golgeDolgudan: 0 },
  cizgi: { acik: false, kip: 0, kalinlik: 1, derinlikEsik: 0.08, normalEsik: 0.4, renk: "#1d1a2e", guc: 0.8, vurgu: 0, titreme: 0, uzaklik: 220 },
  renk: { acik: false, palet: 0, titreme: 0, posterize: 0, doygunluk: 1, gren: 0 },
  son: {
    // Ton eşleme ACES: spec 17'den beri görünüm buydu (standart önayar değişmesin).
    tonlama: { tur: 2 },
    bloom: { acik: false, esik: 0.8, guc: 0.3, cekirdek: 64, olcek: 0.5 },
    huzme: { acik: false, yogunluk: 0.93, azalma: 0.965, agirlik: 0.5, parlaklik: 0.25, ornek: 80 },
    parilti: { acik: false, guc: 0.8, cekirdek: 48 },
    ao: { acik: false, yaricap: 2, guc: 1, ornek: 16 },
    egri: { acik: false, genelTon: 30, genelDoygunluk: 0, golgeTon: 230, golgeYogunluk: 0, golgeDoygunluk: 0, parlakTon: 40, parlakYogunluk: 0, parlakDoygunluk: 0 },
    vinyet: { acik: false, guc: 1.5, renk: "#1d1a2e" },
    gren: { acik: false, guc: 10 },
    sapma: { acik: false, guc: 20 },
    keskinlik: { acik: false, guc: 0.3 },
    derinlik: { acik: false, odak: 20, aciklik: 2 },
    // Ölçüldü (spec 19): güç 10 + yarıçap 0,05 → "yalnız GI" ortalama 9,6/255, bina dipleri ve gölgeli yüzler
    // seken ışıkla belirgin; güç 1–3 neredeyse görünmez (ortalama ≤ 3).
    gi: { acik: false, guc: 10, yaricap: 0.05, ornek: 400, alan: 90 },
  },
};

interface Onayar { aciklama: string; piksel: number; stil: StilAyari }
type SonParcasi = { [G in keyof SonStili]?: Partial<SonStili[G]> };
const sonIle = (d: SonParcasi = {}): SonStili => {
  const k = KAPALI.son;
  return {
    tonlama: { ...k.tonlama, ...d.tonlama }, bloom: { ...k.bloom, ...d.bloom }, huzme: { ...k.huzme, ...d.huzme },
    parilti: { ...k.parilti, ...d.parilti }, ao: { ...k.ao, ...d.ao }, egri: { ...k.egri, ...d.egri },
    vinyet: { ...k.vinyet, ...d.vinyet }, gren: { ...k.gren, ...d.gren }, sapma: { ...k.sapma, ...d.sapma },
    keskinlik: { ...k.keskinlik, ...d.keskinlik }, derinlik: { ...k.derinlik, ...d.derinlik }, gi: { ...k.gi, ...d.gi },
  };
};
const ile = (d: { isik?: Partial<IsikStili>; cizgi?: Partial<CizgiStili>; renk?: Partial<RenkStili>; son?: SonParcasi }): StilAyari => ({
  isik: { ...KAPALI.isik, ...d.isik }, cizgi: { ...KAPALI.cizgi, ...d.cizgi }, renk: { ...KAPALI.renk, ...d.renk }, son: sonIle(d.son),
});

/** Önayarlar (G tuşu bu sırayla döner). Kaynaklar: docs/arastirma/stil-shaderlari.md. */
export const ONAYARLAR: Readonly<Record<string, Onayar>> = {
  standart: { aciklama: "Bugünkü ışık (stil kapalı).", piksel: 1, stil: KAPALI },
  cel: {
    aciklama: "Cel (Catuhe / Babylon CellMaterial): ışık 5 basamak, çizgisiz.", piksel: 1,
    stil: ile({
      isik: { acik: true, bant: 5, yumusaklik: 0.01, enKoyu: 0.2 },
      son: { tonlama: { tur: 3 }, ao: { acik: true, yaricap: 2, guc: 1.1 }, egri: { acik: true, genelDoygunluk: 12 }, gi: { acik: true } },
    }),
  },
  toon: {
    aciklama: "Toon (Roystan / BotW): iki ton, gölge saatin gök dolgusu renginde, eşikli parlama ve kenar ışığı, ince çizgi.", piksel: 1,
    stil: ile({
      // golgeDolgudan 1: gölge tonu paletin saatteki dolgusu (ışık dili adım 1, docs/olcum/on-kayit-isik-dili-1.md); zaman
      // tanımsız level'da `golgeRengi` kalır.
      isik: { acik: true, bant: 2, yumusaklik: 0.03, enKoyu: 0.5, golgeRengi: "#6b72c4", golgeKarisim: 0.45, parlama: 0.35, parlamaBoyu: 24, kenarIsik: 0.3, kenarEsik: 0.72, golgeDolgudan: 1 },
      cizgi: { acik: true, kip: 0, kalinlik: 1, guc: 0.45, renk: "#2a2f45" },
      son: {
        tonlama: { tur: 3 }, bloom: { acik: true, esik: 0.75, guc: 0.35 }, huzme: { acik: true }, parilti: { acik: true }, gi: { acik: true },
        egri: { acik: true, genelDoygunluk: 10, golgeTon: 235, golgeYogunluk: 35, golgeDoygunluk: 20, parlakTon: 45, parlakYogunluk: 25 },
        vinyet: { acik: true, guc: 0.8, renk: "#2a2f45" },
      },
    }),
  },
  anime90: {
    aciklama: "90'lar anime: sert iki ton, mavi-mor gölge, kalın çizgi, posterize, gren.", piksel: 1,
    stil: ile({
      isik: { acik: true, bant: 2, yumusaklik: 0, enKoyu: 0.38, golgeRengi: "#4b3f8f", golgeKarisim: 0.85, parlama: 0.25, parlamaBoyu: 12 },
      cizgi: { acik: true, kip: 0, kalinlik: 2, guc: 0.95, renk: "#1d1a2e", normalEsik: 0.3 },
      renk: { acik: true, posterize: 7, doygunluk: 1.2, gren: 0.05 },
      son: {
        tonlama: { tur: 3 }, bloom: { acik: true, esik: 0.6, guc: 0.6, cekirdek: 96 }, parilti: { acik: true, guc: 1.2 }, gi: { acik: true, guc: 14 },
        egri: { acik: true, genelDoygunluk: 25, golgeTon: 250, golgeYogunluk: 55, golgeDoygunluk: 30, parlakTon: 35, parlakYogunluk: 20 },
        vinyet: { acik: true, guc: 2, renk: "#1d1a2e" }, sapma: { acik: true, guc: 18 }, keskinlik: { acik: true, guc: 0.3 },
      },
    }),
  },
  moebius: {
    aciklama: "Moebius (Heckel): düz renk, gölgede tarama, titrek mürekkep çizgisi.", piksel: 1,
    stil: ile({
      isik: { acik: true, bant: 3, yumusaklik: 0, enKoyu: 0.6, golgeRengi: "#7a6a5a", golgeKarisim: 0.2, tarama: 0.85 },
      cizgi: { acik: true, kip: 0, kalinlik: 1.5, guc: 1, renk: "#16140f", titreme: 1.5 },
      renk: { acik: true, doygunluk: 0.85 },
      son: { tonlama: { tur: 0 }, ao: { acik: true, yaricap: 2.5, guc: 1.3 }, egri: { acik: true, genelDoygunluk: -20, parlakTon: 45, parlakYogunluk: 15 } },
    }),
  },
  piksel: {
    aciklama: "Piksel-sanat (t3ssel8r): düşük çözünürlük, 3 ton, 1 px dış çizgi + iç vurgu, palete yuvarlama, Bayer.", piksel: 3,
    stil: ile({
      isik: { acik: true, bant: 3, yumusaklik: 0, enKoyu: 0.42, golgeRengi: "#3d4a7a", golgeKarisim: 0.55 },
      cizgi: { acik: true, kip: 1, kalinlik: 1, guc: 0.55, vurgu: 0.45, renk: "#262236", derinlikEsik: 0.06 },
      renk: { acik: true, palet: 0.85, titreme: 0.15 },
      // Bloom ve alan derinliği YOK: pikseli bulandırır (stilSistemi piksel kipinde zaten kapatır).
      son: { tonlama: { tur: 3 }, ao: { acik: true, yaricap: 1.5, guc: 1 }, egri: { acik: true, genelDoygunluk: 8, golgeTon: 240, golgeYogunluk: 35, golgeDoygunluk: 15 } },
    }),
  },
};
export const ONAYAR_ADLARI = Object.keys(ONAYARLAR);
export const VARSAYILAN_STIL: StilAyari = KAPALI;

/**
 * Eksik `son` bölümünü ya da sonradan eklenen grupları (ör. `gi`) kapalı değerlerle tamamlar: eski dosyalar
 * açılır ve aynı görünür. Var olan grup olduğu gibi kalır (içindeki yazım hatası doğrulamada yakalanır).
 */
function sonTamamla(son: unknown): SonStili {
  const v = (nesneMi(son) ? son : {}) as Partial<SonStili>;
  return { ...structuredClone(KAPALI.son), ...v };
}
/**
 * Sonradan eklenen ışık alanını (`golgeDolgudan`) kapalı değerle tamamlar: eski dosyalar açılır ve aynı görünür. Alan SONA
 * eklenir (KAPALI'daki sırayla): `onayarAdi` JSON metnini karşılaştırır, sıra kayarsa "standart" bile "özel" görünürdü.
 */
function isikTamamla(isik: unknown): unknown {
  if (!nesneMi(isik) || "golgeDolgudan" in isik) return isik;
  return { ...isik, golgeDolgudan: KAPALI.isik.golgeDolgudan };
}
export function stilTamamla(s: StilAyari | undefined): StilAyari {
  if (!s) return structuredClone(KAPALI);
  return { ...s, isik: isikTamamla(s.isik) as IsikStili, son: sonTamamla(s.son) };
}

/** Önayarı tanıma uygular (stil + piksel boyu); tanımın kopyasını döndürür. */
export function onayarUygula(t: LevelTanimi, ad: string): LevelTanimi {
  const o = ONAYARLAR[ad];
  if (!o) throw new Error(`bilinmeyen stil önayarı "${ad}" (bilinenler: ${ONAYAR_ADLARI.join(", ")})`);
  return { ...t, stil: structuredClone(o.stil), ortam: { ...t.ortam, piksel: o.piksel } };
}

/** Tanımın stili hangi önayara birebir eşit (yoksa "özel"). */
export function onayarAdi(t: LevelTanimi): string {
  const s = JSON.stringify(stilTamamla(t.stil)), p = t.ortam.piksel ?? 1;
  return ONAYAR_ADLARI.find((ad) => JSON.stringify(ONAYARLAR[ad]!.stil) === s && ONAYARLAR[ad]!.piksel === p) ?? "özel";
}

/** Renk düzenleri: paletin gök/ışık renklerini değiştirir (Ozyn'in pastel gün batımı görseli). */
export const PALET_DUZENLERI: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  gunduz: { gokZenit: "#2c63c9", gokOrta: "#5d93e0", gokUfuk: "#b7d3ee", gunes: "#fff3cf", bulut: "#ffffff", bulutGolge: "#b9c7dd" },
  pastel: { gokZenit: "#5b4a9e", gokOrta: "#a77bc4", gokUfuk: "#f4b3c2", gunes: "#ffe0d0", bulut: "#ffc9c2", bulutGolge: "#c08fb8" },
};
export const PALET_DUZENI_ADLARI = Object.keys(PALET_DUZENLERI);

/** Renk düzenini palete uygular (yalnız tanımda var olan adları değiştirir). */
export function paletDuzeniUygula(t: LevelTanimi, ad: string): LevelTanimi {
  const d = PALET_DUZENLERI[ad];
  if (!d) throw new Error(`bilinmeyen renk düzeni "${ad}"`);
  const palet = { ...t.palet };
  for (const [k, v] of Object.entries(d)) if (k in palet) palet[k] = v;
  return { ...t, palet };
}

/** Paletin hangi düzene uyduğu (yoksa "özel"). */
export function paletDuzeniAdi(t: LevelTanimi): string {
  return PALET_DUZENI_ADLARI.find((ad) => Object.entries(PALET_DUZENLERI[ad]!).every(([k, v]) => !(k in t.palet) || t.palet[k] === v)) ?? "özel";
}

const nesneMi = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Şablona göre biçim denetimi (özyinelemeli): eksik/fazla alan, yanlış tür, renk olmayan metin → yol + neden. */
function bicimHatasi(yol: string, sablon: unknown, v: unknown, renkMi: (r: unknown) => boolean): string | null {
  if (nesneMi(sablon)) {
    if (!nesneMi(v)) return `${yol}: nesne değil`;
    for (const k of Object.keys(v)) if (!(k in sablon)) return `${yol}.${k}: bilinmeyen alan`;
    for (const [k, o] of Object.entries(sablon)) { const h = bicimHatasi(`${yol}.${k}`, o, v[k], renkMi); if (h) return h; }
    return null;
  }
  if (typeof sablon === "string") return renkMi(v) ? null : `${yol}: renk olmalı`;
  if (typeof v !== typeof sablon || (typeof v === "number" && !Number.isFinite(v))) return `${yol}: ${typeof sablon} olmalı`;
  return null;
}

/**
 * Stil bölümünün ilk hatası (yoksa null). Biçim KAPALI ile aynı olmalı: eksik/fazla alan ya da yanlış tür hata
 * (yazım hatası sessiz geçmesin). Renk alanları `renkMi` ile denetlenir. `son` (spec 19) ve `isik.golgeDolgudan` eski
 * dosyalarda olmayabilir.
 */
export function stilHatasi(v: unknown, renkMi: (r: unknown) => boolean): string | null {
  if (!nesneMi(v)) return "stil: nesne değil";
  return bicimHatasi("stil", KAPALI, { ...v, isik: isikTamamla(v["isik"]), son: sonTamamla(v["son"]) }, renkMi);
}
