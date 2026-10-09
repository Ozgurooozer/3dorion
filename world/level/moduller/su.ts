// world/level/moduller/su.ts — Su: lowpoly dalgalı göl yüzeyi, gökten yansıyan renk, güneş/ay parıltısı, kıyı köpüğü.
//
// Neden kendi shader'ı (SSR/WaterMaterial değil): Babylon'un su malzemesi iki ek render hedefi (yansıma + kırılma) ister —
// 8 GB VRAM bütçemizde pahalı ve lowpoly sanat yönüne uymuyor. Burada yüzey düz-gölgeli (üçgen başına normal,
// türevlerden), yansıyan renk GÖK paletinden (dünya durumunun o saatteki ufuk/zenit rengi → gece ve gündüz kendiliğinden),
// parıltı güneşin (gece ayın) yansıması. Binalar yansımaz — bilinen sınır; SSR gerekirse ayrı iş.
//
// Zeminden SONRA gelmeli: yüzey `seviye` yüksekliğinde bir disk, çanak (zemin.ts golX/golZ/golYaricap/golDerinlik) onu
// örter. Kıyıda arazi su seviyesini keser; disk çanaktan geniş (`yaricapCarpani`) ki kenar görünmesin.
"use strict";
import { Effect } from "@babylonjs/core/Materials/effect";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3, Vector4 } from "@babylonjs/core/Maths/math.vector";
import type { LevelModulu } from "../cekirdek/modul.ts";

export const SU_VARSAYILAN = {
  /** Su yüzeyinin merkezi (m) — zemin.ts göl merkeziyle AYNI olmalı. */
  x: -30,
  z: -32,
  /** Çanağın yarıçapı (m) — zemin.ts golYaricap ile aynı. */
  yaricap: 16,
  /** Yüzey yüksekliği (m). */
  seviye: -0.25,
  /** Disk, çanaktan bu kat geniş (kıyıda arazi keser). */
  yaricapCarpani: 1.15,
  /** Dalga yüksekliği (m) ve hızı. */
  dalga: 0.05,
  dalgaHiz: 0.9,
  /** Dalga sıklığı (1/m). */
  dalgaSikligi: 0.9,
  derinRenk: "#173f5c",
  siglikRenk: "#4aa6a8",
  kopukRenk: "#e8f6f0",
  /** Yansımanın gücü (Fresnel çarpanı). */
  yansima: 1,
  /** Güneş/ay parıltısı. */
  parilti: 1.1,
  /** Opaklık (0–1). */
  opaklik: 0.9,
  /** Disk çözünürlüğü: halka ve dilim sayısı. */
  halka: 14,
  dilim: 36,
};
export type SuAyari = typeof SU_VARSAYILAN;

/** Disk geometrisi: merkez + halkalar; konum yerel (merkez 0,0,0), y = 0. Saf. */
export function suDiski(yaricap: number, halka: number, dilim: number): { konum: Float32Array; indeks: Uint32Array } {
  const konum = [0, 0, 0], indeks: number[] = [];
  for (let h = 1; h <= halka; h++) for (let d = 0; d < dilim; d++) {
    const aci = ((d + (h % 2) * 0.5) / dilim) * Math.PI * 2, r = (h / halka) * yaricap;   // halka başına yarım dilim kayık: üçgenler düzensiz
    konum.push(Math.cos(aci) * r, 0, Math.sin(aci) * r);
  }
  const v = (h: number, d: number) => (h === 0 ? 0 : 1 + (h - 1) * dilim + (((d % dilim) + dilim) % dilim));
  for (let d = 0; d < dilim; d++) indeks.push(0, v(1, d + 1), v(1, d));
  for (let h = 1; h < halka; h++) for (let d = 0; d < dilim; d++) {
    indeks.push(v(h, d), v(h, d + 1), v(h + 1, d), v(h, d + 1), v(h + 1, d + 1), v(h + 1, d));
  }
  return { konum: new Float32Array(konum), indeks: new Uint32Array(indeks) };
}

