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
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import "@babylonjs/loaders/glTF";
import { gorunenMeshler, meshRengi, type BedenAyari } from "./bedenAyari.ts";

/** Yürüme klibinin (assets/orion-lowpoly.glb ile aynı kaynak) ölçülen hızı (m/s): klip hızı gerçek hıza oranlanır. */
const KLIP_HIZI = 1.25;


export interface OyuncuBedeni {
  readonly kok: TransformNode;
  readonly meshler: readonly AbstractMesh[];
  /** Ayak konumu + yatay bakış (radyan, 0=+Z). */
  yerlestir(x: number, y: number, z: number, yaw: number): void;
  /** Yatay hız (m/s). 0 → boşta, >0 → yürüme klibi (hız oranında). */
  hareket(hiz: number): void;
  /** Tek satır tanı: kaç mesh açık, hangi adlar, ölçek, kök konumu, sınır kutusu (görünmezlik şikâyetinde log'dan okunur). */
  tani(): string;
  /** Giysi seçimini ve renkleri uygula (modüler beden: `bedenAyari.ts`). Anında; yeniden yükleme yok. */
  ayarla(a: BedenAyari): void;
  gorunur(g: boolean): void;
  yokEt(): void;
}

/** `boy`: bedenin metre cinsinden hedef boyu (ayaklar y=0'a oturtulur). */
export async function oyuncuBedeniYukle(sahne: Scene, boy: number, yol: string): Promise<OyuncuBedeni> {
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

  // Parçalar glb'de ADLI mesh'lerdir (`oyuncu_<parça>`), malzeme başına bir renk. Tek primitive'li mesh adı düğüm adıdır; çok primitive'liyse `_primitiveN` eki gelir.
  const parcaAdi = (m: AbstractMesh): string => m.name.replace(/_primitive\d+$/, "");
  const ayarla = (a: BedenAyari): void => {
    const gorunen = new Set(gorunenMeshler(a));
    let taninan = 0;
    for (const m of sonuc.meshes) {
      const anahtar = meshRengi(parcaAdi(m));
      if (anahtar === null) continue;  // iskelet kökü ve bedene ait olmayanlar
      taninan++;
      m.setEnabled(gorunen.has(parcaAdi(m)));
      if (m.material instanceof PBRMaterial) m.material.albedoColor = Color3.FromHexString(a.renk[anahtar]).toLinearSpace();
    }
    // Ad eşleşmezse bütün giysiler üst üste görünürdü: sessiz kalma.
    if (taninan === 0) console.warn(`[oyuncu-beden] parça adı eşleşmedi; mesh adları: ${sonuc.meshes.map((m) => m.name).join(", ")}`);
  };

  return {
    ayarla,
    tani() {
      const acik = sonuc.meshes.filter((m) => m.isEnabled() && m.getTotalVertices() > 0).map((m) => m.name);
      let alt = Infinity, ust = -Infinity;
      for (const m of sonuc.meshes) {
        if (!m.isEnabled() || m.getTotalVertices() === 0) continue;
        m.computeWorldMatrix(true);
        const k = m.getBoundingInfo().boundingBox;
        alt = Math.min(alt, k.minimumWorld.y); ust = Math.max(ust, k.maximumWorld.y);
      }
      return `${sonuc.meshes.length} mesh, açık=[${acik.join(",")}], ölçek=${ayar.scaling.x.toFixed(3)}, kök=(${kok.position.x.toFixed(2)},${kok.position.y.toFixed(2)},${kok.position.z.toFixed(2)}), y=[${alt.toFixed(2)},${ust.toFixed(2)}]`;
    },
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
