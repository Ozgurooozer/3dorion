// world/level/odaEsyalari.ts — Blender odasını (assets/oda-esyalar.glb) sahneye yükler (spec 11).
//
// Model Babylon dünya koordinatında YERİNDE kurulmuştur (Blender betiği olculer.ts'den okur);
// burada konumlandırma YOK, yalnız yükleme + sahneye uyarlama var:
//   - ışın/kamera: büyük gövdeler (duvar, mobilya) seçilebilir kalır ki omuz kamerası
//     duvarın içine girmesin; küçük ışıklı parçalar (neon, lamba, hologram) seçilemez;
//   - ışık: PBR malzemeleri odadaki bütün ışıkları görsün (varsayılan 4 yetmiyor);
//   - parlama: kendinden ışıklı malzemeli parçalar parlama katmanına girer;
//   - dondurma: dünya matrisi ve malzemeler donar (statik dekor).
// Yükleme başarısız olursa hata FIRLATIR; oda.ts yakalar ve klasik odayı kurar.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import "@babylonjs/loaders/glTF";
import { varlik } from "../varlik.ts";
import { ODA_MODELI } from "./odaKipi.ts";

/**
 * Parlama katmanına girecek kendinden ışıklı malzemeler: düğüm adı `oda_<malzeme>`.
 * Işıklık göğü (`gok`) kendinden ışıklı ama girmez: dokusundaki mavi leke parlayınca
 * tavanda bulanık bir top oldu (görüntüde yakalandı).
 */
const ISIKLI = new Set(["neon_pembe", "neon_mavi", "lamba_yesil", "lamba_sicak", "hologram"]);
/** Kamera ışınını durdurması gereken büyük gövdeler. Gerisi (küçük dekor) ışın dışı. */
const GOVDE = new Set(["siva", "lambri", "tavan", "maun", "zemin", "deri_kirmizi"]);

/** Odadaki ışık sayısı (oda.ts yeni kip): ambient + 2 yön + 4 nokta = 7. */
export const ODA_ISIK_SAYISI = 8;

export interface OdaEsyalari {
  meshler: AbstractMesh[];
  /** Parlama katmanına girecek mesh'ler. */
  isikli: AbstractMesh[];
  /** Kamera ışınından muaf tutulacak mesh'ler (seçilemez). */
  isinDisi: AbstractMesh[];
}

/** Düğüm adından malzeme adı: "oda_neon_pembe" → "neon_pembe". */
export function malzemeAdi(dugum: string): string {
  return dugum.replace(/^oda_/, "").replace(/\.\d+$/, "");
}

export async function esyalariYukle(sahne: Scene): Promise<OdaEsyalari> {
  const sonuc = await ImportMeshAsync(varlik(ODA_MODELI), sahne, { pluginExtension: ".glb" });
  const meshler: AbstractMesh[] = [];
  const isikli: AbstractMesh[] = [];
  const isinDisi: AbstractMesh[] = [];
  for (const m of sonuc.meshes) {
    if (m.getTotalVertices() === 0) continue; // __root__ düğümü
    const ad = malzemeAdi(m.name);
    meshler.push(m);
    if (ISIKLI.has(ad)) isikli.push(m);
    if (GOVDE.has(ad)) {
      m.isPickable = true;
    } else {
      m.isPickable = false;
      isinDisi.push(m);
    }
    const mat = m.material;
    if (mat instanceof PBRMaterial) {
      mat.maxSimultaneousLights = ODA_ISIK_SAYISI;
      // Ortam dokusu (IBL) yok: tam metal yüzey yalnız doğrudan ışıkla simsiyah kalır.
      // Pirinç yarı metal tutulur ki lambaların ışığında parlasın.
      if (mat.metallic !== null && mat.metallic > 0.6) mat.metallic = 0.55;
      mat.freeze();
    }
    m.freezeWorldMatrix();
  }
  if (meshler.length === 0) throw new Error(`${ODA_MODELI}: yüklendi ama mesh yok`);
  return { meshler, isikli, isinDisi };
}
