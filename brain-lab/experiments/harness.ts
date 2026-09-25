// brain-lab/experiments/harness.ts — one experimental condition: learners and their frozen twins,
// trained and evaluated the same way, every subject registered, every run logged.
// Shared by the series-002 scripts so every condition is measured identically.
"use strict";

import { readFileSync } from "node:fs";
import { bornGraph, type Expansion, type InnateGroup, type Orienting } from "../development/index.ts";
import { createAgent, type AgentSpec } from "../learning/index.ts";
import { episodeEvents, type Subject } from "../registry/index.ts";
import type { EpisodeLine, RegistryStore } from "../registry/store.ts";
import { drive } from "../neuromodulation/index.ts";
import { isPlastic, senseToMotorDelay } from "../regions/index.ts";
import { Room, runEpisode, type Action, type EpisodeHooks, type Policy, type WorldConfig } from "../world/index.ts";
import { approach, orientation, sideTurnInformation, steering, steeringIndex, turnToward } from "./measures.ts";

export const MAX_TICKS = 3000;

export interface Condition {
  readonly code: string;
  readonly what: string;
  readonly spec: Omit<AgentSpec, "cfg" | "ledger" | "noiseSeed">;
}

export interface Eval {
  ticks: number; meals: number; perK: number; orientation: number; approach: number; still: number;
  /** Share of side-food turns made toward the food (0.5 = chance, also when there were no turns). */
  turnToward: number;
  turns: number;
  /** Habit-free steering index, pooled over episodes (null if food was never seen on both sides). */
  steering: number | null;
  /**
   * Homeostasis: mean drive (hunger² + injury²) over every tick of every episode, a dead body
   * counting at its final drive for the rest of the episode — lower is better. A brain that rests
   * when fed is not punished here, unlike meals/1000 ticks.
   */
  meanDrive: number;
  /** Share of episodes that reached MAX_TICKS alive. */
  survival: number;
  /** I(food side; turn) in bits, pooled over episodes (null if food was never seen on both sides). */
  sideInfo: number | null;
  /** Health lost per 1000 ticks lived (threat zones); 0 in a room without threats. */
  harmPerK: number;
}

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

/** How a condition's subjects are born, beyond seed and group (learner and twin alike). */
export interface BirthOptions {
  readonly orienting?: Orienting | null;
  readonly expansion?: Expansion | null;
  readonly bilateral?: boolean;
  readonly generatorToGo?: number;
}

/** Seeds from here up are test seeds: used once, only under a frozen pre-registration. */
export const TEST_SEED_FLOOR = 1001;

/**
 * Refuses a test seed unless `preregistration` names a pre-registration file whose status line reads
 * "**Durum: DONDURULDU**" (frozen). Until 2026-09-25 this was only a rule; now birth cannot break it.
 */
export function assertSeedAllowed(seed: number, preregistration?: string | null): void {
  if (seed < TEST_SEED_FLOOR) return;
  if (!preregistration) throw new Error(`seed ${seed} is a test seed (≥ ${TEST_SEED_FLOOR}); it needs a frozen pre-registration`);
  const text = readFileSync(preregistration, "utf8");
  if (!/^\*\*Durum: DONDURULDU/m.test(text)) throw new Error(`${preregistration} is not frozen ("**Durum: DONDURULDU**" missing); test seed ${seed} refused`);
}

export function birth(store: RegistryStore, world: WorldConfig, seed: number, group: InnateGroup, codeCommit: string, born: BirthOptions = {}, lineage?: Subject["lineage"], preregistration?: string | null): Subject {
  assertSeedAllowed(seed, preregistration);
  const birthGraph = bornGraph(world, { seed, group, orienting: born.orienting ?? null, expansion: born.expansion ?? null, bilateral: born.bilateral ?? false, generatorToGo: born.generatorToGo });
  return store.createSubject({ category: "learner.3f", group, seed, worldConfig: world, birthGraph, lineage, codeCommit });
}

/** Anything that can live evaluation episodes: a brain, a baseline, a fixture. */
export interface Actor {
  readonly policy: Policy;
  readonly hooks?: EpisodeHooks;
  startEpisode?(episode: number): void;
}