export const SU_UNIFORMLAR = ["viewProjection", "world", "cameraPosition", "zaman", "dalga", "derin", "siglik", "kopuk", "ufuk", "zenit",
  "isikYon", "isikRenk", "sis", "p"] as const;

const VS = `
precision highp float;
attribute vec3 position;
uniform mat4 viewProjection; uniform mat4 world;
uniform float zaman; uniform vec3 dalga;   // yükseklik, hız, sıklık
varying vec3 wp; varying vec2 yerel;
void main(void) {
  vec4 w = world * vec4(position, 1.0);
  float f = dalga.z, t = zaman * dalga.y;
  float h = sin(w.x * f + t) * 0.5 + sin(w.z * f * 1.3 - t * 1.2) * 0.35 + sin((w.x + w.z) * f * 0.7 + t * 0.6) * 0.3;
  w.y += h * dalga.x;
  wp = w.xyz; yerel = position.xz;
  gl_Position = viewProjection * w;
}`;

const FS = `
precision highp float;
varying vec3 wp; varying vec2 yerel;
uniform vec3 cameraPosition;
uniform vec3 derin; uniform vec3 siglik; uniform vec3 kopuk;
uniform vec3 ufuk; uniform vec3 zenit;
uniform vec4 isikYon;     // xyz: ışığa doğru yön (gün güneş, gece ay), w: parıltı gücü
uniform vec3 isikRenk;
uniform vec4 sis;         // rgb sis rengi, a yoğunluk (exp2)
uniform vec4 p;           // x: merkezden kıyıya normalleşmiş yarıçap payı, y: yansıma, z: opaklık, w: gün ışığı
void main(void) {
  vec3 N = normalize(cross(dFdx(wp), dFdy(wp)));
  if (N.y < 0.0) N = -N;
  vec3 V = normalize(cameraPosition - wp);
  float ndv = max(dot(N, V), 0.0);
  float fres = clamp(0.12 + 0.88 * pow(1.0 - ndv, 3.0), 0.0, 1.0) * p.y;
  vec3 R = reflect(-V, N);
  vec3 gok = mix(ufuk, zenit, smoothstep(0.0, 0.65, R.y));
  float d = length(yerel) / p.x;                       // 1 = çanağın kıyısı
  float kenar = smoothstep(0.55, 1.0, d);
  vec3 govde = mix(derin, siglik, kenar) * (0.3 + 0.7 * p.w);
  vec3 c = mix(govde, gok, fres);
  float parilti = pow(max(dot(R, normalize(isikYon.xyz)), 0.0), 220.0) * isikYon.w;
  c += isikRenk * parilti;
  float kopukluk = smoothstep(0.93, 1.02, d + 0.025 * sin(wp.x * 4.0 + wp.z * 3.0));
  c = mix(c, kopuk * (0.35 + 0.65 * p.w), kopukluk * 0.75);
  float uzak = length(cameraPosition - wp);
  c = mix(c, sis.rgb, 1.0 - exp(-pow(sis.a * uzak, 2.0)));
  gl_FragColor = vec4(c, p.z * (1.0 - smoothstep(1.0, 1.12, d)));
}`;

let kayitli = false;
function shaderKaydet() {
  if (kayitli) return;
  kayitli = true;
  Effect.ShadersStore["suVertexShader"] = VS;
  Effect.ShadersStore["suFragmentShader"] = FS;
}
/** Test bekçisi için: fragment kodunun bildirilen uniform adları. */
export const SU_FRAGMAN_KODU = FS;
export const SU_KOSE_KODU = VS;

