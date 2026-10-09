// world/level/editor/sahne/izgara.ts — Yaslama ızgarasının görseli (spec 22).
//
// Arazi düz değil ve üstü çimle kaplı: zemin yüksekliğinde tek bir düzlem ya çimin altında kalır ya da çukurda suya
// gömülür (denendi: göl kıyısında hiç görünmedi). Bu yüzden ızgara ÜZERİNDE ÇALIŞILAN nesnenin tabanında, onun
// çevresinde küçük bir alandır (kenara doğru söner) ve derinlik testi olmadan EN ÜSTE çizilir — yalnız seçim,
// yerleştirme ya da sürükleme varken (çalışılacak düzlem yokken gösterilecek anlamlı bir yükseklik de yok).
// Çizgiler dünyaya sabit (GridMaterial dünya konumundan çizer); ara = yaslama adımı, her 10 adımda kalın çizgi.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Constants } from "@babylonjs/core/Engines/constants";
import { GridMaterial } from "@babylonjs/materials/grid/gridMaterial";

export interface Izgara {
  goster(acik: boolean): void;
  /** Merkez (taban), adım (m). */
  konumla(x: number, y: number, z: number, adim: number): void;
  yokEt(): void;
}

const BOY = 40;

export function izgaraKur(sahne: Scene): Izgara {
  const m = CreateGround("editor_izgara", { width: BOY, height: BOY, subdivisions: 1 }, sahne);
  m.isPickable = false;
  m.metadata = { cizgisiz: true };
  // Kenara doğru sönme: radyal saydamlık dokusu.
  const doku = new DynamicTexture("editor_izgara_sonum", 128, sahne, false);
  const c = doku.getContext() as CanvasRenderingContext2D;
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.55, "rgba(255,255,255,0.8)"); g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  doku.update(); doku.hasAlpha = true;
  const mat = new GridMaterial("editor_izgara", sahne);
  mat.linesOnly = true;
  mat.lineColor = new Color3(1, 0.85, 0.55);
  mat.mainColor = new Color3(0, 0, 0);
  mat.opacity = 0.7;
  mat.opacityTexture = doku;
  mat.majorUnitFrequency = 10;
  mat.minorUnitVisibility = 0.4;
  mat.backFaceCulling = false;
  mat.disableDepthWrite = true;
  mat.depthFunction = Constants.ALWAYS;
  mat.fogEnabled = false;
  m.material = mat;
  m.alphaIndex = 10000;
  m.setEnabled(false);
  return {
    goster(acik) { if (m.isEnabled() !== acik) m.setEnabled(acik); },
    konumla(x, y, z, adim) {
      m.position.set(x, y + 0.02, z);
      mat.gridRatio = Math.max(adim, 0.01);
    },
    yokEt() { m.dispose(); mat.dispose(); doku.dispose(); },
  };
}
