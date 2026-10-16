// world/player/tuslar.ts — OYUNCUNUN oyun tuşları: etkileşim ve kamera. Saf (DOM yok).
//
// Ozyn 2026-10-16: "tüm etkileşimler F tuşu ile". Etkileşim E'den F'ye, kamera modu F'den C'ye taşındı (E boşta). Tuşun KODU ile ekranda yazan ETİKETİ
// (HUD ipucu "[F] …", yardım satırı, panel metinleri) aynı tablodan gelir: yazı ile gerçek tuş birbirinden ayrışamaz (`tuslar.test.ts`).
// Level editörünün kendi tuşları (E/C/F uçuş ve odaklama) AYRI sayfa ve ayrı denetim: buradan etkilenmez.
"use strict";

export const TUSLAR = {
  etkilesim: { kod: "KeyF", etiket: "F" },
  kamera: { kod: "KeyC", etiket: "C" },
  /** İmleç kipi (spec 28): gezinirken imleç serbest, tıklama nesne seçer. Kodu harf değil: etiketi koduyla aynı. */
  imlec: { kod: "Tab", etiket: "Tab" },
} as const;

export type TusKarari = "etkilesim" | "kamera" | "imlec";

/** Basılan tuş kodu hangi oyun eylemini tetikler; hiçbirini tetiklemiyorsa null. */
export function tusKarari(kod: string): TusKarari | null {
  for (const k of Object.keys(TUSLAR) as TusKarari[]) if (TUSLAR[k].kod === kod) return k;
  return null;
}
