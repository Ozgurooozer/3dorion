// world/level/stil/efektler.ts — Ekran uzayı stil efektleri: ÇİZGİ (kenar) ve RENK (palet, titreme, posterize).
//
// Çizgi: Babylon'da hazır kenar efekti yok (docs/arastirma/stil-shaderlari.md). Sahne bir kez daha
// GeometryBufferRenderer'a çizilir (doğrusal görüş derinliği + dünya normali), tam ekran geçiş kenarı bulur:
//   kip 0 Sobel  — derinlik (GÖRELİ: fark / derinlik) ve normal üzerinde 3×3; dış hat + iç kırılım (anime, Moebius).
//   kip 1 t3ssel8r — 4 komşu: komşu daha UZAKSA yakın taraf koyu dış çizgi; normal farkı (tek yön eğilimli,
//                    çift çizgi olmasın) açık iç vurgu (piksel-sanat kaya kenarları).
// Gbuffer'a yalnız ışıklı ve çizgiye uygun mesh'ler girer: gök/bulut/güneş (pişmiş) yüz yüz normal kenarı üretir,
// çim binlerce yaprakla gürültü üretir ve rüzgâr kayması gbuffer'da yok (`metadata.cizgisiz`).
// Çizgi uzaklıkla söner: efekt sisten SONRA gelir, sönmezse uzak dağlar çizgiye boğulur.
//
// Renk: palete yuvarlama (level paleti + gölge tonları, ≤ 48 renk), 4×4 Bayer titreme, posterize, doygunluk, gren.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { PostProcess } from "@babylonjs/core/PostProcesses/postProcess";
import { Effect } from "@babylonjs/core/Materials/effect";
import { GeometryBufferRenderer } from "@babylonjs/core/Rendering/geometryBufferRenderer";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";
import type { Renk } from "../cekirdek/renk.ts";

export const PALET_SINIRI = 48;

const CIZGI_GLSL = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform sampler2D derinlikDoku;
uniform sampler2D normalDoku;
uniform vec2 texel;
uniform vec4 cizgiA;   // kalinlik, derinlikEsik, normalEsik, guc
uniform vec4 cizgiB;   // vurgu, titreme, kip, uzaklik
uniform vec3 cizgiRenk;

