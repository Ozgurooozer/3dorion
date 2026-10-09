// world/level/shader/ekran.ts — Ekran shader'ı kurma yardımcısı (tek yer): gölgelendiriciyi bir kez kaydet, kameraya
// sonrası işlem olarak ekle, her uygulamada uniform yaz. Modüller yalnız GLSL'i ve değerleri verir.
"use strict";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { Effect } from "@babylonjs/core/Materials/effect";
import { Effect as EffectSinifi } from "@babylonjs/core/Materials/effect";
import { PostProcess } from "@babylonjs/core/PostProcesses/postProcess";
import type { EkranEfekti } from "./modul.ts";

export interface EkranTanimi {
  /** Gölgelendirici adı (benzersiz; "ozel" öneki eklenir). */
  ad: string;
  glsl: string;
  uniformlar: string[];
  ornekleyiciler?: string[];
  /** Çözünürlük oranı (1 = tam). */
  oran?: number;
  /** Her uygulamada: boyut (piksel) ve efekt. */
  uygula(e: Effect, genislik: number, yukseklik: number): void;
}

/** Ekran shader'larının ortak başı: karma ve parlaklık. */
export const EKRAN_ORTAK = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
float karma(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float parlaklik(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
`;

export function ekranKur(kamera: Camera, t: EkranTanimi): EkranEfekti {
  const ad = `ozel${t.ad}`;
  if (!EffectSinifi.ShadersStore[`${ad}FragmentShader`]) EffectSinifi.ShadersStore[`${ad}FragmentShader`] = EKRAN_ORTAK + t.glsl;
  const pp = new PostProcess(ad, ad, t.uniformlar, t.ornekleyiciler ?? null, t.oran ?? 1, kamera);
  pp.onApply = (e) => t.uygula(e, pp.width, pp.height);
  return { yokEt: () => pp.dispose(kamera) };
}
