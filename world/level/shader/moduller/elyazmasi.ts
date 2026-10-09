// world/level/shader/moduller/elyazmasi.ts — Elyazması (vault LK3: katmanlar arası bilgi yalnız "kurgu eser" olarak
// akar; Kâtipler'in gemisi): dünya, kâğıda mürekkep ve yaldızla çizilmiş bir SAYFA olarak görünür. Kâğıt lifi, tona
// göre üç yönlü tarama, parlaklık sınırında mürekkep hattı, en parlak yerlerde yaldız (yaprak altın pırıltısı),
// sayfa kenarında kararma; orijinal renk hafif suluboya yıkaması olarak kalır.
"use strict";
import type { ShaderModulu } from "../modul.ts";
import { ekranKur } from "../ekran.ts";

export const ELYAZMASI_VARSAYILAN = {
  kagit: "#efe3c8",
  murekkep: "#2b1d14",
  yaldiz: "#c9a227",
  /** Tarama aralığı (piksel). */
  tarama: 6,
  /** Mürekkep hattı gücü. */
  hat: 1,
  /** Bu parlaklığın üstü yaldız. */
  yaldizEsik: 0.8,
  /** Orijinal rengin suluboya payı. */
  yikama: 0.3,
};
export type ElyazmasiAyari = typeof ELYAZMASI_VARSAYILAN;

const GLSL = `
uniform vec3 kagit; uniform vec3 murekkep; uniform vec3 yaldiz;
uniform vec4 el;    // tarama (px), hat, yaldız eşiği, yıkama
uniform vec2 boyut;
float L(vec2 uv) { return parlaklik(texture2D(textureSampler, uv).rgb); }
void main(void) {
  vec3 c = texture2D(textureSampler, vUV).rgb;
  float l = parlaklik(c);
  vec2 p = vUV * boyut, t = 1.0 / boyut;
  float gx = L(vUV + vec2(t.x, 0.0)) - L(vUV - vec2(t.x, 0.0));
  float gy = L(vUV + vec2(0.0, t.y)) - L(vUV - vec2(0.0, t.y));
  float hat = smoothstep(0.06, 0.2, length(vec2(gx, gy))) * el.y;
  float ink = 0.0;
  if (l < 0.42) ink = max(ink, 1.0 - step(1.0, mod(p.x + p.y, el.x)));
  if (l < 0.26) ink = max(ink, 1.0 - step(1.0, mod(p.x - p.y, el.x)));
  if (l < 0.13) ink = max(ink, 1.0 - step(1.0, mod(p.y, el.x * 0.7)));
  float lif = (karma(floor(p / 2.0)) - 0.5) * 0.05 + (karma(floor(p / 11.0)) - 0.5) * 0.05;
  vec3 sayfa = kagit + vec3(lif);
  vec3 o = mix(sayfa, c, el.w);
  o = mix(o, murekkep, max(ink * 0.8, hat));
  float yal = smoothstep(el.z, el.z + 0.12, l);
  o = mix(o, yaldiz * (0.8 + 0.4 * karma(floor(p / 3.0))), yal * 0.75);
  vec2 q = vUV - 0.5;
  o *= 1.0 - dot(q, q) * 0.7;
  gl_FragColor = vec4(o, 1.0);
}
`;

export const elyazmasiModulu: ShaderModulu<ElyazmasiAyari> = {
  tur: "elyazmasi",
  aciklama: "Kurgu eser sayfası: kâğıt lifi, mürekkep tarama ve hattı, yaldızlı parlaklar (vault LK3, Kâtipler).",
  varsayilan: ELYAZMASI_VARSAYILAN,
  aralik: { tarama: { min: 2, max: 16, adim: 0.5 }, hat: { min: 0, max: 2, adim: 0.05 }, yaldizEsik: { min: 0.4, max: 1, adim: 0.01 }, yikama: { min: 0, max: 1, adim: 0.01 } },
  ekranMi: true,
  kur(b, a) {
    let ayar = a;
    return {
      ayarla(x) { ayar = x; },
      kare() { /* durağan: yalnız ayar */ },
      ekran: (kamera) => ekranKur(kamera, {
        ad: "Elyazmasi", glsl: GLSL, uniformlar: ["kagit", "murekkep", "yaldiz", "el", "boyut"],
        uygula(e, g, y) {
          e.setFloat3("kagit", ...b.renk(ayar.kagit)); e.setFloat3("murekkep", ...b.renk(ayar.murekkep)); e.setFloat3("yaldiz", ...b.renk(ayar.yaldiz));
          e.setFloat4("el", ayar.tarama, ayar.hat, ayar.yaldizEsik, ayar.yikama);
          e.setFloat2("boyut", g, y);
        },
      }),
      yokEt() { /* ekran efekti zincirle yıkılır */ },
    };
  },
};
