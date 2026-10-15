// uygulama/varlikSinyali.ts — Ozyn'in VARLIK sinyali: son girdi, son konuşma, girdi sayacı penceresi.
//
// Eskiden uygulama/giris.ts'teydi (mimari düzenleme B1–B2). Dört modül değişkeni (`sonKonusma`, `sonGirdi`,
// `girdiPenceresi`, `girdiKaydi`) kapanışa girdi; tuş/fare/tekerlek dinleyicileri `varlikSinyaliKur` çağrıldığı
// anda takılır (giris.ts'te eski yerinde).
"use strict";
import { GirdiPenceresi, type GirdiTipi } from "../mind/girdiPenceresi.ts";
import type { KararKaydi } from "../mind/kararKaydi.ts";

export interface VarlikSinyali {
  /** Dünyanın açıldığı an — "ne kadardır buradayım" bundan hesaplanır. */
  readonly acilis: number;
  /** Ozyn'in en son konuştuğu an. 0 = hiç konuşmadı. */
  sonKonusma(): number;
  /**
   * Ozyn'in SON GİRDİSİ (tuş, fare/işaretçi, tekerlek, söz): VARLIK sinyali (Orion Beyin Ofisi T2-K2). Açılış girdi sayılır
   * (uygulamayı Ozyn başlattı). Kendiliğinden uyanma bu yaş ≤ 10 dk iken mümkün; yoksa Orion kimseye konuşmaz.
   */
  sonGirdi(): number;
  girdiOldu(tip: GirdiTipi): void;
  /** Ozyn bir söz söyledi: "en son ne zaman konuştuk" = son girdi anı (`girdiOldu("soz")`den hemen sonra çağrılır). */
  sozVerildi(): void;
  /** Beyin bağlanınca kurulur (`beyniBagla`); öncesindeki girdiler sayılır ama yazılmaz. */
  kararKaydiBagla(k: KararKaydi): void;
  /** Girdi penceresi doldu ama yeni girdi gelmediyse kapanışı tik yazar (Ozyn gittikten sonraki son dakika). */
  tikle(simdi: number): void;
}

export function varlikSinyaliKur(): VarlikSinyali {
  const acilis = Date.now();
  let sonKonusma = 0;
  let sonGirdi = Date.now();
  /** Girdi SAYILARI karar kaydına dakikalık yazılır (OB13; içerik yok): varlık kayıttan yeniden kurulabilsin. */
  const girdiPenceresi = new GirdiPenceresi();
  let girdiKaydi: KararKaydi | null = null;
  function girdiOldu(tip: GirdiTipi): void {
    sonGirdi = Date.now();
    const biten = girdiPenceresi.say(tip, sonGirdi);
    if (biten) girdiKaydi?.girdi(biten);
  }
  for (const [olay, tip] of [["keydown", "tus"], ["pointerdown", "fare"], ["pointermove", "fare"], ["wheel", "fare"]] as const) {
    window.addEventListener(olay, () => girdiOldu(tip), { passive: true, capture: true });
  }
  return {
    acilis,
    sonKonusma: () => sonKonusma,
    sonGirdi: () => sonGirdi,
    girdiOldu,
    sozVerildi: () => { sonKonusma = sonGirdi; },
    kararKaydiBagla: (k) => { girdiKaydi = k; },
    tikle: (simdi) => {
      const bitenGirdi = girdiPenceresi.tikle(simdi);
      if (bitenGirdi) girdiKaydi?.girdi(bitenGirdi);
    },
  };
}
