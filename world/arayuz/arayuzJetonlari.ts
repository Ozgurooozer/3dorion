// world/arayuz/arayuzJetonlari.ts — Yapı ailesi DOM panellerinin renk ve yazı JETONLARI (spec 34).
//
// Yapı çubuğu (`altCubuk.ts`) ve Hafıza sekmesi (`uygulama/yapi/hafizaSekmesi.ts`) bu değerleri CSS'lerinde düz yazıyor; ajan ayar paneli
// (`ayarPaneli.ts`) onlarla AYNI görünmeli. Üçüncü bir kopya yerine değerler burada; panel bunları kullanır. Eski iki dosyanın CSS'ini bu turda
// yeniden yazmadım (canlıda görülmemiş görünüm riski) — onun yerine `arayuzJetonlari.test.ts` her jetonun o dosyalarda AYNEN geçtiğini sınar:
// biri rengini değiştirirse test kırılır ve ikisi birlikte güncellenir (CLAUDE.md: "ayrıştıklarında kırılan bir test").
"use strict";

export const YAPI_RENK = {
  /** Panel zemini (çubuk şeridi ve içerik). */
  zemin: "rgba(10,14,24,0.97)",
  /** Düğme/girdi zemini. */
  dugme: "#121726",
  /** İnce çizgi, kenar. */
  cizgi: "#2a3246",
  /** Kart zemini ve kenarı (Hafıza sekmesi kartı). */
  kart: "#151c2b",
  kartCizgi: "#222c41",
  /** Seçili/odak vurgusu (mavi). */
  vurgu: "#58c1ff",
  yazi: "#d7dcea",
  yaziParlak: "#eef1fa",
  yaziOrta: "#9aa6c4",
  yaziSoluk: "#7c88a6",
  /** "Bağlamda / açık" yeşili. */
  iyi: "#8fe0a8",
  iyiCizgi: "#2f8f5a",
  iyiZemin: "#14261f",
  uyari: "#ffb454",
  hata: "#ff8c84",
} as const;

export const YAPI_YAZI = {
  govde: "13px/1.4 'Segoe UI', system-ui, sans-serif",
  mono: "11px 'Cascadia Mono', Consolas, monospace",
} as const;
