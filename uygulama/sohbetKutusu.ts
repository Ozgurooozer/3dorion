// uygulama/sohbetKutusu.ts — Sohbet kutusu: T aç, Enter gönder, Esc kapat.
//
// Eskiden uygulama/giris.ts'teydi (mimari düzenleme B1–B2). Yazılan söz `girdi.gonder` ile "duyuldu" algısı olur.
"use strict";
import type { Oyuncu } from "../world/player/oyuncu.ts";
import type { MetinGirdi } from "../voice/metin-girdi.ts";

export interface SohbetKutusu {
  /** Kutu açık mı? (M gibi harf kısayolları açıkken devre dışı kalır.) */
  acikMi(): boolean;
}

export function sohbetKutusuKur(d: { oyuncu: Oyuncu; girdi: MetinGirdi }): SohbetKutusu {
  const { oyuncu, girdi } = d;
  const sohbet = document.getElementById("sohbet") as HTMLDivElement;
  const sohbetGirdi = document.getElementById("sohbetGirdi") as HTMLInputElement;

  function sohbetAc(acik: boolean): void {
    sohbet.dataset.acik = acik ? "1" : "0";
    if (acik) sohbetGirdi.focus();
    else { sohbetGirdi.blur(); sohbetGirdi.value = ""; }
  }

  addEventListener("keydown", (e) => {
    const acikMi = sohbet.dataset.acik === "1";
    if (!acikMi && (e.key === "t" || e.key === "T")) {
      if (oyuncu.oyuncuDurumu().etkilesim === "monitor") return;  // terminaldeyken T yazıdır
      e.preventDefault();
      sohbetAc(true);
      return;
    }
    if (!acikMi) return;
    if (e.key === "Escape") { sohbetAc(false); return; }
    if (e.key === "Enter") {
      const m = sohbetGirdi.value.trim();
      sohbetGirdi.value = "";
      if (m) girdi.gonder(m);
      sohbetAc(false);
    }
  });
  return { acikMi: () => sohbet.dataset.acik === "1" };
}
