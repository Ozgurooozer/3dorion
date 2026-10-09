// world/level/editor/sahne/cetvel.ts — Ölçü cetveli (spec 22): iki yüzey noktası arası mesafe. İlk tık A, imleç B'yi
// izler, ikinci tık sabitler (üçüncü tık yeni ölçüme başlar). Çizgi en üste çizilir; mesafe durum çubuğuna yazılır.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { CreateLines } from "@babylonjs/core/Meshes/Builders/linesBuilder";
import type { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Constants } from "@babylonjs/core/Engines/constants";
import type { Vec3 } from "../../cekirdek/levelTanimi.ts";

export interface Olcum { toplam: number; yatay: number; dikey: number }

/** İki nokta arası: toplam, yatay (xz) ve dikey fark. Saf. */
export const olc = (a: Vec3, b: Vec3): Olcum => ({
  toplam: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]),
  yatay: Math.hypot(b[0] - a[0], b[2] - a[2]),
  dikey: b[1] - a[1],
});

export const olcumMetni = (o: Olcum): string => `ölçü ${o.toplam.toFixed(2)} m (yatay ${o.yatay.toFixed(2)}, dikey ${o.dikey >= 0 ? "+" : ""}${o.dikey.toFixed(2)})`;

export interface Cetvel {
  /** Tık: A koyar, sonra B sabitler; döner: ölçüm (B sabitlenince). */
  tikla(n: Vec3): Olcum | null;
  /** İmleç: A konduysa B'yi izler. */
  imlec(n: Vec3 | null): Olcum | null;
  temizle(): void;
  yokEt(): void;
}

export function cetvelKur(sahne: Scene): Cetvel {
  let a: Vec3 | null = null, sabit = false;
  let cizgi: LinesMesh | null = null;
  const ciz = (p: Vec3, q: Vec3) => {
    const yol = [new Vector3(...p), new Vector3(...q), new Vector3(q[0], p[1], q[2]), new Vector3(...p)];
    cizgi = CreateLines("editor_cetvel", { points: yol, updatable: true, ...(cizgi ? { instance: cizgi } : {}) }, sahne);
    cizgi.color = new Color3(1, 0.85, 0.3);
    cizgi.isPickable = false;
    cizgi.metadata = { cizgisiz: true };
    if (cizgi.material) cizgi.material.depthFunction = Constants.ALWAYS;   // binanın arkasında da görünsün
  };
  const temizle = () => { a = null; sabit = false; cizgi?.dispose(); cizgi = null; };
  return {
    tikla(n) {
      if (!a || sabit) { temizle(); a = n; return null; }
      sabit = true;
      ciz(a, n);
      return olc(a, n);
    },
    imlec(n) {
      if (!a || sabit || !n) return null;
      ciz(a, n);
      return olc(a, n);
    },
    temizle,
    yokEt: temizle,
  };
}
