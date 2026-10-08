// world/level/ova/ovaVerisi.ts — Ova level'inin SAF verisi: palet, ölçüler, bütçe, tohumlu üretim (spec 17).
//
// Babylon'suz: test sahnesiz koşar. Görünüşü belirleyen her sayı burada — "sanat" kararı tek yerden
// değişsin, ve ileride gelecek toon/piksel shader aynı paleti okusun (renkler malzemelere buradan gider).
//
// Ova odadan BAĞIMSIZ: world/level/olculer.ts ve capalar.ts'i import etmez (oda sabitleri ovada anlamsız).
"use strict";

export type Renk = readonly [number, number, number];

/** "#rrggbb" → [0..1, 0..1, 0..1]. */
export function hex(h: string): Renk {
  const n = Number.parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * PALET — referans 1 (gündüz ova, kümülüs, altın-yeşil ot). Az renk bilerek: lowpoly ve ileride
 * piksel/toon görünüm sınırlı paletle okunur. Yeni renk eklemeden önce var olanı karıştırmayı dene.
 */
export const PALET = {
  gokZenit: hex("#2c63c9"),
  gokOrta: hex("#5d93e0"),
  gokUfuk: hex("#b7d3ee"),
  gunes: hex("#fff3cf"),
  bulut: hex("#ffffff"),
  bulutGolge: hex("#b9c7dd"),
  cimKoyu: hex("#4e6e2a"),
  cimOrta: hex("#7d9a34"),
  cimAcik: hex("#a9b544"),
  cimUc: hex("#d2c46a"),
  toprak: hex("#8b7a52"),
  kaya: hex("#9c9a96"),
  kayaKoyu: hex("#6d6c70"),
  uzakTepe: hex("#7895ad"),
} as const satisfies Record<string, Renk>;

/** Ölçüler (metre). */
export const OVA = {
  /** Zeminin yarı genişliği: sis kenarı göstermesin diye geniş. */
  zeminYaricap: 320,
  /** Zemin ızgarasının bölüm sayısı (kenar başına). Flat-shading köşeleri çoğaltır: üçgen = 2·n². */
  zeminBolum: 110,
  /** Yükseklik dalgası: hafif — "düzlük". */
  tepeYukseklik: 2.2,
  tepeOlcek: 55,
  gokYaricap: 480,
  kameraUzak: 1000,
  goz: 1.7,
  /** Güneşin yönü (güneşe doğru, birim): alçak, sıcak öğleden sonra. */
  gunesYonu: [-0.55, 0.42, -0.72] as readonly [number, number, number],
  sisYogunluk: 0.0042,
  bulutSayisi: 9,
  tohum: 1907,
} as const;

/**
 * BÜTÇE (spec 17 ön kaydı): 8 GB VRAM'in ~5 GB'ı yerel LLM'de; ova Orion'la birlikte yaşayacak.
 * Oda bütçesiyle aynı çizim tavanı (spec 11).
 */
export const BUTCE = { fps: 60, cizim: 150, vramMB: 500, glbMB: 4 } as const;

/** Tohumlu rastgele (mulberry32): aynı tohum → aynı ova; ekran görüntüleri karşılaştırılabilir kalsın. */
export function rastgele(tohum: number): () => number {
  let a = tohum >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Izgara noktasının belirleyici değeri [0,1) — değer gürültüsünün köşeleri. */
function koseDegeri(ix: number, iz: number, tohum: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(tohum, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const yumusat = (t: number) => t * t * (3 - 2 * t);

/** 2B değer gürültüsü [0,1): belirleyici, sürekli. */
export function gurultu(x: number, z: number, tohum: number = OVA.tohum): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = yumusat(x - ix), fz = yumusat(z - iz);
  const a = koseDegeri(ix, iz, tohum), b = koseDegeri(ix + 1, iz, tohum);
  const c = koseDegeri(ix, iz + 1, tohum), d = koseDegeri(ix + 1, iz + 1, tohum);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz;
}

/** Zeminin yüksekliği (m): iki oktav, merkezde (yürünen yer) sıfıra yakın, dışa doğru dalgalanır. */
export function yukseklik(x: number, z: number): number {
  const s = OVA.tepeOlcek;
  const g = 0.65 * gurultu(x / s, z / s) + 0.35 * gurultu(x / (s * 0.37), z / (s * 0.37), OVA.tohum + 7);
  const merkez = Math.min(1, Math.hypot(x, z) / 40);
  return (g - 0.5) * 2 * OVA.tepeYukseklik * (0.25 + 0.75 * merkez);
}

/** İki renk arasında doğrusal karışım. */
export function karistir(a: Renk, b: Renk, t: number): Renk {
  const k = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** Gök gradyanı: yükseklik açısının sinüsü [0..1] → ufuktan zenite renk (iki duraklı). */
export function gokRengi(sinYukseklik: number): Renk {
  const t = Math.max(0, Math.min(1, sinYukseklik));
  return t < 0.25 ? karistir(PALET.gokUfuk, PALET.gokOrta, t / 0.25)
    : karistir(PALET.gokOrta, PALET.gokZenit, (t - 0.25) / 0.75);
}

/** Zeminin bir noktadaki rengi: gürültü bantları (lowpoly'de lekeli çayır), paletten. */
export function zeminRengi(x: number, z: number): Renk {
  const g = gurultu(x / 9, z / 9, OVA.tohum + 3);
  if (g < 0.3) return PALET.cimKoyu;
  if (g < 0.62) return PALET.cimOrta;
  if (g < 0.86) return PALET.cimAcik;
  return PALET.cimUc;
}
