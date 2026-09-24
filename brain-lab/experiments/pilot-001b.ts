// brain-lab/experiments/pilot-001b.ts — EXPLORATORY diagnosis of pilot 001's collapse.
// Tuning seeds only (4–10). Every condition is reported; nothing is selected.
//
// Run: node --experimental-strip-types brain-lab/experiments/pilot-001b.ts
//
// Part 1 (observation): is dopamine systematically negative in a frozen newborn, and more
//   negative right after it moves? δ at t+1 is paired with the action at t.
// Part 2 (ledgers of pilot 001, phase B): which NoGo/Go edges grew, grouped by sense kind.
// Part 3 (chance): orientation of a random discrete policy, to read the twins' 0.17.
// Part 4 (ablations): same world, seeds 4–10 reflexless, 30 training + 10 evaluation episodes,
//   η 0.05, λ 0.8 (pilot choice), each condition vs the same frozen twin:
//   A0 full rule (replication) · A1 no NoGo learning · A2 no teaching at death ·
//   A3 no interoception/proprioception on learning paths · A4 dopamine bursts only · A5 = A1 + A3
"use strict";

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bornGraph } from "../development/index.ts";
import { createAgent, type LearningParams } from "../learning/index.ts";
import { Ledger, episodeEvents, type Subject } from "../registry/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { isPlastic } from "../regions/index.ts";
import { Rng, Room, makeConfig, runEpisode, type Action, type Observation } from "../world/index.ts";
import { orientation } from "./measures.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const WORLD = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
const MAX_TICKS = 3000;
const SEEDS = [4, 5, 6, 7, 8, 9, 10];
const BASE: Partial<LearningParams> = { eta: 0.05, lambda: 0.8, quantum: 0.005 };
const store = new RegistryStore(DATA);
const codeCommit = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim();
const started = Date.now();
const log = (m: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${m}`);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2; };
const moving = (a: Action) => a.thrust !== 0 || a.turn !== 0;

// --- Part 1: dopamine in a frozen newborn ------------------------------------------------
function part1() {
  const all: number[] = [];
  const afterMove: number[] = [];
  const afterRest: number[] = [];
  const outMove: number[] = [];
  const outRest: number[] = [];
  for (const seed of SEEDS) {
    const ledger = new Ledger("DNK-TEMP", bornGraph(WORLD, { seed, group: "reflexless" }));
    const agent = createAgent({ cfg: WORLD, ledger, noiseSeed: seed * 31 + 999, learning: { frozen: true }, keepSteps: false });
    for (let ep = 1; ep <= 10; ep++) {
      agent.startEpisode(ep);
      const signals: { delta: number; outcome: number }[] = [];
      const wrapped = (o: Observation, t: number) => { const a = agent.policy(o, t); signals.push(agent.dopamine.last!); return a; };
      const { records } = runEpisode(new Room(seed * 1000 + 500 + ep, WORLD), wrapped, MAX_TICKS, true);
      for (let t = 1; t < signals.length; t++) {
        const s = signals[t]!;
        all.push(s.delta);
        (moving(records[t - 1]!.action) ? afterMove : afterRest).push(s.delta);
        (moving(records[t - 1]!.action) ? outMove : outRest).push(s.outcome);
      }
    }
  }
  return {
    ticks: all.length,
    meanDelta: mean(all),
    fractionNegative: all.filter((d) => d < 0).length / all.length,
    meanDeltaAfterMove: mean(afterMove),
    meanDeltaAfterRest: mean(afterRest),
    meanOutcomeAfterMove: mean(outMove),
    meanOutcomeAfterRest: mean(outRest),
    moveShare: afterMove.length / all.length,
  };
}

// --- Part 2: which edges grew in pilot 001 -----------------------------------------------
function kindOf(sense: string): string {
  if (/^ray\d+\.wall$/.test(sense)) return "ray·wall";
  if (/^ray\d+\.food$/.test(sense)) return "ray·food";
  if (/^ray\d+\.threat$/.test(sense)) return "ray·threat";
  return sense.split(".")[0]!; // touch, intero, proprio
}
function part2() {
  const summary = JSON.parse(readFileSync(join(DATA, "pilot-001-summary.json"), "utf8")) as { rows: { phase: string; role: string; id: string }[] };
  const ids = summary.rows.filter((r) => r.phase === "B" && r.role === "learner").map((r) => r.id);
  const growth: Record<string, { go: number[]; nogo: number[] }> = {};
  const perSense: Record<string, number[]> = {};
  for (const id of ids) {
    const l = store.openLedger(id);
    for (const c of l.graph.connections.filter((x) => isPlastic(x))) {
      const b = l.birthGraph.connections.find((x) => x.from === c.from && x.to === c.to)!;
      const k = kindOf(c.from);
      growth[k] ??= { go: [], nogo: [] };
      (c.to.startsWith("bg.nogo.") ? growth[k].nogo : growth[k].go).push(c.weight - b.weight);
      if (c.to.startsWith("bg.nogo.")) (perSense[c.from] ??= []).push(c.weight - b.weight);
    }
  }
  const byKind = Object.fromEntries(Object.entries(growth).map(([k, v]) => [k, { goMeanChange: mean(v.go), nogoMeanChange: mean(v.nogo), edges: v.go.length + v.nogo.length }]));
  const topNoGoSenses = Object.entries(perSense).map(([s, xs]) => ({ sense: s, meanNoGoGrowth: mean(xs) })).sort((a, b) => b.meanNoGoGrowth - a.meanNoGoGrowth).slice(0, 8);
  return { learners: ids.length, byKind, topNoGoSenses };
}

// --- Part 3: chance orientation ---------------------------------------------------------
function part3() {
  let seen = 0;
  let toward = 0;
  for (const seed of SEEDS) {
    const rng = new Rng(seed * 7 + 3);
    const pick = () => [-1, 0, 1][Math.floor(rng.next() * 3)]!;
    for (let ep = 1; ep <= 10; ep++) {
      const room = new Room(seed * 1000 + 500 + ep, WORLD);
      const first = room.observe();
      const { records } = runEpisode(room, () => ({ thrust: pick(), turn: pick() }), MAX_TICKS, true);
      const o = orientation([first, ...records.map((r) => r.result.observation)], records.map((r) => r.action), WORLD);
      seen += o.seen;
      toward += o.toward;
    }
  }
  return { randomDiscreteOrientation: toward / seen, seen };
}

// --- Part 4: ablations -------------------------------------------------------------------
const CONDITIONS: { code: string; what: string; learning: Partial<LearningParams>; teachAtDeath: boolean }[] = [
  { code: "A0", what: "full rule (replication)", learning: {}, teachAtDeath: true },
  { code: "A1", what: "no NoGo learning", learning: { learnNoGo: false }, teachAtDeath: true },
  { code: "A2", what: "no teaching at death", learning: {}, teachAtDeath: false },
  { code: "A3", what: "no intero/proprio on learning paths", learning: { senseFilter: "^(ray|touch)" }, teachAtDeath: true },
  { code: "A4", what: "dopamine bursts only", learning: { dopamine: "positive" }, teachAtDeath: true },
  { code: "A5", what: "A1 + A3", learning: { learnNoGo: false, senseFilter: "^(ray|touch)" }, teachAtDeath: true },
];

interface Eval { meals: number; orientation: number | null; ticks: number; stillShare: number }
function evaluate(s: Subject): Eval {
  const agent = createAgent({ cfg: WORLD, ledger: store.openLedger(s.id), noiseSeed: s.birth.seed * 31 + 999, learning: { frozen: true } });
  const run = store.startRun(s.id, "pilot-001b eval (learning frozen)", {}, { codeCommit });
  const meals: number[] = [];
  const ticks: number[] = [];
  let seen = 0, toward = 0, still = 0, all = 0;
  for (let ep = 1; ep <= 10; ep++) {
    agent.startEpisode(ep);
    const worldSeed = s.birth.seed * 1000 + 500 + ep;
    const room = new Room(worldSeed, WORLD);
    const first = room.observe();
    const { records, ...summary } = runEpisode(room, agent.policy, MAX_TICKS, true, agent.hooks);
    const o = orientation([first, ...records.map((r) => r.result.observation)], records.map((r) => r.action), WORLD);
    seen += o.seen; toward += o.toward;
    for (const r of records) { all++; if (!moving(r.action)) still++; }
    store.appendEpisode(run.id, { episode: ep, worldSeed, summary, events: episodeEvents(records), extra: { orientation: o } });
    meals.push(summary.foodEaten); ticks.push(summary.ticks);
  }
  return { meals: mean(meals), orientation: seen ? toward / seen : null, ticks: mean(ticks), stillShare: still / all };
}

function part4() {
  const twins = new Map<number, Eval>();
  const out: Record<string, { what: string; rows: unknown[]; mealsDiffMedian: number; orientationDiffMedian: number; learnerAheadMeals: number; goMean: number; nogoMean: number; stillShare: number }> = {};
  for (const seed of SEEDS) {
    const twin = store.createSubject({ category: "learner.3f", group: "reflexless", seed, worldConfig: WORLD, birthGraph: bornGraph(WORLD, { seed, group: "reflexless" }), codeCommit });
    twins.set(seed, evaluate(twin));
  }
  log("twins evaluated");
  for (const c of CONDITIONS) {
    const rows: { seed: number; id: string; name: string; eval: Eval; twin: Eval; go: number; nogo: number }[] = [];
    for (const seed of SEEDS) {
      const s = store.createSubject({ category: "learner.3f", group: "reflexless", seed, worldConfig: WORLD, birthGraph: bornGraph(WORLD, { seed, group: "reflexless" }), codeCommit });
      const ledger = store.openLedger(s.id);
      const agent = createAgent({ cfg: WORLD, ledger, noiseSeed: seed * 31 + 7, learning: { ...BASE, ...c.learning }, teachAtDeath: c.teachAtDeath });
      const run = store.startRun(s.id, `pilot-001b ${c.code} train`, { condition: c.code, learning: { ...BASE, ...c.learning }, teachAtDeath: c.teachAtDeath }, { codeCommit });
      for (let ep = 1; ep <= 30; ep++) {
        agent.startEpisode(ep);
        const worldSeed = seed * 1000 + ep;
        const { records, ...summary } = runEpisode(new Room(worldSeed, WORLD), agent.policy, MAX_TICKS, true, agent.hooks);
        store.appendEpisode(run.id, { episode: ep, worldSeed, summary, events: episodeEvents(records) });
      }
      agent.drainWrites();
      if (!ledger.matches(agent.graph)) throw new Error(`${s.id}: off the record`);
      store.saveLedger(ledger);
      const plastic = agent.graph.connections.filter((x) => isPlastic(x));
      const go = mean(plastic.filter((x) => x.to.startsWith("bg.go.")).map((x) => x.weight));
      const nogo = mean(plastic.filter((x) => x.to.startsWith("bg.nogo.")).map((x) => x.weight));
      rows.push({ seed, id: s.id, name: s.name, eval: evaluate(s), twin: twins.get(seed)!, go, nogo });
    }
    const md = rows.map((r) => r.eval.meals - r.twin.meals);
    const od = rows.map((r) => (r.eval.orientation ?? 0) - (r.twin.orientation ?? 0));
    out[c.code] = {
      what: c.what, rows,
      mealsDiffMedian: median(md), orientationDiffMedian: median(od), learnerAheadMeals: md.filter((x) => x > 0).length,
      goMean: mean(rows.map((r) => r.go)), nogoMean: mean(rows.map((r) => r.nogo)), stillShare: mean(rows.map((r) => r.eval.stillShare)),
    };
    log(`${c.code} ${c.what}: meals diff median ${median(md).toFixed(2)}, ahead ${out[c.code]!.learnerAheadMeals}/7, orient diff ${median(od).toFixed(3)}, Go ${out[c.code]!.goMean.toFixed(3)} NoGo ${out[c.code]!.nogoMean.toFixed(3)}, still ${(100 * out[c.code]!.stillShare).toFixed(0)}%`);
  }
  return { twinMeals: mean([...twins.values()].map((t) => t.meals)), twinOrientation: mean([...twins.values()].map((t) => t.orientation ?? 0)), twinStill: mean([...twins.values()].map((t) => t.stillShare)), conditions: out };
}

const p1 = part1(); log(`part 1: ${JSON.stringify(p1)}`);
const p2 = part2(); log(`part 2: ${JSON.stringify(p2)}`);
const p3 = part3(); log(`part 3: ${JSON.stringify(p3)}`);
const p4 = part4();
writeFileSync(join(DATA, "pilot-001b-summary.json"), JSON.stringify({ pilot: "001b", exploratory: true, codeCommit, part1: p1, part2: p2, part3: p3, part4: p4, seconds: Math.round((Date.now() - started) / 1000) }, null, 2) + "\n");
log(`done; twins: meals ${p4.twinMeals.toFixed(2)}, orientation ${p4.twinOrientation.toFixed(3)}, still ${(100 * p4.twinStill).toFixed(0)}%`);
