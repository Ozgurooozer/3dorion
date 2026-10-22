// uygulama/yapi/graf/editorStili.ts — GÖRSEL EDİTÖRÜN CSS'i (spec 35 dilim 2b). DOM katmanı.
//
// Renkler Yapı ailesinin jetonlarından (world/arayuz/arayuzJetonlari.ts) ve editörün kendi sabitlerinden (uygulama/graf/editor/renkler.ts); DÜĞÜM ÖLÇÜLERİ
// geometri modülünden (`DUGUM_OLCU`): pin noktaları DOM'da ölçülmez, hesaplanır — CSS aynı sayılardan yazılmazsa bağlar pinlerin yanına düşerdi.
// Düğüm kenarı `outline`dır, `border` DEĞİL: kenarlık çocukların konumunu 1 px kaydırır (pin noktası hesaplanan yerden kayardı).
// Katman: z-index 30 (Yapı çubuğuyla aynı, ondan SONRA eklenir: üstünde). Altyazı (31) ve diyalog kutusu (32) editörün ÜSTÜNDE kalır: editörden ▶
// basılınca Flash'ın sözü ve "Dur! Parola?" kutusu görünsün.
"use strict";
import { YAPI_RENK as R, YAPI_YAZI } from "../../../world/arayuz/arayuzJetonlari.ts";
import { DUGUM_OLCU as O } from "../../graf/editor/dugumGeometrisi.ts";

