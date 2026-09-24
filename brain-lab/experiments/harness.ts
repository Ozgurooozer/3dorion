// brain-lab/experiments/harness.ts — one experimental condition: learners and their frozen twins,
// trained and evaluated the same way, every subject registered, every run logged.
// Shared by the series-002 scripts so every condition is measured identically.
"use strict";

import { bornGraph, type InnateGroup } from "../development/index.ts";
import { createAgent, type AgentSpec } from "../learning/index.ts";
import { episodeEvents, type Subject } from "../registry/index.ts";
import type { RegistryStore } from "../registry/store.ts";
import { isPlastic } from "../regions/index.ts";
import { Room, runEpisode, type Action, type WorldConfig } from "../world/index.ts";
import { approach, orientation } from "./measures.ts";

export const MAX_TICKS = 3000;

export interface Condition {
  readonly code: string;
  readonly what: string;
  readonly spec: Omit<AgentSpec, "cfg" | "ledger" | "noiseSeed">;
}

export interface Eval { ticks: number; meals: number; perK: number; orientation: number; approach: number; still: number }

export interface Row {
  readonly seed: number;
  readonly group: InnateGroup;
  readonly learner: { id: string; name: string };
  readonly twin: { id: string; name: string };
  readonly l: Eval;
  readonly t: Eval;
  readonly go: number;
  readonly nogo: number;
  readonly weightEntries: number;
  readonly criticEntries: number;
  readonly trainPerK: number[]; // per 10-episode block
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? NaN : s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};
const moving = (a: Action) => a.thrust !== 0 || a.turn !== 0;

export const trainNoise = (seed: number) => seed * 31 + 7;
export const evalNoise = (seed: number) => seed * 31 + 999;
export const trainWorld = (seed: number, ep: number) => seed * 1000 + ep;
export const evalWorld = (seed: number, ep: number) => seed * 1000 + 500 + ep;

export function birth(store: RegistryStore, world: WorldConfig, seed: number, group: InnateGroup, codeCommit: string, lineage?: Subject["lineage"]): Subject {
  return store.createSubject({ category: "learner.3f", group, seed, worldConfig: world, birthGraph: bornGraph(world, { seed, group }), lineage, codeCommit });
}

/** Evaluate a subject's current brain with learning frozen. */
export function evaluate(store: RegistryStore, s: Subject, world: WorldConfig, episodes: number, codeCommit: string, label: string, spec: Partial<AgentSpec> = {}): Eval {
  const agent = createAgent({ ...spec, cfg: world, ledger: store.openLedger(s.id), noiseSeed: evalNoise(s.birth.seed), learning: { ...spec.learning, frozen: true } });
  const run = store.startRun(s.id, `${label} eval (learning frozen)`, {}, { codeCommit });
  const ticks: number[] = [], meals: number[] = [];
  let seen = 0, toward = 0, pairs = 0, closer = 0, still = 0, all = 0;
  for (let ep = 1; ep <= episodes; ep++) {
    agent.startEpisode(ep);
    const worldSeed = evalWorld(s.birth.seed, ep);
    const room = new Room(worldSeed, world);
    const first = room.observe();
    const { records, ...summary } = runEpisode(room, agent.policy, MAX_TICKS, true, agent.hooks);
    const obs = [first, ...records.map((r) => r.result.observation)];
    const o = orientation(obs, records.map((r) => r.action), world);
    const a = approach(obs);
    seen += o.seen; toward += o.toward; pairs += a.pairs; closer += a.closer;
    for (const r of records) { all++; if (!moving(r.action)) still++; }
    store.appendEpisode(run.id, { episode: ep, worldSeed, summary, events: episodeEvents(records), extra: { orientation: o, approach: a } });
    ticks.push(summary.ticks); meals.push(summary.foodEaten);
  }
  const T = ticks.reduce((x, y) => x + y, 0);
  return { ticks: mean(ticks), meals: mean(meals), perK: (1000 * meals.reduce((x, y) => x + y, 0)) / T, orientation: seen ? toward / seen : 0, approach: pairs ? closer / pairs : 0, still: still / all };
}

