// world/level/gi/giEklentisi.ts — Işık Hacmi'nin MALZEME EKLENTİSİ: pikselde ışınım hacmini (ortam küpü) okur, dolaylı ışığı
// diffuse'a ekler. Ekran uzayı geçişi YOK (ek çizim yok, ekran boyu doku yok): GI ofiste efekt zinciri kapalıyken de çalışır
// (birlesikDunya ofis içinde `sonrasiAtla(true)` ile bütün ekran efektlerini kapatıyor).
//
// Nereye girer (Babylon GIRSM eklentisinin kancalarıyla aynı mantık):
//   Standard: `vec3 finalDiffuse=` satırından ÖNCE `diffuseBase += gi` (ışıkların toplamına; albedo/doku çarpımı sonra gelir,
//             IsikStiliEklentisi'nin kancası). Standard gama uzayında çalışır, GI doğrusal → spike'ta dönüşüm yok (not).
//   PBR:      `CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION` → `finalDiffuse += gi × surfaceAlbedo`.
//   Kip 1 ("yalnız GI", hata ayıklama): son rengin yerine ham ışınım (gama 2,2) yazılır.
// Değerler bütün malzemelerin ORTAK `GiDurumu`ndan okunur (stil eklentisinin deseni): güç/kip değişince derleme yok.
"use strict";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import type { Material } from "@babylonjs/core/Materials/material";
import type { MaterialDefines } from "@babylonjs/core/Materials/materialDefines";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { RegisterClass } from "@babylonjs/core/Misc/typeStore";
import { MALZEME_GLSL } from "./isikHacmiGlsl.ts";

export interface GiDurumu {
  /** 6 yönlü ışınım atlası (yoksa eklenti kapalı derlenir). */
  doku: BaseTexture | null;
  /** köken xyz (m), voxel (m) */
  koken: [number, number, number, number];
  /** hücre sayısı xyz, atlas karo sütunu */
  n: [number, number, number, number];
  /** L0 atlas en, boy (blok boyu), güç, kip (0 ekle, 1 yalnız GI) */
  at: [number, number, number, number];
}

export const giDurumuYap = (): GiDurumu => ({ doku: null, koken: [0, 0, 0, 1], n: [1, 1, 1, 1], at: [1, 1, 1, 0] });

/** Standard'a eklenen satır (regex noktası: `IsikStiliEklentisi` ile aynı; ikisi birlikteyse öncelik sırası belirler). */
export const STANDARD_EK = "diffuseBase += giIsinim(vPositionW, normalW) * giAt.z;";
export const PBR_EK = "finalDiffuse += giIsinim(vPositionW, normalW) * giAt.z * surfaceAlbedo.rgb;";

export class GiHacmiEklentisi extends MaterialPluginBase {
  private readonly durum: GiDurumu;
  private readonly pbr: boolean;

  /** `durum` verilmezse kapalı (Babylon kopyalarken sınıf adından tek argümanla kurar: GIRSM'in ışıksız kopyası gibi). */
  constructor(malzeme: Material, durum: GiDurumu = giDurumuYap()) {
    // Öncelik 220: stil eklentisinden (210) SONRA → aynı regex noktasında GI bantlamanın ARDINDAN eklenir (bant GI'yi görmez;
    // ova'ya geçiş spike 3'ün kararı, ofiste stil eklentisi yok).
    super(malzeme, "GiHacmi", 220, { GIHACIM: false });
    this.durum = durum;
    this.pbr = malzeme.getClassName().startsWith("PBR");
    this._enable(true);
  }

  override getClassName(): string { return "GiHacmiEklentisi"; }

  /** GI kaldırılınca: eklenti devre dışı (malzeme yeniden derlenir, GI satırı düşer). */
  kapat(): void { this._enable(false); }

  override prepareDefines(defines: MaterialDefines): void { defines["GIHACIM"] = this.durum.doku !== null; }

  override isReadyForSubMesh(): boolean { return !this.durum.doku || this.durum.doku.isReady(); }

  override getSamplers(samplers: string[]): void { samplers.push("giIrr"); }

  override getUniforms() {
    return {
      ubo: ["giKoken", "giN", "giAt"].map((name) => ({ name, size: 4, type: "vec4" })),
      fragment: `#ifdef GIHACIM
uniform vec4 giKoken;
uniform vec4 giN;
uniform vec4 giAt;
#endif
`,
    };
  }

  override bindForSubMesh(ub: UniformBuffer): void {
    const d = this.durum;
    if (!d.doku) return;
    ub.updateFloat4("giKoken", ...d.koken);
    ub.updateFloat4("giN", ...d.n);
    ub.updateFloat4("giAt", ...d.at);
    ub.setTexture("giIrr", d.doku);
  }

  override getCustomCode(tur: string): Record<string, string> | null {
    if (tur !== "fragment") return null;
    const sarmala = (govde: string) => `#ifdef GIHACIM
${govde}
#endif
`;
    const tanim = sarmala(`uniform sampler2D giIrr;
${MALZEME_GLSL}`);
    const kip = sarmala(`if (giAt.w > 0.5) ${this.pbr ? "finalColor" : "color"} = vec4(pow(max(giIsinim(vPositionW, normalW), vec3(0.0)), vec3(1.0 / 2.2)), 1.0);`);
    if (this.pbr) {
      return {
        CUSTOM_FRAGMENT_DEFINITIONS: tanim,
        CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION: sarmala(PBR_EK),
        CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: kip,
      };
    }
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: tanim,
      // Regex noktası: eşleşen metin yerine konur → satır geri yazılır (üç #if dalının üçüne de).
      "!vec3 finalDiffuse=": `${sarmala(STANDARD_EK)}vec3 finalDiffuse=`,
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: kip,
    };
  }
}
RegisterClass("BABYLON.GiHacmiEklentisi", GiHacmiEklentisi);
