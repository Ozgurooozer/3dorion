// world/surfaces/yuzeyStil.ts — yüzeylerin ortak görsel dili (Babylon'suz).
//
// NEDEN AYRI: bu sabitler ve yardımcılar `yuzey.ts`in içindeydi; o dosya
// Babylon import ediyor. Bir panelin çizimini sahnesiz koşturmak (deneme
// sayfasında ekran görüntüsü almak, tasarımı gözle sınamak) Babylon'u
// yüklemeyi gerektiriyordu. Çizim yalnızca canvas ister.
//
// Bağımlılık: yok.
"use strict";

/** Yüzeyin piksel ölçüsü — çizim geri çağrısı bunu kullanır. */
export interface YuzeyOlcusu {
  genislik: number;
  yukseklik: number;
}

// ── Ortak çizim yardımcıları ───────────────────────────────────────────────
// Dört ekran da aynı görsel dili konuşsun diye; her yüzey kendi rengini
// yeniden icat etmesin.

export const RENK = {
  ekranZemin: "#07080e",
  panoZemin: "#f2f4f1",
  metin: "#d7dcea",
  soluk: "#7c88a6",
  vurgu: "#58c1ff",
  iyi: "#6fd39b",
  uyari: "#ffc857",
  kotu: "#ff7a70",
  cerceve: "#2a3246",
} as const;

export const YAZI = {
  tek: "'Cascadia Mono', Consolas, 'Courier New', monospace",
  duz: "'Segoe UI', system-ui, sans-serif",
} as const;

/** Zemini tek renk doldurur — her çizimin ilk adımı. */
export function zeminDoldur(bag: CanvasRenderingContext2D, o: YuzeyOlcusu, renk: string): void {
  bag.fillStyle = renk;
  bag.fillRect(0, 0, o.genislik, o.yukseklik);
}

/** Köşeleri yuvarlatılmış kutu — panel/kart çizimlerinde kullanılır. */
export function yuvarlakKutu(
  bag: CanvasRenderingContext2D,
  x: number, y: number, g: number, yuk: number, yaricap: number,
): void {
  const r = Math.min(yaricap, g / 2, yuk / 2);
  bag.beginPath();
  bag.moveTo(x + r, y);
  bag.lineTo(x + g - r, y);
  bag.quadraticCurveTo(x + g, y, x + g, y + r);
  bag.lineTo(x + g, y + yuk - r);
  bag.quadraticCurveTo(x + g, y + yuk, x + g - r, y + yuk);
  bag.lineTo(x + r, y + yuk);
  bag.quadraticCurveTo(x, y + yuk, x, y + yuk - r);
  bag.lineTo(x, y + r);
  bag.quadraticCurveTo(x, y, x + r, y);
  bag.closePath();
}