export const suModulu: LevelModulu<SuAyari> = {
  tur: "su",
  aciklama: "Lowpoly dalgalı su: gök paletinden yansıma (gece/gündüz), güneş-ay parıltısı, kıyı köpüğü. Zeminden sonra gelmeli.",
  varsayilan: SU_VARSAYILAN,
  aralik: {
    x: { min: -300, max: 300, adim: 1 }, z: { min: -300, max: 300, adim: 1 }, yaricap: { min: 2, max: 120, adim: 0.5 },
    seviye: { min: -10, max: 10, adim: 0.05 }, yaricapCarpani: { min: 1, max: 2, adim: 0.01 },
    dalga: { min: 0, max: 0.6, adim: 0.005 }, dalgaHiz: { min: 0, max: 5, adim: 0.05 }, dalgaSikligi: { min: 0.1, max: 4, adim: 0.05 },
    yansima: { min: 0, max: 1.5, adim: 0.01 }, parilti: { min: 0, max: 4, adim: 0.05 }, opaklik: { min: 0, max: 1, adim: 0.01 },
    halka: { min: 2, max: 60, adim: 1 }, dilim: { min: 8, max: 120, adim: 1 },
  },
  kur(b, a) {
    shaderKaydet();
    const g = suDiski(a.yaricap * a.yaricapCarpani, a.halka, a.dilim);
    const m = new Mesh("su", b.sahne);
    const v = new VertexData();
    v.positions = g.konum; v.indices = g.indeks;
    v.applyToMesh(m);
    m.position.set(a.x, a.seviye, a.z);
    m.freezeWorldMatrix();
    m.isPickable = false;
    m.metadata = { cizgisiz: true };   // gbuffer çizgisi dalgada gürültü üretir; GI/RSM'e girmez
    const malzeme = new ShaderMaterial("su", b.sahne, { vertex: "su", fragment: "su" }, {
      attributes: ["position"], uniforms: [...SU_UNIFORMLAR], needAlphaBlending: true,
    });
    malzeme.backFaceCulling = false;
    malzeme.setVector3("dalga", new Vector3(a.dalga, a.dalgaHiz, a.dalgaSikligi));
    const [dr, dg, db] = b.renk(a.derinRenk), [sr, sg, sb] = b.renk(a.siglikRenk), [kr, kg, kb] = b.renk(a.kopukRenk);
    malzeme.setColor3("derin", new Color3(dr, dg, db));
    malzeme.setColor3("siglik", new Color3(sr, sg, sb));
    malzeme.setColor3("kopuk", new Color3(kr, kg, kb));
    m.material = malzeme;
    const ufuk = new Color3(), zenit = new Color3(), isik = new Color3(), yon = new Vector4(), sis = new Vector4(), p = new Vector4();
    return {
      meshler: [m],
      guncelle() {
        const d = b.dunya(), f = b.sahne.fogColor;
        const [ur, ug, ub] = d.palet["gokUfuk"] ?? [0.7, 0.8, 0.9], [zr, zg, zb] = d.palet["gokZenit"] ?? [0.2, 0.4, 0.8];
        const gunduz = d.gunIsigi > 0.08;
        const kaynak = gunduz ? d.gunesYonu : d.ayYonu, [ir, ig, ib] = d.palet["isik"] ?? [1, 1, 1];
        malzeme.setFloat("zaman", d.sure);
        malzeme.setColor3("ufuk", ufuk.set(ur, ug, ub));
        malzeme.setColor3("zenit", zenit.set(zr, zg, zb));
        malzeme.setColor3("isikRenk", isik.set(ir, ig, ib));
        malzeme.setVector4("isikYon", yon.set(kaynak[0], kaynak[1], kaynak[2], a.parilti * (gunduz ? 1 : 0.45)));
        malzeme.setVector4("sis", sis.set(f.r, f.g, f.b, b.sahne.fogEnabled ? b.sahne.fogDensity : 0));
        malzeme.setVector4("p", p.set(a.yaricap, a.yansima, a.opaklik, d.gunIsigi));
      },
      yokEt() { m.dispose(); malzeme.dispose(); },
    };
  },
};
