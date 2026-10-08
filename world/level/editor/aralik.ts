// world/level/editor/aralik.ts — Panelde bir sayı alanının kaydırıcı aralığı ve alanların okunur etiketi. Saf.
//
// Aralık önce MODÜLDEN gelir (`LevelModulu.aralik`: o modül kendi ayarının anlamlı sınırını bilir), sonra
// ışık/ortam için buradaki tablodan; ikisi de yoksa değerden türetilir (0 … değerin 3 katı). Kaydırıcının
// dışına sayı kutusuyla yine çıkılabilir — aralık bir öneri, kilit değil.
"use strict";
import type { Yol } from "./alanlar.ts";

export interface Aralik { min: number; max: number; adim: number }

/** Işık ve ortam alanlarının aralıkları (yolun son iki parçasıyla eşleşir). */
const SABIT: Readonly<Record<string, Aralik>> = {
  "gunes.siddet": { min: 0, max: 4, adim: 0.05 },
  "gunes.yon": { min: -1, max: 1, adim: 0.01 },
  "golge.boyut": { min: 512, max: 4096, adim: 512 },
  "golge.kademe": { min: 1, max: 4, adim: 1 },
  "golge.uzaklik": { min: 10, max: 400, adim: 5 },
  "golge.yumusaklik": { min: 0, max: 1, adim: 0.05 },
  "golge.koyuluk": { min: 0, max: 1, adim: 0.01 },
  "dolgu.siddet": { min: 0, max: 2, adim: 0.01 },
  "sis.yogunluk": { min: 0, max: 0.03, adim: 0.0002 },
  "tonlama.pozlama": { min: 0.2, max: 3, adim: 0.01 },
  "tonlama.kontrast": { min: 0.5, max: 2.5, adim: 0.01 },
  "kamera.uzak": { min: 100, max: 3000, adim: 50 },
  "ortam.piksel": { min: 1, max: 8, adim: 1 },
  // stil (spec 18)
  "isik.bant": { min: 1, max: 6, adim: 1 },
  "isik.yumusaklik": { min: 0, max: 0.3, adim: 0.005 },
  "isik.enKoyu": { min: 0, max: 1, adim: 0.01 },
  "isik.golgeKarisim": { min: 0, max: 1, adim: 0.01 },
  "isik.parlama": { min: 0, max: 1, adim: 0.01 },
  "isik.parlamaBoyu": { min: 1, max: 128, adim: 1 },
  "isik.kenarIsik": { min: 0, max: 1, adim: 0.01 },
  "isik.kenarEsik": { min: 0, max: 1, adim: 0.01 },
  "isik.tarama": { min: 0, max: 1, adim: 0.01 },
  "cizgi.kip": { min: 0, max: 1, adim: 1 },
  "cizgi.kalinlik": { min: 0.5, max: 4, adim: 0.25 },
  "cizgi.derinlikEsik": { min: 0, max: 1, adim: 0.005 },
  "cizgi.normalEsik": { min: 0, max: 2, adim: 0.01 },
  "cizgi.guc": { min: 0, max: 1, adim: 0.01 },
  "cizgi.vurgu": { min: 0, max: 1, adim: 0.01 },
  "cizgi.titreme": { min: 0, max: 4, adim: 0.1 },
  "cizgi.uzaklik": { min: 10, max: 600, adim: 5 },
  "renk.palet": { min: 0, max: 1, adim: 0.01 },
  "renk.titreme": { min: 0, max: 1, adim: 0.01 },
  "renk.posterize": { min: 0, max: 16, adim: 1 },
  "renk.doygunluk": { min: 0, max: 2, adim: 0.01 },
  "renk.gren": { min: 0, max: 0.3, adim: 0.005 },
};

/** Değerden türetilen yedek aralık. */
export function turetilmisAralik(v: number): Aralik {
  if (Number.isInteger(v)) return { min: 0, max: Math.max(10, v * 3), adim: 1 };
  const b = Math.abs(v) || 1;
  const adim = b >= 10 ? 0.5 : b >= 1 ? 0.05 : b >= 0.1 ? 0.01 : 0.001;
  return { min: Math.min(0, v * 3), max: Math.max(1, b * 3), adim };
}

/**
 * Sayı alanının aralığı. `modul` = o katmanın modülünün aralık tablosu (anahtar → aralık), varsa önce o.
 * Dizi elemanı (yon[0]) dizinin aralığını alır.
 */
export function aralikBul(yol: Yol, deger: number, modul?: Readonly<Record<string, Aralik>>): Aralik {
  const anahtarlar = yol.filter((p): p is string => typeof p === "string");
  const son = anahtarlar.at(-1) ?? "";
  if (modul?.[son]) return modul[son];
  const iki = anahtarlar.slice(-2).join(".");
  return SABIT[iki] ?? turetilmisAralik(deger);
}

/** Alan adlarının Türkçe okunur hâli; bilinmeyen ad camelCase'ten ayrıştırılır. */
const ETIKET: Readonly<Record<string, string>> = {
  siddet: "şiddet", yon: "yön", renk: "renk", golge: "gölge", acik: "açık", boyut: "çözünürlük", kademe: "kademe",
  uzaklik: "uzaklık", yumusaklik: "yumuşaklık", koyuluk: "koyuluk", dolgu: "gök dolgusu", ust: "üst", alt: "alt",
  arkaPlan: "arka plan", sis: "sis", yogunluk: "yoğunluk", tonlama: "ton eşleme", pozlama: "pozlama",
  kontrast: "kontrast", kamera: "kamera", piksel: "piksel boyu", stil: "stil", enKoyu: "en koyu ton",
  golgeRengi: "gölge tonu", golgeKarisim: "gölge tonu karışımı", parlama: "parlama", parlamaBoyu: "parlama sıkılığı",
  kenarIsik: "kenar ışığı", kenarEsik: "kenar ışığı eşiği", tarama: "tarama", cizgi: "çizgi", kip: "kip (0 Sobel · 1 t3ssel8r)",
  kalinlik: "kalınlık (px)", derinlikEsik: "derinlik eşiği", normalEsik: "normal eşiği", guc: "güç", vurgu: "iç vurgu",
  titreme: "titreme", posterize: "posterize", doygunluk: "doygunluk", gren: "gren", gunes: "güneş", yaricap: "yarıçap", dilim: "dilim", bant: "bant",
  ufuk: "ufuk", orta: "orta", zenit: "zenit", ortaKonum: "orta konum", kenar: "kenar", sayi: "sayı", tohum: "tohum",
  topakMin: "topak (en az)", topakMax: "topak (en çok)", yukseklikMin: "yükseklik (en az)", yukseklikMax: "yükseklik (en çok)",
  uzakMin: "uzaklık (en az)", uzakMax: "uzaklık (en çok)", olcekMin: "ölçek (en az)", olcekMax: "ölçek (en çok)",
  basiklik: "basıklık", donus: "dönüş hızı", bolum: "bölüm", tepeYukseklik: "tepe yüksekliği", tepeOlcek: "tepe ölçeği",
  duzYaricap: "düz alan yarıçapı", lekeOlcek: "leke ölçeği", renkler: "renkler", esikler: "eşikler",
  icYaricap: "iç yarıçap", disYaricap: "dış yarıçap", boyMin: "boy (en az)", boyMax: "boy (en çok)", bozma: "bozma", koyu: "koyu renk",
};

export function etiket(anahtar: string | number): string {
  if (typeof anahtar === "number") return String(anahtar);
  return ETIKET[anahtar] ?? anahtar.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}
