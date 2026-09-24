// brain-lab/experiments/pilot-001.ts — EXPLORATORY pilot, tuning seeds only (1–10).
// Question: does a hungry-born regional brain learn to orient to food?
// Not a confirmatory test: it finds direction and sizes for a later pre-registration.
//
// Run: node --experimental-strip-types brain-lab/experiments/pilot-001.ts
//
// Decided BEFORE any learner was run (LAB-DEFTERI 2026-09-24):
//  - World: no threat, born hungry (0.4), 10 food. Chosen from frozen newborns only:
//    3.2 meals/episode, 24% of episodes without a meal — reward is occasional, far from ceiling.
//  - Phase A (tuning): seeds 1–3, both groups, η × λ grid, 30 training + 10 evaluation episodes.
//    Selection rule: the combination with the largest median (learner − frozen twin) orientation
//    index over the 6 seed×group cells; ties broken by meals.
//  - Phase B (pilot): seeds 4–10, both groups, chosen η, λ; 60 training + 20 evaluation episodes.
//  - Evaluation: learning frozen, same evaluation worlds and the same noise for a learner and its twin.
//  - Test seeds (1001+) are never used here.
"use strict";

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bornGraph, type InnateGroup } from "../development/index.ts";
import { createAgent, type LearningParams } from "../learning/index.ts";
import { episodeEvents, type Subject } from "../registry/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { Room, makeConfig, runEpisode, type Action, type Observation } from "../world/index.ts";
import { orientation } from "./measures.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORLD = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
const MAX_TICKS = 3000;
const QUANTUM = 0.005; // 10× smaller ledgers than 0.001 (measured 2026-09-24)
const GROUPS: readonly InnateGroup[] = ["reflexless", "reflexive"];
const ETAS = [0.05, 0.1, 0.2];
const LAMBDAS = [0.8, 0.9, 0.95];

const store = new RegistryStore(join(HERE, "../data"));
const codeCommit = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim();

interface Eval { meals: number; ticks: number; orientation: number | null; seen: number }
interface Row {
  readonly phase: "A" | "B";
  readonly id: string;
  readonly name: string;
  readonly role: "learner" | "twin";
  readonly seed: number;
  readonly group: InnateGroup;
  readonly eta: number | null;
  readonly lambda: number | null;
  readonly trainMealsFirst10: number | null;
  readonly trainMealsLast10: number | null;
  readonly weightChanges: number | null;
  readonly eval: Eval;
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? NaN : s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};

function born(seed: number, group: InnateGroup, lineage?: Subject["lineage"]): Subject {
  return store.createSubject({ category: "learner.3f", group, seed, worldConfig: WORLD, birthGraph: bornGraph(WORLD, { seed, group }), lineage, codeCommit });
}

function train(s: Subject, params: Partial<LearningParams>, episodes: number) {
  const ledger = store.openLedger(s.id);
  const agent = createAgent({ cfg: WORLD, ledger, noiseSeed: s.birth.seed * 31 + 7, learning: { quantum: QUANTUM, ...params } });
  const run = store.startRun(s.id, "pilot-001 train", { params, episodes, quantum: QUANTUM }, { codeCommit });
  const meals: number[] = [];
  let eventNo = 1;
  for (let ep = 1; ep <= episodes; ep++) {
    agent.startEpisode(ep);
    const worldSeed = s.birth.seed * 1000 + ep;
    const { records, ...summary } = runEpisode(new Room(worldSeed, WORLD), agent.policy, MAX_TICKS, true, agent.hooks);
    const events = episodeEvents(records, eventNo);
    eventNo += events.length;
    store.appendEpisode(run.id, { episode: ep, worldSeed, summary, events });
    meals.push(summary.foodEaten);
  }
  agent.drainWrites();
  if (!ledger.matches(agent.graph)) throw new Error(`${s.id}: live brain differs from its ledger`);
  store.saveLedger(ledger);
  return { first10: mean(meals.slice(0, 10)), last10: mean(meals.slice(-10)), changes: ledger.entries.filter((e) => e.kind === "weight").length };
}

