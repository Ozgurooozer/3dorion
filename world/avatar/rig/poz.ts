// world/avatar/rig/poz.ts — RİG POZ MATEMATİĞİ (spec 38 §4): bir uzvun Euler dönmesini GÖVDE EKSENİ etrafında döndür. SAF: Babylon yok.
//
// Sekans/klip değeri uzuv başına üç Euler kanalıdır (donme_x/y/z, derece, gövde uzayı; protocol/animasyon.ts). Rig'de Ozyn bir kontrolü TEK EKSEN etrafında
// sürükler ("sol dirsek gövdenin yan ekseninde 20° daha bük"): yeni dönme = Eksen(açı) · mevcut dönme (gövde uzayında SOLDAN çarpım), sonra YENİDEN Euler
// (matris.ts; öncekine en yakın çözüm, ±180 sarma ve gimbal dikkate alınır). Üç kanalı ayrı ayrı oynatmak gimbal'da şaşırtırdı.
"use strict";
import { Rx, Ry, Rz, DERECE, carp, eulerdenMatris, matristenEuler, type Euler, type M3 } from "./matris.ts";

export type { Euler };
export type RigEkseni = "x" | "y" | "z";
export const RIG_EKSENLERI: readonly RigEkseni[] = ["x", "y", "z"];

/** Sekans/klip dönme sınırı (derece; protocol/animasyon.ts KLIP_SINIRLARI.donme — burada tekrar yazılmaz, çağıran verir). */
export const SIFIR_EULER: Euler = { x: 0, y: 0, z: 0 };

const eksenMatrisi = (e: RigEkseni, derece: number): M3 => (e === "x" ? Rx(derece * DERECE) : e === "y" ? Ry(derece * DERECE) : Rz(derece * DERECE));

/** Mevcut Euler dönmesini gövde `eksen`i etrafında `derece` döndürür. Dönüş: yeni Euler (derece). */
export function eksendeDondur(mevcut: Euler, eksen: RigEkseni, derece: number): Euler {
  const r = carp(eksenMatrisi(eksen, derece), eulerdenMatris(mevcut.x, mevcut.y, mevcut.z));
  const { gimbal: _g, ...e } = matristenEuler(r, mevcut);
  return e;
}

export const eulerEsit = (a: Euler, b: Euler, tolerans = 1e-6): boolean => Math.abs(a.x - b.x) <= tolerans && Math.abs(a.y - b.y) <= tolerans && Math.abs(a.z - b.z) <= tolerans;

/** Kanal değerini tavanına (±sinir derece) kısar. */
export const kisEuler = (e: Euler, sinir: number): Euler => ({
  x: Math.max(-sinir, Math.min(sinir, e.x)), y: Math.max(-sinir, Math.min(sinir, e.y)), z: Math.max(-sinir, Math.min(sinir, e.z)),
});

/** Sayıyı panel için okunur yazar (ör. 12.3°). */
export const dereceYazisi = (d: number): string => `${(Math.round(d * 10) / 10).toFixed(1)}°`;
