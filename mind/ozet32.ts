// mind/ozet32.ts — FNV-1a, 32 bit: kısa ve belirlenimci içerik özeti.
//
// Tek kaynak. Önce yalnız tools/kapi-deney.ts'te vardı (mantar gövdesi motorunun
// karması). Beceri refleksi de becerinin kimliğini içeriğinden türetiyor (spec 10):
// kimlik kayıttan yeniden kurulunca da aynı kalmalı. İkinci bir kopya yazmak
// yerine buraya taşındı; kıyas aracı buradan alır.
//
// Kriptografik DEĞİL: çakışma olasılığı düşük ama sıfır değil. Yalnız kimlik ve
// karma kovası içindir, güvenlik için değil.
"use strict";

/** FNV-1a 32 bit, işaretsiz tamsayı. */
export function ozet32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
