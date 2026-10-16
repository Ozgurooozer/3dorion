// uygulama/hud.ts — Ekrandaki HUD: K1 ve K2 ölçümleri (FPS, tik hızı, kamera/fare kipi, konum) ve etkileşim ipucu.
//
// Eskiden uygulama/giris.ts'teydi (mimari düzenleme B1–B2). "Sanırım hızlı" yerine sayı. Aynı 250 ms'lik aralık
// odak düşüşünü de gözetler (`odak.odakDustuyseTemizle`).
"use strict";
import { TIK_HZ, type Saat } from "../world/engine/tik.ts";
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { KameraRig } from "../world/engine/kamera.ts";
import type { OdaKurulumu } from "../world/level/oda.ts";
import type { Oyuncu } from "../world/player/oyuncu.ts";
import { TUSLAR } from "../world/player/tuslar.ts";
import type { Odak } from "./odak.ts";
import type { Yerler } from "./yerGecisi.ts";
import type { KokYolu } from "./yolTipleri.ts";

export interface HudGirdisi {
  hud: HTMLElement;
  motor: Engine; saat: Saat; rig: KameraRig; oda: OdaKurulumu; oyuncu: Oyuncu; odak: Odak; yerler: Yerler;
  /** Etkileşim ipucu yoldan gelir (`etkilesim.ipucu`). */
  yol: KokYolu;
  /** İmleç kipi açık mı (Tab, spec 28). */
  imlec: () => boolean;
  /** Seçili nesnenin adı (fareyle seçilen), yoksa null. */
  secili: () => string | null;
  /** 20Hz mantık tik sayacı (giris.ts'te artar): çağrı anında okunur. */
  mantikTik: () => number;
}

export function hudKur(g: HudGirdisi): void {
  const { hud, motor, saat, rig, oda, oyuncu, yerler } = g;
  const kameraTusu = TUSLAR.kamera.etiket, etkilesimTusu = TUSLAR.etkilesim.etiket, imlecTusu = TUSLAR.imlec.etiket;
  // Etkileşim → HUD: T3 (monitör) ve T4 (köprü) aynı konuya abone olacak. Burada yalnızca
  // kullanıcıya geri bildirim var; protokol mesajı ÜRETİLMEZ.
  let ipucuMetin = "";
  g.yol.dinle("etkilesim.ipucu", (i) => { ipucuMetin = i?.metin ?? ""; });

  setInterval(() => {
    // Odaktan çıkışın birden çok yolu var (Esc, panel değişimi, terminale
    // geçiş). Her birine ayrı temizlik kancası asmak yerine tek gözetim
    // noktası: odak düştüyse zoom kumandası da kapanır.
    g.odak.odakDustuyseTemizle();

    const hz = saat.olculenHz;
    const d = oyuncu.oyuncuDurumu();
    hud.textContent =
      `FPS ${motor.getFps().toFixed(0)}  |  tik ${hz.toFixed(2)} Hz (hedef ${TIK_HZ})  ` +
      `|  tik# ${g.mantikTik()}  |  atlanan ${saat.atlanan}\n` +
      `kamera ${rig.mod === "omuz" ? `3.şahıs (${kameraTusu}: 1.şahıs)` : `1.şahıs (${kameraTusu}: 3.şahıs)`}  ` +
      `|  fare ${rig.odakta ? (rig.fareKamerada ? "KAMERA (Ctrl)" : "imleç serbest") : g.imlec() ? `İMLEÇ KİPİ (${imlecTusu}: çık)` : (rig.fareKamerada ? "kamera" : "kamera — tuvale tıkla")}  ` +
      `|  gövde ${oyuncu.govdeUzakligi.toFixed(2)}m ${oyuncu.govde.isVisible ? "görünür" : "GİZLİ"}  ` +
      `|  konum ${d.konum.x.toFixed(1)},${d.konum.z.toFixed(1)}  ` +
      `|  mesh ${oda.meshler.length}  |  çapa ${yerler.ozyn.capalar.length}${g.secili() ? `  |  seçili: ${g.secili()}` : ""}\n` +
      (ipucuMetin ? ipucuMetin : g.imlec() ? `sol tık: seç · sağ tık: menü · ${imlecTusu}/Esc: çık · ${etkilesimTusu}: etkileşim · WASD: yürü` : `WASD yürü · Shift koş · fare bak · ${kameraTusu} kamera · ${imlecTusu} nesne seç · ${etkilesimTusu} etkileşim (monitör, tahta…; terminalde: imleç serbest, Ctrl+fare bak) · T Orion'a yaz · Esc çık`);
  }, 250);
}
