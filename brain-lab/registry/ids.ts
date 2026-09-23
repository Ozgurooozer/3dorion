// brain-lab/registry/ids.ts — numbered identities. A number is never reused.
//   DNK-0007      subject (denek)
//   LRN-00000123  one learning event in a subject's ledger
//   RUN-000045    one experiment run
//   EVT-00000009  one world event inside a run (meal, injury, bump, death).
//                 Not OLY-: brain-ir's OlayDefteri is bound to Orion's event types.
"use strict";

const FORMATS = { DNK: 4, LRN: 8, RUN: 6, EVT: 8 } as const;
export type IdPrefix = keyof typeof FORMATS;

export function makeId(prefix: IdPrefix, n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`${prefix} number must be an integer >= 1, got ${n}`);
  return `${prefix}-${String(n).padStart(FORMATS[prefix], "0")}`;
}

export function parseId(prefix: IdPrefix, id: string): number {
  const m = new RegExp(`^${prefix}-(\\d{${FORMATS[prefix]},})$`).exec(id);
  const n = m ? Number(m[1]) : 0;
  if (n < 1) throw new RangeError(`not a ${prefix} id: ${id}`);
  return n;
}

export const subjectId = (n: number) => makeId("DNK", n);
export const ledgerId = (n: number) => makeId("LRN", n);
export const runId = (n: number) => makeId("RUN", n);
export const eventId = (n: number) => makeId("EVT", n);
