// world/level/secimVurgusu.ts — SEÇİLİ NESNENİN çerçevesi (spec 28): kutusunun 12 kenarı, parlak sarı çizgi. İnce Babylon adaptörü.
//
// Tek bir birim küp çizgi nesnesi kurulur ve her seçimde kutuya göre yerleştirilir/ölçeklenir: seçim değiştikçe mesh üretilmez. Çizgi ışına/tıklamaya
// kapalıdır (`isPickable = false`), sise ve ışığa uymaz (her zaman okunur) ve yüzeylerin ÜSTÜNDE çizilir (`renderingGroupId = 1`: derinlik temizlenir).
// Kutu Orion'un gördüğü AABB'dir (`Yer.nesneler[].kutu`): çerçeve, seçimin tam olarak neye isabet ettiğini gösterir.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateLineSystem } from "@babylonjs/core/Meshes/Builders/linesBuilder";
import type { Kutu } from "./cekirdek/nesneTipi.ts";

/** Çerçeve kutunun biraz dışında (z-fighting olmasın): her yönde şişme payı (m). */
export const VURGU_SISMESI = 0.02;

export interface SecimVurgusu {
  /** Kutuyu çerçevele; null = gizle. */
  goster(kutu: Kutu | null): void;
  /** Çerçevenin şu anki dünya sınırları (test/tanı); gizliyse null. */
  sinir(): { min: [number, number, number]; max: [number, number, number] } | null;
  yokEt(): void;
}

/** Birim küpün (−0,5…+0,5) 12 kenarı. */
function kenarlar(): Vector3[][] {
  const k: Vector3[] = [];
  for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) k.push(new Vector3(x, y, z));
  const l: Vector3[][] = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    const a = k[i]!, b = k[j]!;
    const fark = (a.x !== b.x ? 1 : 0) + (a.y !== b.y ? 1 : 0) + (a.z !== b.z ? 1 : 0);
    if (fark === 1) l.push([a, b]);   // yalnız tek eksende ayrılan köşe çiftleri = küpün kenarı
  }
  return l;
}

export function secimVurgusuKur(sahne: Scene): SecimVurgusu {
  const cizgi = CreateLineSystem("secim_vurgusu", { lines: kenarlar() }, sahne);
  cizgi.color = new Color3(1, 0.85, 0.15);
  cizgi.isPickable = false;
  cizgi.applyFog = false;
  cizgi.renderingGroupId = 1;
  cizgi.setEnabled(false);
  let aktif: Kutu | null = null;
  return {
    goster(kutu) {
      aktif = kutu;
      if (!kutu) { cizgi.setEnabled(false); return; }
      cizgi.position.set(kutu.x, kutu.y, kutu.z);
      cizgi.scaling.set(kutu.g + 2 * VURGU_SISMESI, kutu.yuk + 2 * VURGU_SISMESI, kutu.d + 2 * VURGU_SISMESI);
      cizgi.setEnabled(true);
    },
    sinir() {
      if (!aktif) return null;
      const y = [(aktif.g + 2 * VURGU_SISMESI) / 2, (aktif.yuk + 2 * VURGU_SISMESI) / 2, (aktif.d + 2 * VURGU_SISMESI) / 2] as const;
      return { min: [aktif.x - y[0], aktif.y - y[1], aktif.z - y[2]], max: [aktif.x + y[0], aktif.y + y[1], aktif.z + y[2]] };
    },
    yokEt() { cizgi.dispose(); },
  };
}
