// world/player/oyuncuBeden.ts — Ozyn'in (oyuncunun) görünür bedeni: Orion'un low-poly bedeni, FARKLI renkte, pantolon + gömlek + ceketli.
//
// Eskiden mavi bir kapsüldü. Şimdi `assets/oyuncu-beden.glb` (kaynak: `tools/avatar-blender/oyuncu_giysi.py`): Orion'la AYNI iskelet ve AYNI
// klipler (`yuru`, `bosta`), yalnız renk ve giysi farklı. Mantık (konum, çarpışma, kamera) kapsülde KALIR; bu dosya yalnız görünüşü sürer:
// kök oyuncunun ayağına oturur, yatayda bakışa döner, hareket varsa yürüme klibi hıza göre hızlanır.
// Yüklenemezse FIRLATIR; çağıran uyarı basar ve kapsül görünür kalır (sessiz düşme yok).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

/** Yürüme klibinin (assets/orion-lowpoly.glb ile aynı kaynak) ölçülen hızı (m/s): klip hızı gerçek hıza oranlanır. */
const KLIP_HIZI = 1.25;

export const OYUNCU_BEDEN_YOLU = "/oyuncu-beden.glb";

export interface OyuncuBedeni {
  readonly kok: TransformNode;
  readonly meshler: readonly AbstractMesh[];
  /** Ayak konumu + yatay bakış (radyan, 0=+Z). */
  yerlestir(x: number, y: number, z: number, yaw: number): void;
  /** Yatay hız (m/s). 0 → boşta, >0 → yürüme klibi (hız oranında). */
  hareket(hiz: number): void;
  gorunur(g: boolean): void;
  yokEt(): void;
}

/** `boy`: bedenin metre cinsinden hedef boyu (ayaklar y=0'a oturtulur). */
export async function oyuncuBedeniYukle(sahne: Scene, boy: number, yol = OYUNCU_BEDEN_YOLU): Promise<OyuncuBedeni> {
  const sonuc = await ImportMeshAsync(yol, sahne, { pluginExtension: ".glb" });
  if (sonuc.meshes.length === 0) throw new Error(`oyuncu bedeni boş geldi: ${yol}`);

  const kok = new TransformNode("oyuncu_beden_kok", sahne);
  const ayar = new TransformNode("oyuncu_beden_ayar", sahne);
  ayar.parent = kok;
  sonuc.meshes[0]!.parent = ayar;

  // Ölç: boyu hedefe normalize et, ayakları y=0'a oturt (Orion yükleyicisiyle aynı yöntem).
  for (const m of sonuc.meshes) m.computeWorldMatrix(true);
  const olc = (): { alt: number; ust: number } => {
    let alt = Infinity, ust = -Infinity;
    for (const m of sonuc.meshes) {
      if (!m.getTotalVertices || m.getTotalVertices() === 0) continue;
      const k = m.getBoundingInfo().boundingBox;
      alt = Math.min(alt, k.minimumWorld.y); ust = Math.max(ust, k.maximumWorld.y);
    }
    return { alt, ust };
  };
  const ilk = olc();
  const hamBoy = ilk.ust - ilk.alt;
  if (!(hamBoy > 0.01)) throw new Error(`oyuncu bedeni ölçülemedi (boy=${hamBoy}): ${yol}`);
  ayar.scaling.setAll(boy / hamBoy);
  ayar.computeWorldMatrix(true);
  for (const m of sonuc.meshes) m.computeWorldMatrix(true);
  ayar.position.y -= olc().alt;

  // Işın/etkileşim bedene takılmasın (kapsül de pickable değildi).
  for (const m of sonuc.meshes) m.isPickable = false;

  const klipler: AnimationGroup[] = sonuc.animationGroups;
  for (const g of klipler) g.stop();
  const yuru = klipler.find((g) => /^yuru$|walk/i.test(g.name)) ?? null;
  const bosta = klipler.find((g) => /^bosta$|idle/i.test(g.name)) ?? null;
  if (!yuru) console.warn(`[oyuncu-beden] '${yol}' içinde yürüme klibi yok; yürürken beden kayacak.`);

  let oynayan: AnimationGroup | null = null;
  const oynat = (g: AnimationGroup | null, oran: number): void => {
    if (oynayan === g) { if (g) g.speedRatio = oran; return; }
    oynayan?.stop();
    if (!g) sonuc.skeletons[0]?.returnToRest();
    oynayan = g;
    if (g) { g.speedRatio = oran; g.start(true); }
  };
  oynat(bosta, 1);

  return {
    kok,
    meshler: sonuc.meshes,
    yerlestir(x, y, z, yaw) { kok.position.set(x, y, z); kok.rotation.y = yaw; },
    hareket(hiz) {
      if (hiz > 0.05 && yuru) oynat(yuru, Math.max(0.4, hiz / KLIP_HIZI));
      else oynat(bosta, 1);
    },
    gorunur(g) { kok.setEnabled(g); },
    yokEt() {
      for (const g of klipler) g.dispose();
      for (const s of sonuc.skeletons) s.dispose();
      for (const m of sonuc.meshes) m.dispose();
      ayar.dispose(); kok.dispose();
    },
  };
}
