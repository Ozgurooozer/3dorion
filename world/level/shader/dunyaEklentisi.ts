// world/level/shader/dunyaEklentisi.ts — TEK dünya eklentisi: özel shader'ların malzemelerde çalışan kısmı (spec 20).
//
// Neden tek eklenti: Babylon her eklentiyi ayrı derleme değişkeni yapar; dört özelliği (gök zamanı, zaman kırığı,
// hata imzası, fırça normali) tek eklentide uniform BAYRAKLARIYLA açıp kapamak malzeme yeniden derlemesini önler
// ("zekice, uzay gemisi değil" — vault isik0fis). Modüller (shader/moduller/*) yalnız `DunyaUniformlari`na yazar.
//
// Kanca noktaları (Babylon Standard gölgelendiricisi):
//   CUSTOM_VERTEX_UPDATE_WORLDPOS  hata imzası: dünya-uzayı bloklarında zamanla sıçrayan köşeler
//   CUSTOM_FRAGMENT_BEFORE_LIGHTS  fırça: normal prosedürel fırça akışıyla bükülür (ışık "yalan söyler")
//   CUSTOM_FRAGMENT_BEFORE_FOG     gök zamanı (yalnız gök malzemesi), zaman kırığı, hata rengi
// Gök malzemesi `gok: true` ile kurulur (DUNYAGOK tanımı: yıldız/ay kodu yalnız orada derlenir).
// Nesne başına hata: mesh.metadata.hata (0–1) — çizim başına uniform (örneklenmiş kopyalar kaynağınkini paylaşır).
"use strict";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import type { Material } from "@babylonjs/core/Materials/material";
import type { MaterialDefines } from "@babylonjs/core/Materials/materialDefines";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import type { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { RegisterClass } from "@babylonjs/core/Misc/typeStore";
import type { Renk } from "../cekirdek/renk.ts";
import type { Vec3 } from "../cekirdek/levelTanimi.ts";

type R5 = [Renk, Renk, Renk, Renk, Renk];

export interface DunyaUniformlari {
  sure: number;
  gok: { karisim: number; zenit: Renk; ufuk: Renk; yildiz: number; ayYonu: Vec3; ayBoyu: number; ayRengi: Renk };
  kirik: { acik: boolean; merkez: Vec3; yaricap: number; kenar: number; guc: number; rampa: R5; isilti: Renk };
  hata: { guc: number; merkez: Vec3; yaricap: number; blok: number; hiz: number; magenta: Renk; cyan: Renk };
  firca: { guc: number; olcek: number };
}

const SIYAH: Renk = [0, 0, 0];
export const dunyaUniformlariYap = (): DunyaUniformlari => ({
  sure: 0,
  gok: { karisim: 0, zenit: SIYAH, ufuk: SIYAH, yildiz: 0, ayYonu: [0, -1, 0], ayBoyu: 0.9995, ayRengi: [1, 1, 1] },
  kirik: { acik: false, merkez: [0, 0, 0], yaricap: 1, kenar: 0.1, guc: 0, rampa: [SIYAH, SIYAH, SIYAH, SIYAH, SIYAH], isilti: SIYAH },
  hata: { guc: 0, merkez: [0, 0, 0], yaricap: 1, blok: 0.5, hiz: 8, magenta: [1, 0.13, 0.47], cyan: [0.04, 1, 0.94] },
  firca: { guc: 0, olcek: 1 },
});

const UNIFORMLAR = ["dZaman", "dGok1", "dGok2", "dGok3", "dGok4", "dKirik1", "dKirik2", "dKirik3", "dR0", "dR1", "dR2", "dR3", "dR4",
  "dHata1", "dHata2", "dHata3", "dHata4", "dFirca", "dNesne"] as const;
const BILDIRIM = `#ifdef DUNYA\n${UNIFORMLAR.map((u) => `uniform vec4 ${u};`).join("\n")}\n#endif\n`;

/** Ortak GLSL: karma ve bölge katsayısı (iki gölgelendiricide de). */
const ORTAK = `
#ifdef DUNYA
float dKarma(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float dHataKatsayi(vec3 w) {
  float bolge = dHata1.x * (1.0 - smoothstep(0.7, 1.0, length(w - dHata4.xyz) / max(dHata4.w, 0.01)));
  return clamp(bolge + dNesne.x, 0.0, 1.0);
}
#endif
`;

export const DUNYA_KOSE_GLSL = `
#ifdef DUNYA
{
  float dh = dHataKatsayi(worldPos.xyz);
  if (dh > 0.0) {
    float b = max(dHata1.y, 0.01);
    float r = dKarma(floor(worldPos.xyz / b) + floor(dZaman.x * dHata1.z));
    if (r > 0.9) worldPos.xyz += (vec3(fract(r * 13.1), fract(r * 7.3), fract(r * 3.7)) - 0.5) * b * 0.8 * dh;
  }
}
#endif
`;

export const DUNYA_ISIK_ONCESI_GLSL = `
#ifdef DUNYA
if (dFirca.x > 0.0) {
  vec3 fp = vPositionW * dFirca.y;
  vec2 akis = vec2(sin(fp.x * 1.3 + fp.z * 0.7 + sin(fp.z * 2.1 + fp.y)), cos(fp.z * 1.1 - fp.x * 0.9 + cos(fp.x * 1.7 - fp.y)));
  normalW = normalize(normalW + vec3(akis.x, 0.35 * akis.y * akis.x, akis.y) * dFirca.x);
}
#endif
`;

export const DUNYA_SIS_ONCESI_GLSL = `
#ifdef DUNYA
#ifdef DUNYAGOK
{
  vec3 gd = normalize(vPositionW - vEyePosition.xyz);
  float gy = clamp(gd.y, 0.0, 1.0);
  vec3 gr = mix(dGok2.rgb, dGok1.rgb, pow(gy, 0.55));
  vec3 gh = floor(gd * 260.0);
  float gs = dKarma(gh);
  float yildiz = step(1.0 - dGok2.a * 0.006, gs) * smoothstep(0.03, 0.25, gy) * (0.55 + 0.45 * sin(dZaman.x * 2.7 + gs * 61.0));
  gr += vec3(yildiz);
  float ay = smoothstep(dGok3.w, dGok3.w + 0.0015, dot(gd, normalize(dGok3.xyz)));
  gr = mix(gr, dGok4.rgb, ay);
  color.rgb = mix(color.rgb, gr, dGok1.a);
}
#endif
if (dKirik2.x > 0.5) {
  float dk = length(vPositionW - dKirik1.xyz) / max(dKirik1.w, 0.01);
  float ic = 1.0 - smoothstep(1.0 - dKirik2.y, 1.0, dk);
  if (ic > 0.0) {
    float l = clamp(dot(color.rgb, vec3(0.299, 0.587, 0.114)) * 4.0, 0.0, 3.999);
    float f = fract(l);
    vec3 ra = l < 1.0 ? dR0.rgb : (l < 2.0 ? dR1.rgb : (l < 3.0 ? dR2.rgb : dR3.rgb));
    vec3 rb = l < 1.0 ? dR1.rgb : (l < 2.0 ? dR2.rgb : (l < 3.0 ? dR3.rgb : dR4.rgb));
    color.rgb = mix(color.rgb, mix(ra, rb, f), ic * dKirik2.z);
    float kenar = smoothstep(1.0 - dKirik2.y, 1.0 - dKirik2.y * 0.5, dk) * ic;
    float titre = 0.5 + 0.5 * sin(dZaman.x * 9.0 + vPositionW.y * 3.0 + dKarma(floor(vPositionW * 2.0)) * 6.28);
    color.rgb += dKirik3.rgb * kenar * titre;
  }
}
{
  float dh = dHataKatsayi(vPositionW);
  if (dh > 0.0) {
    float b = max(dHata1.y, 0.01);
    float r = dKarma(floor(vPositionW / b) + floor(dZaman.x * dHata1.z));
    float tarama = step(0.5, fract(vPositionW.y * 7.0 + dZaman.x * 3.0));
    vec3 gl = r > 0.8 ? dHata2.rgb : (r > 0.6 ? dHata3.rgb : (r > 0.5 ? vec3(1.0) - color.rgb : color.rgb));
    color.rgb = mix(color.rgb, gl, dh * (0.25 + 0.75 * step(0.5, r)) * (0.75 + 0.25 * tarama));
  }
}
#endif
`;

export class DunyaEklentisi extends MaterialPluginBase {
  private readonly u: DunyaUniformlari;
  private readonly gok: boolean;

  /** `u` verilmezse kapalı değerler: malzeme kopyalanırken eklenti tek argümanla kurulur (isikEklentisi.ts notu). */
  constructor(malzeme: Material, u: DunyaUniformlari = dunyaUniformlariYap(), gok = false) {
    super(malzeme, "Dunya", 220, { DUNYA: false, DUNYAGOK: false });
    this.u = u;
    this.gok = gok;
    this._enable(true);
  }

  override getClassName(): string { return "DunyaEklentisi"; }

  override prepareDefines(defines: MaterialDefines): void {
    defines["DUNYA"] = true;
    defines["DUNYAGOK"] = this.gok;
  }

  override getUniforms() {
    return { ubo: UNIFORMLAR.map((name) => ({ name, size: 4, type: "vec4" })), vertex: BILDIRIM, fragment: BILDIRIM };
  }

  override bindForSubMesh(ub: UniformBuffer, _s: Scene, _e: AbstractEngine, subMesh: SubMesh): void {
    const u = this.u, g = u.gok, k = u.kirik, h = u.hata;
    ub.updateFloat4("dZaman", u.sure % 1000, 0, 0, 0);
    ub.updateFloat4("dGok1", ...g.zenit, g.karisim);
    ub.updateFloat4("dGok2", ...g.ufuk, g.yildiz);
    ub.updateFloat4("dGok3", ...g.ayYonu, g.ayBoyu);
    ub.updateFloat4("dGok4", ...g.ayRengi, 0);
    ub.updateFloat4("dKirik1", ...k.merkez, k.yaricap);
    ub.updateFloat4("dKirik2", k.acik ? 1 : 0, k.kenar, k.guc, 0);
    ub.updateFloat4("dKirik3", ...k.isilti, 0);
    k.rampa.forEach((r, i) => ub.updateFloat4(`dR${i}`, ...r, 0));
    ub.updateFloat4("dHata1", h.guc, h.blok, h.hiz, 0);
    ub.updateFloat4("dHata2", ...h.magenta, 0);
    ub.updateFloat4("dHata3", ...h.cyan, 0);
    ub.updateFloat4("dHata4", ...h.merkez, h.yaricap);
    ub.updateFloat4("dFirca", u.firca.guc, u.firca.olcek, 0, 0);
    const md = subMesh.getMesh().metadata as { hata?: number } | null | undefined;
    ub.updateFloat4("dNesne", typeof md?.hata === "number" ? md.hata : 0, 0, 0, 0);
  }

  override getCustomCode(tur: string): Record<string, string> | null {
    if (tur === "vertex") return { CUSTOM_VERTEX_DEFINITIONS: ORTAK, CUSTOM_VERTEX_UPDATE_WORLDPOS: DUNYA_KOSE_GLSL };
    if (tur === "fragment") {
      return { CUSTOM_FRAGMENT_DEFINITIONS: ORTAK, CUSTOM_FRAGMENT_BEFORE_LIGHTS: DUNYA_ISIK_ONCESI_GLSL, CUSTOM_FRAGMENT_BEFORE_FOG: DUNYA_SIS_ONCESI_GLSL };
    }
    return null;
  }
}
RegisterClass("BABYLON.DunyaEklentisi", DunyaEklentisi);
