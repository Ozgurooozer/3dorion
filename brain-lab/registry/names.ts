// brain-lab/registry/names.ts — memorable names for subjects, given in order from a fixed list.
// The number is the identity; the name is for people. Changing this list would rename
// future subjects only — existing subjects keep the name stored in their subject.json.
"use strict";

export const NAMES: readonly string[] = Object.freeze([
  "Kıvılcım", "Çınar", "Poyraz", "Ada", "Işık", "Deniz", "Yakamoz", "Toprak",
  "Rüzgâr", "Şafak", "Doruk", "Pınar", "Ayaz", "Mercan", "Ilgaz", "Nehir",
  "Tan", "Başak", "Kuzey", "Serin", "Yağmur", "Ekin", "Dolunay", "Kaya",
  "Duru", "Çağlayan", "Gökçe", "Tuna", "Lodos", "Meltem", "Sema", "Umut",
  "Ateş", "Bulut", "Yıldız", "Irmak", "Ardıç", "Defne", "Kardelen", "Sarp",
  "Alaz", "Bora", "Ilgın", "Karma", "Mavi", "Oya", "Rota", "Zeytin",
]);

/** Name for subject number n: the list in order; after it runs out, "Kıvılcım 2", "Çınar 2", … */
export function nameFor(n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`subject number must be >= 1, got ${n}`);
  const base = NAMES[(n - 1) % NAMES.length]!;
  const cycle = Math.floor((n - 1) / NAMES.length);
  return cycle === 0 ? base : `${base} ${cycle + 1}`;
}
