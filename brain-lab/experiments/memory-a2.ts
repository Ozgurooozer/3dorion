// brain-lab/experiments/memory-a2.ts — A2 (TASARIM-008): do the grown food memories match the room? The growing memory
// (memory/pose.ts + learning/growth.ts) lives with the bodies and is graded against the true room. Read-only: recorded
// subjects grow their memories on an in-memory copy of their ledger, never saved.
//   Reference bodies (blind, centre, seeker; the condition's room, seeds 1–10, 10 rooms each): a scratch ledger each.
//   The condition's recorded learners in their recorded evaluation rooms, their frozen brains with the memory switched
//   on: every room must end in the recorded final world hash (the memory does not act).
// Gates G1–G5 and predictions: LAB-DEFTERI.md, 2026-09-26, "A2 (büyüyen yemek hafızası) — koşmadan önce".
//
// The condition is an argument (2026-09-26, falsification of the memory results): K1n is the default and writes
// data/memory-a2-*, the recorded A2 outputs; another condition writes data/memory-a2-<code>-*. The grading pieces are
// exported so a falsification script can grade other rooms, seeds, growth parameters (rule lesions) and, as a labelled
// diagnostic fixture, the memory fed the true pose instead of the pose module's.
//
//   node --experimental-strip-types brain-lab/experiments/memory-a2.ts [KOD]
"use strict";

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrainGrafi } from "../brain-ir/ir.ts";
import { FoodMemory, createAgent, type GrowthParams, type LiveMemory } from "../learning/index.ts";
import { MemoryCore, PoseModule, inRoom, type Pose } from "../memory/index.ts";
import { Ledger, graphHash } from "../registry/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { sensorimotorScaffold } from "../sensorimotor/index.ts";
import { Room, runEpisode, type Action, type EpisodeHooks, type Observation, type Policy, type WorldConfig } from "../world/index.ts";
import { ROOM1, condition } from "./conditions.ts";
import { MAX_TICKS, assertBornInto, assertReplayed, assertSeedAllowed, evalNoise, evalWorld, recordedEvaluation, recordedLearners } from "./harness.ts";
import { referenceBodies } from "./pose-a1.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
/** A memory within this distance (m) of a real food is right about it (the G3/G4 radius). */
const RIGHT = 0.5;
/** "Seen lately": within this many ticks (G4). */
const LATELY = 100;
/** A false memory must die within this many ticks of its food being eaten (G5). */
const DIES_WITHIN = 20;

/** What one room lived with a growing memory gives. */
export interface RoomGrade {
  ticks: number;
  /** G3: over ticks with any live memory, the share of live memories within RIGHT of a real food. */
  precisionSum: number;
  precisionTicks: number;
  /** G4: over ticks with any food seen in the last LATELY ticks, the share of those foods remembered within RIGHT. */
  coverageSum: number;
  coverageTicks: number;
  /** G5: memories that stood on a food when it was eaten, and how many of them died within DIES_WITHIN ticks. */
  eatenMemories: number;
  eatenDiedInTime: number;
  mostAlive: number;
  growthEntries: number;
}

