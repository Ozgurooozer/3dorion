// brain-lab/experiments/series-002a.ts — EXPLORATORY mechanism sweep (series 002, batch 1).
// Tuning seeds 4–10, both groups (14 learners per condition), 40 training + 10 evaluation
// episodes, η 0.05 / λ 0.8 / quantum 0.005, world: born hungry 0.4, 10 food, no threat.
// Each learner is compared with a frozen twin (same birth, same evaluation worlds and noise).
//
// Run: node --experimental-strip-types brain-lab/experiments/series-002a.ts
//
// Written BEFORE running (see LAB-DEFTERI):
//  - "Best" = the highest median (learner − twin) meals per 1000 ticks, among conditions where
//    ≥ 11/14 learners beat their twin; ties by approach. If none reaches 11/14, there is no best.
//  - H6 prediction: E6 (Go-only, death does not teach) turns hyperactive (still share < 10%).
//  - The best candidate goes to batch 2 (robustness) and batch 3 (what was learned, lesion, shuffled control).
"use strict";

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { InnateGroup } from "../development/index.ts";
import type { AgentSpec } from "../learning/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { makeConfig } from "../world/index.ts";
import { runCondition, type Condition } from "./harness.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const WORLD = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
const SEEDS = [4, 5, 6, 7, 8, 9, 10];
const GROUPS: InnateGroup[] = ["reflexless", "reflexive"];
const BASE = { eta: 0.05, lambda: 0.8, quantum: 0.005 };
const SEL = { ...BASE, gate: "selected" as const };
const FLOOR = 0.05;

type Spec = Omit<AgentSpec, "cfg" | "ledger" | "noiseSeed">;
const C = (code: string, what: string, spec: Spec): Condition => ({ code, what, spec });
const CONDITIONS: Condition[] = [
  C("E0", "full rule, neuron gate (reference)", { learning: BASE }),
  C("E1", "selected gate", { learning: SEL }),
  C("E2", "selected + death does not teach", { learning: SEL, teachAtDeath: false }),
  C("E3", "selected + dip floor", { learning: { ...SEL, dipFloor: FLOOR } }),
  C("E4", "selected + dip floor + death does not teach", { learning: { ...SEL, dipFloor: FLOOR }, teachAtDeath: false }),
  C("E5", "Go-only, neuron gate (previous best)", { learning: { ...BASE, learnNoGo: false } }),
  C("E6", "Go-only + death does not teach (H6)", { learning: { ...BASE, learnNoGo: false }, teachAtDeath: false }),
  C("E7", "E4 + critic", { learning: { ...SEL, dipFloor: FLOOR }, teachAtDeath: false, critic: {} }),
  C("E8", "E4 + synaptic scaling", { learning: { ...SEL, dipFloor: FLOOR, scaling: true }, teachAtDeath: false }),
  C("E9", "E4 + RPE normalization (η 0.003)", { learning: { ...SEL, dipFloor: null, eta: 0.003 }, teachAtDeath: false, rpeNormalization: { rate: 0.01 } }),
  C("E10", "E4 + critic + scaling", { learning: { ...SEL, dipFloor: FLOOR, scaling: true }, teachAtDeath: false, critic: {} }),
];

const store = new RegistryStore(DATA);
const codeCommit = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim();
const started = Date.now();
const twins = new Map(); // one frozen twin per seed×group, shared by every condition
const out = CONDITIONS.map((c) => {
  const r = runCondition(store, { condition: c, world: WORLD, seeds: SEEDS, groups: GROUPS, trainEpisodes: 40, evalEpisodes: 10, codeCommit, label: "series-002a", twins });
  console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${r.line}`);
  return r;
});
const eligible = out.filter((r) => r.ahead >= 11).sort((a, b) => b.medianPerKDiff - a.medianPerKDiff || b.medianApproachDiff - a.medianApproachDiff);
const best = eligible[0]?.code ?? null;
writeFileSync(join(DATA, "series-002a-summary.json"), JSON.stringify({ series: "002a", exploratory: true, codeCommit, best, conditions: out.map(({ twins: _t, ...r }) => r), seconds: Math.round((Date.now() - started) / 1000) }, null, 2) + "\n");
console.log(`best: ${best ?? "none (no condition reached 11/14)"}`);
