// uygulama/yapi/ortak/kabukStili.ts — EDİTÖR KABUĞUNUN ortak CSS'i (spec 38 §6): menü çubuğu, araç çubuğu, yan sekmeler, yeniden boyutlanır dok, durum çubuğu.
// Sekans ve Graf editörü aynı iskeleti kullanır (`kb-*` sınıfları); türe özgü görünüm kendi dosyalarında. Renk/yazı jetonlardan (`arayuzJetonlari.ts`).
"use strict";
import { YAPI_RENK as R, YAPI_YAZI } from "../../../world/arayuz/arayuzJetonlari.ts";

export const KABUK_CSS = `
/* Menü çubuğu */
.kb-menucubugu { display: flex; align-items: stretch; gap: 0; position: relative; background: #0b101c; border-bottom: 1px solid ${R.cizgi}; font: ${YAPI_YAZI.govde}; }
.kb-menu { position: relative; }
.kb-menu-dugme { background: transparent; border: 0; color: ${R.yazi}; font: inherit; padding: 5px 12px; cursor: pointer; }
.kb-menu-dugme:hover, .kb-menu[data-acik="1"] .kb-menu-dugme { background: rgba(88,193,255,0.14); color: ${R.yaziParlak}; }
.kb-menu-dugme[data-soluk="1"] { color: ${R.yaziSoluk}; }
.kb-acilir { display: none; position: absolute; left: 0; top: 100%; min-width: 240px; padding: 4px 0; background: #0e1424; border: 1px solid ${R.cizgi}; border-radius: 0 0 8px 8px; box-shadow: 0 10px 28px rgba(0,0,0,0.6); z-index: 50; }
.kb-menu[data-acik="1"] .kb-acilir { display: block; }
.kb-oge { display: flex; align-items: center; gap: 8px; padding: 5px 14px 5px 8px; cursor: pointer; color: ${R.yazi}; white-space: nowrap; }
.kb-oge:hover:not([data-etkin="0"]) { background: rgba(88,193,255,0.16); color: ${R.yaziParlak}; }
.kb-oge[data-etkin="0"] { color: ${R.yaziSoluk}; opacity: 0.55; cursor: default; }
.kb-tik { width: 14px; text-align: center; color: ${R.iyi}; flex: none; }
.kb-oge-ad { flex: 1; }
.kb-kisayol { color: ${R.yaziSoluk}; font: ${YAPI_YAZI.mono}; margin-left: 24px; }
.kb-ayirici { height: 1px; margin: 4px 0; background: ${R.cizgi}; }
/* Araç çubuğu */
.kb-aracsatiri { display: flex; align-items: center; gap: 4px; padding: 4px 10px; border-bottom: 1px solid ${R.cizgi}; background: #0d1220; flex-wrap: wrap; }
.kb-grup { display: flex; align-items: center; gap: 3px; padding-right: 8px; margin-right: 4px; border-right: 1px solid ${R.cizgi}; }
.kb-grup:last-child { border-right: 0; }
.kb-arac { min-width: 30px; height: 26px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; background: ${R.dugme}; color: ${R.yazi}; border: 1px solid ${R.cizgi}; border-radius: 6px; padding: 0 8px; font: inherit; cursor: pointer; white-space: nowrap; }
.kb-arac:hover:not(:disabled) { border-color: ${R.vurgu}; color: ${R.yaziParlak}; } .kb-arac:disabled { opacity: 0.4; cursor: default; }
.kb-arac[data-acik="1"] { border-color: ${R.vurgu}; color: ${R.yaziParlak}; background: rgba(88,193,255,0.18); }
.kb-arac[data-ton="oynat"]:not(:disabled) { border-color: ${R.iyiCizgi}; color: ${R.iyi}; } .kb-arac[data-ton="durdur"]:not(:disabled) { border-color: #c2563f; color: #ff9c84; }
.kb-bosluk { flex: 1; }
.kb-okuma { font: 12px 'Cascadia Mono', Consolas, monospace; color: #ffd27a; min-width: 150px; }
/* Yan sekmeler (sağ panel) */
.kb-yan { width: 310px; flex: none; display: flex; flex-direction: column; min-height: 0; border-left: 1px solid ${R.cizgi}; background: #0c111e; }
.kb-yan-seritler { display: flex; border-bottom: 1px solid ${R.cizgi}; }
.kb-yan-sekme { flex: 1; background: transparent; border: 0; border-bottom: 2px solid transparent; color: ${R.yaziOrta}; font: inherit; padding: 6px 4px; cursor: pointer; }
.kb-yan-sekme:hover { color: ${R.yaziParlak}; } .kb-yan-sekme[data-etkin="1"] { color: ${R.yaziParlak}; border-bottom-color: ${R.vurgu}; background: rgba(88,193,255,0.08); }
.kb-yan-icerik { flex: 1; min-height: 0; overflow: auto; }
.kb-yan-icerik > [data-sekme] { display: none; } .kb-yan-icerik > [data-sekme][data-etkin="1"] { display: block; }
/* Yeniden boyutlanır dok */
.kb-boyut { height: 7px; margin-top: -4px; cursor: ns-resize; position: relative; z-index: 4; flex: none; }
.kb-boyut::after { content: ""; position: absolute; left: 50%; top: 2px; width: 46px; height: 3px; margin-left: -23px; border-radius: 2px; background: ${R.cizgi}; }
.kb-boyut:hover::after, .kb-boyut[data-surukle="1"]::after { background: ${R.vurgu}; }
/* Durum çubuğu */
.kb-durum { display: flex; gap: 14px; align-items: center; padding: 3px 12px; border-top: 1px solid ${R.cizgi}; min-height: 20px; font-size: 12px; background: #0b101c; }
`;

let eklendi = false;
export function kabukStiliEkle(): void {
  if (eklendi) return;
  const s = document.createElement("style"); s.textContent = KABUK_CSS; document.head.append(s); eklendi = true;
}
