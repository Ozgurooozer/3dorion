// brain-lab/experiments/series-002c.ts — EXPLORATORY: what did the best candidate learn, and is it causal?
//
// Run: node --experimental-strip-types brain-lab/experiments/series-002c.ts [CODE]
//   CODE defaults to the "best" of series-002a-summary.json.
//
// H8 geometry: in each learner, for food seen on the LEFT rays (ray3, ray4) the net drive
//    (Go − NoGo) toward "left" should exceed that toward "right"; RIGHT rays (ray0, ray1) the
//    reverse; the CENTER ray (ray2) should favour "forward" over "back". 5 comparisons per learner;
//    the same score on the birth brain is the chance reference.
// H9 lesion: a clone of each learner gets its food-ray → Go/NoGo edges set back to their birth
//    values (recorded as ledger entries, cause "lesion"); a control clone gets the same number of
//    wall-ray edges reset instead. Prediction: the food lesion drops meals/1000 ticks toward the
//    twin; the wall lesion drops it less.
// H10 negative control: new learners of the same condition taught by dopamine delayed 100 ticks
//    (same values, broken timing). Prediction: no advantage over the twin.
"use strict";

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { InnateGroup } from "../development/index.ts";
import type { AgentSpec } from "../learning/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { isPlastic } from "../regions/index.ts";
import { makeConfig, type WorldConfig } from "../world/index.ts";
import { evaluate, median, runCondition, type Eval } from "./harness.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const store = new RegistryStore(DATA);
const codeCommit = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim();

interface Row { seed: number; group: InnateGroup; learner: { id: string }; twin: { id: string }; l: Eval; t: Eval }
interface Cond { code: string; what: string; spec: Omit<AgentSpec, "cfg" | "ledger" | "noiseSeed">; rows: Row[] }
const a = JSON.parse(readFileSync(join(DATA, "series-002a-summary.json"), "utf8")) as { best: string | null; conditions: Cond[] };
const code = process.argv[2] ?? a.best;
if (!code) throw new Error("series 002a found no best candidate; pass a condition code explicitly");
const cond = a.conditions.find((c) => c.code === code)!;
const WORLD: WorldConfig = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);

// --- H8: geometry of what was learned ---------------------------------------------------
const net = (g: { connections: { from: string; to: string; weight: number }[] }, ray: string, action: string) => {
  const w = (to: string) => g.connections.find((c) => c.from === ray && c.to === to)?.weight ?? 0;
  return w(`bg.go.${action}`) - w(`bg.nogo.${action}`);
};
const geometry = (g: { connections: { from: string; to: string; weight: number }[] }) => {
  const checks = [
    net(g, "ray3.food", "left") > net(g, "ray3.food", "right"),
    net(g, "ray4.food", "left") > net(g, "ray4.food", "right"),
    net(g, "ray0.food", "right") > net(g, "ray0.food", "left"),
    net(g, "ray1.food", "right") > net(g, "ray1.food", "left"),
    net(g, "ray2.food", "forward") > net(g, "ray2.food", "back"),
  ];
  return checks.filter(Boolean).length / checks.length;
};
const h8 = cond.rows.map((r) => {
  const l = store.openLedger(r.learner.id);
  return { id: r.learner.id, learned: geometry(l.graph), birth: geometry(l.birthGraph) };
});
console.log(`H8 geometry: learned ${mean(h8.map((x) => x.learned)).toFixed(2)} vs birth ${mean(h8.map((x) => x.birth)).toFixed(2)} (chance 0.5)`);

// --- H9: lesions -----------------------------------------------------------------------------
function lesion(parentId: string, pick: (from: string) => boolean, label: string): Eval {
  const child = store.clone(parentId, { codeCommit });
  const ledger = store.openLedger(child.id);
  const parentBirth = store.openLedger(parentId).birthGraph;
  const targets = ledger.graph.connections.filter((c) => isPlastic(c) && pick(c.from));
  for (const c of targets) {
    const b = parentBirth.connections.find((x) => x.from === c.from && x.to === c.to)!.weight;
    if (b !== c.weight) ledger.record({ kind: "weight", tick: 0, episode: 0, cause: ["lesion", label], edge: { from: c.from, to: c.to }, before: c.weight, after: b });
  }
  store.saveLedger(ledger);
  return evaluate(store, child, WORLD, 10, codeCommit, `series-002c lesion ${label}`);
}
const h9 = cond.rows.map((r) => {
  const food = lesion(r.learner.id, (f) => /^ray\d+\.food$/.test(f), "food");
  const wall = lesion(r.learner.id, (f) => /^ray\d+\.wall$/.test(f), "wall");
  return { id: r.learner.id, intact: r.l.perK, food: food.perK, wall: wall.perK, twin: r.t.perK };
});
console.log(`H9 lesion (meals/1000t): intact ${mean(h9.map((x) => x.intact)).toFixed(2)} | food-lesioned ${mean(h9.map((x) => x.food)).toFixed(2)} | wall-lesioned ${mean(h9.map((x) => x.wall)).toFixed(2)} | twin ${mean(h9.map((x) => x.twin)).toFixed(2)}`);

// --- H10: dopamine with broken timing -------------------------------------------------------
const DELAY = 100;
const delayed = (): AgentSpec["deltaTransform"] => {
  const buf: number[] = [];
  return (d) => { buf.push(d); return buf.length > DELAY ? buf.shift()! : 0; };
};
// A fresh delay line per learner: runCondition builds one agent per learner through train(), so the
// transform must be created per agent — wrap the spec so each call gets its own buffer.
const seeds = [...new Set(cond.rows.map((r) => r.seed))];
const groups = [...new Set(cond.rows.map((r) => r.group))];
const h10rows = [];
const twins = new Map(); // shared across the per-learner calls below
for (const group of groups) for (const seed of seeds) {
  const r = runCondition(store, {
    condition: { code: `${code}-delay${DELAY}`, what: `${cond.what}, dopamine delayed ${DELAY} ticks`, spec: { ...cond.spec, deltaTransform: delayed() } },
    world: WORLD, seeds: [seed], groups: [group], trainEpisodes: 40, evalEpisodes: 10, codeCommit, label: "series-002c H10", twins,
  });
  h10rows.push(...r.rows);
}
const ahead = h10rows.filter((r) => r.l.perK > r.t.perK).length;
console.log(`H10 delayed dopamine: ahead ${ahead}/${h10rows.length}, median diff ${median(h10rows.map((r) => r.l.perK - r.t.perK)).toFixed(2)} (original condition: ${cond.rows.filter((r) => r.l.perK > r.t.perK).length}/${cond.rows.length})`);

writeFileSync(join(DATA, `series-002c-${code}-summary.json`), JSON.stringify({ series: "002c", exploratory: true, codeCommit, code, h8, h9, h10: { delay: DELAY, ahead, of: h10rows.length, rows: h10rows } }, null, 2) + "\n");
