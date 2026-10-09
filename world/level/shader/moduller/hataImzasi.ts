// world/level/shader/moduller/hataImzasi.ts — Hata imzası (vault: "doku hatası" — titreyen glitch paleti): bir dünya
// bölgesinde (ve metadata.hata işaretli nesnelerde) dünya-uzayı bloklarında köşeler sıçrar, renk glitch paletine
// (magenta/cyan) ya da negatifine kayar, tarama çizgisi akar. Ekran kısmı: PATLAMA anlarında satır kayması + RGB
// ayrışması. Patlamalar düzensiz (zamana bağlı karma): hata "nefes almaz", tekler.
"use strict";
import type { ShaderModulu } from "../modul.ts";
import { ekranKur } from "../ekran.ts";
import { GLITCH } from "../paletler.ts";
import { hex } from "../../cekirdek/renk.ts";

export const HATA_IMZASI_VARSAYILAN = {
  guc: 0.85,
  merkezX: -14,
  merkezZ: -10,
  yaricap: 9,
  /** Blok boyu (m). */
  blok: 0.45,
  /** Saniyede kaç kez yeniden karılır. */
  hiz: 9,
  /** Ekran patlamasının gücü (0 = yalnız dünyada). */
  ekran: 0.6,
  /** Patlama sıklığı (0–1). */
  siklik: 0.3,
};
export type HataImzasiAyari = typeof HATA_IMZASI_VARSAYILAN;

const GLSL = `
uniform vec4 hx;   // patlama gücü, süre, yükseklik (px), -
void main(void) {
  vec2 uv = vUV;
  float satir = floor(uv.y * hx.z / 5.0);
  float r = karma(vec2(satir, floor(hx.y * 14.0)));
  uv.x += (r > 0.8 ? (r - 0.8) * 5.0 - 0.5 : 0.0) * hx.x * 0.06;
  float ay = hx.x * 0.007;
  vec3 c = vec3(texture2D(textureSampler, uv + vec2(ay, 0.0)).r, texture2D(textureSampler, uv).g, texture2D(textureSampler, uv - vec2(ay, 0.0)).b);
  c *= 1.0 - hx.x * 0.18 * step(0.5, fract(uv.y * hx.z * 0.5));
  gl_FragColor = vec4(c, 1.0);
}
`;

/** Patlama zarfı: süreye bağlı düzensiz açık/kapalı (0–1). Saf. */
export function patlama(sure: number, siklik: number): number {
  const dilim = Math.floor(sure * 3);
  const r = Math.abs(Math.sin(dilim * 12.9898) * 43758.5453) % 1;
  return r < siklik ? 1 : 0;
}

export const hataImzasiModulu: ShaderModulu<HataImzasiAyari> = {
  tur: "hataImzasi",
  aciklama: "Doku hatası: bölgede bloklu glitch (magenta/cyan, köşe sıçraması, tarama) + ekranda düzensiz patlamalar.",
  varsayilan: HATA_IMZASI_VARSAYILAN,
  aralik: {
    guc: { min: 0, max: 1, adim: 0.01 }, merkezX: { min: -150, max: 150, adim: 1 }, merkezZ: { min: -150, max: 150, adim: 1 },
    yaricap: { min: 1, max: 80, adim: 0.5 }, blok: { min: 0.05, max: 3, adim: 0.05 }, hiz: { min: 0.5, max: 30, adim: 0.5 },
    ekran: { min: 0, max: 1, adim: 0.01 }, siklik: { min: 0, max: 1, adim: 0.01 },
  },
  ekranMi: true,
  kur(b, a) {
    let ayar = a;
    const h = b.uniform.hata;
    let ekranGuc = 0, sure = 0;
    return {
      ayarla(x) { ayar = x; },
      kare(d) {
        const p = patlama(d.sure, ayar.siklik);
        sure = d.sure;
        h.guc = ayar.guc * (0.55 + 0.45 * p);
        h.merkez = [ayar.merkezX, 0, ayar.merkezZ];
        h.yaricap = ayar.yaricap;
        h.blok = ayar.blok;
        h.hiz = ayar.hiz;
        h.magenta = hex(GLITCH.magenta);
        h.cyan = hex(GLITCH.cyan);
        ekranGuc = ayar.ekran * p;
      },
      ekran: (kamera) => ekranKur(kamera, {
        ad: "HataImzasi", glsl: GLSL, uniformlar: ["hx"],
        uygula(e, _g, y) { e.setFloat4("hx", ekranGuc, sure % 1000, y, 0); },
      }),
      yokEt() { h.guc = 0; },
    };
  },
};
