// world/level/shader/moduller/paletHaritasi.ts — Palet haritası: kareyi parlaklığına göre etkin dünyanın O SAATTEKİ
// 5 renklik rampasına boyar (gradyan haritası). Gün/akşam/gece rampaları saatle karışır: gece paleti burada yaşar.
// Ton koruma: orijinal rengin kromasının bir payı geri eklenir (gök mavisi tamamen rampaya ezilmesin).
"use strict";
import type { ShaderModulu } from "../modul.ts";
import type { Renk } from "../../cekirdek/renk.ts";
import { ekranKur } from "../ekran.ts";

export const PALET_HARITASI_VARSAYILAN = {
  /** Gündüz rampaya karışma gücü. */
  gunduz: 0.3,
  /** Gece gücü (gece rampası daha baskın: ay ışığı tek renkli). */
  gece: 0.75,
  /** Orijinal rengin kromasından korunan pay (0 = saf gradyan haritası). */
  tonKoru: 0.6,
  /** Parlaklık eğrisi (>1 koyular uzar). */
  egri: 1,
};
export type PaletHaritasiAyari = typeof PALET_HARITASI_VARSAYILAN;

const GLSL = `
uniform vec3 r0; uniform vec3 r1; uniform vec3 r2; uniform vec3 r3; uniform vec3 r4;
uniform vec4 ph;   // güç, ton koruma, eğri, gece
void main(void) {
  vec3 c = texture2D(textureSampler, vUV).rgb;
  float l = clamp(parlaklik(c), 0.0, 1.0);
  float x = clamp(pow(l, ph.z * (1.0 - 0.45 * ph.w)) * 4.0, 0.0, 3.999);   // gece koyular kalkar
  float f = fract(x);
  vec3 a = x < 1.0 ? r0 : (x < 2.0 ? r1 : (x < 3.0 ? r2 : r3));
  vec3 b = x < 1.0 ? r1 : (x < 2.0 ? r2 : (x < 3.0 ? r3 : r4));
  vec3 eslem = mix(a, b, f) + (c - vec3(l)) * ph.y;
  gl_FragColor = vec4(mix(c, clamp(eslem, 0.0, 1.0), ph.x), 1.0);
}
`;

export const paletHaritasiModulu: ShaderModulu<PaletHaritasiAyari> = {
  tur: "paletHaritasi",
  aciklama: "Kareyi etkin dünyanın o saatteki rampasına boyar (gündüz/akşam/gece paleti shader'da).",
  varsayilan: PALET_HARITASI_VARSAYILAN,
  aralik: { gunduz: { min: 0, max: 1, adim: 0.01 }, gece: { min: 0, max: 1, adim: 0.01 }, tonKoru: { min: 0, max: 1.5, adim: 0.01 }, egri: { min: 0.3, max: 3, adim: 0.05 } },
  ekranMi: true,
  kur(_b, a) {
    let ayar = a;
    const rampa: Renk[] = [[0, 0, 0], [0.25, 0.25, 0.25], [0.5, 0.5, 0.5], [0.75, 0.75, 0.75], [1, 1, 1]];
    let guc = a.gunduz, gece = 0;
    return {
      ayarla(x) { ayar = x; },
      kare(d) {
        for (let i = 0; i < 5; i++) { const r = d.palet[`r${i}`]; if (r) rampa[i] = r; }
        guc = ayar.gunduz + (ayar.gece - ayar.gunduz) * d.gece;
        gece = d.gece;
      },
      ekran: (kamera) => ekranKur(kamera, {
        ad: "PaletHaritasi", glsl: GLSL, uniformlar: ["r0", "r1", "r2", "r3", "r4", "ph"],
        uygula(e) {
          rampa.forEach((r, i) => e.setFloat3(`r${i}`, ...r));
          e.setFloat4("ph", guc, ayar.tonKoru, ayar.egri, gece);
        },
      }),
      yokEt() { /* ekran efekti zincirle birlikte yıkılır */ },
    };
  },
};