function evaluate(s: Subject, episodes: number, noiseSeed: number): Eval {
  const ledger = store.openLedger(s.id);
  const agent = createAgent({ cfg: WORLD, ledger, noiseSeed, learning: { frozen: true } });
  const run = store.startRun(s.id, "pilot-001 eval (learning frozen)", { episodes, noiseSeed }, { codeCommit });
  const meals: number[] = [];
  const ticks: number[] = [];
  let seen = 0;
  let toward = 0;
  for (let ep = 1; ep <= episodes; ep++) {
    agent.startEpisode(ep);
    const worldSeed = s.birth.seed * 1000 + 500 + ep;
    const room = new Room(worldSeed, WORLD);
    const first = room.observe();
    const { records, ...summary } = runEpisode(room, agent.policy, MAX_TICKS, true, agent.hooks);
    const observations: Observation[] = [first, ...records.map((r) => r.result.observation)];
    const actions: Action[] = records.map((r) => r.action);
    const o = orientation(observations, actions, WORLD);
    seen += o.seen;
    toward += o.toward;
    store.appendEpisode(run.id, { episode: ep, worldSeed, summary, events: episodeEvents(records), extra: { orientation: o } });
    meals.push(summary.foodEaten);
    ticks.push(summary.ticks);
  }
  return { meals: mean(meals), ticks: mean(ticks), orientation: seen > 0 ? toward / seen : null, seen };
}

function cell(phase: "A" | "B", seed: number, group: InnateGroup, combos: { eta: number; lambda: number }[], trainEps: number, evalEps: number): Row[] {
  const rows: Row[] = [];
  const noiseSeed = seed * 31 + 999; // same evaluation noise for the learner and its twin
  const first = born(seed, group);
  const twin = born(seed, group, { parent: first.id, how: "clone" });
  combos.forEach(({ eta, lambda }, i) => {
    const s = i === 0 ? first : born(seed, group);
    const t = train(s, { eta, lambda }, trainEps);
    rows.push({ phase, id: s.id, name: s.name, role: "learner", seed, group, eta, lambda, trainMealsFirst10: t.first10, trainMealsLast10: t.last10, weightChanges: t.changes, eval: evaluate(s, evalEps, noiseSeed) });
  });
  rows.push({ phase, id: twin.id, name: twin.name, role: "twin", seed, group, eta: null, lambda: null, trainMealsFirst10: null, trainMealsLast10: null, weightChanges: null, eval: evaluate(twin, evalEps, noiseSeed) });
  return rows;
}

