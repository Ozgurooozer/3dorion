// world/avatar/rig/surukleme.ts — HALKA SÜRÜKLEME MATEMATİĞİ (spec 38 §4): fare hareketi → dönme açısı. SAF: Babylon yok (izdüşüm dışarıdan verilir).
//
// Unreal'in döndürme tutamacındaki gibi: Ozyn bir halkanın üstündeki NOKTAYI tutup halkanın teğeti yönünde sürükler. O noktadaki teğet
// t = eksen × (P − M); küçük bir `e` adımının ekrandaki izdüşümü ekran teğetini verir. Fare farkının ekran teğetine izdüşümü, kaç `e` ilerlendiğini söyler;
// `e / |P − M|` radyana çevirir. Böylece kamera nerede olursa olsun imleç halkanın gittiği yönde gider ve halka kameraya yandan bakıyorsa (teğet ekranda
// kısalır) hassasiyet düşmek yerine SINIRLANIR (aşırı hızlı dönmesin).
"use strict";

export type V3 = readonly [number, number, number];
export interface Ekran { x: number; y: number }
/** Dünya noktasını ekran pikseline koyar (Babylon'da `Vector3.Project`). */
export type EkranaKoy = (p: V3) => Ekran;

const cikar = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const topla = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const olcekle = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const uzunluk = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const capraz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Bir fare adımı (piksel) için dönme açısı (radyan, eksenin sağ el yönünde artı). `eksen` birim, dünya uzayında. */
export function surukleAcisi(merkez: V3, eksen: V3, nokta: V3, ekranaKoy: EkranaKoy, dx: number, dy: number, enBuyukAdim = 0.35): number {
  const yaricap = uzunluk(cikar(nokta, merkez));
  if (yaricap < 1e-9) return 0;
  const teget = capraz(eksen, cikar(nokta, merkez));
  const tl = uzunluk(teget);
  if (tl < 1e-9) return 0;
  const e = yaricap * 0.1;                                                  // küçük adım: halka yarıçapının %10'u
  const t = olcekle(teget, 1 / tl);
  const a = ekranaKoy(nokta), b = ekranaKoy(topla(nokta, olcekle(t, e)));
  const sx = b.x - a.x, sy = b.y - a.y;
  const s2 = sx * sx + sy * sy;
  if (s2 < 1e-9) return 0;                                                  // teğet tam kameraya dönük: ekranda yön yok
  const adim = ((dx * sx + dy * sy) / s2) * e;                              // fare, ekran teğeti boyunca kaç dünya birimi ilerledi
  const aci = adim / yaricap;
  const sinir = enBuyukAdim;                                                // tek fare olayında en çok ~20°
  return Math.max(-sinir, Math.min(sinir, aci));
}

/**
 * TAŞI oku sürükleme: fare farkı (piksel) → eksen boyunca metre. Eksenin BİR METRESİNİN ekrandaki izdüşümü `s` (piksel/metre); fare farkının ona izdüşümü metreyi verir.
 * Eksen kameraya doğru bakıyorsa (izdüşümü ~0) yön yoktur → 0 (sonsuz hassasiyet yok). Tek olayda en çok 0,25 m.
 */
export function surukleOtelemesi(merkez: V3, eksen: V3, ekranaKoy: EkranaKoy, dx: number, dy: number, enBuyuk = 0.25): number {
  const a = ekranaKoy(merkez), b = ekranaKoy(topla(merkez, eksen));
  const sx = b.x - a.x, sy = b.y - a.y, s2 = sx * sx + sy * sy;
  if (s2 < 1e-6) return 0;
  return Math.max(-enBuyuk, Math.min(enBuyuk, (dx * sx + dy * sy) / s2));
}