export const EDITOR_CSS = `
.ge-kok { position: fixed; inset: 0; z-index: 30; display: none; flex-direction: column; background: rgba(8,11,19,0.985); color: ${R.yazi};
  font: ${YAPI_YAZI.govde}; user-select: none; outline: none; }
.ge-kok[data-acik="1"] { display: flex; }
.ge-dugme { background: ${R.dugme}; color: ${R.yazi}; border: 1px solid ${R.cizgi}; border-radius: 6px; padding: 3px 10px; font: inherit; cursor: pointer; white-space: nowrap; }
.ge-dugme:hover:not(:disabled) { border-color: ${R.vurgu}; }
.ge-dugme:disabled { opacity: 0.4; cursor: default; }
.ge-calistir:not(:disabled) { border-color: ${R.iyiCizgi}; color: ${R.iyi}; }
.ge-durdur:not(:disabled) { border-color: #c2563f; color: #ff9c84; }
.ge-dinle:not(:disabled) { border-color: #a87a2a; color: #ffcf8a; }
.ge-ust { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-bottom: 1px solid ${R.cizgi}; flex-wrap: wrap; }
.ge-sekmeler { display: flex; gap: 2px; min-width: 0; overflow-x: auto; scrollbar-width: thin; flex: 0 1 auto; }
.ge-sekme { display: flex; align-items: center; gap: 6px; padding: 4px 8px 4px 12px; background: transparent; color: ${R.yaziOrta}; border: 1px solid transparent; border-bottom: 2px solid transparent;
  border-radius: 6px 6px 0 0; cursor: pointer; white-space: nowrap; font: inherit; }
.ge-sekme[data-etkin="1"] { color: ${R.yaziParlak}; border-color: ${R.cizgi}; border-bottom-color: ${R.vurgu}; background: rgba(88,193,255,0.08); }
.ge-sekme .ge-nokta { color: ${R.uyari}; visibility: hidden; }
.ge-sekme[data-kirli="1"] .ge-nokta { visibility: visible; }
.ge-sekme .ge-rozet { color: #ffcf8a; font-size: 11px; }
.ge-sekme .ge-kapat { border: 0; background: transparent; color: ${R.yaziSoluk}; cursor: pointer; font: inherit; padding: 0 2px; }
.ge-sekme .ge-kapat:hover { color: ${R.yaziParlak}; }
.ge-sekme .ge-kapat[data-onay="1"] { color: ${R.uyari}; }
.ge-bosluk { flex: 1; }
.ge-satir { font: 12px/1.4 'Cascadia Mono', Consolas, monospace; color: ${R.yaziOrta}; max-width: 34vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ge-satir[data-tur="calisiyor"] { color: ${R.iyi}; } .ge-satir[data-tur="hata"] { color: ${R.hata}; } .ge-satir[data-tur="durdu"] { color: ${R.uyari}; }
.ge-adkutu { display: none; align-items: center; gap: 4px; }
.ge-adkutu[data-acik="1"] { display: flex; }
.ge-adkutu input, .ge-alan, .ge-sag textarea, .ge-sol input, .ge-sol select, .ge-sag select { background: ${R.dugme}; color: ${R.yaziParlak}; border: 1px solid ${R.cizgi}; border-radius: 5px;
  padding: 2px 6px; font: inherit; user-select: text; min-width: 0; }
.ge-ipucu { display: flex; gap: 10px; align-items: center; padding: 5px 12px; background: rgba(88,193,255,0.08); color: #8fb8dc; font-size: 12px; border-bottom: 1px solid ${R.cizgi}; }
.ge-bant { display: none; gap: 8px; align-items: center; padding: 5px 12px; background: rgba(255,180,84,0.12); color: #ffcf8a; font-size: 12px; border-bottom: 1px solid ${R.cizgi}; }
.ge-bant[data-acik="1"] { display: flex; }
.ge-govde { flex: 1; min-height: 0; display: flex; }
.ge-sol, .ge-sag { flex: none; overflow: auto; padding: 8px 10px; font-size: 12px; color: ${R.yaziOrta}; }
.ge-sol { width: 250px; border-right: 1px solid ${R.cizgi}; }
.ge-sag { width: 300px; border-left: 1px solid ${R.cizgi}; }
.ge-baslik2 { color: ${R.yaziSoluk}; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; margin: 10px 0 4px; display: flex; align-items: center; gap: 6px; }
.ge-baslik2:first-child { margin-top: 0; }
.ge-oge { display: flex; align-items: center; gap: 4px; padding: 2px 0; }
.ge-oge > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ge-oge .ge-dugme { padding: 0 6px; font-size: 11px; }
.ge-soluk { color: ${R.yaziSoluk}; } .ge-uyari { color: ${R.uyari}; } .ge-hata { color: ${R.hata}; } .ge-iyi { color: ${R.iyi}; }
.ge-alanlar { display: grid; grid-template-columns: auto 1fr; gap: 4px 8px; align-items: center; }
.ge-alanlar label { color: ${R.yaziOrta}; }
.ge-sag textarea { width: 100%; box-sizing: border-box; min-height: 54px; resize: vertical; }
.ge-tuval { flex: 1; min-width: 0; position: relative; overflow: hidden; cursor: default; outline: none; background-color: #0b101c;
  background-image: linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px); }
.ge-tuval[data-kaydiriyor="1"] { cursor: grabbing; }
.ge-dunya { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.ge-baglar { position: absolute; left: 0; top: 0; overflow: visible; width: 1px; height: 1px; }
.ge-bag { fill: none; stroke-width: 2.2; pointer-events: none; }
.ge-bag[data-akis="1"] { stroke-width: 3; }
.ge-bag[data-bozuk="1"] { stroke: ${R.hata} !important; stroke-dasharray: 6 4; }
.ge-bag-vurus { fill: none; stroke: transparent; stroke-width: 12; cursor: pointer; pointer-events: stroke; }
.ge-bag-vurus:hover + .ge-bag { stroke-width: 4; filter: brightness(1.3); }
.ge-bag-gecici { fill: none; stroke: ${R.vurgu}; stroke-width: 2; stroke-dasharray: 5 4; pointer-events: none; }
.ge-dugum { position: absolute; box-sizing: border-box; background: rgba(21,28,43,0.96); outline: 1px solid ${R.kartCizgi}; border-radius: 8px; color: ${R.yazi}; cursor: grab; }
.ge-dugum[data-saf="1"] { background: rgba(20,38,31,0.92); border-radius: 12px; }
.ge-dugum[data-secili="1"] { outline: 2px solid ${R.vurgu}; }
.ge-dugum[data-hata="1"] { outline: 2px solid ${R.hata}; }
.ge-dugum[data-suan="1"] { box-shadow: 0 0 0 3px ${R.iyi}, 0 0 18px rgba(143,224,168,0.45); }
.ge-dugum[data-calisma-hata="1"] { box-shadow: 0 0 0 3px #ff5a4e, 0 0 18px rgba(255,90,78,0.45); }
.ge-dbaslik { height: ${O.baslik}px; box-sizing: border-box; padding: 0 10px; display: flex; align-items: center; gap: 6px; border-radius: 7px 7px 0 0; font-weight: 600; color: ${R.yaziParlak};
  white-space: nowrap; overflow: hidden; }
.ge-dugum[data-saf="1"] .ge-dbaslik { height: ${O.safBaslik}px; font-size: 12px; border-radius: 11px 11px 0 0; }
.ge-dbaslik .ge-kimlik { margin-left: auto; color: rgba(238,241,250,0.55); font: 10px 'Cascadia Mono', Consolas, monospace; font-weight: 400; overflow: hidden; text-overflow: ellipsis; }
.ge-dsatir { position: absolute; left: 0; right: 0; height: ${O.satir}px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; box-sizing: border-box; gap: 4px; }
.ge-dsol, .ge-dsag { display: flex; align-items: center; gap: 4px; min-width: 0; font-size: 12px; }
.ge-dsag { justify-content: flex-end; }
.ge-detiket { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 92px; color: ${R.yaziOrta}; }
.ge-dsatir .ge-alan { width: 84px; padding: 1px 4px; font-size: 11px; }
.ge-dsatir select.ge-alan { width: 92px; }
.ge-pin { position: absolute; width: ${O.pinYaricap * 2}px; height: ${O.pinYaricap * 2}px; border-radius: 50%; box-sizing: border-box; border: 2px solid var(--renk); background: #0b101c;
  top: ${O.satir / 2 - O.pinYaricap}px; cursor: crosshair; }
.ge-pin[data-bagli="1"] { background: var(--renk); }
.ge-pin[data-yon="giris"] { left: ${-O.pinYaricap}px; } .ge-pin[data-yon="cikis"] { right: ${-O.pinYaricap}px; }
.ge-pin[data-tip="akis"] { border-radius: 0; border: 0; background: var(--renk); clip-path: polygon(0 0, 100% 50%, 0 100%); }
.ge-pin[data-tip="akis"][data-bagli="0"] { opacity: .55; }
.ge-tuval[data-baglaniyor="1"] .ge-pin[data-uygun="0"] { opacity: .15; }
.ge-tuval[data-baglaniyor="1"] .ge-pin[data-uygun="1"] { box-shadow: 0 0 0 3px rgba(88,193,255,.55); transform: scale(1.3); }
.ge-cozumsuz { padding: 4px 10px; color: ${R.hata}; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ge-secim-kutusu { position: absolute; border: 1px dashed ${R.vurgu}; background: rgba(88,193,255,0.08); pointer-events: none; display: none; }
.ge-bos { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: ${R.yaziSoluk}; pointer-events: none; text-align: center; padding: 20px; font-size: 14px; }
.ge-palet { position: absolute; width: 300px; max-height: 420px; display: none; flex-direction: column; background: rgba(10,14,24,0.99); border: 1px solid ${R.vurgu}; border-radius: 8px; z-index: 5; }
.ge-palet[data-acik="1"] { display: flex; }
.ge-palet input { margin: 8px; background: ${R.dugme}; color: ${R.yaziParlak}; border: 1px solid ${R.cizgi}; border-radius: 5px; padding: 4px 8px; font: inherit; user-select: text; }
.ge-palet .ge-pnot { padding: 0 10px 4px; color: ${R.yaziSoluk}; font-size: 11px; }
.ge-palet .ge-pliste { overflow: auto; padding: 0 4px 6px; }
.ge-palet .ge-pgrup { color: ${R.yaziSoluk}; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; padding: 6px 6px 2px; }
.ge-palet .ge-poge { padding: 3px 8px; border-radius: 5px; cursor: pointer; display: flex; flex-direction: column; }
.ge-palet .ge-poge[data-isaretli="1"], .ge-palet .ge-poge:hover { background: rgba(88,193,255,0.14); }
.ge-palet .ge-poge small { color: ${R.yaziSoluk}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ge-yardim { position: absolute; right: 16px; top: 16px; width: 440px; max-height: calc(100% - 32px); overflow: auto; display: none; padding: 10px 14px; background: rgba(10,14,24,0.99);
  border: 1px solid ${R.cizgi}; border-radius: 8px; z-index: 6; font-size: 12px; }
.ge-yardim[data-acik="1"] { display: block; }
.ge-yardim table { border-collapse: collapse; width: 100%; } .ge-yardim td { padding: 3px 6px; vertical-align: top; border-top: 1px solid ${R.kartCizgi}; }
.ge-yardim td:first-child { white-space: nowrap; color: ${R.yaziParlak}; font-family: 'Cascadia Mono', Consolas, monospace; font-size: 11px; }
.ge-alt { display: flex; gap: 12px; align-items: flex-start; padding: 5px 12px; border-top: 1px solid ${R.cizgi}; max-height: 22vh; min-height: 22px; overflow: auto; font-size: 12px; }
.ge-mesaj { flex: 0 0 34%; color: ${R.yaziOrta}; }
.ge-mesaj[data-tur="hata"] { color: ${R.hata}; } .ge-mesaj[data-tur="uyari"] { color: ${R.uyari}; } .ge-mesaj[data-tur="iyi"] { color: ${R.iyi}; }
.ge-hatalar { flex: 1; min-width: 0; }
.ge-hatalar div { cursor: pointer; color: #ffcf8a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ge-hatalar div:hover { color: ${R.yaziParlak}; }
`;
