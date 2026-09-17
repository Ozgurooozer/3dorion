// tools/sadakat.ts — SADAKAT PUANLAYICISI (spec 06, Faz 1).
//
// Soru: Orion gözlemi söyledi mi, gözlemde olmayan bir şey uydurdu mu?
//
// Belirleyici etiket eşleştirmesi — LLM hakem DEĞİL. Hakem aynı sadakat
// sorununu taşır, kota yer ve ölçüme varyans ekler; ölçtüğümüz şeyin
// kendisiyle ölçmek olurdu. Bedeli: eş anlamlılar elle varyant olarak
// verilmeli ve olumsuzlama ("masa yok") ayırt edilmez (bkz. test).
"use strict";

export interface Beklenti {
  /** Söylenmesi gerekenler. Her öğe bir varyant listesi; biri yeter. */
  beklenen: string[][];
  /** Gözlemde OLMAYAN, söylenirse uydurma sayılanlar. */
  yabanci: string[][];
}

export interface Puan {
  soyledi: boolean;
  /** Geçen yabancı öğelerin ilk varyantı, sırayla. */
  uydurma: string[];
  sadik: boolean;
}

// Türkçe katlama: düz toLowerCase 'İ'yi 'i̇' yapar ve eşleşme sessizce kaçar.
const katla = (s: string) => s.toLocaleLowerCase("tr-TR");

export function puanla(metin: string, b: Beklenti): Puan {
  const m = katla(metin);
  const gecer = (varyantlar: string[]) => varyantlar.some((v) => m.includes(katla(v)));
  const soyledi = m.length > 0 && b.beklenen.every(gecer);
  const uydurma = b.yabanci.filter(gecer).map((v) => v[0]!);
  return { soyledi, uydurma, sadik: soyledi && uydurma.length === 0 };
}
