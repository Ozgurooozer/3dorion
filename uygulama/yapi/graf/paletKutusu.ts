// uygulama/yapi/graf/paletKutusu.ts — DÜĞÜM PALETİ KUTUSU (spec 35 dilim 2b): sağ tık / Boşluk / boşluğa bırakılan bağ ile açılır; arama, kategori
// grupları, Türkçe ad + açıklama (kütüphaneden), ↑↓ ile gezinti, Enter ekler, Esc kapatır. DOM katmanı; liste ve süzgeç `palet.ts`te (saf, testli).
//
// Bir pinden sürüklenip boşluğa bırakılınca YALNIZ o pine bağlanabilen düğümler listelenir ve eklenen düğüm o pine kendiliğinden bağlanır (tek geri al adımı:
// editorOturumu.dugumEkleKomutu). Düğüm paletin açıldığı noktaya (imleç) gelir.
"use strict";
import type { PinTipi } from "../../../protocol/graf.ts";
import { paletGrupla, paletOgeleri, paletSuz, type PaletOgesi } from "../../graf/editor/palet.ts";
import { PIN_TIP_ADI, type PinRef } from "../../graf/editor/bagKurali.ts";
import type { Nokta } from "../../duzenleyici/tuvalMatematigi.ts";
import type { EditorBaglami } from "./editorBaglami.ts";
import { el } from "./dom.ts";

export interface PaletKutusu {
  readonly kok: HTMLElement;
  ac(ekran: Nokta, dunya: Nokta, pin?: (PinRef & { tip: PinTipi }) | null, arama?: string): void;
  /** Açıksa kapatır; kapandı mı. */
  kapat(): boolean;
  acikMi(): boolean;
}

export function paletKur(b: EditorBaglami, ekle: (oge: PaletOgesi, dunya: Nokta, pin: (PinRef & { tip: PinTipi }) | null) => void): PaletKutusu {
  const kok = el("div", "ge-palet");
  const ara = el("input"); ara.type = "search"; ara.placeholder = "Ara… (ad, tür, açıklama)"; ara.spellcheck = false; ara.autocomplete = "off";
  const not = el("div", "ge-pnot");
  const liste = el("div", "ge-pliste");
  kok.append(ara, not, liste);

  let tum: PaletOgesi[] = [];
  let gorunen: PaletOgesi[] = [];
  let isaretli = 0;
  let hedef: { dunya: Nokta; pin: (PinRef & { tip: PinTipi }) | null } = { dunya: { x: 0, y: 0 }, pin: null };

  function ciz(): void {
    gorunen = paletSuz(tum, { arama: ara.value, pin: hedef.pin });
    isaretli = Math.min(isaretli, Math.max(0, gorunen.length - 1));
    liste.replaceChildren();
    if (!gorunen.length) { liste.append(el("div", "ge-pnot", hedef.pin ? "Bu pine bağlanabilen düğüm yok (aramayı değiştir)." : "Aramaya uyan düğüm yok.")); return; }
    let sira = 0;
    for (const g of paletGrupla(gorunen)) {
      liste.append(el("div", "ge-pgrup", g.ad));
      for (const o of g.ogeler) {
        const i = sira++;
        const s = el("div", "ge-poge");
        s.dataset.isaretli = i === isaretli ? "1" : "0";
        s.title = `${o.ad} (${o.tip})\n${o.aciklama}`;
        s.append(el("span", "", o.ad), el("small", "", o.aciklama));
        s.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); sec(o); });
        liste.append(s);
      }
    }
    liste.querySelector<HTMLElement>('[data-isaretli="1"]')?.scrollIntoView({ block: "nearest" });
  }

  function sec(o: PaletOgesi): void {
    const h = hedef;
    kapat();
    ekle(o, h.dunya, h.pin);
  }

  function kapat(): boolean {
    if (kok.dataset.acik !== "1") return false;
    kok.dataset.acik = "0";
    (kok.closest(".ge-kok") as HTMLElement | null)?.focus({ preventScroll: true });
    return true;
  }

  ara.addEventListener("input", () => { isaretli = 0; ciz(); });
  ara.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      isaretli = Math.max(0, Math.min(gorunen.length - 1, isaretli + (e.key === "ArrowDown" ? 1 : -1)));
      ciz();
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Gruplama sırası listeyle aynı olsun diye seçim gruplanmış sıradan.
      const sirali = paletGrupla(gorunen).flatMap((g) => g.ogeler);
      const o = sirali[isaretli];
      if (o) sec(o);
    } else if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      kapat();
    }
  });
  kok.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });

  return {
    kok,
    ac(ekran, dunya, pin = null, arama = "") {
      const o = b.oturum();
      if (!o) return;
      const g = o.graf();
      tum = paletOgeleri(b.kayit, o.ortam(), g.tur, b.desenler(), g.ad);
      hedef = { dunya, pin };
      ara.value = arama;
      isaretli = 0;
      not.textContent = pin ? `'${pin.dugum}.${pin.pin}' (${PIN_TIP_ADI[pin.tip]}) ${pin.yon === "cikis" ? "çıkışına" : "girişine"} bağlanabilenler — eklenince bağlanır` : "Enter: ekle · ↑↓: seç · Esc: kapat";
      kok.dataset.acik = "1";
      // Tuvalin içinde kalsın.
      const ust = kok.parentElement;
      const gw = ust?.clientWidth ?? 800, gh = ust?.clientHeight ?? 600;
      kok.style.left = `${Math.max(4, Math.min(ekran.x, gw - 304))}px`;
      kok.style.top = `${Math.max(4, Math.min(ekran.y, gh - 424))}px`;
      ciz();
      ara.focus({ preventScroll: true });
    },
    kapat,
    acikMi: () => kok.dataset.acik === "1",
  };
}
