// world/engine/fareIsini.ts — Fare pikselinden DÜNYA IŞINI (spec 28): imleç kipinde tıklanan yer → (kaynak, yön). İnce Babylon adaptörü.
//
// Seçimin kendisi saftır (`world/player/nesneSecici.ts`); burası yalnız "ekranda şu piksel, dünyada hangi ışın" sorusunu yanıtlar. Koordinat olay
// ofsetidir (`MouseEvent.offsetX/Y`): odak kipindeki `sahne.pick(e.offsetX, e.offsetY)` ile aynı. Dönen yön BİRİM uzunluktadır (`isinAabb` ister).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Culling/ray";   // `Scene.createPickingRay` bu modülün yan etkisiyle tanımlanır (ağaç-sarsılabilir derleme)

export interface DunyaIsini {
  kaynak: { x: number; y: number; z: number };
  yon: { x: number; y: number; z: number };
}

export function fareIsini(sahne: Scene, kamera: Camera, x: number, y: number): DunyaIsini {
  const r = sahne.createPickingRay(x, y, Matrix.Identity(), kamera);
  const d = r.direction.normalizeToNew();
  return { kaynak: { x: r.origin.x, y: r.origin.y, z: r.origin.z }, yon: { x: d.x, y: d.y, z: d.z } };
}
