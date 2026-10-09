// world/level/shader/moduller/firca.ts — Fırça (vault: UE5 painterly spec): iki katman.
//   Dünya: normal prosedürel fırça akışıyla bükülür — geometri aynı, ışık yüzeyi "boyanmış" okur.
//   Ekran: Kuwahara (dört bölgeli, en düşük varyanslı bölgenin ortalaması) — kenarı koruyan yağlı boya lekesi.
"use strict";
import type { ShaderModulu } from "../modul.ts";
import { ekranKur } from "../ekran.ts";

export const FIRCA_VARSAYILAN = {
  /** Kuwahara yarıçapı (piksel, 1–6): büyüdükçe leke iri. */
  yaricap: 4,
  /** Filtrenin karışımı (0 = kapalı). */
  guc: 1,
  /** Fırça normalinin gücü (dünya). */
  normal: 0.35,
  /** Fırça akışının sıklığı (1/m). */
  olcek: 0.7,
};
export type FircaAyari = typeof FIRCA_VARSAYILAN;

const GLSL = `
uniform vec4 kw;   // yarıçap, güç, texel x, texel y
void main(void) {
  int r = int(kw.x);
  vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
  vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
  for (int j = -6; j <= 6; j++) {
    for (int i = -6; i <= 6; i++) {
      if (i < -r || i > r || j < -r || j > r) continue;
      vec3 c = texture2D(textureSampler, vUV + vec2(float(i), float(j)) * kw.zw).rgb;
      vec3 c2 = c * c;
      if (i <= 0 && j <= 0) { m0 += c; s0 += c2; }
      if (i >= 0 && j <= 0) { m1 += c; s1 += c2; }
      if (i <= 0 && j >= 0) { m2 += c; s2 += c2; }
      if (i >= 0 && j >= 0) { m3 += c; s3 += c2; }
    }
  }
  float n = float((r + 1) * (r + 1));
  m0 /= n; m1 /= n; m2 /= n; m3 /= n;
  float v0 = dot(s0 / n - m0 * m0, vec3(1.0)), v1 = dot(s1 / n - m1 * m1, vec3(1.0));
  float v2 = dot(s2 / n - m2 * m2, vec3(1.0)), v3 = dot(s3 / n - m3 * m3, vec3(1.0));
  vec3 en = m0; float ev = v0;
  if (v1 < ev) { en = m1; ev = v1; }
  if (v2 < ev) { en = m2; ev = v2; }
  if (v3 < ev) { en = m3; }
  gl_FragColor = vec4(mix(texture2D(textureSampler, vUV).rgb, en, kw.y), 1.0);
}
`;

export const fircaModulu: ShaderModulu<FircaAyari> = {
  tur: "firca",
  aciklama: "Yağlı boya: Kuwahara filtresi + fırça akışıyla bükülen normal (ışık yüzeyi boyanmış okur).",
  varsayilan: FIRCA_VARSAYILAN,
  aralik: { yaricap: { min: 1, max: 6, adim: 1 }, guc: { min: 0, max: 1, adim: 0.01 }, normal: { min: 0, max: 1.5, adim: 0.01 }, olcek: { min: 0.05, max: 5, adim: 0.05 } },
  ekranMi: true,
  kur(b, a) {
    let ayar = a;
    const f = b.uniform.firca;
    return {
      ayarla(x) { ayar = x; },
      kare() { f.guc = ayar.normal; f.olcek = ayar.olcek; },
      ekran: (kamera) => ekranKur(kamera, {
        ad: "Firca", glsl: GLSL, uniformlar: ["kw"],
        uygula(e, g, y) { e.setFloat4("kw", Math.max(1, Math.min(6, Math.round(ayar.yaricap))), ayar.guc, 1 / g, 1 / y); },
      }),
      yokEt() { f.guc = 0; },
    };
  },
};
