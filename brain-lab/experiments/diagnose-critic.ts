// brain-lab/experiments/diagnose-critic.ts — what did the critic learn to value? (Themis §1.2, read-only)
// For every learner of a condition's standard runs: its critic weights grouped by sense (food rays, wall
// rays, hunger, bias, …), and how much weight was moved in total vs where it ended (churn).
//
//   node --experimental-strip-types brain-lab/experiments/diagnose-critic.ts K1n
"use strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RegistryStore } from "../registry/store.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const code = process.argv[2] ?? "K1n";
// "cue/" reads the cue memory (TASARIM-006) instead of the critic.
const prefix = process.argv[3] ?? "";

const rows = readFileSync(join(DATA, "results.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { code: string; command: string; control: string; learner: string; seed: number; group: string });
const seen = new Set<string>();
const learners = rows.filter((r) => r.code === code && r.command === "tara" && r.control === "none" && !seen.has(`${r.seed}/${r.group}`) && seen.add(`${r.seed}/${r.group}`));
const store = new RegistryStore(DATA, { readOnly: true });

/** Which group a critic feature belongs to. */
const groupOf = (f: string) => (/^ray\d+\.food$/.test(f) ? "food rays" : /^ray\d+\.wall$/.test(f) ? "wall rays" : /^ray\d+\.threat$/.test(f) ? "threat rays" : f.startsWith("intero.") ? f : f.startsWith("proprio.") ? "proprio" : f);

/** The features of the estimate asked for: the critic's own (no prefix) or one prefixed estimate. */
const ownFeature = (f: string) => (prefix ? f.startsWith(prefix) : !f.includes("/"));

const totals = new Map<string, { net: number[]; moved: number[] }>();
// Series 006 prediction (a): food rays valued above 0.1 and above the wall rays, per learner.
let foodValued = 0;
for (const r of learners) {
  const ledger = store.openLedger(r.learner);
  const net = new Map<string, number>(), moved = new Map<string, number>();
  for (const e of ledger.entries) {
    if (e.kind !== "critic" || !ownFeature(e.feature)) continue;
    const g = groupOf(e.feature.slice(prefix.length));
    moved.set(g, (moved.get(g) ?? 0) + Math.abs(e.after - e.before));
  }
  const features = new Set(ledger.entries.flatMap((e) => (e.kind === "critic" && ownFeature(e.feature) ? [e.feature] : [])));
  for (const f of features) net.set(groupOf(f.slice(prefix.length)), (net.get(groupOf(f.slice(prefix.length))) ?? 0) + ledger.criticWeight(f));
  if ((net.get("food rays") ?? 0) > Math.max(0.1, net.get("wall rays") ?? 0)) foodValued++;
  for (const g of new Set([...net.keys(), ...moved.keys()])) {
    const t = totals.get(g) ?? { net: [], moved: [] };
    t.net.push(net.get(g) ?? 0);
    t.moved.push(moved.get(g) ?? 0);
    totals.set(g, t);
  }
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
console.log(`${code}: ${learners.length} learners — ${prefix ? `"${prefix}" values` : "critic weight"} per sense group (sum over the group's features)`);
console.log("group            final (mean)   moved in total (mean)");
for (const [g, t] of [...totals].sort((a, b) => mean(b[1].moved) - mean(a[1].moved))) {
  console.log(`${g.padEnd(16)} ${mean(t.net).toFixed(4).padStart(12)}   ${mean(t.moved).toFixed(3).padStart(10)}`);
}
console.log(`food rays valued above 0.1 and above the wall rays: ${foodValued}/${learners.length} learners`);
