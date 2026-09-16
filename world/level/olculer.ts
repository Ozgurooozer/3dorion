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
import type { CapaAdi } from "../../protocol/temel.ts";

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

// ── ZİHİN DUVARI (sağ duvar, normal -X) ───────────────────────────────────
//
// Orion'un kendi işleyişi odada GÖRÜNÜR olsun diye. Şimdiye kadar beynin ne
// yaptığı yalnızca tarayıcı konsolunda vardı — yani dünyanın dışında. Kota
// arızası bunu acı biçimde gösterdi: Orion 75 sn boyunca hiçbir şey yapmadı
// ve odada sebebi görünmüyordu.
//
// İki panel, salt okunur: SEMA (akış şeması, canlı) ve GUNLUK (olay akışı).
// Sağ duvar boştu; sol duvarda tahta ve raf var.

/** Panellerin duvardan ayrık durduğu mesafe — ışın önce paneli vursun. */
const ZIHIN_X = ODA.genislik / 2 - 0.06;

export const SEMA = {
  x: ZIHIN_X, y: 1.72, z: 1.35,
  /** Genişlik Z ekseni boyunca (duvar normali -X). */
  genislik: 2.4, yukseklik: 1.35,
} as const;

export const GUNLUK = {
  x: ZIHIN_X, y: 1.72, z: -1.35,
  genislik: 2.4, yukseklik: 1.35,
} as const;

// ── ADMIN TERMİNALİ ───────────────────────────────────────────────────────
//
// Masadaki İKİNCİ monitör. Ayrı olmak zorunda: `MONITOR` Ozyn'in çalıştığı ve
// ORION'UN İZLEDİĞİ ekrandır. Yönetim işi (dünyayı yeniden başlatmak, günlüğe
// bakmak) Orion'un algısına gürültü olarak düşmemeli.
//
// Masanın sağ ucuna sığdırıldı: masa x ∈ [-1.3, 1.3], ana monitör [-0.53, 0.53].
export const ADMIN = {
  x: 0.9,
  y: MASA.ustYuzey + 0.34,
  z: MASA.z - 0.14,
  genislik: 0.74, yukseklik: 0.44,
  /** İçe dönük açı (radyan): Ozyn'e baksın, duvara değil. */
  aciY: -0.42,
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

// ── Katı yüzeyler: ışın okluzyonu ─────────────────────────────────────────
// `ENGELLER` yalnızca YÜRÜME engelidir (XZ, duvarlar hariç). Bakış ışını ise
// duvar/tavan/zemin dahil odanın TÜM katı yüzeylerini görmek zorundadır: aksi
// hâlde oyuncu duvarın arkasından monitöre `E` basar. Bu liste `oda.ts`'nin
// ürettiği mesh'lerin ışın amaçlı basitleştirilmiş (AABB) ikizidir.

/** Işın testinde bir katı yüzey. `capa` null ise etkileşimsizdir (duvar, zemin). */
export interface KatiYuzey {
  kutu: Kutu;
  /** Bu yüzeye bakmak hangi çapayı önerir; null = hiçbiri. */
  capa: CapaAdi | null;
}

const _G = ODA.genislik, _D = ODA.derinlik, _Y = ODA.yukseklik, _K = ODA.duvarKalinlik;

/**
 * Odanın ışın-geçirmez yüzeyleri. Sıra anlamsız — `isinTara` en yakın
 * isabeti seçer.
 *
 * Arka duvar TEK parça modellenir (oda.ts'te dört parçadır): pencere boşluğunu
 * `pencere` paneli tam olarak kapladığı ve panelin duvardan 0.04 m ÖNDE
 * durduğu için ışın her koşulda paneli önce vurur. Davranış birebir aynı,
 * yüzey sayısı üç az.
 */
export const KATI_YUZEYLER: readonly KatiYuzey[] = [
  // Kabuk — etkileşimsiz
  { capa: null, kutu: { x: -_G / 2 - _K / 2, y: _Y / 2, z: 0, g: _K, yuk: _Y, d: _D } },        // sol duvar
  { capa: null, kutu: { x:  _G / 2 + _K / 2, y: _Y / 2, z: 0, g: _K, yuk: _Y, d: _D } },        // sağ duvar
  { capa: null, kutu: { x: 0, y: _Y / 2, z: -_D / 2 - _K / 2, g: _G + _K * 2, yuk: _Y, d: _K } }, // arka duvar
  { capa: null, kutu: { x: 0, y: _Y / 2, z:  _D / 2 + _K / 2, g: _G + _K * 2, yuk: _Y, d: _K } }, // ön duvar
  { capa: null, kutu: { x: 0, y: _Y + _K / 2, z: 0, g: _G + _K * 2, yuk: _K, d: _D + _K * 2 } },  // tavan
  { capa: null, kutu: { x: 0, y: -0.01, z: 0, g: _G, yuk: 0.02, d: _D } },                        // zemin
  // Etkileşimsiz dekor — ama ışını DURDURUR
  { capa: null, kutu: { x: -_G / 2 + 0.22, y: 0.9, z: 2.4, g: 0.44, yuk: 1.8, d: 1.8 } },        // raf
  // Etkileşimli yüzeyler
  { capa: "masa", kutu: { x: MASA.x, y: MASA.ustYuzey / 2, z: MASA.z, g: MASA.genislik, yuk: MASA.ustYuzey, d: MASA.derinlik } },
  { capa: "sandalye", kutu: { x: SANDALYE.x, y: 0.45, z: SANDALYE.z, g: SANDALYE.genislik, yuk: 0.9, d: SANDALYE.derinlik } },
  { capa: "monitor", kutu: { x: MONITOR.x, y: MONITOR.y, z: MONITOR.z, g: MONITOR.genislik, yuk: MONITOR.yukseklik, d: 0.06 } },
  { capa: "tahta", kutu: { x: TAHTA.x, y: TAHTA.y, z: TAHTA.z, g: 0.06, yuk: TAHTA.yukseklik, d: TAHTA.genislik } },
  { capa: "pencere", kutu: { x: PENCERE.x, y: PENCERE.y, z: PENCERE.z, g: PENCERE.genislik, yuk: PENCERE.yukseklik, d: 0.06 } },
  { capa: "kapi", kutu: { x: KAPI.x, y: KAPI.y, z: KAPI.z, g: KAPI.genislik, yuk: KAPI.yukseklik, d: 0.06 } },
  // Zihin duvarı — genişlik Z ekseninde, kalınlık X ekseninde (duvar normali -X).
  { capa: "sema", kutu: { x: SEMA.x, y: SEMA.y, z: SEMA.z, g: 0.06, yuk: SEMA.yukseklik, d: SEMA.genislik } },
  { capa: "gunluk", kutu: { x: GUNLUK.x, y: GUNLUK.y, z: GUNLUK.z, g: 0.06, yuk: GUNLUK.yukseklik, d: GUNLUK.genislik } },
  // Yönetim terminali — masadaki ikinci monitör. Açılı duruyor ama ışın ikizi
  // AABB: birkaç derecelik dönüş için ayrı bir dönük kutu testi yazmaya değmez.
  { capa: "admin", kutu: { x: ADMIN.x, y: ADMIN.y, z: ADMIN.z, g: ADMIN.genislik, yuk: ADMIN.yukseklik, d: 0.06 } },
] as const;
