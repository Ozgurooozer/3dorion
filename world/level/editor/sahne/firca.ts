// world/level/editor/sahne/firca.ts — Fırça imleci ve damga ritmi (spec 22): yüzeyi izleyen halka; basılı tutup
// gezdirince yarıçapın yarısı kadar ilerledikçe bir DAMGA (editör ne ekleneceğini cekirdek/firca.ts ile hesaplar).
// Halka en üste çizilir (çimin altında kalmasın), silgi kipinde (Shift) kırmızı.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Constants } from "@babylonjs/core/Engines/constants";
import type { Vec3 } from "../../cekirdek/levelTanimi.ts";
import type { Yuzey } from "./yuzey.ts";

export interface FircaImleci {
  /** İmleç (tuval pikseli); halkayı yüzeye koyar. Yüzey yoksa null. */
  imlec(x: number, y: number, yaricap: number, silgi: boolean, yalnizArazi?: boolean): Vec3 | null;
  /** Basılı gezinirken: damga vurulacak mı (son damgadan yarıçapın yarısı uzaklaştıysa). */
  damgaZamani(nokta: Vec3, yaricap: number): boolean;
  /** Vuruş başladı/bitti (ilk damga hemen). */
  basla(): void;
  bitir(): void;
  goster(acik: boolean): void;
  yokEt(): void;
}

export function fircaImleciKur(sahne: Scene, yuzey: Yuzey): FircaImleci {
  const halka = CreateTorus("editor_firca", { diameter: 2, thickness: 0.04, tessellation: 64 }, sahne);
  halka.isPickable = false;
  halka.metadata = { cizgisiz: true };
  const mat = new StandardMaterial("editor_firca", sahne);
  mat.disableLighting = true;
  mat.emissiveColor = new Color3(1, 0.62, 0.15);
  mat.depthFunction = Constants.ALWAYS;
  mat.disableDepthWrite = true;
  mat.alpha = 0.9;
  halka.material = mat;
  halka.renderingGroupId = 0;
  halka.alphaIndex = 10001;
  halka.setEnabled(false);
  let son: Vec3 | null = null;
  let gorunur = false;
  return {
    imlec(x, y, yaricap, silgi, yalnizArazi = false) {
      const h = yalnizArazi ? yuzey.araziden(x, y) : yuzey.ekrandan(x, y);
      halka.setEnabled(gorunur && !!h);
      if (!h) return null;
      halka.position.set(h.nokta[0], h.nokta[1] + 0.05, h.nokta[2]);
      // Ölçek yatayda yarıçap kadar: halka kalınlığı da onunla büyür (5 m fırçada ~20 cm) — uzaktan seçilir kalır.
      halka.scaling.set(yaricap, 1, yaricap);
      if (silgi) mat.emissiveColor.set(1, 0.3, 0.3); else mat.emissiveColor.set(1, 0.62, 0.15);
      return h.nokta;
    },
    damgaZamani(n, yaricap) {
      if (!son) { son = n; return true; }
      if (Math.hypot(n[0] - son[0], n[2] - son[2]) < Math.max(0.3, yaricap * 0.5)) return false;
      son = n;
      return true;
    },
    basla() { son = null; },
    bitir() { son = null; },
    goster(acik) { gorunur = acik; if (!acik) halka.setEnabled(false); },
    yokEt() { halka.dispose(); mat.dispose(); },
  };
}
