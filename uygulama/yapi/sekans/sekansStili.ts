// uygulama/yapi/sekans/sekansStili.ts — SEKANS EDİTÖRÜNÜN ve Sekans sekmesinin CSS'i (spec 36). DOM katmanı.
//
// Renkler Yapı ailesinin jetonlarından (world/arayuz/arayuzJetonlari.ts); SATIR ÖLÇÜLERİ görünüm modelinden (`DUZEN`, uygulama/sekans/editor/izDuzeni.ts):
// sol sütun ve zaman çizelgesi aynı sayılarla çizilir, hizaları DOM'da ölçülmez. Katman: alt yarıda bir DOK (Unreal'daki gibi 3B görünüm üstte kalır,
// ▶'de beden görünsün), z-index 30 (Yapı çubuğundan SONRA eklenir: üstünde); altyazı (31) ve diyalog (32) üstte kalır.
"use strict";
import { YAPI_RENK as R, YAPI_YAZI } from "../../../world/arayuz/arayuzJetonlari.ts";
import { DUZEN as D } from "../../sekans/editor/izDuzeni.ts";

/** Sol sütunun genişliği (px). */
export const SOL_GENISLIK = 270;

export const SEKANS_CSS = `
.sk-kok { position: fixed; left: 0; right: 0; bottom: 0; height: 46vh; min-height: 330px; z-index: 30; display: none; flex-direction: column; background: rgba(8,11,19,0.985);
  color: ${R.yazi}; font: ${YAPI_YAZI.govde}; user-select: none; outline: none; border-top: 2px solid ${R.vurgu}; }
.sk-kok[data-acik="1"] { display: flex; }
.sk-dugme { background: ${R.dugme}; color: ${R.yazi}; border: 1px solid ${R.cizgi}; border-radius: 6px; padding: 2px 9px; font: inherit; cursor: pointer; white-space: nowrap; }
.sk-dugme:hover:not(:disabled) { border-color: ${R.vurgu}; } .sk-dugme:disabled { opacity: 0.4; cursor: default; }
.sk-dugme[data-acik="1"] { border-color: ${R.vurgu}; color: ${R.yaziParlak}; background: rgba(88,193,255,0.14); }
.sk-oynat:not(:disabled) { border-color: ${R.iyiCizgi}; color: ${R.iyi}; } .sk-durdur:not(:disabled) { border-color: #c2563f; color: #ff9c84; }
.sk-sil:not(:disabled) { border-color: #7a3030; color: #ff9c84; } .sk-sil[data-emin="1"] { background: #4a1f1f; border-color: #ff6b5c; color: #fff; }
.sk-ust { display: flex; align-items: center; gap: 6px; padding: 5px 10px; border-bottom: 1px solid ${R.cizgi}; flex-wrap: wrap; }
.sk-sekmeler { display: flex; gap: 2px; min-width: 0; overflow-x: auto; flex: 0 1 auto; }
.sk-sekme { display: flex; align-items: center; gap: 6px; padding: 3px 8px 3px 12px; color: ${R.yaziOrta}; border: 1px solid transparent; border-bottom: 2px solid transparent; border-radius: 6px 6px 0 0; cursor: pointer; white-space: nowrap; }
.sk-sekme[data-etkin="1"] { color: ${R.yaziParlak}; border-color: ${R.cizgi}; border-bottom-color: ${R.vurgu}; background: rgba(88,193,255,0.08); }
.sk-sekme .sk-nokta { color: ${R.uyari}; visibility: hidden; } .sk-sekme[data-kirli="1"] .sk-nokta { visibility: visible; }
.sk-sekme .sk-rozet { color: ${R.iyi}; font-size: 11px; }
.sk-sekme .sk-kapat { border: 0; background: transparent; color: ${R.yaziSoluk}; cursor: pointer; font: inherit; padding: 0 2px; } .sk-sekme .sk-kapat[data-onay="1"] { color: ${R.uyari}; }
.sk-adkutu { display: none; align-items: center; gap: 4px; } .sk-adkutu[data-acik="1"] { display: flex; }
.sk-soluk { color: ${R.yaziSoluk}; } .sk-hata { color: ${R.hata}; } .sk-iyi { color: ${R.iyi}; } .sk-uyari { color: ${R.uyari}; }
.sk-bosluk { flex: 1; }
.sk-satir { font: 12px/1.4 'Cascadia Mono', Consolas, monospace; color: ${R.yaziOrta}; max-width: 30vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sk-satir[data-tur="oynuyor"] { color: ${R.iyi}; } .sk-satir[data-tur="hata"] { color: ${R.hata}; } .sk-satir[data-tur="durdu"] { color: ${R.uyari}; }
.sk-playhead-yazi { font: 12px 'Cascadia Mono', Consolas, monospace; color: #ffd27a; min-width: 130px; }
.sk-kok input, .sk-kok select, .sk-kutu input, .sk-kutu select { background: ${R.dugme}; color: ${R.yaziParlak}; border: 1px solid ${R.cizgi}; border-radius: 5px; padding: 1px 6px; font: inherit; user-select: text; min-width: 0; }
.sk-ipucu { display: flex; gap: 10px; align-items: center; padding: 4px 12px; background: rgba(88,193,255,0.08); color: #8fb8dc; font-size: 12px; border-bottom: 1px solid ${R.cizgi}; }
.sk-bant { display: none; gap: 8px; align-items: center; padding: 4px 12px; background: rgba(255,180,84,0.12); color: #ffcf8a; font-size: 12px; } .sk-bant[data-acik="1"] { display: flex; }
.sk-govde { flex: 1; min-height: 0; display: flex; }
.sk-kaydir { flex: 1; min-width: 0; overflow-y: auto; overflow-x: hidden; position: relative; }
.sk-ic { display: flex; min-height: 100%; }
.sk-sol { width: ${SOL_GENISLIK}px; flex: none; border-right: 1px solid ${R.cizgi}; font-size: 12px; }
.sk-sol-bas { position: sticky; top: 0; z-index: 3; height: ${D.cetvel}px; box-sizing: border-box; display: flex; align-items: center; gap: 4px; padding: 0 6px; background: #0d1220; border-bottom: 1px solid ${R.cizgi}; }
.sk-ssatir { position: relative; box-sizing: border-box; display: flex; align-items: center; gap: 4px; padding: 0 6px 0 18px; border-bottom: 1px solid rgba(42,50,70,0.5); cursor: pointer; }
.sk-ssatir[data-tur="baglama"] { padding-left: 6px; background: #111827; color: ${R.yaziParlak}; font-weight: 600; }
.sk-ssatir[data-secili="1"] { background: rgba(88,193,255,0.12); }
.sk-ssatir[data-gizli="1"] .sk-ad { opacity: .45; text-decoration: line-through; }
.sk-ssatir .sk-ad { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sk-ssatir .sk-deger { font: 11px 'Cascadia Mono', Consolas, monospace; color: #ffd27a; }
.sk-ssatir .sk-bayrak { border: 0; background: transparent; color: ${R.yaziSoluk}; cursor: pointer; padding: 0 2px; font: inherit; }
.sk-ssatir .sk-bayrak[data-acik="1"] { color: ${R.uyari}; }
.sk-sol-alt { padding: 6px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.sk-zaman { flex: 1; min-width: 0; position: relative; overflow: clip; outline: none; }
/* overflow: clip (hidden DEĞİL): hidden kaydırma kabı yaratır ve cetvelin "sticky"si dikey kaydırmada yukarıda kalmazdı. */
.sk-cetvel { position: sticky; top: 0; z-index: 3; height: ${D.cetvel}px; box-sizing: border-box; background: #0d1220; border-bottom: 1px solid ${R.cizgi}; cursor: col-resize; overflow: hidden; }
.sk-isaret { position: absolute; bottom: 0; width: 1px; background: ${R.cizgi}; height: 6px; } .sk-isaret[data-buyuk="1"] { height: 12px; background: ${R.yaziSoluk}; }
.sk-etiket { position: absolute; top: 2px; font: 10px 'Cascadia Mono', Consolas, monospace; color: ${R.yaziSoluk}; transform: translateX(3px); white-space: nowrap; }
.sk-satirlar { position: relative; }
.sk-zsatir { position: absolute; left: 0; right: 0; box-sizing: border-box; border-bottom: 1px solid rgba(42,50,70,0.5); }
.sk-zsatir[data-tur="baglama"] { background: rgba(17,24,39,0.8); } .sk-zsatir[data-secili="1"] { background: rgba(88,193,255,0.06); }
.sk-zsatir[data-gizli="1"] { opacity: .4; }
.sk-disari { position: absolute; top: 0; bottom: 0; background: rgba(0,0,0,0.35); pointer-events: none; }
.sk-sinir { position: absolute; top: 0; bottom: 0; width: 2px; pointer-events: none; } .sk-sinir[data-tur="bas"] { background: #3fbf6a; } .sk-sinir[data-tur="bit"] { background: #e0574b; }
.sk-elmas { position: absolute; width: ${D.elmas * 2}px; height: ${D.elmas * 2}px; margin: -${D.elmas}px 0 0 -${D.elmas}px; transform: rotate(45deg); background: #c9d3ee; border: 1px solid #0b101c; box-sizing: border-box; cursor: grab; }
.sk-elmas[data-yumusatma="yumusak"] { border-radius: 50%; transform: none; } .sk-elmas[data-yumusatma="basamak"] { transform: none; }
.sk-elmas[data-secili="1"] { background: #ffb454; box-shadow: 0 0 0 2px rgba(255,180,84,0.45); }
.sk-cizgi { position: absolute; height: 1px; background: rgba(201,211,238,0.35); pointer-events: none; }
.sk-bolum { position: absolute; box-sizing: border-box; background: #23406b; border: 1px solid #3c6aa8; border-radius: 4px; color: ${R.yaziParlak}; font-size: 11px; padding: 0 8px; overflow: hidden;
  white-space: nowrap; text-overflow: ellipsis; display: flex; align-items: center; cursor: grab; }
.sk-bolum[data-eksik="1"] { background: #4a1f1f; border-color: ${R.hata}; color: ${R.hata}; }
.sk-bolum[data-secili="1"] { border-color: #ffb454; box-shadow: 0 0 0 1px #ffb454; }
.sk-bolum .sk-tutamak { position: absolute; top: 0; bottom: 0; width: ${D.kenar}px; background: rgba(255,255,255,0.12); cursor: ew-resize; } .sk-bolum .sk-tutamak[data-yan="sol"] { left: 0; } .sk-bolum .sk-tutamak[data-yan="sag"] { right: 0; }
.sk-bolum .sk-tasma { position: absolute; top: 0; bottom: 0; background: repeating-linear-gradient(45deg, rgba(0,0,0,0.25) 0 4px, transparent 4px 8px); pointer-events: none; }
.sk-playhead { position: absolute; top: 0; bottom: 0; width: 0; border-left: 2px solid #ffd27a; pointer-events: none; z-index: 4; }
.sk-playhead::before { content: ""; position: absolute; top: 0; left: -7px; border: 6px solid transparent; border-top: 8px solid #ffd27a; }
.sk-secim-kutusu { position: absolute; border: 1px dashed ${R.vurgu}; background: rgba(88,193,255,0.08); pointer-events: none; display: none; z-index: 5; }
.sk-bos { padding: 18px; color: ${R.yaziSoluk}; }
.sk-sag { width: 290px; flex: none; overflow: auto; padding: 8px 10px; border-left: 1px solid ${R.cizgi}; font-size: 12px; color: ${R.yaziOrta}; }
.sk-baslik2 { color: ${R.yaziSoluk}; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; margin: 8px 0 4px; } .sk-baslik2:first-child { margin-top: 0; }
.sk-alanlar { display: grid; grid-template-columns: auto 1fr; gap: 3px 8px; align-items: center; }
.sk-alanlar small { grid-column: 2; color: ${R.yaziSoluk}; margin-top: -2px; }
.sk-alt { display: flex; gap: 12px; padding: 4px 12px; border-top: 1px solid ${R.cizgi}; min-height: 20px; font-size: 12px; }
.sk-mesaj { flex: 1; color: ${R.yaziOrta}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sk-mesaj[data-tur="hata"] { color: ${R.hata}; } .sk-mesaj[data-tur="uyari"] { color: ${R.uyari}; } .sk-mesaj[data-tur="iyi"] { color: ${R.iyi}; }
.sk-yardim { position: absolute; right: 300px; bottom: 30px; width: 520px; max-height: 70%; overflow: auto; display: none; padding: 10px 14px; background: rgba(10,14,24,0.99); border: 1px solid ${R.cizgi}; border-radius: 8px; z-index: 6; font-size: 12px; }
.sk-yardim[data-acik="1"] { display: block; } .sk-yardim td { padding: 3px 6px; vertical-align: top; border-top: 1px solid ${R.kartCizgi}; } .sk-yardim td:first-child { white-space: nowrap; color: ${R.yaziParlak}; }
.sk-iz-formu { display: none; gap: 4px; align-items: center; flex-wrap: wrap; } .sk-iz-formu[data-acik="1"] { display: flex; }
/* Sekans sekmesi (alt çubuk) */
.sk-sekme-kok { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.sk-sekme-ust { display: flex; align-items: center; gap: 8px; padding: 8px 14px 4px; flex-wrap: wrap; }
.sk-sekme-govde { flex: 1; min-height: 0; display: flex; gap: 10px; padding: 4px 14px 10px; }
.sk-sutun { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.sk-serit { flex: 1; min-height: 0; overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); grid-auto-rows: 64px; gap: 8px; align-content: start; }
.sk-kart { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; background: ${R.kart}; border: 1px solid ${R.kartCizgi}; border-radius: 9px; cursor: pointer; overflow: hidden; }
.sk-kart:hover { border-color: #4a69b0; } .sk-kart[data-secili="1"] { border-color: ${R.vurgu}; background: #182238; } .sk-kart[data-bozuk="1"] { border-color: #7a3030; }
.sk-kart[data-oynuyor="1"] { border-color: ${R.iyiCizgi}; }
.sk-kad { font-weight: 600; color: ${R.yaziParlak}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sk-kalt { color: #6b7794; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .sk-kart[data-bozuk="1"] .sk-kalt { color: ${R.hata}; }
.sk-kutu { display: flex; align-items: center; gap: 6px; }
`;

let eklendi = false;
/** CSS bir kez eklenir (editör ve Sekans sekmesi ortak). */
export function sekansStiliEkle(): void {
  if (eklendi) return;
  const s = document.createElement("style"); s.textContent = SEKANS_CSS; document.head.append(s); eklendi = true;
}