/**
 * Lives `episodes` episodes on the fixed evaluation worlds of `seed` and measures them — the ONE
 * place behavior is measured, so a brain and a baseline are compared on identical terms.
 * `lag` is the actor's sense→motor delay (LAG for the regional brain, 0 for a reactive policy).
 */
export function measureEpisodes(actor: Actor, world: WorldConfig, seed: number, episodes: number, lag: number, onEpisode?: (line: Omit<EpisodeLine, "kind">) => void): Eval {
  const ticks: number[] = [], meals: number[] = [];
  let harm = 0;
  let seen = 0, toward = 0, pairs = 0, closer = 0, still = 0, all = 0, turns = 0, turnsToward = 0;
  let driveSum = 0, alive = 0;
  const steer = { leftSeen: 0, rightSeen: 0, leftTurnWhenLeft: 0, rightTurnWhenLeft: 0, leftTurnWhenRight: 0, rightTurnWhenRight: 0 };
  for (let ep = 1; ep <= episodes; ep++) {
    actor.startEpisode?.(ep);
    const worldSeed = evalWorld(seed, ep);
    const room = new Room(worldSeed, world);
    const first = room.observe();
    const { records, ...summary } = runEpisode(room, actor.policy, MAX_TICKS, true, actor.hooks);
    const obs = [first, ...records.map((r) => r.result.observation)];
    const actions = records.map((r) => r.action);
    const o = orientation(obs, actions, world, lag);
    const a = approach(obs);
    const d = turnToward(obs, actions, world, lag);
    const st = steering(obs, actions, world, lag);
    for (const k of Object.keys(steer) as (keyof typeof steer)[]) steer[k] += st[k];
    seen += o.seen; toward += o.toward; pairs += a.pairs; closer += a.closer; turns += d.turns; turnsToward += d.toward;
    for (const r of records) { all++; if (!moving(r.action)) still++; }
    for (const o of obs.slice(1)) driveSum += drive(o);
    driveSum += drive(obs[obs.length - 1]!) * (MAX_TICKS - records.length); // dead: stays at its last drive
    if (summary.doneCause === null) alive++;
    onEpisode?.({ episode: ep, worldSeed, summary, events: episodeEvents(records), extra: { orientation: o, approach: a, turnToward: d, steering: st } });
    ticks.push(summary.ticks); meals.push(summary.foodEaten); harm += summary.damage;
  }
  const T = ticks.reduce((x, y) => x + y, 0);
  return {
    harmPerK: (1000 * harm) / T,
    ticks: mean(ticks), meals: mean(meals), perK: (1000 * meals.reduce((x, y) => x + y, 0)) / T,
    orientation: seen ? toward / seen : 0, approach: pairs ? closer / pairs : 0, still: still / all,
    turnToward: turns ? turnsToward / turns : 0.5, turns, steering: steeringIndex(steer),
    meanDrive: driveSum / (episodes * MAX_TICKS), survival: alive / episodes, sideInfo: sideTurnInformation(steer),
  };
}

