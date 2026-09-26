// brain-lab/experiments/memory-a2.ts — A2 (TASARIM-008): do the grown food memories match the room? The growing memory
// (memory/pose.ts + learning/growth.ts) lives with the bodies and is graded against the true room. Read-only: recorded
// subjects grow their memories on an in-memory copy of their ledger, never saved.
//   Reference bodies (blind, centre, seeker; scarce room, seeds 1–10, 10 rooms each): a scratch ledger each.
//   The K1n learners' recorded evaluation rooms, their frozen brains with the memory switched on: every room must end
//   in the recorded final world hash (the memory does not act).
// Gates G1–G5 and predictions: LAB-DEFTERI.md, 2026-09-26, "A2 (büyüyen yemek hafızası) — koşmadan önce".
//
//   node --experimental-strip-types brain-lab/experiments/memory-a2.ts
"use strict";

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrainGrafi } from "../brain-ir/ir.ts";
import { burstPolicy, centrePolicy, seekerPolicy } from "../baselines/index.ts";
import { FoodMemory, createAgent, type LiveMemory } from "../learning/index.ts";
import { MemoryCore, PoseModule, inRoom, type Pose } from "../memory/index.ts";
import { Ledger, graphHash, type LedgerEntry } from "../registry/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { sensorimotorScaffold } from "../sensorimotor/index.ts";
import { Room, runEpisode, type Action, type EpisodeHooks, type Observation, type Policy, type WorldConfig } from "../world/index.ts";
import { CONDITIONS } from "./conditions.ts";
import { MAX_TICKS, evalNoise, evalWorld, recordedEvaluation } from "./harness.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
/** A memory within this distance (m) of a real food is right about it (the G3/G4 radius). */
const RIGHT = 0.5;
/** "Seen lately": within this many ticks (G4). */
const LATELY = 100;
/** A false memory must die within this many ticks of its food being eaten (G5). */
const DIES_WITHIN = 20;

