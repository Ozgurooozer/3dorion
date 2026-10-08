// world/level/cekirdek/renk.ts — Level renkleri: "#rrggbb" ↔ [0..1]³, karışım, palet çözümü. Saf.
"use strict";

export type Renk = readonly [number, number, number];

/** "#rrggbb" → [0..1, 0..1, 0..1]. Geçersizse fırlatır (tanım doğrulanırken yakalanır). */
export function hex(h: string): Renk {
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) throw new Error(`renk "#rrggbb" olmalı: ${h}`);
  const n = Number.parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** [0..1]³ → "#rrggbb". */
export function hexYaz(r: Renk): string {
  return "#" + r.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");
}

/** İki renk arasında doğrusal karışım (t sınırlanır). */
export function karistir(a: Renk, b: Renk, t: number): Renk {
  const k = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/**
 * Renk başvurusu: "#rrggbb" doğrudan renk, başka her şey paletteki adı. Modüller renklerini böyle alır —
 * palet tek yerde değişince bütün level değişir (ileride toon shader aynı paleti okur).
 */
export function renkCoz(deger: string, palet: Readonly<Record<string, string>>): Renk {
  if (deger.startsWith("#")) return hex(deger);
  const p = palet[deger];
  if (p === undefined) throw new Error(`paletde yok: "${deger}"`);
  return hex(p);
}
