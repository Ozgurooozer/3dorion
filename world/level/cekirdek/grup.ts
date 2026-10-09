// world/level/cekirdek/grup.ts — Grup zinciri: gizli/kilitli bayrağı üst gruplardan içindekilere geçer. Saf.
"use strict";
import type { GrupTanimi, NesneYeri } from "./levelTanimi.ts";

/** Grubun kendisi ve üstleri (içten dışa). Bilinmeyen kimlikte ya da döngüde durur (doğrulama döngüyü zaten reddeder). */
export function grupZinciri(id: string | undefined, gruplar: readonly GrupTanimi[]): GrupTanimi[] {
  const harita = new Map(gruplar.map((g) => [g.id, g]));
  const zincir: GrupTanimi[] = [];
  for (let g = id ? harita.get(id) : undefined; g && !zincir.includes(g); g = g.ust ? harita.get(g.ust) : undefined) zincir.push(g);
  return zincir;
}

/** Nesnenin kendisinde ya da herhangi bir üst grubunda bayrak açık mı. */
export const etkinBayrak = (n: NesneYeri, gruplar: readonly GrupTanimi[], alan: "gizli" | "kilitli"): boolean =>
  !!n[alan] || grupZinciri(n.grup, gruplar).some((g) => !!g[alan]);
