// uygulama/yapi/grafSekmesiStili.ts — Graf sekmesinin CSS'i (spec 35). Ayrı dosya: sekme kodu ≈300 satırı geçmesin; görsel editörün stili ayrıdır (yapi/graf/editorStili.ts).
"use strict";

export const GRAF_SEKMESI_CSS = `
.gs-kok { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.gs-ust { display: flex; align-items: center; gap: 8px; padding: 8px 14px 4px; flex-wrap: wrap; }
.gs-satir { flex: 1; min-width: 200px; font: 12px/1.4 'Cascadia Mono', Consolas, monospace; color: #aab4d0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gs-satir[data-tur="calisiyor"] { color: #8fe0a8; }
.gs-satir[data-tur="hata"] { color: #ff8c84; }
.gs-satir[data-tur="durdu"] { color: #ffb454; }
.gs-dugme { background: #121726; color: #d7dcea; border: 1px solid #2a3246; border-radius: 6px; padding: 3px 11px; font: inherit; cursor: pointer; white-space: nowrap; }
.gs-dugme:hover:not(:disabled) { border-color: #58c1ff; }
.gs-dugme:disabled { opacity: 0.4; cursor: default; }
.gs-calistir:not(:disabled) { border-color: #2f8f5a; color: #8fe0a8; }
.gs-durdur:not(:disabled) { border-color: #c2563f; color: #ff9c84; }
.gs-yeni { display: flex; align-items: center; gap: 6px; }
.gs-yeni input { width: 150px; background: #121726; color: #eef1fa; border: 1px solid #2a3246; border-radius: 6px; padding: 3px 9px; font: inherit; user-select: text; }
.gs-yeni-hata { color: #ff8c84; font-size: 12px; }
.gs-govde { flex: 1; min-height: 0; display: flex; gap: 10px; padding: 4px 14px 10px; }
.gs-sutun { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.gs-baslik { color: #7c88a6; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; padding: 2px 0 4px; }
.gs-serit { flex: 1; min-height: 0; overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); grid-auto-rows: 64px; gap: 8px; align-content: start; }
.gs-kart { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; background: #151c2b; border: 1px solid #222c41; border-radius: 9px; cursor: pointer; overflow: hidden; }
.gs-kart:hover { border-color: #4a69b0; }
.gs-kart[data-secili="1"] { border-color: #58c1ff; background: #182238; }
.gs-kart[data-bozuk="1"] { border-color: #7a3030; }
.gs-kart[data-calisiyor="1"] { border-color: #2f8f5a; }
.gs-ad { font-weight: 600; color: #eef1fa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gs-alt { color: #6b7794; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gs-kart[data-bozuk="1"] .gs-alt { color: #ff8c84; }
.gs-kontrol { width: 300px; flex: none; overflow: auto; font-size: 12px; color: #aab4d0; border-left: 1px solid #222c41; padding-left: 10px; }
.gs-kontrol li { margin: 0 0 4px 14px; color: #ffcf8a; }
.gs-kontrol .gs-tamam { color: #8fe0a8; }
.gs-bos { grid-column: 1 / -1; padding: 10px 2px; color: #7c88a6; }
.gs-dinle:not(:disabled) { border-color: #a87a2a; color: #ffcf8a; }
.gs-sil:not(:disabled) { border-color: #7a3030; color: #ff9c84; }
.gs-sil[data-emin="1"] { background: #4a1f1f; border-color: #ff6b5c; color: #fff; }
.gs-kart[data-dinliyor="1"] { border-color: #a87a2a; }
.gs-sag { width: 320px; flex: none; display: flex; flex-direction: column; gap: 8px; min-height: 0; border-left: 1px solid #222c41; padding-left: 10px; }
.gs-sag .gs-kontrol { width: auto; border-left: 0; padding-left: 0; flex: 1; min-height: 0; }
.gs-dinleme { font-size: 12px; color: #aab4d0; max-height: 45%; overflow: auto; }
.gs-dinleme-satir { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
.gs-dinleme-satir span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gs-dinleme-satir[data-calisiyor="1"] span { color: #8fe0a8; }
.gs-dinleme .gs-dugme { padding: 1px 8px; font-size: 11px; }
.gs-yeni select { background: #121726; color: #eef1fa; border: 1px solid #2a3246; border-radius: 6px; padding: 3px 6px; font: inherit; }
.gs-durum { margin-top: 8px; color: #9fb0d8; }
`;