/** Evaluate a subject's current brain with learning frozen. */
export function evaluate(store: RegistryStore, s: Subject, world: WorldConfig, episodes: number, codeCommit: string, label: string, spec: Partial<AgentSpec> = {}): Eval {
  const ledger = store.openLedger(s.id);
  const agent = createAgent({ ...spec, cfg: world, ledger, noiseSeed: evalNoise(s.birth.seed), learning: { ...spec.learning, frozen: true } });
  const run = store.startRun(s.id, `${label} eval (learning frozen)`, {}, { codeCommit });
  // A selector acts on the tick it senses; the graph needs its conduction delay.
  const lag = spec.selection ? 0 : senseToMotorDelay(ledger.graph);
  return measureEpisodes(agent, world, s.birth.seed, episodes, lag, (line) => store.appendEpisode(run.id, line));
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
  /** How learner AND twin are born (both the same way). */
  born?: BirthOptions;
  /** A frozen pre-registration file; required for test seeds (≥ TEST_SEED_FLOOR). */
  preregistration?: string | null;
  twins?: Map<string, { id: string; name: string; eval: Eval }>;
}) {
  const twins = o.twins ?? new Map<string, { id: string; name: string; eval: Eval }>();
  const rows: Row[] = [];
  for (const group of o.groups) {
    for (const seed of o.seeds) {
      const born = o.born ?? {};
      // The twin behaves through the same machinery as the learner (selection), it just never learns.
      const selection = o.condition.spec.selection ?? null;
      const key = `${seed}/${group}/${JSON.stringify(o.world)}/${JSON.stringify(born)}/${JSON.stringify(selection)}`;
      if (!twins.has(key)) {
        const t = birth(store, o.world, seed, group, o.codeCommit, born, undefined, o.preregistration);
        twins.set(key, { id: t.id, name: t.name, eval: evaluate(store, t, o.world, o.evalEpisodes, o.codeCommit, o.label, { selection }) });
      }
      const twin = twins.get(key)!;
      const s = birth(store, o.world, seed, group, o.codeCommit, born, undefined, o.preregistration);
      const trainPerK = train(store, s, o.world, o.trainEpisodes, o.condition.spec, o.codeCommit, `${o.label} ${o.condition.code}`);
      const l = evaluate(store, s, o.world, o.evalEpisodes, o.codeCommit, o.label, { critic: o.condition.spec.critic ?? null, selection: o.condition.spec.selection ?? null });
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

/**
 * CROSS control (meeting 2026-09-24, K1): dopamine delayed 3000 ticks, so it comes from another
 * episode — timing and size kept, every link between this moment's action and its outcome gone.
 * Each channel (global, compartment, teacher) has its own delay line. One per subject: build it fresh.
 */
export function crossDopamine(delay = 3000): NonNullable<AgentSpec["deltaTransform"]> {
  const buffers = new Map<string, number[]>();
  return (d, _tick, channel = "global") => {
    const buf = buffers.get(channel) ?? [];
    buffers.set(channel, buf);
    buf.push(d);
    return buf.length > delay ? buf.shift()! : 0;
  };
}

/**
 * LOCAL control (falsification of S1n, 2026-09-25): dopamine from the same episode, `delay` ticks
 * late. Slow variables still line up (hunger level, being in a food-rich part of the room), the link
 * between this moment's action and its outcome is gone. If learning survives LOCAL, it was learning
 * slow correlations, not action → outcome. The line is emptied at every episode start (tick 0).
 */
export function localDopamine(delay = 200): NonNullable<AgentSpec["deltaTransform"]> {
  const buffers = new Map<string, number[]>();
  return (d, tick, channel = "global") => {
    if (tick === 0) buffers.set(channel, []);
    const buf = buffers.get(channel) ?? [];
    buffers.set(channel, buf);
    buf.push(d);
    return buf.length > delay ? buf.shift()! : 0;
  };
}

/**
 * Lesion: a clone of a subject whose learned weights on the plastic edges from senses matching
 * `from` are set back to the parent's birth values. The clone is a registered subject (lineage
 * "clone") and every reset is a ledger entry with cause "lesion", so the lesioned brain replays.
 */
export function lesionClone(store: RegistryStore, parentId: string, from: RegExp, codeCommit: string): Subject {
  const birthOfParent = new Map(store.openLedger(parentId).birthGraph.connections.map((e) => [`${e.from}->${e.to}`, e.weight]));
  const clone = store.clone(parentId, { codeCommit });
  const ledger = store.openLedger(clone.id);
  for (const e of ledger.graph.connections) {
    if (!isPlastic(e) || !from.test(e.from)) continue;
    const birthWeight = birthOfParent.get(`${e.from}->${e.to}`)!;
    if (e.weight === birthWeight) continue;
    ledger.record({ kind: "weight", tick: 0, episode: 0, cause: ["lesion", from.source], edge: { from: e.from, to: e.to }, before: e.weight, after: birthWeight });
  }
  store.saveLedger(ledger);
  return clone;
}
