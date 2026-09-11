// world/level/olculer.ts — Odanın SAF VERİ tanımı. Babylon import'u YOK.
//
// Neden ayrı dosya: geometri sayıları ile mesh üretimi karışırsa oda test
// edilemez ve motor değişiminde veriyi de yeniden yazmak gerekir. Burada
// yalnızca sayı var; `oda.ts` bunu Babylon mesh'ine çevirir, `capalar.ts`
// aynı sayılardan çapa noktalarını türetir, `oyuncu.ts` çarpışma için okur.
//
// Birim: metre. Eksen: Babylon sol-elli. +Y yukarı.
// Oda yerleşimi (kuşbakışı, -Z arkada):
//
//        z=-4  ┌──── pencere ────┐  arka duvar
//              │   [masa+monitör] │
//   tahta →    │                  │   ← raf duvarı
//   (x=-5)     │    sandalye      │
//              │   oda_ortasi     │
//        z=+4  └──── kapı ────────┘  ön duvar
//              x=-5            x=+5
"use strict";

/** Bir eksen hizalı kutu (AABB). Çarpışma ve mesh üretimi aynı veriyi okur. */
export interface Kutu {
  /** Merkez. */
  x: number; y: number; z: number;
  /** Tam boyutlar (yarım değil). */
  g: number; yuk: number; d: number;
}

/** Oda kabuğu ölçüleri. */
export const ODA = {
  /** İç genişlik (X ekseni). */
  genislik: 10,
  /** İç derinlik (Z ekseni). */
  derinlik: 8,
  /** Zeminden tavana iç yükseklik. */
  yukseklik: 3.2,
  /** Duvar kalınlığı. */
  duvarKalinlik: 0.2,
} as const;

/** Oyuncunun yürüyebildiği iç sınırlar (duvar iç yüzü). */
export const SINIR = {
  minX: -ODA.genislik / 2,
  maxX:  ODA.genislik / 2,
  minZ: -ODA.derinlik / 2,
  maxZ:  ODA.derinlik / 2,
} as const;

// ── Mobilya konumları ─────────────────────────────────────────────────────
// Tek kaynak: hem mesh hem çapa hem çarpışma buradan okur.

export const MASA = {
  x: 0, z: -3.25,
  genislik: 2.6, derinlik: 0.85,
  /** Üst yüzey yüksekliği. */
  ustYuzey: 0.76,
  kalinlik: 0.06,
} as const;

export const MONITOR = {
  x: 0,
  /** Masa üstünde, ekran merkezinin yüksekliği. */
  y: MASA.ustYuzey + 0.42,
  z: MASA.z - 0.18,
  /** Ekran düzlemi boyutları (T3 bunun üstüne DynamicTexture basacak). */
  genislik: 1.06, yukseklik: 0.6,
} as const;

export const SANDALYE = {
  x: 0, z: -2.35,
  /** Oturma yüzeyi yüksekliği. */
  oturma: 0.46,
  genislik: 0.52, derinlik: 0.52,
} as const;

export const TAHTA = {
  /** Sol duvara asılı. Düzlem normali +X. */
  x: -ODA.genislik / 2 + 0.06,
  y: 1.65, z: -0.4,
  genislik: 2.8, yukseklik: 1.5,
} as const;

export const PENCERE = {
  /** Arka duvarda (z = -derinlik/2). Düzlem normali +Z. */
  x: 1.9, y: 1.75, z: -ODA.derinlik / 2 + 0.04,
  genislik: 2.6, yukseklik: 1.7,
} as const;

export const KAPI = {
  /** Ön duvarda (z = +derinlik/2). */
  x: 2.6, y: 1.05, z: ODA.derinlik / 2 - 0.04,
  genislik: 1.0, yukseklik: 2.1,
} as const;

/**
 * Çarpışma engelleri. Oyuncu bunların içine giremez.
 * Duvarlar ayrı ele alınır (bkz. SINIR) — burada yalnızca oda içi mobilya var.
 * Yükseklik bilerek yok sayılır: oyuncu kapsülü zeminde yürür, masanın
 * altından geçme senaryosu MVP'de yok. 2B (XZ) kontrolü yeter ve bedavadır.
 */
export const ENGELLER: readonly Kutu[] = [
  // Masa gövdesi (ayaklar dahil dış hacim)
  { x: MASA.x, y: MASA.ustYuzey / 2, z: MASA.z, g: MASA.genislik, yuk: MASA.ustYuzey, d: MASA.derinlik },
  // Sandalye
  { x: SANDALYE.x, y: 0.4, z: SANDALYE.z, g: SANDALYE.genislik, yuk: 0.9, d: SANDALYE.derinlik },
  // Sol duvardaki raf (dekor + engel)
  { x: -ODA.genislik / 2 + 0.22, y: 0.9, z: 2.4, g: 0.44, yuk: 1.8, d: 1.8 },
] as const;

/** Oyuncu kapsül yarıçapı — çarpışma şişirmesi bunu kullanır. */
export const OYUNCU_YARICAP = 0.32;
/** Oyuncu göz yüksekliği (1. şahıs kamera). */
export const GOZ_YUKSEKLIK = 1.62;
/** Oyuncu gövde yüksekliği. */
export const GOVDE_YUKSEKLIK = 1.75;

/**
 * Bir noktanın XZ'de engele/duvara çarpıp çarpmadığını söyler.
 * Saf fonksiyon — Babylon'suz test edilebilir.
 */
export function carpisiyorMu(x: number, z: number, yaricap = OYUNCU_YARICAP): boolean {
  if (x - yaricap < SINIR.minX || x + yaricap > SINIR.maxX) return true;
  if (z - yaricap < SINIR.minZ || z + yaricap > SINIR.maxZ) return true;
  for (const e of ENGELLER) {
    const yx = e.g / 2 + yaricap;
    const yz = e.d / 2 + yaricap;
    if (Math.abs(x - e.x) < yx && Math.abs(z - e.z) < yz) return true;
  }
  return false;
}
