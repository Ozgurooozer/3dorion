// world/varlik.ts — Varlık (doku, model) yolu çözücü.
//
// Neden var: aynı yol iki ortamda farklı çözülüyor.
//   Geliştirme (vite sunucusu, http://): uygulama kökü "/" — "/orion.vrm" çalışır,
//     ve alt yoldaki deneme sayfaları (/world/avatar/deneme.html) için de doğrudur.
//   Paketli (file://.../dist/index.html): "/orion.vrm" diskin KÖKÜNE bakar ve
//     404 verir; varlıklar index.html'in yanındadır, "./" gerekir.
//
// Göreli yol ("orion.vrm") da çözüm değil: alt yoldaki deneme sayfalarında
// kırılır. Bu yüzden tek karar noktası burası.
"use strict";

const KOK = import.meta.env.DEV ? "/" : "./";

/** `varlik("orion.vrm")` → ortama göre doğru yol. Baştaki "/" göz ardı edilir. */
export function varlik(ad: string): string {
  return KOK + ad.replace(/^\/+/, "");
}
