// world/avatar/rig/matris.ts — 3×3 dönme matematiği (spec 37 §4, spec 38): çevirici (tools/kimodo) ve Control Rig AYNI kodu kullanır (tek kopya). SAF, Babylon yok.
//
// KURAL: matris 9 sayılık dizi, SATIR-ANA, SÜTUN-VEKTÖR (v' = M·v). Babylon satır-vektördür (v' = v·M); köprü tek yerde: Babylon'un `RotationYawPitchRoll`u
// sütun biçiminde Ry(y)·Rx(x)·Rz(z)'dir (eksen matrisleri standart formül) — bekçi test bunu Babylon'un KENDİSİYLE sınar (kimodoCevir.test.ts).
"use strict";

export type M3 = number[];
export type V3 = [number, number, number];

export const DERECE = Math.PI / 180;
export const BIRIM: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function carp(a: M3, b: M3): M3 {
  const r = new Array<number>(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!;
  return r;
}
export const devrik = (a: M3): M3 => [a[0]!, a[3]!, a[6]!, a[1]!, a[4]!, a[7]!, a[2]!, a[5]!, a[8]!];
export const uygula = (a: M3, v: V3): V3 => [a[0]! * v[0] + a[1]! * v[1] + a[2]! * v[2], a[3]! * v[0] + a[4]! * v[1] + a[5]! * v[2], a[6]! * v[0] + a[7]! * v[1] + a[8]! * v[2]];
export const fark = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const topla = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const olcekle = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const nokta = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const capraz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const uzunluk = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const birimle = (a: V3): V3 => { const l = uzunluk(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Eksen etrafında dönme (radyan, sağ el kuralı formülü; eksen birim). */
export function eksenAci(e: V3, a: number): M3 {
  const [x, y, z] = birimle(e), c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
export const Rx = (a: number): M3 => eksenAci([1, 0, 0], a);
export const Ry = (a: number): M3 => eksenAci([0, 1, 0], a);
export const Rz = (a: number): M3 => eksenAci([0, 0, 1], a);

/** `a` yönünü `b` yönüne götüren EN KÜÇÜK dönme (salınım; burulma eklemez). */
export function hizala(a: V3, b: V3): M3 {
  const u = birimle(a), v = birimle(b);
  const c = Math.max(-1, Math.min(1, nokta(u, v)));
  const ex = capraz(u, v);
  if (uzunluk(ex) < 1e-9) {
    if (c > 0) return [...BIRIM];
    const dik = Math.abs(u[0]) < 0.9 ? capraz(u, [1, 0, 0]) : capraz(u, [0, 1, 0]);
    return eksenAci(dik, Math.PI);
  }
  return eksenAci(ex, Math.acos(c));
}

/** İki dönmenin arasındaki açı (radyan). */
export function aciFarki(a: M3, b: M3): number {
  const r = carp(devrik(a), b);
  return Math.acos(Math.max(-1, Math.min(1, (r[0]! + r[4]! + r[8]! - 1) / 2)));
}

/** Gram–Schmidt: ölçek/ayna içermeyen en yakın dönmeye (ortalama ve ölçüm gürültüsü için). Sütunlar dikleştirilir. */
export function diklestir(m: M3): M3 {
  const x = birimle([m[0]!, m[3]!, m[6]!]);
  let y: V3 = [m[1]!, m[4]!, m[7]!];
  y = birimle(fark(y, olcekle(x, nokta(x, y))));
  const z = capraz(x, y);
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

/** Babylon'un Euler'i (derece): sütun biçiminde R = Ry(y)·Rx(x)·Rz(z) — `Matrix.RotationYawPitchRoll(y, x, z)`nin devriği. */
export function eulerdenMatris(x: number, y: number, z: number): M3 {
  return carp(Ry(y * DERECE), carp(Rx(x * DERECE), Rz(z * DERECE)));
}

export interface Euler { x: number; y: number; z: number }

/** Gimbal eşiği: |cos x| bunun altındaysa y öncekinden alınır, z ondan çözülür (y ve z tek başına belirsiz). */
export const GIMBAL_ESIGI = 0.02;

const sar = (v: number, onceki: number): number => v + 360 * Math.round((onceki - v) / 360);
const mesafe = (a: Euler, b: Euler) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);

/**
 * Matris → Babylon Euler (derece), ÖNCEKİ KAREYE EN YAKIN çözüm: YXZ'nin iki çözümü ((y, x, z) ve (y+180, 180−x, z+180)) ve her bileşenin 360 katları
 * içinden öncekine en yakını seçilir (±180 sarma süreksizliği olmasın). Gimbal yakınında y öncekinden tutulur.
 */
export function matristenEuler(r: M3, onceki: Euler = { x: 0, y: 0, z: 0 }): Euler & { gimbal: boolean } {
  const sx = Math.max(-1, Math.min(1, -r[5]!));
  const x = Math.asin(sx) / DERECE;
  const cx = Math.cos(x * DERECE);
  if (cx < GIMBAL_ESIGI) {
    // sx ≈ +1: R00 = cos(y−z), R01 = sin(y−z); sx ≈ −1: R00 = cos(y+z), R01 = −sin(y+z).
    const y = onceki.y;
    const z = sx > 0 ? y - Math.atan2(r[1]!, r[0]!) / DERECE : Math.atan2(-r[1]!, r[0]!) / DERECE - y;
    return { x: sar(x, onceki.x), y, z: sar(z, onceki.z), gimbal: true };
  }
  const y = Math.atan2(r[2]!, r[8]!) / DERECE, z = Math.atan2(r[3]!, r[4]!) / DERECE;
  const a: Euler = { x: sar(x, onceki.x), y: sar(y, onceki.y), z: sar(z, onceki.z) };
  const b: Euler = { x: sar(180 - x, onceki.x), y: sar(y + 180, onceki.y), z: sar(z + 180, onceki.z) };
  return { ...(mesafe(a, onceki) <= mesafe(b, onceki) ? a : b), gimbal: false };
}

/** BVH kanal sırasıyla (ör. Zrotation Yrotation Xrotation) yerel dönme: R = R_k1·R_k2·R_k3 (BVH kuralı: ilk yazılan en dışta). */
export function bvhDonmesi(sira: readonly ("X" | "Y" | "Z")[], acilar: readonly number[]): M3 {
  let r = [...BIRIM];
  for (const [i, e] of sira.entries()) r = carp(r, e === "X" ? Rx(acilar[i]! * DERECE) : e === "Y" ? Ry(acilar[i]! * DERECE) : Rz(acilar[i]! * DERECE));
  return r;
}

/** Dönmenin `s` katı (eksen aynı, açı × s; 0 ≤ açı < 180°). Döngü kapanış farkını segmente yaymak için. */
export function kesirliDonme(m: M3, s: number): M3 {
  const aci = Math.acos(Math.max(-1, Math.min(1, (m[0]! + m[4]! + m[8]! - 1) / 2)));
  if (aci < 1e-9) return [...BIRIM];
  const e: V3 = [m[7]! - m[5]!, m[2]! - m[6]!, m[3]! - m[1]!];
  if (uzunluk(e) < 1e-9) return [...BIRIM];   // 180°: eksen belirsiz; döngü kapanışında bu kadar fark olmaz (benzerlik ölçüsü seçmez)
  return eksenAci(e, aci * s);
}

/** Dönme ortalaması (küçük saçılım için yeterli: matrisler toplanır, dikleştirilir). */
export function ortalamaDonme(l: readonly M3[]): M3 {
  const t = new Array<number>(9).fill(0);
  for (const m of l) for (let i = 0; i < 9; i++) t[i]! += m[i]!;
  return diklestir(t);
}
