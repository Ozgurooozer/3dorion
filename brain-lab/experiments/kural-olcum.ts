// brain-lab/experiments/kural-olcum.ts — what the rule synapses grew, and how the recalled memory is used, for the
// screened learners of any conditions at a given training length (prereg 003/004). Read-only.
//
//   node --experimental-strip-types brain-lab/experiments/kural-olcum.ts <trainEpisodes|auto|patient> KOD [KOD…]
//
// recordedRows keeps only 40-episode rows; here the rows of the wanted length are relabelled 40 in memory (never written)
// so the same reader serves any length.
"use strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RegistryStore } from "../registry/store.ts";
import { condition } from "./conditions.ts";
import { recordedRows } from "./harness.ts";
import { aggregateRecall, learnerRecallLives, ruleWeights } from "./recall-a3.ts";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "../data");

/** The results lines of `code`s screened with `train` training episodes, relabelled as 40 for the shared readers. */
export function linesOfLength(lines: readonly string[], train: number | "auto" | "patient"): string[] {
  return lines.filter((t) => t.trim() !== "").flatMap((t) => {
    const r = JSON.parse(t) as { trainEpisodes?: number | "auto" | "patient" };
    return String(r.trainEpisodes ?? 40) === String(train) ? [JSON.stringify({ ...r, trainEpisodes: 40 })] : [];
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [train, ...codes] = process.argv.slice(2);
  if (!train || codes.length === 0) throw new Error("usage: kural-olcum.ts <trainEpisodes> KOD [KOD…]");
  const store = new RegistryStore(DATA, { readOnly: true });
  const lines = linesOfLength(readFileSync(join(DATA, "results.jsonl"), "utf8").split("\n"), train === "auto" || train === "patient" ? train : Number(train));
  const m = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
  for (const code of codes) {
    const world = condition(code).world!;
    const rows = recordedRows(lines, code, world, "tara");
    if (rows.length === 0) { console.log(`${code}: no ${train}-episode rows`); continue; }
    const rw = rows.map((r) => ruleWeights(store.openLedger(r.learner).graph, world));
    const a = aggregateRecall(learnerRecallLives(code, store, lines, null));
    console.log(`${code} @${train} n ${rows.length} | rule w mean ${m(rw.map((x) => x.mean)).toFixed(4)} own ${m(rw.map((x) => x.own)).toFixed(4)} other ${m(rw.map((x) => x.other)).toFixed(4)} own>other ${rw.filter((x) => x.own > x.other).length}/${rows.length} | drive ${m(rows.map((r) => r.l.meanDrive)).toFixed(3)} surv ${m(rows.map((r) => r.l.survival)).toFixed(2)} | G7 ${a.gateShare?.toFixed(3)} G6m ${a.steering?.toFixed(3)}`);
  }
}
