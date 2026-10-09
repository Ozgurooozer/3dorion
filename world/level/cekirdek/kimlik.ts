// world/level/cekirdek/kimlik.ts — Yerleşim ve grup kimlikleri. Saf, belirlenimci (rastgele değil: aynı dosya aynı
// kimlikleri alır, testler ve geri al tekrarlanabilir).
//
// Biçim `<önek><sayı>` (n12, g3). Yeni kimlik = kullanılanların en büyüğü + 1: aradaki boşluklar doldurulmaz
// (araya eklenen nesne eskisinin kimliğini almasın — dosya farkında "n4 taşındı" sanılmasın).
"use strict";

/** `onek`li kimliklerin sayı kısmının en büyüğü (yoksa 0). */
function enBuyuk(idler: Iterable<string>, onek: string): number {
  let m = 0;
  for (const id of idler) {
    if (!id.startsWith(onek)) continue;
    const s = Number(id.slice(onek.length));
    if (Number.isInteger(s) && s > m) m = s;
  }
  return m;
}

/** `adet` yeni kimlik: kullanılanlarla çakışmaz, sırayla artar. */
export function yeniIdler(kullanilan: Iterable<string>, adet: number, onek = "n"): string[] {
  const bas = enBuyuk(kullanilan, onek);
  return Array.from({ length: adet }, (_, i) => `${onek}${bas + i + 1}`);
}

/** Tek yeni kimlik. */
export const yeniId = (kullanilan: Iterable<string>, onek = "n"): string => yeniIdler(kullanilan, 1, onek)[0]!;

/** Kimliği olmayanlara sırayla kimlik verir (olanlara dokunmaz). Değişiklik yoksa AYNI dizi döner. */
export function kimlikleriDoldur<T extends { id?: string }>(liste: readonly T[], onek = "n"): T[] {
  const eksik = liste.filter((x) => !x.id).length;
  if (eksik === 0) return liste as T[];
  const yeni = yeniIdler(liste.map((x) => x.id ?? ""), eksik, onek);
  let i = 0;
  return liste.map((x) => (x.id ? x : { ...x, id: yeni[i++]! }));
}
