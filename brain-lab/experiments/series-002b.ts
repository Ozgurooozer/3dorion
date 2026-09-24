// brain-lab/experiments/series-002b.ts — EXPLORATORY robustness of one condition (series 002, batch 2).
//
// Run: node --experimental-strip-types brain-lab/experiments/series-002b.ts [CODE]
//   CODE defaults to the "best" of series-002a-summary.json.
//
// H7: the advantage over the frozen twin holds across learning rate, eligibility memory, food
// density, both innate groups, and new seeds (1–10). Plus a 100-episode learning curve.
// Every variant changes one thing from the condition's own settings.
"use strict";

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { InnateGroup } from "../development/index.ts";
import type { AgentSpec } from "../learning/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { makeConfig } from "../world/index.ts";
import { runCondition } from "./harness.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const store = new RegistryStore(DATA);
const codeCommit = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim();
type Spec = Omit<AgentSpec, "cfg" | "ledger" | "noiseSeed">;
const a = JSON.parse(readFileSync(join(DATA, "series-002a-summary.json"), "utf8")) as { best: string | null; conditions: { code: string; what: string; spec: Spec }[] };
const code = process.argv[2] ?? a.best;
if (!code) throw new Error("series 002a found no best candidate; pass a condition code explicitly");
const base = a.conditions.find((c) => c.code === code)!;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const GROUPS: InnateGroup[] = ["reflexless", "reflexive"];
const W = (foodCount: number) => makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount });
const withLearning = (patch: object): Spec => ({ ...base.spec, learning: { ...base.spec.learning, ...patch } });

const variants: { tag: string; spec: Spec; food: number }[] = [
  { tag: "as-is", spec: base.spec, food: 10 },
  { tag: "eta×0.4", spec: withLearning({ eta: (base.spec.learning?.eta ?? 0.05) * 0.4 }), food: 10 },
  { tag: "eta×2", spec: withLearning({ eta: (base.spec.learning?.eta ?? 0.05) * 2 }), food: 10 },
  { tag: "lambda 0.7", spec: withLearning({ lambda: 0.7 }), food: 10 },
  { tag: "lambda 0.9", spec: withLearning({ lambda: 0.9 }), food: 10 },
  { tag: "food 5", spec: base.spec, food: 5 },
  { tag: "food 15", spec: base.spec, food: 15 },
];

const started = Date.now();
const twins = new Map();
const results = variants.map((v) => {
  const r = runCondition(store, {
    condition: { code: `${code}/${v.tag}`, what: `${base.what} — ${v.tag}`, spec: v.spec },
    world: W(v.food), seeds: SEEDS, groups: GROUPS, trainEpisodes: 40, evalEpisodes: 10, codeCommit, label: "series-002b", twins,
  });
  console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${r.line}`);
  const { twins: _t, ...rest } = r;
  return rest;
});

// Learning curve: 100 episodes, seeds 1–3, both groups; training meals/1000 ticks per 10 episodes.
const curve = runCondition(store, {
  condition: { code: `${code}/long`, what: `${base.what} — 100 episodes`, spec: base.spec },
  world: W(10), seeds: [1, 2, 3], groups: GROUPS, trainEpisodes: 100, evalEpisodes: 10, codeCommit, label: "series-002b long", twins,
});
const blocks = curve.rows[0]!.trainPerK.map((_, i) => curve.rows.reduce((s, r) => s + r.trainPerK[i]!, 0) / curve.rows.length);
console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${curve.line}`);
console.log(`learning curve (training meals/1000t per 10 episodes): ${blocks.map((b) => b.toFixed(2)).join(" → ")}`);
const { twins: _t, ...curveRest } = curve;
writeFileSync(join(DATA, `series-002b-${code}-summary.json`), JSON.stringify({ series: "002b", exploratory: true, codeCommit, code, variants: results, curve: { ...curveRest, blocks } }, null, 2) + "\n");
