// brain-lab/experiments/series-003a.ts — EXPLORATORY: where does our brain stand?
//
// Run: node --experimental-strip-types brain-lab/experiments/series-003a.ts
//
// Measuring sticks on the same body, senses, reward and evaluation worlds as E7 (series 002b):
//   random  — the untrained linear-Q learner (ties at random) = the floor
//   oracle  — hand-coded steering = the ceiling of this room with these senses
//   TD      — textbook SARSA(λ) with a linear value function, a small α × λ sweep
// E7 subjects from series 002b are re-measured with the new direction measure (turnToward);
// their meals/1000 ticks must equal the recorded numbers exactly (check on the measurement refactor).
// Predictions are in LAB-DEFTERI.md, written before this ran.
"use strict";

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LinearQ, oraclePolicy, type LinearQParams } from "../baselines/index.ts";
import type { AgentSpec } from "../learning/index.ts";
import { RegistryStore } from "../registry/store.ts";
import type { Category, Subject } from "../registry/index.ts";
import { sensorimotorScaffold } from "../sensorimotor/index.ts";
import { Room, makeConfig, runEpisode, type WorldConfig } from "../world/index.ts";
import { MAX_TICKS, evalNoise, evaluate, measureEpisodes, median, trainNoise, trainWorld, type Eval } from "./harness.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const store = new RegistryStore(DATA);
const codeCommit = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim();
const WORLD = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const EVAL_EPISODES = 10;
const EVAL_EPSILON = 0.05;
const started = Date.now();
const log = (s: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${s}`);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** A baseline is registered like any subject; its "brain" is the body's nerves only (no connections). */
const register = (category: Category, seed: number, world: WorldConfig): Subject =>
  store.createSubject({ category, group: "none", seed, worldConfig: world, birthGraph: sensorimotorScaffold(world, `${category}-nerves`), codeCommit });

function measureBaseline(s: Subject, label: string, actor: Parameters<typeof measureEpisodes>[0], meta: Record<string, unknown> = {}): Eval {
  const run = store.startRun(s.id, `${label} eval`, meta, { codeCommit });
  return measureEpisodes(actor, s.birth.worldConfig, s.birth.seed, EVAL_EPISODES, 0, (line) => store.appendEpisode(run.id, line));
}

function trainTD(seed: number, world: WorldConfig, params: Partial<LinearQParams>, episodes: number, label: string) {
  const s = register("baseline.td", seed, world);
  const q = new LinearQ(world, trainNoise(seed), params);
  const run = store.startRun(s.id, `${label} train`, { params: q.params }, { codeCommit });
  const blocks: number[] = [];
  let bm = 0, bt = 0;
  for (let ep = 1; ep <= episodes; ep++) {
    q.startEpisode();
    const worldSeed = trainWorld(seed, ep);
    const { records: _r, ...summary } = runEpisode(new Room(worldSeed, world), q.policy, MAX_TICKS, false, q.hooks);
    // Not a brain, so no ledger: the weights are stored with the episode every 10 episodes instead.
    store.appendEpisode(run.id, { episode: ep, worldSeed, summary, events: [], extra: ep % 10 === 0 ? { weights: q.snapshot() } : undefined });
    bm += summary.foodEaten; bt += summary.ticks;
    if (ep % 10 === 0) { blocks.push((1000 * bm) / bt); bm = 0; bt = 0; }
  }
  const evalAt = (epsilon: number) => {
    const frozen = new LinearQ(world, evalNoise(seed), { ...params, frozen: true, epsilon }, q.snapshot());
    return measureBaseline(s, `${label} (ε ${epsilon})`, { policy: frozen.policy, startEpisode: () => frozen.startEpisode() }, { epsilon });
  };
  return { id: s.id, name: s.name, blocks, e: evalAt(EVAL_EPSILON), greedy: evalAt(0) };
}

const fmt = (e: Eval[]) =>
  `meals/1000t ${mean(e.map((x) => x.perK)).toFixed(2)} | life ${mean(e.map((x) => x.ticks)).toFixed(0)} | approach ${mean(e.map((x) => x.approach)).toFixed(3)} | turnToward ${mean(e.map((x) => x.turnToward)).toFixed(3)} (turns ${mean(e.map((x) => x.turns)).toFixed(0)}) | still ${(100 * mean(e.map((x) => x.still))).toFixed(0)}%`;
const out: Record<string, unknown> = {};

// 1. Floor and ceiling.
const random = SEEDS.map((seed) => {
  const s = register("baseline.random", seed, WORLD);
  const q = new LinearQ(WORLD, evalNoise(seed), { frozen: true, epsilon: 0 });
  return { id: s.id, e: measureBaseline(s, "series-003a random", { policy: q.policy, startEpisode: () => q.startEpisode() }) };
});
log(`random: ${fmt(random.map((r) => r.e))}`);
const oracle = SEEDS.map((seed) => {
  const s = register("baseline.oracle", seed, WORLD);
  return { id: s.id, e: measureBaseline(s, "series-003a oracle", { policy: oraclePolicy(WORLD) }) };
});
log(`oracle: ${fmt(oracle.map((r) => r.e))}`);
out.random = random;
out.oracle = oracle;

// 2. E7 re-measured: same subjects, same evaluation; meals must match the record exactly.
type Row = { seed: number; group: string; learner: { id: string }; twin: { id: string }; l: Eval; t: Eval };
const e7 = JSON.parse(readFileSync(join(DATA, "series-002b-E7-summary.json"), "utf8")) as { variants: { code: string; spec: Omit<AgentSpec, "cfg" | "ledger" | "noiseSeed">; rows: Row[] }[] };
for (const code of ["E7/as-is", "E7/lambda 0.9"]) {
  const v = e7.variants.find((x) => x.code === code)!;
  const l: Eval[] = [], t: Eval[] = [];
  const twinsSeen = new Map<string, Eval>();
  for (const r of v.rows) {
    const learner = evaluate(store, store.loadSubject(r.learner.id), WORLD, EVAL_EPISODES, codeCommit, "series-003a re-measure", { critic: v.spec.critic ?? null });
    if (learner.perK !== r.l.perK) throw new Error(`${r.learner.id}: re-measured ${learner.perK} ≠ recorded ${r.l.perK}`);
    if (!twinsSeen.has(r.twin.id)) twinsSeen.set(r.twin.id, evaluate(store, store.loadSubject(r.twin.id), WORLD, EVAL_EPISODES, codeCommit, "series-003a re-measure"));
    const twin = twinsSeen.get(r.twin.id)!;
    if (twin.perK !== r.t.perK) throw new Error(`${r.twin.id}: re-measured ${twin.perK} ≠ recorded ${r.t.perK}`);
    l.push(learner); t.push(twin);
  }
  log(`${code} learners: ${fmt(l)}`);
  log(`${code} twins:    ${fmt(t)}`);
  out[code] = { learners: l, twins: t, ids: v.rows.map((r) => r.learner.id) };
}

// 3. TD sweep, 40 training episodes.
const sweep: { alpha: number; lambda: number; rows: ReturnType<typeof trainTD>[] }[] = [];
for (const alpha of [0.03, 0.1, 0.3]) for (const lambda of [0.8, 0.9]) {
  const rows = SEEDS.map((seed) => trainTD(seed, WORLD, { alpha, lambda, epsilon: 0.1 }, 40, `series-003a TD α${alpha} λ${lambda}`));
  sweep.push({ alpha, lambda, rows });
  log(`TD α ${alpha} λ ${lambda}: ${fmt(rows.map((r) => r.e))} | greedy ${mean(rows.map((r) => r.greedy.perK)).toFixed(2)} | train blocks ${[0, 1, 2, 3].map((b) => mean(rows.map((r) => r.blocks[b]!)).toFixed(2)).join(" → ")}`);
}
const best = sweep.reduce((a, b) => (mean(b.rows.map((r) => r.e.perK)) > mean(a.rows.map((r) => r.e.perK)) ? b : a));
log(`best TD: α ${best.alpha} λ ${best.lambda}`);
out.sweep = sweep;

// 4. Best TD, 100 episodes: learning curve.
const long = SEEDS.map((seed) => trainTD(seed, WORLD, { alpha: best.alpha, lambda: best.lambda, epsilon: 0.1 }, 100, `series-003a TD long α${best.alpha} λ${best.lambda}`));
log(`TD long (100 ep): ${fmt(long.map((r) => r.e))} | greedy ${mean(long.map((r) => r.greedy.perK)).toFixed(2)}`);
log(`TD long curve: ${Array.from({ length: 10 }, (_, b) => mean(long.map((r) => r.blocks[b]!)).toFixed(2)).join(" → ")}`);
out.long = long;
out.medianBestMinusRandom = median(best.rows.map((r, i) => r.e.perK - random[i]!.e.perK));

writeFileSync(join(DATA, "series-003a-summary.json"), JSON.stringify({ series: "003a", exploratory: true, codeCommit, world: WORLD, results: out }, null, 2) + "\n");
log("done");