const started = Date.now();
const log = (m: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${m}`);
const rows: Row[] = [];

// Phase A — tuning
const grid = ETAS.flatMap((eta) => LAMBDAS.map((lambda) => ({ eta, lambda })));
for (const seed of [1, 2, 3]) for (const group of GROUPS) { rows.push(...cell("A", seed, group, grid, 30, 10)); log(`A seed ${seed} ${group}`); }

const score = grid.map(({ eta, lambda }) => {
  const diffs: number[] = [];
  const mealDiffs: number[] = [];
  for (const seed of [1, 2, 3]) for (const group of GROUPS) {
    const l = rows.find((r) => r.phase === "A" && r.role === "learner" && r.seed === seed && r.group === group && r.eta === eta && r.lambda === lambda)!;
    const t = rows.find((r) => r.phase === "A" && r.role === "twin" && r.seed === seed && r.group === group)!;
    diffs.push((l.eval.orientation ?? 0) - (t.eval.orientation ?? 0));
    mealDiffs.push(l.eval.meals - t.eval.meals);
  }
  return { eta, lambda, orientationDiff: median(diffs), mealDiff: median(mealDiffs) };
});
score.sort((a, b) => b.orientationDiff - a.orientationDiff || b.mealDiff - a.mealDiff);
const chosen = score[0]!;
log(`A chosen: eta ${chosen.eta}, lambda ${chosen.lambda} (median orientation diff ${chosen.orientationDiff.toFixed(4)})`);

// Phase B — pilot
for (const seed of [4, 5, 6, 7, 8, 9, 10]) for (const group of GROUPS) { rows.push(...cell("B", seed, group, [chosen], 60, 20)); log(`B seed ${seed} ${group}`); }

// Summary
const pairs = (group: InnateGroup) => [4, 5, 6, 7, 8, 9, 10].map((seed) => {
  const l = rows.find((r) => r.phase === "B" && r.role === "learner" && r.seed === seed && r.group === group)!;
  const t = rows.find((r) => r.phase === "B" && r.role === "twin" && r.seed === seed && r.group === group)!;
  return { seed, learner: l, twin: t };
});
const binomTail = (k: number, n: number) => { // P(X ≥ k), X ~ Bin(n, 1/2): exploratory sign test
  let p = 0;
  for (let i = k; i <= n; i++) { let c = 1; for (let j = 0; j < i; j++) c = (c * (n - j)) / (j + 1); p += c / 2 ** n; }
  return p;
};
const summary = {
  pilot: "001", exploratory: true, codeCommit, world: { initialEnergy: 0.4, threatCount: 0, foodCount: 10 },
  phaseA: { grid: score, chosen },
  phaseB: Object.fromEntries(GROUPS.map((group) => {
    const ps = pairs(group);
    const o = ps.map((p) => (p.learner.eval.orientation ?? 0) - (p.twin.eval.orientation ?? 0));
    const m = ps.map((p) => p.learner.eval.meals - p.twin.eval.meals);
    return [group, {
      pairs: ps.map((p) => ({ seed: p.seed, learner: `${p.learner.id} «${p.learner.name}»`, twin: `${p.twin.id} «${p.twin.name}»`,
        orientation: [p.learner.eval.orientation, p.twin.eval.orientation], meals: [p.learner.eval.meals, p.twin.eval.meals],
        ticks: [p.learner.eval.ticks, p.twin.eval.ticks], trainMeals: [p.learner.trainMealsFirst10, p.learner.trainMealsLast10], weightChanges: p.learner.weightChanges })),
      orientationDiff: { median: median(o), learnerAhead: o.filter((x) => x > 0).length, of: o.length, signTestP: binomTail(o.filter((x) => x > 0).length, o.length) },
      mealDiff: { median: median(m), learnerAhead: m.filter((x) => x > 0).length, of: m.length, signTestP: binomTail(m.filter((x) => x > 0).length, m.length) },
    }];
  })),
  rows,
  seconds: Math.round((Date.now() - started) / 1000),
};
writeFileSync(join(HERE, "../data/pilot-001-summary.json"), JSON.stringify(summary, null, 2) + "\n");
log("done → brain-lab/data/pilot-001-summary.json");
for (const group of GROUPS) {
  const g = summary.phaseB[group]!;
  console.log(`\n${group}: orientation diff median ${g.orientationDiff.median.toFixed(4)} (learner ahead ${g.orientationDiff.learnerAhead}/${g.orientationDiff.of}, sign p=${g.orientationDiff.signTestP.toFixed(3)}); meals diff median ${g.mealDiff.median.toFixed(2)} (ahead ${g.mealDiff.learnerAhead}/${g.mealDiff.of}, p=${g.mealDiff.signTestP.toFixed(3)})`);
  for (const p of g.pairs) console.log(`  seed ${p.seed}: ${p.learner} vs ${p.twin} | orient ${p.orientation.map((x) => x?.toFixed(3)).join(" / ")} | meals ${p.meals.map((x) => x.toFixed(2)).join(" / ")} | train meals first10→last10 ${p.trainMeals.map((x) => x?.toFixed(2)).join("→")} | Δw ${p.weightChanges}`);
}
