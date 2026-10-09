// world/level/shader/moduller/debugTarama.ts — Debug taraması (vault: DEBUG MODU — "dünya renkleri soluklaşır, hata
// imzaları görünür"): dünya soluklaşır; Orion'dan (kameradan) dışa doğru genişleyen bir TARAMA HALKASI geçtiği
// derinlikte siluet kenarlarını dijital maviyle çizer; taranmış alanda kenarlar sönerek kalır. Derinlik Babylon'un
// derinlik çizicisinden (doğrusal, kameranın yakın/uzak düzlemine oranlı).
"use strict";
import type { ShaderModulu } from "../modul.ts";
import { ekranKur } from "../ekran.ts";
import { GLITCH } from "../paletler.ts";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";

export const DEBUG_TARAMA_VARSAYILAN = {
  /** Halkanın hızı (m/sn). */
  hiz: 35,
  /** Taramanın yeniden başladığı uzaklık (m). */
  menzil: 160,
  /** Halka kalınlığı (m). */
  kalinlik: 5,
  /** Dünyanın soluklaşması (0–1). */
  soluk: 0.75,
  kenar: 1,
  renk: GLITCH.dijitalMavi,
};
export type DebugTaramaAyari = typeof DEBUG_TARAMA_VARSAYILAN;

const GLSL = `
uniform sampler2D derinlik;
uniform vec4 dt;    // halka (m), kalınlık (m), menzil (m), soluk
uniform vec4 dt2;   // kenar gücü, uzak+yakın (m), texel x, texel y
uniform vec3 mavi;
float D(vec2 uv) { return max(texture2D(derinlik, uv).r * dt2.y, 0.05); }
void main(void) {
  vec3 c = texture2D(textureSampler, vUV).rgb;
  float l = parlaklik(c);
  vec3 o = mix(c, vec3(l) * vec3(0.82, 0.9, 1.0), dt.w);
  float d0 = D(vUV);
  vec2 t = dt2.zw;
  float e = (abs(1.0 / D(vUV + vec2(t.x, 0.0)) + 1.0 / D(vUV - vec2(t.x, 0.0)) - 2.0 / d0)
           + abs(1.0 / D(vUV + vec2(0.0, t.y)) + 1.0 / D(vUV - vec2(0.0, t.y)) - 2.0 / d0)) * d0;
  float kenar = smoothstep(0.004, 0.025, e) * dt2.x;
  float bant = 1.0 - smoothstep(0.0, dt.y, abs(d0 - dt.x));
  float taranmis = step(d0, dt.x) * (1.0 - smoothstep(0.0, dt.z * 0.5, dt.x - d0));
  float izgara = step(0.92, fract(d0 * 0.5)) * taranmis * 0.25;
  o += mavi * (kenar * (0.45 * taranmis + 1.6 * bant) + izgara);
  o = mix(o, mavi, bant * 0.35);
  gl_FragColor = vec4(o, 1.0);
}
`;

export const debugTaramaModulu: ShaderModulu<DebugTaramaAyari> = {
  tur: "debugTarama",
  aciklama: "Debug modu: dünya soluklaşır, kameradan yayılan tarama halkası kenarları dijital maviyle çizer.",
  varsayilan: DEBUG_TARAMA_VARSAYILAN,
  aralik: {
    hiz: { min: 1, max: 200, adim: 1 }, menzil: { min: 10, max: 600, adim: 5 }, kalinlik: { min: 0.2, max: 20, adim: 0.1 },
    soluk: { min: 0, max: 1, adim: 0.01 }, kenar: { min: 0, max: 3, adim: 0.05 },
  },
  ekranMi: true,
  kur(b, a) {
    let ayar = a;
    let sure = 0;
    return {
      ayarla(x) { ayar = x; },
      kare(d) { sure = d.sure; },
      ekran(kamera) {
        const dr = b.sahne.enableDepthRenderer(kamera, false);
        return ekranKur(kamera, {
          ad: "DebugTarama", glsl: GLSL, uniformlar: ["dt", "dt2", "mavi"], ornekleyiciler: ["derinlik"],
          uygula(e, g, y) {
            e.setTexture("derinlik", dr.getDepthMap());
            const halka = (sure * ayar.hiz) % ayar.menzil;
            e.setFloat4("dt", halka, ayar.kalinlik, ayar.menzil, ayar.soluk);
            e.setFloat4("dt2", ayar.kenar, kamera.maxZ + kamera.minZ, 1 / g, 1 / y);
            e.setFloat3("mavi", ...b.renk(ayar.renk));
          },
        });
      },
      yokEt() { /* derinlik çizici açık kalır: gölgenin otomatik sınırı da kullanabilir */ },
    };
  },
};
