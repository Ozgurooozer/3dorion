// world/level/bankMesh.ts — Bank'ın Babylon mesh'leri: `bank.ts` parça tablosundan basit kutular (tahta oturma/sırtlık, demir ayak/direk).
//
// Veri ve yerleşim `bank.ts`te (saf, testli); burası yalnız mesh'e çevirir. Mesh'ler ışına/tıklamaya kapalıdır (`isPickable = false`): etkileşim ve
// çarpışma veriden gelir (`BANK_KATI`, `BANK_KUTUSU`). Sahnedeki `sahne.meshes` ova'nın çizgi (kontur) geçişine kendiliğinden girer.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { BANK_PARCALARI, type BankMalzemesi } from "./bank.ts";

const RENK: Readonly<Record<BankMalzemesi, readonly [number, number, number]>> = {
  tahta: [0.55, 0.36, 0.18],
  demir: [0.16, 0.17, 0.20],
};

/** Bankı sahneye kurar; dönen mesh'ler çağıranın (yıkımda `dispose`, gölgeye katma). Malzemeler mesh'lerle birlikte yok edilir. */
export function bankMeshleriKur(sahne: Scene): Mesh[] {
  const malzeme = Object.fromEntries((Object.keys(RENK) as BankMalzemesi[]).map((ad) => {
    const m = new StandardMaterial(`m_bank_${ad}`, sahne);
    m.diffuseColor = new Color3(...RENK[ad]);
    m.specularColor = new Color3(0.04, 0.04, 0.04);
    return [ad, m];
  })) as Record<BankMalzemesi, StandardMaterial>;
  return BANK_PARCALARI.map((p) => {
    const mesh = CreateBox(`bank_${p.ad}`, { width: p.kutu.g, height: p.kutu.yuk, depth: p.kutu.d }, sahne);
    mesh.position.set(p.kutu.x, p.kutu.y, p.kutu.z);
    mesh.material = malzeme[p.malzeme];
    mesh.isPickable = false;
    return mesh;
  });
}
