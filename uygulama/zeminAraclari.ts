// uygulama/zeminAraclari.ts — ZEMİN KALEMİ ARAÇ TABLOSU ve ayar sınırları (Yapı çubuğu · Zemin sekmesi). SAF (Babylon ve DOM yok).
//
// Sekme (DOM) ve kalem (Babylon) AYNI tablodan çalışır: yeni araç = tabloya bir satır (+ editörün `AraziIslemi`nde karşılığı olmalı). Güç, aracın
// birimine göre okunur: yükselt/alçalt/pürüz damga başına METRE, öteki araçlar 0–1 ORAN (editördeki "guc" anlamı; `cekirdek/araziKomutu.ts`).
"use strict";

export type ZeminAraci = "yukselt" | "alcalt" | "duzle" | "yumusat" | "puruz" | "asindir" | "sifirla";

export interface AracBilgisi {
  readonly id: ZeminAraci;
  readonly ad: string;
  readonly simge: string;
  /** Düğmenin üstünde görünen tek cümle: araç ne yapar. */
  readonly ipucu: string;
  /** Gücün birimi: damga başına metre ya da 0–1 oran. */
  readonly birim: "m" | "oran";
}

export const ZEMIN_ARACLARI: readonly AracBilgisi[] = [
  { id: "yukselt", ad: "Yükselt", simge: "⛰", ipucu: "Tepe yap (Shift basılıyken alçaltır)", birim: "m" },
  { id: "alcalt", ad: "Alçalt", simge: "🕳", ipucu: "Çukur kaz (Shift basılıyken yükseltir)", birim: "m" },
  { id: "duzle", ad: "Düzle", simge: "▭", ipucu: "İlk bastığın yüksekliğe düzle", birim: "oran" },
  { id: "yumusat", ad: "Yumuşat", simge: "〰", ipucu: "Engebeyi ve sivri yerleri yumuşat", birim: "oran" },
  { id: "puruz", ad: "Pürüz", simge: "⁂", ipucu: "Doğal engebe ekle", birim: "m" },
  { id: "asindir", ad: "Aşındır", simge: "💧", ipucu: "Dik yamaçları kaydır, doğal eğim ver", birim: "oran" },
  { id: "sifirla", ad: "Eski hâl", simge: "↺", ipucu: "Fırçanın altını level dosyasındaki ilk hâline döndür", birim: "oran" },
];

export const aracBilgisi = (id: ZeminAraci): AracBilgisi => {
  const b = ZEMIN_ARACLARI.find((x) => x.id === id);
  if (!b) throw new Error(`zemin aracı yok: ${id}`);
  return b;
};

export interface KalemAyari {
  /** Fırça yarıçapı (m). */
  yaricap: number;
  /** Güç (birim aracın birimi). */
  guc: number;
  /** Tam etkili iç bölge oranı: 0 çok yumuşak kenar, 1 keskin kenar. */
  sertlik: number;
  /** Vuruş bitince tabanı eski arazide olan nesneleri yeni araziye taşı. */
  nesneleriOturt: boolean;
}

export const KALEM_VARSAYILAN: KalemAyari = { yaricap: 6, guc: 0.25, sertlik: 0.3, nesneleriOturt: true };

export const KALEM_SINIRLARI = {
  yaricap: { min: 0.5, max: 40, adim: 0.5 },
  guc: { min: 0.02, max: 1, adim: 0.01 },
  sertlik: { min: 0, max: 1, adim: 0.05 },
} as const;

const sinirla = (v: number, s: { readonly min: number; readonly max: number }): number => Math.min(s.max, Math.max(s.min, v));
const yuvarla = (v: number, basamak: number): number => Math.round(v * 10 ** basamak) / 10 ** basamak;

/** Verilen değişikliği sınırlara oturtur (sayı olmayan/sonsuz değer HATA: sessizce 0'a düşmez). */
export function kalemAyariniDuzelt(mevcut: KalemAyari, p: Partial<KalemAyari>): KalemAyari {
  for (const k of ["yaricap", "guc", "sertlik"] as const) {
    const v = p[k];
    if (v !== undefined && !Number.isFinite(v)) throw new Error(`zemin kalemi: ${k} sayı olmalı`);
  }
  return {
    yaricap: p.yaricap === undefined ? mevcut.yaricap : yuvarla(sinirla(p.yaricap, KALEM_SINIRLARI.yaricap), 1),
    guc: p.guc === undefined ? mevcut.guc : yuvarla(sinirla(p.guc, KALEM_SINIRLARI.guc), 2),
    sertlik: p.sertlik === undefined ? mevcut.sertlik : yuvarla(sinirla(p.sertlik, KALEM_SINIRLARI.sertlik), 2),
    nesneleriOturt: p.nesneleriOturt ?? mevcut.nesneleriOturt,
  };
}

/** Ctrl+tekerlek: yarıçapı %15 büyüt/küçült (`yon` +1 büyüt, −1 küçült); sınırda kalır. */
export const yaricapAdimi = (yaricap: number, yon: 1 | -1): number =>
  yuvarla(sinirla(yaricap * (yon > 0 ? 1.15 : 1 / 1.15), KALEM_SINIRLARI.yaricap), 1);

/** Gücün okunur hâli: "0.25 m" (metre birimli araçlar) ya da "%25" (oranlılar). */
export function gucEtiketi(arac: ZeminAraci, guc: number): string {
  return aracBilgisi(arac).birim === "m" ? `${guc.toFixed(2)} m` : `%${Math.round(guc * 100)}`;
}
