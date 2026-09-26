// brain-lab/experiments/recall-a3.ts — A3.0 (TASARIM-008 §16; meeting 2026-09-26-a3-kural-dogumu K6): the measures of
// memory use, calibrated on known policies before anything learns (Themis §1.1).
//
//   G7   gate share — ticks with the gate open (hungry, no food seen) over ticks lived
//   G6m  reach share ("hatırlanan yemeğe ulaşma") — a run of ticks with a memory recalled starts one recall episode; the
//        memory recalled on its first tick is the episode's target, placed in the true room. The episode is reached when
//        a food within REACH_RADIUS of the target is eaten within REACH_WINDOW ticks, and failed when the window passes
//        or the body dies first. An episode still open when the room ends alive is left out (censored).
// The recall is recall.ts's, the same functions the brain uses; each body recalls from its own memory (a scratch one for
// bodies without a brain), so the measure asks: would what this body remembered have brought it back to a meal?
//
// Calibration bodies (known answers):
//   spinning   turns in place: sees the food around it and recalls it once out of sight, never moves, never eats: reach
//              share exactly 0 (a body standing still is no calibration: it never both remembers food and sees none)
//   blind      random bursts, food-blind: reaches only by chance
//   circling   forward + always left, a habit that knows nothing
//   seeker     hand-coded ceiling of sight (steers to food in view, bursts otherwise), no memory use
//   K1n        the recorded learners (seeds 1–5 × both groups, their recorded rooms): the A3 baseline
//   fixture    LABELLED FIXTURE, never a brain: K1n's brains with hand-set rule synapses rec{i} → Go of ray i's direction
//              (weight W), through the real selector — what memory use can do
//
//   node --experimental-strip-types brain-lab/experiments/recall-a3.ts [W]
"use strict";

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrainGrafi, MemoryRecord } from "../brain-ir/ir.ts";
import { actionOfAngle } from "../development/index.ts";
import { DEFAULT_RECALL, FoodMemory, createAgent, gateOpen, recallFood, type LiveMemory } from "../learning/index.ts";
import { MemoryCore, PoseModule, inRoom, type Pose } from "../memory/index.ts";
import { Ledger } from "../registry/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { recId } from "../regions/index.ts";
import { sensorimotorScaffold } from "../sensorimotor/index.ts";
import { Room, runEpisode, type Action, type EpisodeHooks, type EpisodeSummary, type Observation, type Policy, type WorldConfig } from "../world/index.ts";
import { condition } from "./conditions.ts";
import { MAX_TICKS, assertBornInto, assertReplayed, assertSeedAllowed, evalNoise, evalWorld, recordedEvaluation, recordedLearners } from "./harness.ts";
import { referenceBodies } from "./pose-a1.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");

/** A food eaten within this distance (m) of the target reaches it: the radius G3 and G4 judge a memory right with. */
export const REACH_RADIUS = 0.5;
/** Ticks an episode has to be reached. */
export const REACH_WINDOW = 200;

export interface EpisodeCounts { episodes: number; reached: number; failed: number; censored: number }

/** The bookkeeping of recall episodes in one room (pure; the room loop is gradeRecall). */
export class RecallEpisodes {
  private pending: { start: number; x: number; y: number }[] = [];
  readonly counts: EpisodeCounts = { episodes: 0, reached: 0, failed: 0, censored: 0 };

  start(tick: number, target: { x: number; y: number }): void {
    this.pending.push({ start: tick, x: target.x, y: target.y });
    this.counts.episodes++;
  }

  /** A food eaten at (x, y) on `tick`: every open episode whose target lies within the radius is reached. */
  eaten(tick: number, x: number, y: number): void {
    this.pending = this.pending.filter((p) => {
      if (tick - p.start > REACH_WINDOW || Math.hypot(p.x - x, p.y - y) > REACH_RADIUS) return true;
      this.counts.reached++;
      return false;
    });
  }

  /** `tick` lived: episodes whose window has passed failed. Call after this tick's meals. */
  tick(tick: number): void {
    this.pending = this.pending.filter((p) => {
      if (tick - p.start <= REACH_WINDOW) return true;
      this.counts.failed++;
      return false;
    });
  }

  /** The room ended: a dead body failed every open episode; one alive at the end leaves them out. */
  end(died: boolean): void {
    for (const _ of this.pending) {
      if (died) this.counts.failed++;
      else this.counts.censored++;
    }
    this.pending = [];
  }
}

export interface RecallGrade extends EpisodeCounts { ticks: number; gateTicks: number; recallTicks: number; meals: number; died: boolean }

/** What a body's memory holds right after it lived `obs`, and the action it chose. */
export interface MemoryNow { action: Action; live: readonly LiveMemory[]; pose: Pose; strength: (m: MemoryRecord) => number }