/** Train a subject; returns meals/1000 ticks per 10-episode block. */
export function train(store: RegistryStore, s: Subject, world: WorldConfig, episodes: number, spec: Condition["spec"], codeCommit: string, label: string): number[] {
  const ledger = store.openLedger(s.id);
  const agent = createAgent({ ...spec, cfg: world, ledger, noiseSeed: trainNoise(s.birth.seed) });
  const run = store.startRun(s.id, `${label} train`, { spec: JSON.parse(JSON.stringify(spec)) }, { codeCommit });
  const blocks: number[] = [];
  let bm = 0, bt = 0;
  for (let ep = 1; ep <= episodes; ep++) {
    agent.startEpisode(ep);
    const worldSeed = trainWorld(s.birth.seed, ep);
    const { records, ...summary } = runEpisode(new Room(worldSeed, world), agent.policy, MAX_TICKS, true, agent.hooks);
    agent.finishEpisode(summary.ticks);
    store.appendEpisode(run.id, { episode: ep, worldSeed, summary, events: episodeEvents(records) });
    bm += summary.foodEaten; bt += summary.ticks;
    if (ep % 10 === 0) { blocks.push((1000 * bm) / bt); bm = 0; bt = 0; }
  }
  agent.drainWrites();
  if (!ledger.matches(agent.graph)) throw new Error(`${s.id}: live brain differs from its ledger`);
  store.saveLedger(ledger);
  return blocks;
}

export function runCondition(store: RegistryStore, o: {
  condition: Condition; world: WorldConfig; seeds: number[]; groups: InnateGroup[];
  trainEpisodes: number; evalEpisodes: number; codeCommit: string; label: string;
  twins?: Map<string, { id: string; name: string; eval: Eval }>;
}) {
  const twins = o.twins ?? new Map<string, { id: string; name: string; eval: Eval }>();
  const rows: Row[] = [];
  for (const group of o.groups) {
    for (const seed of o.seeds) {
      const key = `${seed}/${group}/${JSON.stringify(o.world)}`;
      if (!twins.has(key)) {
        const t = birth(store, o.world, seed, group, o.codeCommit);
        twins.set(key, { id: t.id, name: t.name, eval: evaluate(store, t, o.world, o.evalEpisodes, o.codeCommit, o.label) });
      }
      const twin = twins.get(key)!;
      const s = birth(store, o.world, seed, group, o.codeCommit);
      const trainPerK = train(store, s, o.world, o.trainEpisodes, o.condition.spec, o.codeCommit, `${o.label} ${o.condition.code}`);
      const l = evaluate(store, s, o.world, o.evalEpisodes, o.codeCommit, o.label, { critic: o.condition.spec.critic ?? null });
      const ledger = store.openLedger(s.id);
      const plastic = ledger.graph.connections.filter((c) => isPlastic(c));
      rows.push({
        seed, group, learner: { id: s.id, name: s.name }, twin: { id: twin.id, name: twin.name }, l, t: twin.eval,
        go: mean(plastic.filter((c) => c.to.startsWith("bg.go.")).map((c) => c.weight)),
        nogo: mean(plastic.filter((c) => c.to.startsWith("bg.nogo.")).map((c) => c.weight)),
        weightEntries: ledger.entries.filter((e) => e.kind === "weight").length,
        criticEntries: ledger.entries.filter((e) => e.kind === "critic").length,
        trainPerK,
      });
    }
  }
  const ahead = rows.filter((r) => r.l.perK > r.t.perK).length;
  const medianPerKDiff = median(rows.map((r) => r.l.perK - r.t.perK));
  const medianApproachDiff = median(rows.map((r) => r.l.approach - r.t.approach));
  const L = (f: (e: Eval) => number) => mean(rows.map((r) => f(r.l)));
  const Tw = (f: (e: Eval) => number) => mean(rows.map((r) => f(r.t)));
  const c = o.condition;
  const line = `${c.code} ${c.what}: ahead ${ahead}/${rows.length} | meals/1000t ${L((e) => e.perK).toFixed(2)} vs ${Tw((e) => e.perK).toFixed(2)} (median diff ${medianPerKDiff.toFixed(2)}) | life ${L((e) => e.ticks).toFixed(0)} vs ${Tw((e) => e.ticks).toFixed(0)} | approach ${L((e) => e.approach).toFixed(3)} vs ${Tw((e) => e.approach).toFixed(3)} | still ${(100 * L((e) => e.still)).toFixed(0)}% vs ${(100 * Tw((e) => e.still)).toFixed(0)}% | Go ${mean(rows.map((r) => r.go)).toFixed(3)} NoGo ${mean(rows.map((r) => r.nogo)).toFixed(3)}`;
  return { code: c.code, what: c.what, spec: JSON.parse(JSON.stringify(c.spec)), rows, ahead, medianPerKDiff, medianApproachDiff, line, twins };
}