float D(vec2 uv) { float d = texture2D(derinlikDoku, uv).r; return d <= 0.0 ? 1e5 : d; }
vec3 N(vec2 uv) { return texture2D(normalDoku, uv).rgb; }
float karma(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main(void) {
  vec4 renk = texture2D(textureSampler, vUV);
  vec2 uv = vUV;
  if (cizgiB.y > 0.0) {
    vec2 h = floor(vUV / texel / 4.0);
    uv += texel * cizgiB.y * vec2(sin(vUV.y * 140.0 + karma(h) * 3.0), cos(vUV.x * 140.0 + karma(h.yx) * 3.0));
  }
  vec2 o = texel * cizgiA.x;
  float d0 = D(uv);
  vec3 n0 = N(uv);
  float sonme = 1.0 - smoothstep(cizgiB.w * 0.6, cizgiB.w, d0);
  vec3 c = renk.rgb;
  if (cizgiB.z < 0.5) {
    vec3 gxN = vec3(0.0), gyN = vec3(0.0);
    for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) {
        vec2 q = uv + vec2(float(i), float(j)) * o;
        float kx = float(i) * (j == 0 ? 2.0 : 1.0), ky = float(j) * (i == 0 ? 2.0 : 1.0);
        vec3 n = N(q);
        gxN += kx * n; gyN += ky * n;
      }
    }
    // Derinlik: TERS derinliğin ikinci farkı (Laplace). Düzlemde 1/z ekranda doğrusal → sıfır; yalnız siluet kalır.
    // İlk sürüm derinliğe Sobel uyguladı: yatay bakılan zemin her pikselde derinlik değiştirdiği için orta mesafe
    // simsiyah bir şerit oldu (görüntüde yakalandı).
    float i0 = 1.0 / d0;
    float kD = (abs(1.0 / D(uv + vec2(o.x, 0.0)) + 1.0 / D(uv - vec2(o.x, 0.0)) - 2.0 * i0)
              + abs(1.0 / D(uv + vec2(0.0, o.y)) + 1.0 / D(uv - vec2(0.0, o.y)) - 2.0 * i0)) * d0;
    float kN = sqrt(dot(gxN, gxN) + dot(gyN, gyN));
    float kenar = max(smoothstep(cizgiA.y, cizgiA.y * 1.5, kD), smoothstep(cizgiA.z, cizgiA.z * 1.5, kN));
    c = mix(c, cizgiRenk, kenar * cizgiA.w * sonme);
  } else {
    float dis = 0.0, ic = 0.0;
    vec2 yon[4] = vec2[4](vec2(0.0, -1.0), vec2(1.0, 0.0), vec2(0.0, 1.0), vec2(-1.0, 0.0));
    for (int k = 0; k < 4; k++) {
      vec2 q = uv + yon[k] * o;
      float dk = D(q), karsi = D(uv - yon[k] * o);
      // Komşu, karşı komşudan düzlemle UZATILAN tahminden ne kadar uzak (1/z ekranda doğrusal). Ham fark yatay
      // bakılan zeminde her pikselde "kenar" sayardı.
      dis += clamp((2.0 / d0 - 1.0 / karsi - 1.0 / dk) * d0, 0.0, 1.0);
      vec3 nk = N(q);
      float egilim = smoothstep(-0.01, 0.01, dot(n0 - nk, vec3(1.0)));
      float sureklilik = clamp(sign((d0 - dk) / d0 * 0.25 + 0.0025), 0.0, 1.0);
      ic += (1.0 - dot(n0, nk)) * sureklilik * egilim;
    }
    float disK = smoothstep(cizgiA.y, cizgiA.y * 1.5, dis) * sonme;
    float icK = smoothstep(cizgiA.z * 0.25, cizgiA.z * 0.5, ic) * (1.0 - disK) * sonme;
    c = mix(c, cizgiRenk, disK * cizgiA.w);
    c = mix(c, min(c * 1.45 + 0.06, vec3(1.0)), icK * cizgiB.x);
  }
  gl_FragColor = vec4(c, renk.a);
}
`;

const RENK_GLSL = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform vec2 boyut;
uniform vec4 renkA;   // palet, titreme, posterize, doygunluk
uniform vec4 renkB;   // gren, paletSayisi, zaman, -
uniform vec3 paletRenk[${PALET_SINIRI}];

float karma(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main(void) {
  vec3 c = texture2D(textureSampler, vUV).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, renkA.w);
  ivec2 p = ivec2(mod(floor(vUV * boyut), 4.0));
  float bayer[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  float esik = (bayer[p.y * 4 + p.x] + 0.5) / 16.0 - 0.5;
  if (renkA.z > 0.5) c = floor(c * renkA.z + 0.5 + esik * renkA.y) / renkA.z;
  if (renkA.x > 0.0) {
    vec3 t = c + esik * renkA.y * 0.22;
    vec3 en = c; float enD = 1e9;
    for (int i = 0; i < ${PALET_SINIRI}; i++) {
      if (float(i) >= renkB.y) break;
      // Renk uzaklığı (kırmızı-ortalama benzeri ağırlık). Parlaklık ağırlığı (.3/.59/.11) maviyi neredeyse
      // saymadı: koyu yeşil çimin en yakını koyu mavi gök tonu çıktı (görüntüde mavi noktalar).
      vec3 f = (t - paletRenk[i]) * vec3(0.47, 0.67, 0.58);
      float d = dot(f, f);
      if (d < enD) { enD = d; en = paletRenk[i]; }
    }
    c = mix(c, en, renkA.x);
  }
  if (renkB.x > 0.0) c += (karma(vUV * boyut + renkB.z) - 0.5) * renkB.x;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

/**
 * Palete yuvarlamanın renk listesi: her palet rengi + iki koyu tonu (ışık eklentisinin basamakları gibi; koyu
 * tonlar gölge rengine kayar). Saf: sahnesiz test edilir. Sınırı aşan renkler atılır (önce ana renkler).
 */
export function paletListesi(palet: readonly Renk[], golge: Renk, golgeKarisim: number): Renk[] {
  const l = (r: Renk) => 0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2];
  const gN = l(golge) > 0.05 ? golge.map((v) => v / l(golge)) : [1, 1, 1];
  const ton = (r: Renk, k: number): Renk => {
    const t = (1 - k) * golgeKarisim;
    const kanal = (i: number) => r[i]! * k * (1 - t + t * gN[i]!);
    return [kanal(0), kanal(1), kanal(2)];
  };
  return [...palet, ...palet.map((r) => ton(r, 0.72)), ...palet.map((r) => ton(r, 0.48))].slice(0, PALET_SINIRI);
}

/** Çizgiye girer mi: ışıklı malzemeli, görünür, `metadata.cizgisiz` değil. */
export function cizgiyeUygun(m: AbstractMesh): boolean {
  const mat = m.material as { disableLighting?: boolean } | null;
  const md = m.metadata as { cizgisiz?: boolean } | null | undefined;
  return m.isEnabled() && m.isVisible && !!mat && !mat.disableLighting && !md?.cizgisiz && m.getTotalVertices() > 0;
}

export interface CizgiDegerleri { a: [number, number, number, number]; b: [number, number, number, number]; renk: Renk }
export interface RenkDegerleri { a: [number, number, number, number]; gren: number; palet: Renk[] }

export interface Efekt { yokEt(): void }

let kayitli = false;
function shaderKaydet(): void {
  if (kayitli) return;
  Effect.ShadersStore["stilCizgiFragmentShader"] = CIZGI_GLSL;
  Effect.ShadersStore["stilRenkFragmentShader"] = RENK_GLSL;
  kayitli = true;
}

export function cizgiEfektiKur(sahne: Scene, kamera: Camera, d: CizgiDegerleri, ornekleme: number): Efekt {
  shaderKaydet();
  const gb = sahne.enableGeometryBufferRenderer(1);
  if (!gb) throw new Error("çizgi efekti: GeometryBufferRenderer desteklenmiyor");
  gb.generateNormalsInWorldSpace = true;
  const listeGozcu = sahne.onBeforeRenderObservable.add(() => { gb.renderList = sahne.meshes.filter(cizgiyeUygun); });
  const pp = new PostProcess("stilCizgi", "stilCizgi", ["texel", "cizgiA", "cizgiB", "cizgiRenk"], ["derinlikDoku", "normalDoku"], 1, kamera);
  pp.samples = ornekleme;
  pp.onApply = (e) => {
    const dokular = gb.getGBuffer().textures;
    e.setTexture("derinlikDoku", dokular[gb.getTextureIndex(GeometryBufferRenderer.DEPTH_TEXTURE_TYPE)]!);
    e.setTexture("normalDoku", dokular[gb.getTextureIndex(GeometryBufferRenderer.NORMAL_TEXTURE_TYPE)]!);
    e.setFloat2("texel", 1 / pp.width, 1 / pp.height);
    e.setFloat4("cizgiA", ...d.a);
    e.setFloat4("cizgiB", ...d.b);
    e.setFloat3("cizgiRenk", ...d.renk);
  };
  return {
    yokEt() {
      pp.dispose(kamera);
      sahne.onBeforeRenderObservable.remove(listeGozcu);
      sahne.disableGeometryBufferRenderer();
    },
  };
}

export function renkEfektiKur(kamera: Camera, d: RenkDegerleri, ornekleme: number): Efekt {
  shaderKaydet();
  const pp = new PostProcess("stilRenk", "stilRenk", ["boyut", "renkA", "renkB", "paletRenk"], null, 1, kamera);
  pp.samples = ornekleme;
  const dizi: number[] = new Array<number>(PALET_SINIRI * 3).fill(0);
  pp.onApply = (e) => {
    dizi.fill(0);
    d.palet.forEach((r, i) => { dizi[i * 3] = r[0]; dizi[i * 3 + 1] = r[1]; dizi[i * 3 + 2] = r[2]; });
    e.setFloat2("boyut", pp.width, pp.height);
    e.setFloat4("renkA", ...d.a);
    e.setFloat4("renkB", d.gren, d.palet.length, (performance.now() / 1000) % 100, 0);
    e.setArray3("paletRenk", dizi);
  };
  return { yokEt() { pp.dispose(kamera); } };
}