/** One room lived by a body with a memory, its recall graded against the true room (the gate at `hunger`). */
export function gradeRecall(room: Room, step: (obs: Observation, t: number) => MemoryNow, hooks?: EpisodeHooks, hunger = DEFAULT_RECALL.hunger): { summary: EpisodeSummary; grade: RecallGrade } {
  const cfg = room.config;
  const start = room.state().body;
  const episodes = new RecallEpisodes();
  let gateTicks = 0, recallTicks = 0, meals = 0;
  let before = room.state().entities.filter((e) => e.kind === "food").map((e) => ({ ...e }));
  let recalling = false;
  const summary = runEpisode(room, (obs, t) => {
    const now = step(obs, t);
    const foods = room.state().entities.filter((e) => e.kind === "food");
    for (const f of before) { // eaten since the last tick: a food that moved
      const moved = foods.find((x) => x.id === f.id)!;
      if (moved.x === f.x && moved.y === f.y) continue;
      meals++;
      episodes.eaten(t, f.x, f.y);
    }
    before = foods.map((e) => ({ ...e }));
    episodes.tick(t);
    const open = gateOpen(obs, hunger);
    const recalled = open ? recallFood(now.live, now.pose, now.strength, cfg) : null;
    if (open) gateTicks++;
    if (recalled) {
      recallTicks++;
      if (!recalling) {
        const m = now.live.find((x) => x.id === recalled.id)!;
        episodes.start(t, inRoom({ x: m.memory.x, y: m.memory.y, heading: 0, side: 0, sigma: 0 }, start));
      }
    }
    recalling = recalled !== null;
    return now.action;
  }, MAX_TICKS, false, hooks);
  const died = summary.doneCause !== null;
  episodes.end(died);
  return { summary, grade: { ...episodes.counts, ticks: summary.ticks, gateTicks, recallTicks, meals, died } };
}

export interface RecallLife extends RecallGrade { body: string; subject: string | null; seed: number; room: number }

/** A scratch brain holding only a memory (for bodies without one), on a scratch ledger that is never saved. */
function scratchMemory(world: WorldConfig, name: string) {
  const ledger = new Ledger(name, sensorimotorScaffold(world, name));
  const graph: BrainGrafi = structuredClone(ledger.graph);
  const pose = new PoseModule(world);
  return { pose, core: new MemoryCore([pose]), food: new FoodMemory(ledger, graph, world) };
}

/** Reference bodies (each seeded seed·7 + 3, as calibrate-005b and A2), 10 evaluation rooms per seed, their own scratch memory. */
export function referenceRecallLives(bodies: Record<string, (seed: number) => Policy>, world: WorldConfig, seeds: readonly number[]): RecallLife[] {
  const lives: RecallLife[] = [];
  for (const [body, make] of Object.entries(bodies)) {
    for (const seed of seeds) {
      assertSeedAllowed(seed); // no test seed without a frozen pre-registration
      const { pose, core, food } = scratchMemory(world, `REF-${body}-${seed}`);
      const policy = make(seed * 7 + 3);
      for (let ep = 1; ep <= 10; ep++) {
        core.reset();
        food.newRoom(0, ep);
        const step = (obs: Observation, t: number): MemoryNow => {
          core.observe(obs, t);
          food.step(obs, pose.pose, t, ep);
          return { action: policy(obs, t), live: food.live, pose: pose.pose, strength: (m) => food.strengthAt(m, t) };
        };
        const { grade } = gradeRecall(new Room(evalWorld(seed, ep), world), step);
        lives.push({ ...grade, body, subject: null, seed, room: ep });
      }
    }
  }
  return lives;
}

/**
 * LABELLED FIXTURE: a subject's ledger (in memory, never saved) with the recalled-sense nodes and one hand-set rule
 * synapse per ray, rec{i} → the Go of the action ray i points to (left rays → left, the middle ray → forward, right
 * rays → right), weight `w`. What memory use can do with this brain, not something a brain learned.
 */
export function fixtureLedger(store: RegistryStore, id: string, world: WorldConfig, w: number): Ledger {
  const ledger = store.openLedger(id);
  world.rayAngles.forEach((_, i) => ledger.record({ kind: "node+", tick: 0, episode: 0, cause: ["fixture"], node: { id: recId(i), type: "sensor" } }));
  world.rayAngles.forEach((angle, i) => ledger.record({ kind: "edge+", tick: 0, episode: 0, cause: ["fixture"], edge: { from: recId(i), to: `bg.go.${actionOfAngle(angle)}`, weight: w } }));
  return ledger;
}

/**
 * A condition's recorded learners in their recorded evaluation rooms, frozen, the memory on. With `fixtureWeight` null
 * they are the learners as recorded (every room must end as recorded: the memory does not act); with a weight they
 * get the fixture's rule synapses and the recall, so they live other lives.
 */
