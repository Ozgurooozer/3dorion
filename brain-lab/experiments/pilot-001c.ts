// brain-lab/experiments/pilot-001c.ts — EXPLORATORY confirmation of pilot 001b. Tuning seeds only.
//
// Run: node --experimental-strip-types brain-lab/experiments/pilot-001c.ts
//
// Q1 (causal test of "the death signal's scale drives the collapse"): the FULL rule (Go + NoGo)
//    with a smaller innate death value. If the hypothesis holds, −0.1 and −0.01 do not freeze.
//      C0 death −1 (replication) · C1 death −0.1 · C2 death −0.01        seeds 4–10, reflexless
// Q2 (does the Go-only result replicate?): A1 of pilot 001b on new cells.
//      C3 Go-only, seeds 1–3 reflexless · C4 Go-only, seeds 4–10 reflexive
// All: η 0.05, λ 0.8, quantum 0.005, 30 training + 10 evaluation episodes, vs frozen twins.
// Measures: life (ticks), meals, meals/1000 ticks, orientation, approach, share of still ticks.
"use strict";

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bornGraph, type InnateGroup } from "../development/index.ts";
import { createAgent, type LearningParams } from "../learning/index.ts";
import { episodeEvents, type Subject } from "../registry/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { Room, makeConfig, runEpisode, type Action } from "../world/index.ts";
import { approach, orientation } from "./measures.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const WORLD = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
const MAX_TICKS = 3000;
const BASE: Partial<LearningParams> = { eta: 0.05, lambda: 0.8, quantum: 0.005 };
const store = new RegistryStore(DATA);
const codeCommit = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim();
const started = Date.now();
const log = (m: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${m}`);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2; };
const moving = (a: Action) => a.thrust !== 0 || a.turn !== 0;

interface Cond { code: string; what: string; seeds: number[]; group: InnateGroup; learning: Partial<LearningParams>; deathOutcome: number }
const CONDS: Cond[] = [
  { code: "C0", what: "full rule, death −1 (replication)", seeds: [4, 5, 6, 7, 8, 9, 10], group: "reflexless", learning: {}, deathOutcome: -1 },
  { code: "C1", what: "full rule, death −0.1", seeds: [4, 5, 6, 7, 8, 9, 10], group: "reflexless", learning: {}, deathOutcome: -0.1 },
  { code: "C2", what: "full rule, death −0.01", seeds: [4, 5, 6, 7, 8, 9, 10], group: "reflexless", learning: {}, deathOutcome: -0.01 },
  { code: "C3", what: "Go-only, new seeds 1–3", seeds: [1, 2, 3], group: "reflexless", learning: { learnNoGo: false }, deathOutcome: -1 },
  { code: "C4", what: "Go-only, reflexive group", seeds: [4, 5, 6, 7, 8, 9, 10], group: "reflexive", learning: { learnNoGo: false }, deathOutcome: -1 },
];

interface Eval { ticks: number; meals: number; perK: number; orientation: number; approach: number; still: number }
function evaluate(s: Subject): Eval {
  const agent = createAgent({ cfg: WORLD, ledger: store.openLedger(s.id), noiseSeed: s.birth.seed * 31 + 999, learning: { frozen: true } });
  const run = store.startRun(s.id, "pilot-001c eval (learning frozen)", {}, { codeCommit });
  const ticks: number[] = [], meals: number[] = [];
  let seen = 0, toward = 0, pairs = 0, closer = 0, still = 0, all = 0;
  for (let ep = 1; ep <= 10; ep++) {
    agent.startEpisode(ep);
    const worldSeed = s.birth.seed * 1000 + 500 + ep;
    const room = new Room(worldSeed, WORLD);
    const first = room.observe();
    const { records, ...summary } = runEpisode(room, agent.policy, MAX_TICKS, true, agent.hooks);
    const obs = [first, ...records.map((r) => r.result.observation)];
    const o = orientation(obs, records.map((r) => r.action), WORLD);
    const a = approach(obs);
    seen += o.seen; toward += o.toward; pairs += a.pairs; closer += a.closer;
    for (const r of records) { all++; if (!moving(r.action)) still++; }
    store.appendEpisode(run.id, { episode: ep, worldSeed, summary, events: episodeEvents(records), extra: { orientation: o, approach: a } });
    ticks.push(summary.ticks); meals.push(summary.foodEaten);
  }
  return { ticks: mean(ticks), meals: mean(meals), perK: (1000 * meals.reduce((x, y) => x + y, 0)) / ticks.reduce((x, y) => x + y, 0), orientation: seen ? toward / seen : 0, approach: pairs ? closer / pairs : 0, still: still / all };
}

const born = (seed: number, group: InnateGroup) =>
  store.createSubject({ category: "learner.3f", group, seed, worldConfig: WORLD, birthGraph: bornGraph(WORLD, { seed, group }), codeCommit });

const twins = new Map<string, Eval>();
const twinOf = (seed: number, group: InnateGroup) => {
  const k = `${seed}/${group}`;
  if (!twins.has(k)) twins.set(k, evaluate(born(seed, group)));
  return twins.get(k)!;
};

const results: Record<string, unknown> = {};
for (const c of CONDS) {
  const rows = [];
  for (const seed of c.seeds) {
    const twin = twinOf(seed, c.group);
    const s = born(seed, c.group);
    const ledger = store.openLedger(s.id);
    const learning = { ...BASE, ...c.learning };
    const agent = createAgent({ cfg: WORLD, ledger, noiseSeed: seed * 31 + 7, learning, deathOutcome: c.deathOutcome });
    const run = store.startRun(s.id, `pilot-001c ${c.code} train`, { condition: c.code, learning, deathOutcome: c.deathOutcome }, { codeCommit });
    for (let ep = 1; ep <= 30; ep++) {
      agent.startEpisode(ep);
      const worldSeed = seed * 1000 + ep;
      const { records, ...summary } = runEpisode(new Room(worldSeed, WORLD), agent.policy, MAX_TICKS, true, agent.hooks);
      store.appendEpisode(run.id, { episode: ep, worldSeed, summary, events: episodeEvents(records) });
    }
    agent.drainWrites();
    if (!ledger.matches(agent.graph)) throw new Error(`${s.id}: off the record`);
    store.saveLedger(ledger);
    rows.push({ seed, id: s.id, name: s.name, learner: evaluate(s), twin });
  }
  const d = (f: (e: Eval) => number) => median(rows.map((r) => f(r.learner) - f(r.twin)));
  const ahead = rows.filter((r) => r.learner.perK > r.twin.perK).length;
  const L = (f: (e: Eval) => number) => mean(rows.map((r) => f(r.learner)));
  const T = (f: (e: Eval) => number) => mean(rows.map((r) => f(r.twin)));
  results[c.code] = { what: c.what, rows, aheadPerK: `${ahead}/${rows.length}`, medianDiff: { perK: d((e) => e.perK), ticks: d((e) => e.ticks), approach: d((e) => e.approach), orientation: d((e) => e.orientation) } };
  log(`${c.code} ${c.what}: learner ticks ${L((e) => e.ticks).toFixed(0)} vs twin ${T((e) => e.ticks).toFixed(0)} | meals/1000t ${L((e) => e.perK).toFixed(2)} vs ${T((e) => e.perK).toFixed(2)} (ahead ${ahead}/${rows.length}) | approach ${L((e) => e.approach).toFixed(3)} vs ${T((e) => e.approach).toFixed(3)} | orient ${L((e) => e.orientation).toFixed(3)} vs ${T((e) => e.orientation).toFixed(3)} | still ${(100 * L((e) => e.still)).toFixed(0)}% vs ${(100 * T((e) => e.still)).toFixed(0)}%`);
}
writeFileSync(join(DATA, "pilot-001c-summary.json"), JSON.stringify({ pilot: "001c", exploratory: true, codeCommit, results, seconds: Math.round((Date.now() - started) / 1000) }, null, 2) + "\n");
log("done → brain-lab/data/pilot-001c-summary.json");
