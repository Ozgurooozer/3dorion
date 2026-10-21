// uygulama/ayar/dom.ts — Ayar paneli bölümlerinin ortak küçük DOM yardımcıları (her bölüm kendi `el`ini yazmasın). Görünüm sınıfları `world/arayuz/ayarPaneli.ts` CSS'inde.
"use strict";

export function el<K extends keyof HTMLElementTagNameMap>(ad: K, sinif = "", metin = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(ad);
  if (sinif) e.className = sinif;
  if (metin) e.textContent = metin;
  return e;
}

/** `.ap-dugme`: tür button (form gönderimi yok), başlık = ipucu. */
export function dugme(metin: string, ipucu: string, tik: () => void): HTMLButtonElement {
  const d = el("button", "ap-dugme", metin);
  d.type = "button";
  d.title = ipucu;
  d.addEventListener("click", (e) => { e.stopPropagation(); tik(); });
  return d;
}

export const hataMetni = (e: unknown): string => (e instanceof Error ? e.message : String(e));
