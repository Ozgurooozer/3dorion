// uygulama/dumanTesti.ts — Duman testi kanıtı: açılıştan 4 sn sonra tek satır sağlık özeti ([DUMAN]).
//
// Eskiden uygulama/giris.ts'teydi (mimari düzenleme B1–B2); kapı betikleri bu satırı arar.
"use strict";
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { Saat } from "../world/engine/tik.ts";
import type { KameraRig } from "../world/engine/kamera.ts";
import type { OdaKurulumu } from "../world/level/oda.ts";
import type { Oyuncu } from "../world/player/oyuncu.ts";
import type { Avatar } from "../world/avatar/index.ts";
import type { Monitor } from "../world/surfaces/terminal/monitor.ts";
import type { Kopru } from "../bridge/kopru.ts";
import type { Yerler } from "./yerGecisi.ts";

export interface DumanTestiGirdisi {
  motor: Engine; saat: Saat; rig: KameraRig; oda: OdaKurulumu; oyuncu: Oyuncu; monitor: Monitor; yerler: Yerler;
  /** Sonradan atananlar: çağrı anında okunur. */
  orion: () => Avatar | null;
  kopru: () => Kopru | null;
}

export function dumanTestiKur(g: DumanTestiGirdisi): void {
  const { motor, saat, rig, oda, oyuncu, monitor, yerler } = g;
  setTimeout(() => {
    const d = oyuncu.oyuncuDurumu();
    const orion = g.orion();
    const kopru = g.kopru();
    console.log(
      `[DUMAN] fps=${motor.getFps().toFixed(1)} hz=${saat.olculenHz.toFixed(2)} ` +
      `tik=${saat.tikSayisi} atlanan=${saat.atlanan} ` +
      `kamera=${rig.mod} mesh=${oda.meshler.length} capa=${yerler.ozyn.capalar.length} ` +
      `kopru=${JSON.stringify(kopru?.sayac() ?? null)} ` +
      `oyuncu=${d.konum.x.toFixed(2)},${d.konum.y.toFixed(2)},${d.konum.z.toFixed(2)} ` +
      `etkilesim=${d.etkilesim ?? "-"} kopru=${typeof window.kopru} ` +
      `orion=${orion ? `${orion.durum().poz}@${orion.durum().konum.x.toFixed(2)},${orion.durum().konum.z.toFixed(2)}` : "yok"} ` +
      `monitor=${monitor.acikMi() ? "acik" : "kapali"}`
    );
  }, 4000);
}
