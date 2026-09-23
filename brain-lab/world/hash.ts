// brain-lab/world/hash.ts — FNV-1a over a string, 8 hex chars. The single hash used for
// "bit-identical" checks across the lab (world snapshots, brain graphs, records).
"use strict";

export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
