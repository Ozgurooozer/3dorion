// uygulama/yapi/ortak/dok/dokStili.ts — DOK SİSTEMİNİN CSS'i (spec 39 D3). Renk/yazı jetonlardan; yerleşim `--dok-*` değişkenlerine bağlı (index.html tuvali bunlardan düşer).
"use strict";
import { YAPI_RENK as R, YAPI_YAZI } from "../../../../world/arayuz/arayuzJetonlari.ts";

/** Dok bölgelerinin z katmanı: ana menü şeridinin (40) altında, sekans editörünün (30) üstünde değil yanında; yüzer pencereler bölgelerin üstünde. */
export const DOK_CSS = `
.dk-kok { position: fixed; inset: 0; pointer-events: none; z-index: 35; font: ${YAPI_YAZI.govde}; color: ${R.yazi}; }
.dk-kok > * { pointer-events: auto; }
.dk-depo { display: none; }
/* Bölgeler: sol/sağ üstten alt dok payına kadar, alt tam genişlik; alt kenar Yapı çubuğu/editör payının ÜSTÜNDE */
.dk-bolge { position: fixed; display: none; flex-direction: column; box-sizing: border-box; background: #0c111e; border: 0 solid ${R.cizgi}; overflow: hidden; }
.dk-bolge[data-acik="1"] { display: flex; }
.dk-bolge[data-bolge="sol"] { left: 0; top: var(--editor-ust, 0px); width: var(--dok-sol, 300px); bottom: calc(var(--dok-alt, 0px) + max(var(--alt-cubuk, 0px), var(--editor-alt, 0px))); border-right-width: 1px; }
.dk-bolge[data-bolge="sag"] { right: 0; top: var(--editor-ust, 0px); width: var(--dok-sag, 310px); bottom: calc(var(--dok-alt, 0px) + max(var(--alt-cubuk, 0px), var(--editor-alt, 0px))); border-left-width: 1px; }
.dk-bolge[data-bolge="alt"] { left: 0; right: 0; bottom: max(var(--alt-cubuk, 0px), var(--editor-alt, 0px)); height: var(--dok-alt, 240px); border-top-width: 1px; }
.dk-seritler { display: flex; align-items: stretch; flex: none; border-bottom: 1px solid ${R.cizgi}; background: #0a0f1b; min-height: 28px; }
.dk-sekme { display: flex; align-items: center; gap: 4px; padding: 0 12px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: ${R.yaziOrta}; font: inherit; cursor: grab; white-space: nowrap; }
.dk-sekme:hover { color: ${R.yaziParlak}; }
.dk-sekme[data-etkin="1"] { color: ${R.yaziParlak}; border-bottom-color: ${R.vurgu}; background: rgba(88,193,255,0.08); }
.dk-sekme[data-surukleniyor="1"] { opacity: 0.4; }
.dk-sekme[data-ekle="onde"] { box-shadow: inset 2px 0 0 ${R.vurgu}; } .dk-sekme[data-ekle="sonra"] { box-shadow: inset -2px 0 0 ${R.vurgu}; }
.dk-bosluk { flex: 1; min-width: 12px; }
.dk-ikon { width: 26px; border: 0; background: transparent; color: ${R.yaziOrta}; font: inherit; cursor: pointer; }
.dk-ikon:hover { color: ${R.yaziParlak}; background: rgba(255,255,255,0.06); }
.dk-icerik { flex: 1; min-height: 0; overflow: auto; position: relative; }
.dk-icerik > [data-dok] { display: none; } .dk-icerik > [data-dok][data-etkin="1"] { display: block; }
/* Sekans editörünün eski sağ sütun stilleri (sabit genişlik/kenar) dokta bölgenin genişliğine uyar */
.dk-icerik .sk-sag, .dk-yuzer-icerik .sk-sag { width: auto; border-left: 0; }
.dk-tutamak { position: absolute; z-index: 5; background: transparent; }
.dk-tutamak::after { content: ""; position: absolute; background: ${R.cizgi}; opacity: 0; }
.dk-tutamak:hover::after, .dk-tutamak[data-surukle="1"]::after { opacity: 1; background: ${R.vurgu}; }
.dk-bolge[data-bolge="sol"] .dk-tutamak { right: 0; top: 0; bottom: 0; width: 6px; cursor: ew-resize; } .dk-bolge[data-bolge="sol"] .dk-tutamak::after { right: 0; top: 0; bottom: 0; width: 2px; }
.dk-bolge[data-bolge="sag"] .dk-tutamak { left: 0; top: 0; bottom: 0; width: 6px; cursor: ew-resize; } .dk-bolge[data-bolge="sag"] .dk-tutamak::after { left: 0; top: 0; bottom: 0; width: 2px; }
.dk-bolge[data-bolge="alt"] .dk-tutamak { left: 0; right: 0; top: 0; height: 6px; cursor: ns-resize; } .dk-bolge[data-bolge="alt"] .dk-tutamak::after { left: 0; right: 0; top: 0; height: 2px; }
/* Sürükleme sırasında boş bölgelerin ve yüzerin bırakma hedefleri; izinsiz hedef gri */
.dk-hedef { position: fixed; display: none; align-items: center; justify-content: center; box-sizing: border-box; border: 2px dashed ${R.vurgu}; background: rgba(88,193,255,0.10); color: ${R.yaziParlak}; font-size: 12px; letter-spacing: .04em; z-index: 36; }
.dk-kok[data-surukle="1"] .dk-hedef[data-var="1"] { display: flex; }
.dk-hedef[data-izinli="0"] { border-color: #6b7280; background: rgba(107,114,128,0.14); color: #9ca3af; }
.dk-hedef[data-ustunde="1"][data-izinli="1"] { background: rgba(88,193,255,0.26); }
.dk-hedef[data-bolge="sol"] { left: 0; top: var(--editor-ust, 0px); bottom: calc(var(--dok-alt, 0px) + max(var(--alt-cubuk, 0px), var(--editor-alt, 0px))); width: 120px; }
.dk-hedef[data-bolge="sag"] { right: 0; top: var(--editor-ust, 0px); bottom: calc(var(--dok-alt, 0px) + max(var(--alt-cubuk, 0px), var(--editor-alt, 0px))); width: 120px; }
.dk-hedef[data-bolge="alt"] { left: 0; right: 0; bottom: max(var(--alt-cubuk, 0px), var(--editor-alt, 0px)); height: 90px; }
.dk-hedef[data-bolge="yuzer"] { left: 50%; top: 45%; width: 200px; height: 70px; margin-left: -100px; }
.dk-bolge[data-hedef="1"] { outline: 2px dashed ${R.vurgu}; outline-offset: -2px; }
.dk-ipucu { position: fixed; left: 50%; top: calc(var(--editor-ust, 0px) + 12px); transform: translateX(-50%); max-width: 70vw; padding: 7px 14px; border-radius: 8px; background: #2a1620; border: 1px solid #a8475f; color: #ffd6df; font-size: 12px; z-index: 60; display: none; pointer-events: none; }
.dk-ipucu[data-acik="1"] { display: block; }
/* Yüzer pencere */
.dk-yuzer { position: fixed; display: flex; flex-direction: column; box-sizing: border-box; min-width: 160px; min-height: 120px; background: #0c111e; border: 1px solid ${R.cizgi}; border-radius: 8px; box-shadow: 0 10px 34px rgba(0,0,0,0.55); overflow: hidden; resize: both; z-index: 37; }
.dk-yuzer-bas { display: flex; align-items: center; gap: 2px; flex: none; padding: 0 2px 0 10px; height: 28px; background: #0a0f1b; border-bottom: 1px solid ${R.cizgi}; cursor: move; user-select: none; color: ${R.yaziParlak}; }
.dk-yuzer-ad { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dk-yuzer-icerik { flex: 1; min-height: 0; overflow: auto; }
`;

let eklendi = false;
export function dokStiliEkle(): void {
  if (eklendi) return;
  const s = document.createElement("style"); s.textContent = DOK_CSS; document.head.append(s); eklendi = true;
}
