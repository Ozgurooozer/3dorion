// world/level/editor/sahne/vurgu.ts — Seçili ve üstünde durulan nesnelerin dış hattı (spec 22).
//
// Babylon SelectionOutlineLayer: seçili mesh'ler bir maskeye çizilir, kenarı ekranda boyanır; ÖRNEKLİ mesh'leri
// tek tek ayırır (aynı varlığın diğer yerleşimleri vurgulanmaz — `renderOutline` bunu yapamıyordu: kaynak mesh
// özelliği bütün örneklere geçer). Önceki `showBoundingBox` yerine. Seçim turuncu, üstünde durulan soluk mavi
// (iki katman: ayrı renk). Grup tek parça çizilir (`addSelection(dizi)`).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { SelectionOutlineLayer } from "@babylonjs/core/Layers/selectionOutlineLayer";
import "@babylonjs/core/Layers/effectLayerSceneComponent";

export interface Vurgu {
  secili(gruplar: readonly AbstractMesh[][]): void;
  ustunde(meshler: readonly AbstractMesh[] | null): void;
  /** Uçuş kipinde gizle. */
  goster(acik: boolean): void;
  yokEt(): void;
}

export function vurguKur(sahne: Scene): Vurgu {
  const katman = (ad: string, renk: Color3, kalinlik: number) => {
    const k = new SelectionOutlineLayer(ad, sahne, { mainTextureRatio: 1 });
    k.outlineColor = renk;
    k.outlineThickness = kalinlik;
    k.occlusionStrength = 0.35;   // arkada kalan kısım da soluk görünsün (binanın arkasındaki seçili lamba)
    return k;
  };
  const sec = katman("editor_secim", new Color3(1, 0.62, 0.15), 2.2);
  const ust = katman("editor_ustunde", new Color3(0.45, 0.7, 1), 1.4);
  let sonUst: readonly AbstractMesh[] | null = null;
  return {
    secili(gruplar) {
      sec.clearSelection();
      for (const g of gruplar) if (g.length) sec.addSelection([...g]);
    },
    ustunde(m) {
      if (m === sonUst || (m && sonUst && m.length === sonUst.length && m.every((x, i) => x === sonUst![i]))) return;
      sonUst = m;
      ust.clearSelection();
      if (m?.length) ust.addSelection([...m]);
    },
    goster(acik) { sec.isEnabled = acik; ust.isEnabled = acik; },
    yokEt() { sec.dispose(); ust.dispose(); },
  };
}
