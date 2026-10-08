// world/level/cekirdek/ornekTanim.ts — Testler için geçerli, asgari level tanımı (fikstür).
//
// Test dosyasında durduğunda onu import eden başka test dosyası o testleri İKİNCİ kez koşturuyordu; ayrı dosya.
"use strict";
import type { LevelTanimi } from "./levelTanimi.ts";

/** Geçerli asgari tanım; testler bir alanını bozar. Her çağrı yeni kopya. */
export function ornekTanim(): LevelTanimi {
  return {
    surum: 1, ad: "deneme",
    palet: { mavi: "#2040c0", yesil: "#40a040" },
    isik: {
      gunes: { yon: [0, 1, 0], renk: "#ffffff", siddet: 1, golge: { acik: false, boyut: 1024, kademe: 2, uzaklik: 50, yumusaklik: 0.5, koyuluk: 0.4 } },
      dolgu: { ust: "mavi", alt: "yesil", siddet: 0.3 },
    },
    ortam: { arkaPlan: "mavi", sis: { acik: false, renk: "mavi", yogunluk: 0.01 }, tonlama: { acik: true, pozlama: 1, kontrast: 1 }, kamera: { uzak: 500 } },
    katmanlar: [{ tur: "a", ad: "a1", acik: true, ayar: {} }],
  };
}
