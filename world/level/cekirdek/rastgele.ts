// world/level/cekirdek/rastgele.ts — Tohumlu rastgele ve değer gürültüsü. Saf, belirleyici.
//
// Aynı tohum → aynı level: ekran görüntüleri önce/sonra karşılaştırılabilir kalır, ve kayıtlı bir level
// tanımı her açılışta aynı görünür.
"use strict";

/** mulberry32: [0,1) üreten tohumlu üreteç. */
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

/**
 * `rastgele(tohum)`un `n` çekim SONRAKİ hâli (mulberry32'nin durumu her çekimde sabit kadar artar: n·sabit ileri
 * sarılır). Uzun bir dizinin ortasındaki öğeyi baştan yürümeden üretmek için (çim bölge yenilemesi, spec 22).
 */
export const rastgeleAtla = (tohum: number, n: number): (() => number) => rastgele(((tohum >>> 0) + Math.imul(n >>> 0, 0x6d2b79f5)) >>> 0);

/** Izgara noktasının belirleyici değeri [0,1). */
function koseDegeri(ix: number, iz: number, tohum: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(tohum, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const yumusat = (t: number) => t * t * (3 - 2 * t);

/** 2B değer gürültüsü [0,1): belirleyici, sürekli. */
export function gurultu(x: number, z: number, tohum: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = yumusat(x - ix), fz = yumusat(z - iz);
  const a = koseDegeri(ix, iz, tohum), b = koseDegeri(ix + 1, iz, tohum);
  const c = koseDegeri(ix, iz + 1, tohum), d = koseDegeri(ix + 1, iz + 1, tohum);
  const ust = a + (b - a) * fx, alt = c + (d - c) * fx;
  return ust + (alt - ust) * fz;
}
