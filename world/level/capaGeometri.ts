// world/level/capaGeometri.ts — Çapa verisi ↔ Babylon Vector3 köprüsü.
//
// `capalar.ts` bilerek Babylon'suzdur (test edilebilirlik). Bu dosya tek
// sorumluluğu olan ince bir katman: saf `Vec3`i `Vector3`e çevirir. Böylece
// kamera/oyuncu Babylon ile çalışır, çapa defteri saf kalır.
"use strict";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Vec3 } from "../../protocol/temel.ts";
import { capaBul } from "./capalar.ts";

/** Saf Vec3 → Babylon Vector3. */
export function vek(v: Vec3): Vector3 {
  return new Vector3(v.x, v.y, v.z);
}

/** Babylon Vector3 → saf Vec3. Protokole durum yazarken kullanılır. */
export function vec3(v: Vector3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

/** Çapanın bakılacak noktası. Bilinmeyen ad → `null`. */
export function capaKonumu(ad: string): Vector3 | null {
  const c = capaBul(ad);
  return c ? vek(c.konum) : null;
}

/** Çapanın durak (ayak) noktası. Bilinmeyen ad → `null`. */
export function capaDuragi(ad: string): Vector3 | null {
  const c = capaBul(ad);
  return c ? vek(c.durak) : null;
}
