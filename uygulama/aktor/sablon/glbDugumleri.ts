// uygulama/aktor/sablon/glbDugumleri.ts — YERLEŞTİRİLMİŞ GLB'DEN ADLI BOŞ DÜĞÜMLER (spec 45 B7; Unreal'da mesh soketleri). Babylon katmanı: saf eşleme `aktorSablonu.ts` `glbdenSablon`da.
//
// Sanatçı glb'de `soket_<ad>` adlı boş düğüm koyar (Blender Empty); bu işlev nesnenin sahne düğümünün soyundan o düğümleri, NESNE KÖKÜNE GÖRE yerel konum/dönüşle (derece) okur.
// Nesne ölçeği kökün dünya matrisinde olduğundan çıkarılır (soket konumu ölçeksiz glb uzayında kalır; ölçek aktörün kendi alanı). Okuma sahneyi DEĞİŞTİRMEZ.
// Hiçbir işlev fırlatmaz: düğüm yoksa/çözülemezse kodlu uyarı (AKT-SBL-008) döner.
"use strict";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { kodlu } from "../../../world/level/cekirdek/aktorHatalari.ts";
import { GLB_SOKET_ONEKI, type GlbDugumu } from "./aktorSablonu.ts";

const DERECE = 180 / Math.PI;
/** Konum/dönüşte yuvarlama: kayan nokta gürültüsü (1e-8) level dosyasına girmesin. */
const yuvarla = (x: number, basamak: number): number => { const k = 10 ** basamak; const r = Math.round(x * k) / k; return r === 0 ? 0 : r; };

export type GlbDugumOkuma = { ok: true; dugumler: GlbDugumu[] } | { ok: false; neden: string };

/** `kok` nesne düğümünün soyundaki `soket_` önekli düğümler; yerel konum (m) ve dönüş (derece), nesne köküne göre. */
export function glbDugumleriniOku(kok: TransformNode | null | undefined): GlbDugumOkuma {
  if (!kok) return { ok: false, neden: kodlu("AKT-SBL-008", "nesnenin sahne düğümü yok") };
  let ters: Matrix;
  try {
    const kokDunya = kok.computeWorldMatrix(true);
    ters = kokDunya.clone().invert();
  } catch (e) {
    return { ok: false, neden: kodlu("AKT-SBL-008", `kök matrisi okunamadı: ${e instanceof Error ? e.message : String(e)}`) };
  }
  const dugumler: GlbDugumu[] = [];
  for (const d of kok.getChildTransformNodes(false)) {
    if (!d.name.startsWith(GLB_SOKET_ONEKI)) continue;
    const yerel = d.computeWorldMatrix(true).multiply(ters);
    const olcek = new Vector3(), donus = new Quaternion(), konum = new Vector3();
    if (!yerel.decompose(olcek, donus, konum)) continue;   // sıfır ölçekli düğüm: yön yok, atla (glbdenSablon'a hiç girmez)
    const e = donus.toEulerAngles();
    dugumler.push({
      ad: d.name,
      konum: [yuvarla(konum.x, 4), yuvarla(konum.y, 4), yuvarla(konum.z, 4)],
      donus: [yuvarla(e.x * DERECE, 2), yuvarla(e.y * DERECE, 2), yuvarla(e.z * DERECE, 2)],
    });
  }
  return { ok: true, dugumler };
}