export function learnerRecallLives(code: string, store: RegistryStore, resultLines: readonly string[], fixtureWeight: number | null, command: "tara" | "curut" = "tara"): RecallLife[] {
  const def = condition(code);
  const world = def.world!;
  const spec = def.spec(world);
  const lives: RecallLife[] = [];
  for (const row of recordedLearners(resultLines, code, world, command)) {
    const subject = store.loadSubject(row.learner);
    assertBornInto(subject, world);
    const recorded = recordedEvaluation(store, row.learner);
    if (!recorded) throw new Error(`${row.learner} has no recorded evaluation`);
    const ledger = fixtureWeight === null ? store.openLedger(row.learner) : fixtureLedger(store, row.learner, world, fixtureWeight);
    const memory = fixtureWeight === null ? {} : { recall: {} };
    const agent = createAgent({ ...spec, cfg: world, ledger, noiseSeed: evalNoise(subject.birth.seed), learning: { ...spec.learning, frozen: true }, memory });
    const mine: { room: number; matches: boolean }[] = [];
    for (const ep of recorded.episodes) {
      agent.startEpisode(ep.episode);
      const step = (obs: Observation, t: number): MemoryNow => {
        const action = agent.policy(obs, t);
        const food = agent.memory!.food;
        return { action, live: food.live, pose: agent.memory!.pose.pose, strength: (m) => food.strengthAt(m, t) };
      };
      const { summary, grade } = gradeRecall(new Room(evalWorld(subject.birth.seed, ep.episode), world), step, agent.hooks);
      mine.push({ room: ep.episode, matches: summary.finalHash === ep.summary.finalHash });
      lives.push({ ...grade, body: fixtureWeight === null ? code : `fikstür w ${fixtureWeight}`, subject: row.learner, seed: subject.birth.seed, room: ep.episode });
    }
    if (fixtureWeight === null) assertReplayed(row.learner, mine);
  }
  return lives;
}

/** Pooled over lives: the gate share (G7), the reach share (G6m) and what it rests on. */
export function aggregateRecall(ls: readonly RecallLife[]) {
  const sum = (k: keyof RecallGrade) => ls.reduce((s, l) => s + Number(l[k]), 0);
  const judged = sum("reached") + sum("failed");
  return {
    lives: ls.length,
    gateShare: sum("gateTicks") / sum("ticks"),
    recallShare: sum("recallTicks") / Math.max(1, sum("gateTicks")),
    episodesPerK: (1000 * sum("episodes")) / sum("ticks"),
    reachShare: judged > 0 ? sum("reached") / judged : NaN,
    judged,
    censored: sum("censored"),
    mealsPerK: (1000 * sum("meals")) / sum("ticks"),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const W = Number(process.argv[2] ?? 1);
  const world = condition("K1n").world!;
  const spinning: Policy = () => ({ thrust: 0, turn: 1 });
  const circling: Policy = () => ({ thrust: 1, turn: 1 });
  const ref = referenceBodies(world);
  const bodies: Record<string, (seed: number) => Policy> = { spinning: () => spinning, blind: ref.blind!, circling: () => circling, seeker: ref.seeker! };
  const store = new RegistryStore(DATA, { readOnly: true });
  const lines = readFileSync(join(DATA, "results.jsonl"), "utf8").split("\n");
  const lives = [
    ...referenceRecallLives(bodies, world, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    ...learnerRecallLives("K1n", store, lines, null),
    ...learnerRecallLives("K1n", store, lines, W),
  ];
  const f = (x: number, d = 2) => (Number.isNaN(x) ? "—" : x.toFixed(d).replace(".", ","));
  const pct = (x: number) => (Number.isNaN(x) ? "—" : `%${f(100 * x, 1)}`);
  console.log(`\n=== A3.0: hafızayı kullanma ölçüleri, kalibrasyon (K1n odası: ${world.foodCount} yemek, doğum enerjisi ${world.initialEnergy}; kapı açlık ≥ ${DEFAULT_RECALL.hunger}) ===`);
  console.log("beden          hayat | kapı açık (G7) | açıkken hatıra | bölüm/1000t | ulaşma (G6m)       | kesilen | yemek/1000t");
  const table: Record<string, ReturnType<typeof aggregateRecall>> = {};
  for (const body of [...new Set(lives.map((l) => l.body))]) {
    const a = (table[body] = aggregateRecall(lives.filter((l) => l.body === body)));
    console.log(`${body.padEnd(14)} ${String(a.lives).padStart(5)} | ${pct(a.gateShare).padStart(14)} | ${pct(a.recallShare).padStart(14)} | ${f(a.episodesPerK).padStart(11)} | ${pct(a.reachShare).padStart(7)} (${String(a.judged).padStart(5)} bölüm) | ${String(a.censored).padStart(7)} | ${f(a.mealsPerK).padStart(11)}`);
  }
  writeFileSync(join(DATA, "recall-a3-calibration.json"), JSON.stringify({ weight: W, hunger: DEFAULT_RECALL.hunger, table }, null, 2) + "\n");
  console.log("\nyazıldı: data/recall-a3-calibration.json");
}
