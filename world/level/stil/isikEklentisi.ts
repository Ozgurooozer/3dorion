// world/level/stil/isikEklentisi.ts — Işığı stile göre işleyen malzeme eklentisi: basamaklar (cel/toon), renkli
// gölge, eşikli parlama, kenar ışığı, Moebius taraması.
//
// Nereye girer: Standard malzeme bütün ışıkları (gölge çarpanı dahil) `diffuseBase`te toplar; eklenti kodunu
// `vec3 finalDiffuse=` satırının hemen ÖNÜNE sokar (regex noktası). Böylece CSM gölgesi, sis, ince örnek (çim) ve
// rüzgâr eklentisi olduğu gibi çalışır — ayrı bir "toon malzemesi" yok (Babylon CellMaterial bu yüzden seçilmedi,
// docs/arastirma/stil-shaderlari.md).
//
// Değerler bütün ışıklı malzemelerde ORTAK bir durum nesnesinden okunur (`IsikStiliDurumu`, stil sistemi yazar):
// stil değişince yeniden derleme yok, yalnız uniform. Kapalıyken (`acik` = 0) kod dalı atlanır.
//
// Basamak: ışık parlaklığı tam ışığa (güneşe dik bakan yüz + gök dolgusu) oranlanır, `bant` basamağa bölünür,
// basamak `enKoyu`dan 1'e eşit aralıklı. Işığın RENGİ korunur, yalnız parlaklığı basamaklanır.
"use strict";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import type { Material } from "@babylonjs/core/Materials/material";
import type { MaterialDefines } from "@babylonjs/core/Materials/materialDefines";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";

/** Stil sisteminin yazdığı, bütün ışıklı malzemelerin okuduğu değerler (uniform düzeninde). */
export interface IsikStiliDurumu {
  /** acik, bant, yumusaklik, enKoyu */
  a: [number, number, number, number];
  /** golgeKarisim, parlama, parlamaBoyu, kenarIsik */
  b: [number, number, number, number];
  /** kenarEsik, tarama, tamIsik, piksel */
  c: [number, number, number, number];
  /** gölge tonu (rgb) */
  golge: [number, number, number];
  /** güneşe doğru birim yön */
  gunes: [number, number, number];
}

export const isikStiliDurumuYap = (): IsikStiliDurumu => ({
  a: [0, 3, 0, 0.35], b: [0, 0, 32, 0], c: [0.72, 0, 1, 1], golge: [0.3, 0.3, 0.6], gunes: [0, 1, 0],
});

/** Eklenen GLSL (test: yer tutucu adları ve kullandığı Babylon değişkenleri burada görünür). */
export const ISIK_STILI_GLSL = `
#ifdef STIL
if (stilA.x > 0.5) {
  float stL = dot(diffuseBase, vec3(0.2126, 0.7152, 0.0722));
  float stTam = max(stilC.z, 1e-4);
  float stN = max(stilA.y, 1.0);
  float stK = clamp(stL / stTam, 0.0, 0.9999) * stN;
  float stI = floor(stK);
  float stW = max(stilA.z * stN, 1e-4);
  float stB = min(stI + smoothstep(1.0 - stW, 1.0, stK - stI), stN - 1.0);
  float stD = stN > 1.5 ? stB / (stN - 1.0) : 1.0;
  diffuseBase = diffuseBase / max(stL, 1e-4) * mix(stilA.w, 1.0, stD) * stTam;
  vec3 stG = stilGolge.rgb / max(dot(stilGolge.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.05);
  diffuseBase = mix(diffuseBase, diffuseBase * stG, (1.0 - stD) * stilB.x);
  float stNdl = max(dot(normalW, stilGunes.xyz), 0.0);
  float stGol = clamp(aggShadow - (numLights - 1.0), 0.0, 1.0);
  float stIsikta = step(0.001, stNdl * stGol);
  if (stilB.y > 0.0) {
    vec3 stH = normalize(stilGunes.xyz + viewDirectionW);
    float stS = pow(max(dot(normalW, stH), 0.0), stilB.z) * stIsikta;
    diffuseBase += smoothstep(0.5, 0.52, stS) * stilB.y * stTam;
  }
  if (stilB.w > 0.0) {
    float stR = (1.0 - max(dot(viewDirectionW, normalW), 0.0)) * pow(stNdl * stGol, 0.1);
    diffuseBase += smoothstep(stilC.x - 0.01, stilC.x + 0.01, stR) * stilB.w * stTam;
  }
  if (stilC.y > 0.0) {
    vec2 stP = floor(gl_FragCoord.xy / max(stilC.w, 1.0));
    float stC = 0.0;
    if (stD < 0.8) stC = max(stC, step(mod(stP.x + stP.y, 7.0), 0.9));
    if (stD < 0.55) stC = max(stC, step(mod(stP.x - stP.y, 7.0), 0.9));
    if (stD < 0.3) stC = max(stC, step(mod(stP.y, 5.0), 0.9));
    diffuseBase *= 1.0 - stC * stilC.y * 0.85;
  }
}
#endif
`;

export class IsikStiliEklentisi extends MaterialPluginBase {
  private readonly durum: IsikStiliDurumu;

  constructor(malzeme: Material, durum: IsikStiliDurumu) {
    super(malzeme, "IsikStili", 210, { STIL: false });
    this.durum = durum;
    this._enable(true);
  }

  override getClassName(): string { return "IsikStiliEklentisi"; }

  override prepareDefines(defines: MaterialDefines): void { defines["STIL"] = true; }

  override getUniforms() {
    return {
      ubo: ["stilA", "stilB", "stilC", "stilGolge", "stilGunes"].map((name) => ({ name, size: 4, type: "vec4" })),
      fragment: "#ifdef STIL\nuniform vec4 stilA;\nuniform vec4 stilB;\nuniform vec4 stilC;\nuniform vec4 stilGolge;\nuniform vec4 stilGunes;\n#endif\n",
    };
  }

  override bindForSubMesh(ub: UniformBuffer): void {
    const d = this.durum;
    ub.updateFloat4("stilA", ...d.a);
    ub.updateFloat4("stilB", ...d.b);
    ub.updateFloat4("stilC", ...d.c);
    ub.updateFloat4("stilGolge", ...d.golge, 0);
    ub.updateFloat4("stilGunes", ...d.gunes, 0);
  }

  override getCustomCode(tur: string): Record<string, string> | null {
    if (tur !== "fragment") return null;
    // Regex noktası: eşleşen metin yerine konur → satırı geri yazıyoruz. Üç #if dalının üçüne de girer; derlenen bir tane.
    return { "!vec3 finalDiffuse=": `${ISIK_STILI_GLSL}\nvec3 finalDiffuse=` };
  }
}