/** What one room lived with a growing memory gives. */
interface RoomGrade {
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
function gradeRoom(room: Room, act: Policy, remember: (obs: Observation, t: number) => { live: LiveMemory[] }, entriesNow: () => number, hooks?: EpisodeHooks) {
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

interface Life extends RoomGrade { body: string; subject: string | null; seed: number; room: number; matches: boolean | null }
const lives: Life[] = [];
const replays: { who: string; exact: boolean }[] = [];
let refusedBirths = 0;
const GROWTH = new Set<LedgerEntry["kind"]>(["node+", "memory", "node-"]);

// --- reference bodies: a scratch brain holding only their memories --------------------------------------------------

const K1N = CONDITIONS.K1n!;
const WORLD: WorldConfig = K1N.world!;
const REFERENCE: Record<string, (seed: number) => Policy> = {
  blind: (seed) => burstPolicy(seed),
  centre: (seed) => centrePolicy(WORLD, seed),
  seeker: (seed) => seekerPolicy(WORLD, seed),
};
for (const [body, make] of Object.entries(REFERENCE)) {
  for (let seed = 1; seed <= 10; seed++) {
    const birth = sensorimotorScaffold(WORLD, `${body}-${seed}`);
    const ledger = new Ledger(`REF-${body}-${seed}`, birth);
    const graph: BrainGrafi = structuredClone(ledger.graph);
    const pose = new PoseModule(WORLD);
    const core = new MemoryCore([pose]);
    const food = new FoodMemory(ledger, graph, WORLD);
    const policy = make(seed * 7 + 3); // the policy seeds calibrate-005b used
    for (let ep = 1; ep <= 10; ep++) {
      core.reset();
      food.newRoom(0, ep);
      const remember = (obs: Observation, t: number) => { core.observe(obs, t); food.step(obs, pose.pose as Pose, t, ep); return { live: food.live }; };
      const { grade } = gradeRoom(new Room(evalWorld(seed, ep), WORLD), policy, remember, () => ledger.entries.length);
      lives.push({ ...grade, body, subject: null, seed, room: ep, matches: null });
    }
    refusedBirths += food.refused;
    replays.push({ who: `${body} ${seed}`, exact: new Ledger(`REF-${body}-${seed}`, birth, ledger.entries).hash() === graphHash(graph) && ledger.matches(graph) });
  }
}

// --- the K1n learners, as evaluated, memory switched on -------------------------------------------------------------

interface ResultLine { code: string; seed: number; group: string; learner: string }
const rows = readFileSync(join(DATA, "results.jsonl"), "utf8").split("\n").filter((l) => l.trim() !== "")
  .map((l) => JSON.parse(l) as ResultLine).filter((r) => r.code === "K1n");
const store = new RegistryStore(DATA, { readOnly: true });
for (const row of [...new Map(rows.map((r) => [r.learner, r])).values()]) {
  const subject = store.loadSubject(row.learner);
  const recorded = recordedEvaluation(store, row.learner);
  if (!recorded) throw new Error(`${row.learner} has no recorded evaluation`);
  const ledger = store.openLedger(row.learner); // in memory only: the growth is never saved
  const spec = K1N.spec(WORLD);
  const agent = createAgent({ ...spec, cfg: WORLD, ledger, noiseSeed: evalNoise(subject.birth.seed), learning: { ...spec.learning, frozen: true }, memory: {} });
  for (const ep of recorded.episodes) {
    agent.startEpisode(ep.episode);
    // The agent acts and grows its memory in one call; the grader reads the memory right after it, then hands the
    // action the agent chose back to the room.
    let action: Action = { thrust: 0, turn: 0 };
    const remember = (obs: Observation, t: number) => { action = agent.policy(obs, t); return { live: agent.memory!.food.live }; };
    const act: Policy = () => action;
    const { summary, grade } = gradeRoom(new Room(evalWorld(subject.birth.seed, ep.episode), WORLD), act, remember, () => ledger.entries.length, agent.hooks);
    lives.push({
      ...grade, body: `K1n ${row.group === "reflexless" ? "reflekssiz" : "refleksli"}`, subject: row.learner, seed: subject.birth.seed, room: ep.episode,
      matches: summary.finalHash === ep.summary.finalHash,
    });
  }
  refusedBirths += agent.memory!.food.refused;
  replays.push({ who: row.learner, exact: new Ledger(row.learner, ledger.birthGraph, ledger.entries).hash() === ledger.hash() && ledger.matches(agent.graph) });
  process.stdout.write(`${row.learner} `);
}
process.stdout.write("\n");

// --- report ----------------------------------------------------------------------------------------------------------

const f = (x: number, d = 2) => (Number.isNaN(x) ? "—" : x.toFixed(d).replace(".", ","));
const pct = (x: number) => (Number.isNaN(x) ? "—" : `%${Math.round(100 * x)}`);
const groups = [...Object.keys(REFERENCE), "K1n"];
const inGroup = (gname: string) => lives.filter((l) => (gname === "K1n" ? l.subject !== null : l.body === gname));
const agg = (ls: Life[]) => {
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
};
console.log("\n=== A2: büyüyen yemek hafızası, gerçek odayla ===");
console.log("grup      hayat | G3 isabet | G4 kapsama | G5 yenen yemeğin hatırası 20 tikte öldü | en çok canlı | büyüme kaydı / oda");
const table: Record<string, ReturnType<typeof agg>> = {};
for (const gname of groups) {
  const a = (table[gname] = agg(inGroup(gname)));
  console.log(`${gname.padEnd(8)} ${String(a.lives).padStart(5)} | ${pct(a.precision).padStart(9)} | ${pct(a.coverage).padStart(10)} | ${pct(a.eatenInTime).padStart(9)} (${a.eaten} hatıra)`
    + `${"".padStart(20)} | ${String(a.mostAlive).padStart(12)} | ${f(a.entriesPerRoom, 0).padStart(6)}`);
}
const matched = lives.filter((l) => l.matches === true).length;
const k1nLives = lives.filter((l) => l.subject !== null).length;
const exact = replays.filter((r) => r.exact).length;
console.log(`\nG1 yeniden kurma (doğum + defter = canlı beyin): ${exact}/${replays.length}`);
console.log(`davranış değişmedi (K1n odaları kayıttaki son dünya özetiyle): ${matched}/${k1nLives}`);
console.log(`G2 tavanda reddedilen doğum: ${refusedBirths}; bir odada en çok canlı hatıra: ${Math.max(...groups.map((gname) => table[gname]!.mostAlive))}`);

writeFileSync(join(DATA, "memory-a2-lives.jsonl"), lives.map((l) => JSON.stringify(l)).join("\n") + "\n");
writeFileSync(join(DATA, "memory-a2-summary.json"), JSON.stringify({ table, replays: { exact, of: replays.length }, matched: `${matched}/${k1nLives}`, refusedBirths }, null, 2) + "\n");
console.log("\nyazıldı: data/memory-a2-summary.json, data/memory-a2-lives.jsonl");
