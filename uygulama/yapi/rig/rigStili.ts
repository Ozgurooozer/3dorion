// uygulama/yapi/rig/rigStili.ts — RİG ve KAMERA panellerinin CSS'i (spec 38 §6, §7). Renkler Yapı jetonlarından. DOM katmanı.
"use strict";
import { YAPI_RENK as R } from "../../../world/arayuz/arayuzJetonlari.ts";

export const RIG_CSS = `
.rg-kok, .kp-kok { padding: 8px 10px; font-size: 12px; color: ${R.yaziOrta}; }
.rg-liste { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.rg-zincir { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.rg-zad { width: 74px; flex: none; color: ${R.yaziSoluk}; }
.rg-kontrol { padding: 1px 7px; border-left-width: 3px; }
.rg-kontrol[data-taraf="sag"] { border-left-color: #d83030; } .rg-kontrol[data-taraf="sol"] { border-left-color: #3060d8; } .rg-kontrol[data-taraf="orta"] { border-left-color: #e0b020; }
.rg-kontrol[data-secili="1"] { border-color: ${R.vurgu}; color: ${R.yaziParlak}; background: rgba(88,193,255,0.18); }
.rg-alanlar { display: grid; grid-template-columns: 1fr auto 62px auto; gap: 4px 4px; align-items: center; margin-bottom: 6px; }
.rg-alanlar label { grid-column: 1 / -1; color: ${R.yaziOrta}; margin-top: 4px; }
.rg-alanlar small { grid-column: 1 / -1; margin-top: -2px; }
.rg-adim { min-width: 24px; padding: 0 6px; }
.rg-segment { display: flex; align-items: center; gap: 4px; margin: 3px 0; }
.rg-etiket { width: 44px; color: ${R.yaziSoluk}; }
.rg-seg[data-secili="1"] { border-color: ${R.vurgu}; color: ${R.yaziParlak}; background: rgba(88,193,255,0.2); }
.rg-gruplar { display: flex; flex-direction: column; gap: 6px; }
.rg-grup { border: 1px solid ${R.kartCizgi}; border-radius: 8px; background: ${R.kart}; padding: 5px 7px; }
.rg-grup-ust { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
.rg-grup-ad { flex: 1; color: ${R.yaziParlak}; font-weight: 600; }
.rg-mini { padding: 0 7px; font-size: 11px; }
.rg-cipler { display: flex; flex-wrap: wrap; gap: 3px; }
.rg-kontrol[data-anahtar="1"] { color: #ffd27a; }
.rg-kanal { margin: 6px 0 2px; }
.rg-kanal-baslik { display: flex; justify-content: space-between; color: ${R.yaziOrta}; }
.rg-kaydirici { width: 100%; margin: 3px 0; accent-color: ${R.vurgu}; }
.rg-kanal-alt { display: flex; align-items: center; gap: 4px; }
.rg-sayi { width: 64px; text-align: right; }
.kp-satir { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin: 3px 0; }
.kp-liste { display: flex; flex-direction: column; gap: 2px; margin: 4px 0; }
.kp-oge { display: flex; align-items: center; gap: 6px; padding: 3px 8px; border: 1px solid ${R.kartCizgi}; border-radius: 6px; background: ${R.kart}; cursor: pointer; }
.kp-oge:hover { border-color: #4a69b0; } .kp-oge[data-secili="1"] { border-color: ${R.vurgu}; background: #182238; }
.kp-ad { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${R.yaziParlak}; }
.kp-alanlar { display: grid; grid-template-columns: 1fr; gap: 2px; }
.kp-alanlar label { color: ${R.yaziSoluk}; margin-top: 4px; }
.kp-alanlar input[type=text] { width: 100%; box-sizing: border-box; }
.kp-uclu { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.kp-uclu input { width: 100%; box-sizing: border-box; }
.kp-adim { min-width: 30px; padding: 2px 8px; }
`;

let eklendi = false;
export function rigStiliEkle(): void {
  if (eklendi) return;
  const s = document.createElement("style"); s.textContent = RIG_CSS; document.head.append(s); eklendi = true;
}