/** The memory of one body in one room, and the grading of it against the room. */
export function gradeRoom(room: Room, act: Policy, remember: (obs: Observation, t: number) => { live: LiveMemory[] }, entriesNow: () => number, hooks?: EpisodeHooks) {
  const cfg = room.config;
  const start = room.state().body;
  const g: RoomGrade = { ticks: 0, precisionSum: 0, precisionTicks: 0, coverageSum: 0, coverageTicks: 0, eatenMemories: 0, eatenDiedInTime: 0, mostAlive: 0, growthEntries: 0 };
  const entriesAtStart = entriesNow();
  let before = room.state().entities.filter((e) => e.kind === "food").map((e) => ({ ...e }));
  const seenAt = new Map<string, { x: number; y: number; tick: number }>(); // food id → where and when last seen
  const watch = new Map<string, number>(); // memory id → tick its food was eaten
  const where = (m: LiveMemory) => inRoom({ x: m.memory.x, y: m.memory.y, heading: 0, side: 0, sigma: 0 }, start);
  // The memories alive before this tick's growth: a memory that stood on a food the body ate may die in the very tick
  // the meal is felt (that is the rule working), so who stood on it is read from the tick before.
  let previousLive: LiveMemory[] = [];
  const summary = runEpisode(room, (obs, t) => {
    const { live } = remember(obs, t);
    const state = room.state();
    const foods = state.entities.filter((e) => e.kind === "food");
    // Eaten since the last tick: a food that moved. The memories that stood on it must die.
    for (const f of before) {
      const now = foods.find((x) => x.id === f.id)!;
      if (now.x === f.x && now.y === f.y) continue;
      seenAt.delete(f.id);
      for (const m of previousLive) {
        const p = where(m);
        if (Math.hypot(p.x - f.x, p.y - f.y) <= RIGHT && !watch.has(m.id)) { watch.set(m.id, t); g.eatenMemories++; }
      }
    }
    for (const [id, eatenAt] of [...watch]) {
      if (!live.some((m) => m.id === id)) { if (t - eatenAt <= DIES_WITHIN) g.eatenDiedInTime++; watch.delete(id); }
      else if (t - eatenAt > DIES_WITHIN) watch.delete(id);
    }
    before = foods.map((e) => ({ ...e }));
    // Which foods the rays see now (the grader knows the true body).
    obs.rays.forEach((ray, i) => {
      if (ray.hit !== "food") return;
      const a = state.body.heading + cfg.rayAngles[i]!;
      const hx = state.body.x + ray.distance * Math.cos(a);
      const hy = state.body.y + ray.distance * Math.sin(a);
      const f = foods.reduce((best, x) => (Math.hypot(x.x - hx, x.y - hy) < Math.hypot(best.x - hx, best.y - hy) ? x : best), foods[0]!);
      seenAt.set(f.id, { x: f.x, y: f.y, tick: t });
    });
    // G3 precision and G4 coverage at this tick.
    if (live.length > 0) {
      const right = live.filter((m) => { const p = where(m); return foods.some((f) => Math.hypot(p.x - f.x, p.y - f.y) <= RIGHT); }).length;
      g.precisionSum += right / live.length;
      g.precisionTicks++;
    }
    const lately = [...seenAt.values()].filter((s) => t - s.tick <= LATELY);
    if (lately.length > 0) {
      const covered = lately.filter((s) => live.some((m) => { const p = where(m); return Math.hypot(p.x - s.x, p.y - s.y) <= RIGHT; })).length;
      g.coverageSum += covered / lately.length;
      g.coverageTicks++;
    }
    g.mostAlive = Math.max(g.mostAlive, live.length);
    previousLive = live;
    return act(obs, t);
  }, MAX_TICKS, false, hooks);
  g.ticks = summary.ticks;
  g.growthEntries = entriesNow() - entriesAtStart;
  return { summary, grade: g };
}

export interface Life extends RoomGrade { body: string; subject: string | null; seed: number; room: number; matches: boolean | null }
/** Lives graded, whether each brain's birth graph + ledger replays to its live brain (G1), births refused at the cap. */
export interface Graded { lives: Life[]; replays: { who: string; exact: boolean }[]; refused: number }

export interface ReferenceOptions {
  /** Growth parameters other than DEFAULT_GROWTH (a rule lesion, e.g. { eatenRadius: 0 }). */
  readonly food?: Partial<GrowthParams>;
  /**
   * LABELLED DIAGNOSTIC FIXTURE, never a brain: the memory is fed the body's true pose in its start frame (read from
   * the room) instead of the pose module's estimate. It separates the growth rules from the pose error (A2 diagnosis).
   */
  readonly truePose?: boolean;
}

