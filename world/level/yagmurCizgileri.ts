// world/level/yagmurCizgileri.ts — Pencere yağmuru dokusunun çizgileri (saf, Babylon'suz).
//
// Çizgiler 0..1 doku koordinatında; `yagmur.ts` bunları bir tuvale çizer ve dokuyu aşağı
// kaydırır. Doku kendini tekrarlar (WRAP): bir çizgi alttan taşarsa üstten devam eder.
// Sabit tohum: aynı açıdan alınan iki ekran görüntüsü aynı yağmuru gösterir.
"use strict";

export interface YagmurCizgisi {
  /** Başlangıç (üst uç), doku koordinatı 0..1. */
  x: number;
  y: number;
  /** Dikey boy, doku yüksekliğinin oranı. */
  boy: number;
  /** 0..1. */
  opaklik: number;
}

/** mulberry32: küçük, hızlı, tohumlu. */
function rastgele(tohum: number): () => number {
  let a = tohum >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function yagmurCizgileri(tohum: number, adet: number): YagmurCizgisi[] {
  const r = rastgele(tohum);
  const cizgiler: YagmurCizgisi[] = [];
  for (let i = 0; i < adet; i++) {
    cizgiler.push({
      x: r(),
      y: r(),
      boy: 0.03 + r() * 0.12,
      opaklik: 0.15 + r() * 0.55,
    });
  }
  return cizgiler;
}
