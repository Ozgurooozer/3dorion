// uygulama/yapi/onizleme/varlikOzeti.ts — YÜKLENMİŞ BİR GLB'NİN ÖZETİ (spec 39 D5): mesh/üçgen/köşe, iskelet ve kemik ağacı, malzemeler, animasyonlar, boyut. Babylon'u OKUR (sahneye yazmaz);
// saf sayım/sıralama `varlikModeli.ts`te (testli). Önizleme penceresi (Bileşenler ağacı + Ayrıntılar) bunu çizer; senaryo aynı özeti ölçer.
"use strict";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { kemikAgaci, ucgenSayisi, type KemikGorunumu } from "./varlikModeli.ts";

export interface MeshOzeti { ad: string; ucgen: number; kose: number; malzeme: string | null; kemikli: boolean }
export interface VarlikOzeti {
  meshler: MeshOzeti[];
  ucgen: number;
  kose: number;
  iskeletler: { ad: string; kemik: number }[];
  /** Bütün iskeletlerin kemikleri, ağaç sırasıyla (ata önce). */
  kemikler: KemikGorunumu[];
  malzemeler: { ad: string; tur: string }[];
  animasyonlar: { ad: string; saniye: number }[];
  /** Dünya sınırlayıcı kutusunun boyutu (metre): genişlik, yükseklik, derinlik. Çizilebilir mesh yoksa 0. */
  boyut: [number, number, number];
}

export interface YuklenenVarlik {
  meshes: readonly AbstractMesh[];
  skeletons: readonly Skeleton[];
  animationGroups: readonly AnimationGroup[];
}

export function varlikOzetle(r: YuklenenVarlik): VarlikOzeti {
  const meshler: MeshOzeti[] = [];
  const malzemeAdlari = new Map<string, string>();
  let ucgen = 0, kose = 0;
  const alt = [Infinity, Infinity, Infinity], ust = [-Infinity, -Infinity, -Infinity];
  for (const m of r.meshes) {
    const k = m.getTotalVertices();
    if (k === 0) continue;   // kök düğüm / boş transform: çizilebilir değil
    const u = ucgenSayisi(m.getTotalIndices());
    ucgen += u; kose += k;
    if (m.material) malzemeAdlari.set(m.material.name, m.material.getClassName());
    meshler.push({ ad: m.name, ucgen: u, kose: k, malzeme: m.material?.name ?? null, kemikli: !!m.skeleton });
    m.computeWorldMatrix(true);
    const kutu = m.getBoundingInfo().boundingBox;
    for (const [i, a] of [kutu.minimumWorld.x, kutu.minimumWorld.y, kutu.minimumWorld.z].entries()) alt[i] = Math.min(alt[i]!, a);
    for (const [i, a] of [kutu.maximumWorld.x, kutu.maximumWorld.y, kutu.maximumWorld.z].entries()) ust[i] = Math.max(ust[i]!, a);
  }
  const boyut = alt.map((a, i) => (Number.isFinite(a) ? ust[i]! - a : 0)) as [number, number, number];
  const satirlar = r.skeletons.flatMap((s) => s.bones.map((b) => ({ ad: b.name, ust: b.getParent()?.name ?? null })));
  return {
    meshler, ucgen, kose,
    iskeletler: r.skeletons.map((s) => ({ ad: s.name, kemik: s.bones.length })),
    kemikler: kemikAgaci(satirlar),
    malzemeler: [...malzemeAdlari].map(([ad, tur]) => ({ ad, tur })),
    animasyonlar: r.animationGroups.map((g) => {
      const fps = g.targetedAnimations[0]?.animation.framePerSecond || 60;
      return { ad: g.name, saniye: Math.max(0, (g.to - g.from) / fps) };
    }),
    boyut,
  };
}
