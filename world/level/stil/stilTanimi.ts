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

export interface StilAyari { isik: IsikStili; cizgi: CizgiStili; renk: RenkStili }

const KAPALI: StilAyari = {
  isik: { acik: false, bant: 3, yumusaklik: 0.02, enKoyu: 0.35, golgeRengi: "#4b4f8f", golgeKarisim: 0, parlama: 0, parlamaBoyu: 32, kenarIsik: 0, kenarEsik: 0.72, tarama: 0 },
  cizgi: { acik: false, kip: 0, kalinlik: 1, derinlikEsik: 0.08, normalEsik: 0.4, renk: "#1d1a2e", guc: 0.8, vurgu: 0, titreme: 0, uzaklik: 220 },
  renk: { acik: false, palet: 0, titreme: 0, posterize: 0, doygunluk: 1, gren: 0 },
};

interface Onayar { aciklama: string; piksel: number; stil: StilAyari }
const ile = (d: { isik?: Partial<IsikStili>; cizgi?: Partial<CizgiStili>; renk?: Partial<RenkStili> }): StilAyari => ({
  isik: { ...KAPALI.isik, ...d.isik }, cizgi: { ...KAPALI.cizgi, ...d.cizgi }, renk: { ...KAPALI.renk, ...d.renk },
});

/** Önayarlar (G tuşu bu sırayla döner). Kaynaklar: docs/arastirma/stil-shaderlari.md. */
export const ONAYARLAR: Readonly<Record<string, Onayar>> = {
  standart: { aciklama: "Bugünkü ışık (stil kapalı).", piksel: 1, stil: KAPALI },
  cel: {
    aciklama: "Cel (Catuhe / Babylon CellMaterial): ışık 5 basamak, çizgisiz.", piksel: 1,
    stil: ile({ isik: { acik: true, bant: 5, yumusaklik: 0.01, enKoyu: 0.2 } }),
  },
  toon: {
    aciklama: "Toon (Roystan / BotW): iki ton, renkli gölge, eşikli parlama ve kenar ışığı, ince çizgi.", piksel: 1,
    stil: ile({
      isik: { acik: true, bant: 2, yumusaklik: 0.03, enKoyu: 0.5, golgeRengi: "#6b72c4", golgeKarisim: 0.45, parlama: 0.35, parlamaBoyu: 24, kenarIsik: 0.3, kenarEsik: 0.72 },
      cizgi: { acik: true, kip: 0, kalinlik: 1, guc: 0.45, renk: "#2a2f45" },
    }),
  },
  anime90: {
    aciklama: "90'lar anime: sert iki ton, mavi-mor gölge, kalın çizgi, posterize, gren.", piksel: 1,
    stil: ile({
      isik: { acik: true, bant: 2, yumusaklik: 0, enKoyu: 0.38, golgeRengi: "#4b3f8f", golgeKarisim: 0.85, parlama: 0.25, parlamaBoyu: 12 },
      cizgi: { acik: true, kip: 0, kalinlik: 2, guc: 0.95, renk: "#1d1a2e", normalEsik: 0.3 },
      renk: { acik: true, posterize: 7, doygunluk: 1.2, gren: 0.05 },
    }),
  },
  moebius: {
    aciklama: "Moebius (Heckel): düz renk, gölgede tarama, titrek mürekkep çizgisi.", piksel: 1,
    stil: ile({
      isik: { acik: true, bant: 3, yumusaklik: 0, enKoyu: 0.6, golgeRengi: "#7a6a5a", golgeKarisim: 0.2, tarama: 0.85 },
      cizgi: { acik: true, kip: 0, kalinlik: 1.5, guc: 1, renk: "#16140f", titreme: 1.5 },
      renk: { acik: true, doygunluk: 0.85 },
    }),
  },
  piksel: {
    aciklama: "Piksel-sanat (t3ssel8r): düşük çözünürlük, 3 ton, 1 px dış çizgi + iç vurgu, palete yuvarlama, Bayer.", piksel: 3,
    stil: ile({
      isik: { acik: true, bant: 3, yumusaklik: 0, enKoyu: 0.42, golgeRengi: "#3d4a7a", golgeKarisim: 0.55 },
      cizgi: { acik: true, kip: 1, kalinlik: 1, guc: 0.55, vurgu: 0.45, renk: "#262236", derinlikEsik: 0.06 },
      renk: { acik: true, palet: 0.85, titreme: 0.15 },
    }),
  },
};
export const ONAYAR_ADLARI = Object.keys(ONAYARLAR);
export const VARSAYILAN_STIL: StilAyari = KAPALI;

/** Önayarı tanıma uygular (stil + piksel boyu); tanımın kopyasını döndürür. */
export function onayarUygula(t: LevelTanimi, ad: string): LevelTanimi {
  const o = ONAYARLAR[ad];
  if (!o) throw new Error(`bilinmeyen stil önayarı "${ad}" (bilinenler: ${ONAYAR_ADLARI.join(", ")})`);
  return { ...t, stil: structuredClone(o.stil), ortam: { ...t.ortam, piksel: o.piksel } };
}

/** Tanımın stili hangi önayara birebir eşit (yoksa "özel"). */
export function onayarAdi(t: LevelTanimi): string {
  const s = JSON.stringify(t.stil ?? KAPALI), p = t.ortam.piksel ?? 1;
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

/**
 * Stil bölümünün ilk hatası (yoksa null). Biçim KAPALI ile aynı olmalı: eksik/fazla alan ya da yanlış tür hata
 * (yazım hatası sessiz geçmesin). Renk alanları `renkMi` ile denetlenir.
 */
export function stilHatasi(v: unknown, renkMi: (r: unknown) => boolean): string | null {
  if (!nesneMi(v)) return "stil: nesne değil";
  for (const bolum of ["isik", "cizgi", "renk"] as const) {
    const ornek: Record<string, unknown> = Object.fromEntries(Object.entries(KAPALI[bolum])), deger = v[bolum];
    if (!nesneMi(deger)) return `stil.${bolum}: nesne değil`;
    for (const k of Object.keys(deger)) if (!(k in ornek)) return `stil.${bolum}.${k}: bilinmeyen alan`;
    for (const [k, o] of Object.entries(ornek)) {
      const x = deger[k];
      if (typeof o === "string" ? !renkMi(x) : typeof x !== typeof o || (typeof x === "number" && !Number.isFinite(x))) {
        return `stil.${bolum}.${k}: ${typeof o === "string" ? "renk" : typeof o} olmalı`;
      }
    }
  }
  for (const k of Object.keys(v)) if (!["isik", "cizgi", "renk"].includes(k)) return `stil.${k}: bilinmeyen bölüm`;
  return null;
}