/** Reference bodies, each with a scratch brain holding only its memories; 10 evaluation rooms per seed, policy seeded seed·7 + 3. */
export function referenceMemoryLives(bodies: Record<string, (seed: number) => Policy>, world: WorldConfig, seeds: readonly number[], opts: ReferenceOptions = {}): Graded {
  const lives: Life[] = [];
  const replays: Graded["replays"] = [];
  let refused = 0;
  for (const [body, make] of Object.entries(bodies)) {
    for (const seed of seeds) {
      assertSeedAllowed(seed); // no test seed without a frozen pre-registration
      const birth = sensorimotorScaffold(world, `${body}-${seed}`);
      const ledger = new Ledger(`REF-${body}-${seed}`, birth);
      const graph: BrainGrafi = structuredClone(ledger.graph);
      const pose = new PoseModule(world);
      const core = new MemoryCore([pose]);
      const food = new FoodMemory(ledger, graph, world, opts.food);
      const policy = make(seed * 7 + 3); // the policy seeds calibrate-005b used
      for (let ep = 1; ep <= 10; ep++) {
        core.reset();
        food.newRoom(0, ep);
        const room = new Room(evalWorld(seed, ep), world);
        const start = room.state().body;
        if (opts.truePose && start.heading !== 0) throw new Error("the true-pose fixture assumes bodies start facing 0");
        const truth = (): Pose => { const b = room.state().body; return { x: b.x - start.x, y: b.y - start.y, heading: b.heading, side: 0, sigma: 0 }; };
        const remember = (obs: Observation, t: number) => {
          core.observe(obs, t);
          food.step(obs, opts.truePose ? truth() : pose.pose as Pose, t, ep);
          return { live: food.live };
        };
        const { grade } = gradeRoom(room, policy, remember, () => ledger.entries.length);
        lives.push({ ...grade, body, subject: null, seed, room: ep, matches: null });
      }
      refused += food.refused;
      replays.push({ who: `${body} ${seed}`, exact: new Ledger(`REF-${body}-${seed}`, birth, ledger.entries).hash() === graphHash(graph) && ledger.matches(graph) });
    }
  }
  return { lives, replays, refused };
}

/**
 * A condition's recorded learners (harness.recordedLearners) in their recorded evaluation rooms, frozen, the memory
 * switched on; the growth goes to an in-memory copy of each ledger, never saved. A subject born into another world, or
 * a room that does not end in its recorded final world hash, stops the measurement (assertBornInto, assertReplayed).
 */
export function learnerMemoryLives(code: string, store: RegistryStore, resultLines: readonly string[], command: "tara" | "curut" = "tara"): Graded {
  const def = condition(code);
  const world = def.world ?? ROOM1;
  const lives: Life[] = [];
  const replays: Graded["replays"] = [];
  let refused = 0;
  for (const row of recordedLearners(resultLines, code, world, command)) {
    const subject = store.loadSubject(row.learner);
    assertBornInto(subject, world);
    const recorded = recordedEvaluation(store, row.learner);
    if (!recorded) throw new Error(`${row.learner} has no recorded evaluation`);
    const ledger = store.openLedger(row.learner); // in memory only: the growth is never saved
    const spec = def.spec(world);
    const agent = createAgent({ ...spec, cfg: world, ledger, noiseSeed: evalNoise(subject.birth.seed), learning: { ...spec.learning, frozen: true }, memory: {} });
    for (const ep of recorded.episodes) {
      agent.startEpisode(ep.episode);
      // The agent acts and grows its memory in one call; the grader reads the memory right after it, then hands the
      // action the agent chose back to the room.
      let action: Action = { thrust: 0, turn: 0 };
      const remember = (obs: Observation, t: number) => { action = agent.policy(obs, t); return { live: agent.memory!.food.live }; };
      const act: Policy = () => action;
      const { summary, grade } = gradeRoom(new Room(evalWorld(subject.birth.seed, ep.episode), world), act, remember, () => ledger.entries.length, agent.hooks);
      lives.push({
        ...grade, body: `${code} ${row.group === "reflexless" ? "reflekssiz" : "refleksli"}`, subject: row.learner, seed: subject.birth.seed, room: ep.episode,
        matches: summary.finalHash === ep.summary.finalHash,
      });
    }
    assertReplayed(row.learner, lives.filter((l) => l.subject === row.learner));
    refused += agent.memory!.food.refused;
    replays.push({ who: row.learner, exact: new Ledger(row.learner, ledger.birthGraph, ledger.entries).hash() === ledger.hash() && ledger.matches(agent.graph) });
    process.stdout.write(`${row.learner} `);
  }
  process.stdout.write("\n");
  return { lives, replays, refused };
}

/** G3–G5 and growth over a set of lives: tick-weighted shares, pooled over rooms. */
export function aggregate(ls: Life[]) {
  const sum = (k: keyof RoomGrade) => ls.reduce((s, l) => s + (l[k] as number), 0);
  return {
    lives: ls.length,
    precision: sum("precisionSum") / sum("precisionTicks"),
    coverage: sum("coverageSum") / sum("coverageTicks"),
    eaten: sum("eatenMemories"),
    eatenInTime: sum("eatenDiedInTime") / sum("eatenMemories"),
    mostAlive: Math.max(...ls.map((l) => l.mostAlive)),
    entriesPerRoom: sum("growthEntries") / ls.length,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const code = process.argv[2] ?? "K1n";
  // Which recorded learners: the screened ones (tara, default) or a falsification run's fresh-seed learners (curut).
  const command = (process.argv[3] ?? "tara") as "tara" | "curut";
  if (command !== "tara" && command !== "curut") throw new Error(`the third argument is tara or curut, got ${command}`);
  const WORLD: WorldConfig = condition(code).world ?? ROOM1;
  const REFERENCE = referenceBodies(WORLD);
  const resultLines = readFileSync(join(DATA, "results.jsonl"), "utf8").split("\n");
  const store = new RegistryStore(DATA, { readOnly: true });
  const refs = referenceMemoryLives(REFERENCE, WORLD, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const subjects = learnerMemoryLives(code, store, resultLines, command);
  const lives = [...refs.lives, ...subjects.lives];
  const replays = [...refs.replays, ...subjects.replays];
  const refusedBirths = refs.refused + subjects.refused;

  // --- report ----------------------------------------------------------------------------------------------------------

  const f = (x: number, d = 2) => (Number.isNaN(x) ? "—" : x.toFixed(d).replace(".", ","));
  const pct = (x: number) => (Number.isNaN(x) ? "—" : `%${Math.round(100 * x)}`);
  const groups = [...Object.keys(REFERENCE), code];
  const inGroup = (gname: string) => lives.filter((l) => (gname === code ? l.subject !== null : l.body === gname));
  console.log(`\n=== A2: büyüyen yemek hafızası, gerçek odayla (${code} odası: ${WORLD.foodCount} yemek, ${WORLD.threatCount} tehlike) ===`);
  console.log("grup      hayat | G3 isabet | G4 kapsama | G5 yenen yemeğin hatırası 20 tikte öldü | en çok canlı | büyüme kaydı / oda");
  const table: Record<string, ReturnType<typeof aggregate>> = {};
  for (const gname of groups) {
    const a = (table[gname] = aggregate(inGroup(gname)));
    console.log(`${gname.padEnd(8)} ${String(a.lives).padStart(5)} | ${pct(a.precision).padStart(9)} | ${pct(a.coverage).padStart(10)} | ${pct(a.eatenInTime).padStart(9)} (${a.eaten} hatıra)`
      + `${"".padStart(20)} | ${String(a.mostAlive).padStart(12)} | ${f(a.entriesPerRoom, 0).padStart(6)}`);
  }
  const matched = lives.filter((l) => l.matches === true).length;
  const learnerLifeCount = lives.filter((l) => l.subject !== null).length;
  const exact = replays.filter((r) => r.exact).length;
  console.log(`\nG1 yeniden kurma (doğum + defter = canlı beyin): ${exact}/${replays.length}`);
  console.log(`davranış değişmedi (${code} odaları kayıttaki son dünya özetiyle): ${matched}/${learnerLifeCount}`);
  console.log(`G2 tavanda reddedilen doğum: ${refusedBirths}; bir odada en çok canlı hatıra: ${Math.max(...groups.map((gname) => table[gname]!.mostAlive))}`);

  const out = (code === "K1n" ? "memory-a2" : `memory-a2-${code}`) + (command === "tara" ? "" : `-${command}`);
  writeFileSync(join(DATA, `${out}-lives.jsonl`), lives.map((l) => JSON.stringify(l)).join("\n") + "\n");
  writeFileSync(join(DATA, `${out}-summary.json`), JSON.stringify({ table, replays: { exact, of: replays.length }, matched: `${matched}/${learnerLifeCount}`, refusedBirths }, null, 2) + "\n");
  console.log(`\nyazıldı: data/${out}-summary.json, data/${out}-lives.jsonl`);
}
