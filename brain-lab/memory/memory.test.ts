// brain-lab/memory/memory.test.ts — the memory core must keep its rules (TASARIM-007 §4), and H1 must know where
// the body is from the body's own motion senses: exactly away from walls, with its only error entering at wall
// contact, and with a confidence that falls only there. Every case starts from a fresh room and fresh memory.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { burstPolicy } from "../baselines/index.ts";
import { bornGraph } from "../development/index.ts";
import { CONDITIONS, ROOM3 } from "../experiments/conditions.ts";
import { createAgent } from "../learning/index.ts";
import { Ledger } from "../registry/index.ts";
import { DEFAULT_CONFIG as C, Room, makeConfig, runEpisode, type Observation, type Policy, type WorldConfig } from "../world/index.ts";
import {
  MemoryCore, POSE_SCALE, POSE_SLOT, PoseModule, SOURCES, WorkingMemory, inRoom, poseConfidence, terminalSpeed, withMemory,
  type MemoryModule, type Pose, type PoseParams, type Stamp,
} from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** No hunger, no food, no threats: a body that lives as long as a test needs and only moves. */
const FREE = { basalEnergyCost: 0, motorEnergyCost: 0, foodCount: 0, threatCount: 0 };
/** A 1000 m room: from its centre a body cannot reach a wall in 3000 ticks (at most 2.47 m/s × 150 s = 370 m). */
const OPEN = makeConfig({ ...FREE, width: 1000, height: 1000 });
/** The lab's 10 m room, walls and all. */
const WALLED = makeConfig(FREE);

/**
 * Tolerance for "exact" positions. Measured 2026-09-26 over seeds 1–5: open room, largest error in 3000 ticks
 * 1.4e-12 m (positions up to ~370 m from the start); walled room before the first contact 1.2e-14 m. 1e-9 m leaves
 * room for rounding on another machine; a modelling error shows up far above it (one turn at full speed slides 0.24 m).
 */
const EXACT = 1e-9;

const still: Policy = () => ({ thrust: 0, turn: 0 });
const sense = (motion: Partial<Observation["motion"]> = {}, bump = false): Observation => ({
  rays: [], bump, energy: 1, health: 1, motion: { forward: 0, turn: 0, ...motion },
});
const stamp = (confidence: number, tick = 0, source: Stamp["source"] = "sensed"): Stamp => ({ tick, source, confidence });

interface Tick { readonly tick: number; readonly pose: Pose; readonly error: number; readonly headingError: number; readonly bump: boolean }

/** Lives one room with a pose module listening; per tick the estimate against the true body at the same moment. */
function track(cfg: WorldConfig, policy: Policy, ticks: number, params: Partial<PoseParams> = {}, seed = 1): Tick[] {
  const room = new Room(seed, cfg);
  const pose = new PoseModule(cfg, params);
  const core = new MemoryCore([pose]);
  const start = room.state().body;
  assert.equal(start.heading, 0, "this world starts every body facing 0, so body and room frames share their axes");
  const out: Tick[] = [];
  runEpisode(room, (obs, t) => {
    core.observe(obs, t);
    const body = room.state().body;
    const p = inRoom(pose.pose, start);
    out.push({ tick: t, pose: pose.pose, error: Math.hypot(p.x - body.x, p.y - body.y), headingError: Math.abs(pose.pose.heading - body.heading), bump: obs.bump });
    return policy(obs, t);
  }, ticks);
  return out;
}

const worst = (ticks: readonly Tick[]) => Math.max(...ticks.map((t) => t.error));

// --- structure ---------------------------------------------------------------------------------------------------

test("dependencies: the memory reads only the world's public types (no ledger, no brain, no world internals); nothing below imports it", () => {
  for (const f of readdirSync(HERE).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
    const imports = [...readFileSync(join(HERE, f), "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const i of imports) assert.match(i, /^(\.\/[\w-]+\.ts|\.\.\/world\/index\.ts)$/, `${f} imports ${i}`);
  }
  for (const dir of ["../world", "../sensorimotor", "../brain-ir", "../registry", "../neuromodulation", "../regions", "../development", "../learning", "../baselines"]) {
    for (const f of readdirSync(join(HERE, dir)).filter((n) => n.endsWith(".ts"))) {
      assert.doesNotMatch(readFileSync(join(HERE, dir, f), "utf8"), /from\s+["'][^"']*\/memory\/[^"']*["']/, `${dir}/${f} imports the memory`);
    }
  }
});

// --- the core: working memory ------------------------------------------------------------------------------------

test("working memory: a slot holds one entry, and the next write replaces it", () => {
  const wm = new WorkingMemory();
  wm.write("self.pose", "first", stamp(1, 0));
  wm.write("self.pose", "second", stamp(1, 1));
  assert.equal(wm.read("self.pose")?.value, "second");
  assert.equal(wm.read("self.pose")?.stamp.tick, 1);
  assert.deepEqual(wm.keys(), ["self.pose"]);
});

test("every entry carries tick, source and confidence: the edges 0 and 1 and every source are accepted", () => {
  const wm = new WorkingMemory();
  for (const c of [0, 1]) assert.doesNotThrow(() => wm.write("k", 1, stamp(c)), `confidence ${c}`);
  for (const s of SOURCES) assert.doesNotThrow(() => wm.write("k", 1, stamp(1, 0, s)), `source ${s}`);
});

test("a stamp without a valid tick, source or confidence is refused", () => {
  const bad: [string, Stamp][] = [
    ["confidence below 0", stamp(-0.01)], ["confidence above 1", stamp(1.01)], ["confidence NaN", stamp(Number.NaN)],
    ["negative tick", stamp(1, -1)], ["fractional tick", stamp(1, 0.5)], ["tick NaN", stamp(1, Number.NaN)],
    ["unknown source", { tick: 0, source: "seen" as Stamp["source"], confidence: 1 }],
  ];
  for (const [why, s] of bad) assert.throws(() => new WorkingMemory().write("k", 1, s), RangeError, why);
});

test("retrieval threshold: an entry is returned exactly when its confidence is at least the threshold", () => {
  for (const c of [0, 0.25, 0.5, 0.75, 1]) {
    for (const th of [0, 0.25, 0.5, 0.75, 1]) {
      const wm = new WorkingMemory();
      wm.write("k", "v", stamp(c));
      assert.equal(wm.read("k", th) !== undefined, c >= th, `confidence ${c}, threshold ${th}`);
    }
  }
});

test("a threshold outside [0, 1] is refused, and a missing key reads as nothing", () => {
  const wm = new WorkingMemory();
  for (const th of [-0.1, 1.1, Number.NaN]) assert.throws(() => wm.read("k", th), RangeError, `threshold ${th}`);
  assert.equal(wm.read("nothing"), undefined);
});

test("an entry and its stamp cannot be changed by whoever reads them", () => {
  const wm = new WorkingMemory();
  const s = stamp(0.9, 3);
  wm.write("k", "v", s);
  const e = wm.read<string>("k")!;
  assert.throws(() => { (e.stamp as { confidence: number }).confidence = 0.1; }, TypeError);
  assert.throws(() => { (e as { value: string }).value = "changed"; }, TypeError);
  (s as { confidence: number }).confidence = 0.1; // the writer's own object is a copy source only
  assert.equal(wm.read("k")?.stamp.confidence, 0.9);
});

// --- the core: modules, rooms and ticks ---------------------------------------------------------------------------

/** A module that counts what it hears and writes the count. */
function counter(name = "counter"): MemoryModule & { heard: number; resets: number } {
  const m = {
    name, heard: 0, resets: 0,
    reset() { m.heard = 0; m.resets++; },
    observe(_obs: Observation, tick: number, wm: WorkingMemory) { m.heard++; wm.write(name, m.heard, stamp(1, tick, "inferred")); },
  };
  return m;
}

test("reset forgets everything: working memory empties, every module resets, ticks start from 0", () => {
  const m = counter();
  const core = new MemoryCore([m]);
  for (let t = 0; t < 5; t++) core.observe(sense(), t);
  core.reset();
  assert.deepEqual(core.working.keys(), []);
  assert.equal(m.resets, 1);
  assert.equal(m.heard, 0);
  assert.equal(core.ticks, 0);
});

test("ticks come one at a time from 0: a skipped tick throws", () => {
  const core = new MemoryCore([counter()]);
  core.observe(sense(), 0);
  assert.throws(() => core.observe(sense(), 2), /expected tick 1, got 2/);
});

test("ticks come one at a time from 0: a repeated tick throws", () => {
  const core = new MemoryCore([counter()]);
  core.observe(sense(), 0);
  core.observe(sense(), 1);
  assert.throws(() => core.observe(sense(), 1), /expected tick 2, got 1/);
});

test("a new room without reset() throws, and says so", () => {
  const core = new MemoryCore([counter()]);
  for (let t = 0; t < 3; t++) core.observe(sense(), t);
  assert.throws(() => core.observe(sense(), 0), /needs reset\(\) first/);
});

test("modules run in the order given and share one working memory; their names must be unique", () => {
  const core = new MemoryCore([counter("a"), counter("b")]);
  core.observe(sense(), 0);
  assert.deepEqual(core.working.keys(), ["a", "b"]);
  assert.throws(() => new MemoryCore([counter("a"), counter("a")]), /unique/);
});

test("a body with memory lives exactly the same life, and its memory heard every tick", () => {
  for (const seed of [1, 2, 3]) {
    const plain = runEpisode(new Room(seed, WALLED), burstPolicy(seed), 1000);
    const core = new MemoryCore([new PoseModule(WALLED)]);
    const remembering = runEpisode(new Room(seed, WALLED), withMemory(burstPolicy(seed), core), 1000);
    assert.equal(remembering.finalHash, plain.finalHash, `seed ${seed}`);
    assert.equal(core.ticks, plain.ticks, `seed ${seed}`);
  }
});

test("a learning subject with memory lives the same life and writes exactly the same ledger (memory is not learning)", () => {
  const { spec, world } = CONDITIONS.K1n!;
  const room = world ?? ROOM3;
  const life = (memory: boolean) => {
    const ledger = new Ledger("DNK-0001", bornGraph(room, { seed: 3, group: "reflexless" }));
    const agent = createAgent({ ...spec(room), cfg: room, ledger, noiseSeed: 11 });
    const core = new MemoryCore([new PoseModule(room)]);
    const hashes: string[] = [];
    for (let ep = 1; ep <= 2; ep++) {
      agent.startEpisode(ep);
      core.reset();
      const policy = memory ? withMemory(agent.policy, core) : agent.policy;
      hashes.push(runEpisode(new Room(100 + ep, room), policy, 3000, false, agent.hooks).finalHash);
      agent.finishEpisode(0);
    }
    return { hashes, ledger: ledger.hash(), entries: ledger.entries.length };
  };
  const without = life(false);
  const withIt = life(true);
  assert.deepEqual(withIt.hashes, without.hashes);
  assert.equal(withIt.ledger, without.ledger);
  assert.ok(without.entries > 0, `the subject learned something (${without.entries} entries), so the comparison is not vacuous`);
});

// --- H1 pose: guards ------------------------------------------------------------------------------------------------

test("this body's top speed, 2.467 m/s, is below the speed cap (4 m/s), so the sideways model needs no cap", () => {
  const k = 1 - C.drag * C.dt;
  assert.ok(Math.abs(terminalSpeed(C) - (C.maxAccel * C.dt * k) / (1 - k)) < 1e-12);
  assert.ok(Math.abs(terminalSpeed(C) - 2.4666666666666666) < 1e-12, `${terminalSpeed(C)}`);
  assert.ok(terminalSpeed(C) < C.maxSpeed);
});

test("the top speed really is the top: full thrust, straight and then turning, never exceeds it", () => {
  const room = new Room(1, OPEN);
  let fastest = 0;
  // 300 ticks straight bring the body to within 0.925^300 ≈ 7e-11 of the top; then 700 ticks of turning at full thrust.
  for (let t = 0; t < 1000; t++) {
    room.step({ thrust: 1, turn: t < 300 || t % 50 < 25 ? 0 : 1 });
    const b = room.state().body;
    fastest = Math.max(fastest, Math.hypot(b.vx, b.vy));
  }
  assert.ok(fastest <= terminalSpeed(OPEN) + 1e-12, `fastest ${fastest}, top ${terminalSpeed(OPEN)}`);
  assert.ok(fastest > 0.999 * terminalSpeed(OPEN), `fastest ${fastest}: the body did reach full speed`);
});

test("a world where the speed cap can bite is refused by the sideways model, not silently mis-tracked", () => {
  const capped = makeConfig({ maxSpeed: 2 });
  assert.throws(() => new PoseModule(capped), /speed cap/);
  assert.doesNotThrow(() => new PoseModule(capped, { sideslip: false }));
});

test("bad pose parameters are refused", () => {
  const bad: [string, Partial<PoseParams>][] = [
    ["contactNoise below 0", { contactNoise: -1 }], ["contactNoise NaN", { contactNoise: Number.NaN }],
    ["contactNoise infinite", { contactNoise: Number.POSITIVE_INFINITY }],
    ["unknown contact rule", { contact: "slide" as PoseParams["contact"] }],
    ["sideslip not a boolean", { sideslip: 1 as unknown as boolean }],
  ];
  for (const [why, p] of bad) assert.throws(() => new PoseModule(C, p), RangeError, why);
});

// --- H1 pose: where the body is -------------------------------------------------------------------------------------

test("standing still: the pose stays exactly at the start, fully confident", () => {
  const ticks = track(WALLED, still, 300);
  for (const t of ticks) assert.deepEqual(t.pose, { x: 0, y: 0, heading: 0, side: 0, sigma: 0 }, `tick ${t.tick}`);
  assert.equal(worst(ticks), 0);
});

test("the heading is exact, bit for bit, whatever the turns (the turn sense is the turn command)", () => {
  for (const seed of [1, 2, 3]) {
    const ticks = track(OPEN, burstPolicy(seed), 3000);
    assert.equal(Math.max(...ticks.map((t) => t.headingError)), 0, `seed ${seed}`);
  }
});

test("open room: with the sideways model the position stays exact for 3000 ticks of turning at speed", () => {
  for (const seed of [1, 2, 3]) assert.ok(worst(track(OPEN, burstPolicy(seed), 3000, { sideslip: true })) < EXACT, `seed ${seed}`);
});

test("open room: without it (TASARIM-007 as first written) the same lives end metres away (measured 4.7–6.5 m)", () => {
  for (const seed of [1, 2, 3]) {
    const ticks = track(OPEN, burstPolicy(seed), 3000, { sideslip: false });
    assert.ok(ticks.at(-1)!.error > 1, `seed ${seed}: ${ticks.at(-1)!.error} m`);
  }
});

test("one turn at full speed: the modelled sideways speed equals the body's true sideways velocity (≈ −0.357 m/s)", () => {
  const room = new Room(1, OPEN);
  const pose = new PoseModule(OPEN);
  const core = new MemoryCore([pose]);
  let t = 0;
  const act = (thrust: number, turn: number) => { core.observe(room.observe(), t++); room.step({ thrust, turn }); };
  for (let i = 0; i < 200; i++) act(1, 0);
  act(1, 1);
  core.observe(room.observe(), t);
  const b = room.state().body;
  const trueSide = -b.vx * Math.sin(b.heading) + b.vy * Math.cos(b.heading);
  // Values below 3 m/s: 1e-12 is a few thousand ε (measured difference 0).
  assert.ok(Math.abs(pose.pose.side - trueSide) < 1e-12, `modelled ${pose.pose.side}, true ${trueSide}`);
  assert.ok(pose.pose.side < -0.3, `a left turn leaves the old velocity to the right: ${pose.pose.side}`);
});

test("walls: until the first wall contact the position is exact; the error enters at contact", () => {
  for (const contact of ["keep", "zero"] as const) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const ticks = track(WALLED, burstPolicy(seed), 3000, { contact }, seed);
      const first = ticks.findIndex((t) => t.bump);
      assert.ok(first > 0, `${contact}, seed ${seed}: the body did touch a wall`);
      assert.ok(worst(ticks.slice(0, first)) < EXACT, `${contact}, seed ${seed}: error before tick ${first}`);
      assert.ok(ticks.at(-1)!.error > 0.1, `${contact}, seed ${seed}: after contacts ${ticks.at(-1)!.error} m`);
    }
  }
});

test("contact rule 'keep' carries the modelled sideways speed through a contact; 'zero' drops it", () => {
  const k = 1 - C.drag * C.dt;
  const lived = (contact: PoseParams["contact"]) => {
    const pose = new PoseModule(C, { contact });
    const core = new MemoryCore([pose]);
    core.observe(sense({ forward: 0.5 }), 0);
    core.observe(sense({ forward: 0.5, turn: 1 }), 1); // the turn leaves a sideways speed
    const sideBefore = pose.pose.side;
    core.observe(sense({ forward: 0.5 }, true), 2);
    return { sideBefore, after: pose.pose.side };
  };
  const keep = lived("keep");
  assert.ok(keep.sideBefore < 0, `the turn left a sideways speed: ${keep.sideBefore}`);
  assert.ok(Math.abs(keep.after - k * keep.sideBefore) < 1e-15, `keep: ${keep.after} vs ${k * keep.sideBefore}`);
  assert.equal(lived("zero").after, 0);
});

// --- H1 pose: confidence ----------------------------------------------------------------------------------------------

test("confidence: 1 when certain, one half at σ = 0.5 m, one fifth at σ = 1 m, and falling as σ grows", () => {
  assert.equal(poseConfidence(0), 1);
  assert.equal(poseConfidence(POSE_SCALE), 0.5);
  assert.ok(Math.abs(poseConfidence(1) - 0.2) < 1e-15, `${poseConfidence(1)}`); // 1 / (1 + (1 / 0.5)²)
  const grid = [0, 0.1, 0.25, 0.5, 1, 2, 5];
  for (let i = 1; i < grid.length; i++) assert.ok(poseConfidence(grid[i]!) < poseConfidence(grid[i - 1]!), `σ ${grid[i]}`);
});

test("moving freely never costs confidence, however fast or far", () => {
  const ticks = track(OPEN, burstPolicy(4), 3000);
  assert.equal(Math.max(...ticks.map((t) => t.pose.sigma)), 0);
});

test("resting against a wall costs no confidence: only moving into contact does", () => {
  const pose = new PoseModule(C, { contactNoise: 2 });
  const core = new MemoryCore([pose]);
  for (let t = 0; t < 50; t++) core.observe(sense({}, true), t);
  assert.equal(pose.pose.sigma, 0);
});

test("a contact tick adds contactNoise × (speed before it × tick) to σ, and contact ticks add as variances", () => {
  const q = 2;
  const pose = new PoseModule(C, { contactNoise: q });
  const core = new MemoryCore([pose]);
  core.observe(sense({ forward: 0.5 }), 0); // coming in at 2 m/s
  core.observe(sense({ forward: 0.25 }, true), 1); // the wall slows it to 1 m/s: the speed it came in with counts
  const first = q * 2 * C.dt;
  assert.ok(Math.abs(pose.pose.sigma - first) < 1e-15, `one contact: ${pose.pose.sigma} vs ${first}`);
  core.observe(sense({ forward: 0.25 }, true), 2); // still in contact, moving at 1 m/s
  const second = q * 1 * C.dt;
  const both = Math.hypot(first, second);
  assert.ok(Math.abs(pose.pose.sigma - both) < 1e-15, `two contacts: ${pose.pose.sigma} vs ${both}`);
});

// --- H1 pose: in working memory, frames, rooms -------------------------------------------------------------------------

test("every tick the pose is written to working memory as an inferred, frozen entry with its confidence", () => {
  const pose = new PoseModule(C, { contactNoise: 2 });
  const core = new MemoryCore([pose]);
  core.observe(sense({ forward: 0.5 }), 0);
  core.observe(sense({ forward: 0.5 }, true), 1);
  const e = core.working.read<Pose>(POSE_SLOT)!;
  assert.equal(e.value, pose.pose);
  assert.equal(e.stamp.tick, 1);
  assert.equal(e.stamp.source, "inferred");
  assert.equal(e.stamp.confidence, poseConfidence(pose.pose.sigma));
  assert.ok(e.stamp.confidence < 1, "the contact made it less sure");
  assert.ok(Object.isFrozen(e.value));
});

test("the pose is in the body's own frame; inRoom puts it where the room started the body", () => {
  const p: Pose = { x: 1, y: 2, heading: 0.5, side: 0, sigma: 0 };
  const moved = inRoom(p, { x: 5, y: 5, heading: 0 });
  assert.equal(moved.x, 6);
  assert.equal(moved.y, 7);
  assert.ok(Math.abs(moved.heading - 0.5) < 1e-15, `${moved.heading}`); // wrapping may round the last bit
  // A start facing +y: ahead-of-start becomes +y in the room.
  const turned = inRoom({ ...p, y: 0 }, { x: 1, y: 2, heading: Math.PI / 2 });
  assert.ok(Math.abs(turned.x - 1) < 1e-15, `x ${turned.x}`);
  assert.ok(Math.abs(turned.y - 3) < 1e-15, `y ${turned.y}`);
});

test("a new room starts from the body's origin again", () => {
  const pose = new PoseModule(C);
  const core = new MemoryCore([pose]);
  for (let t = 0; t < 20; t++) core.observe(sense({ forward: 0.5, turn: t % 2 }, t === 19), t);
  assert.notDeepEqual(pose.pose, { x: 0, y: 0, heading: 0, side: 0, sigma: 0 });
  core.reset();
  assert.deepEqual(pose.pose, { x: 0, y: 0, heading: 0, side: 0, sigma: 0 });
  assert.equal(core.working.read(POSE_SLOT), undefined);
});

test("the sideways speed counts too: a body sliding into a wall after a turn loses confidence for its whole speed", () => {
  const q = 2;
  const pose = new PoseModule(C, { contactNoise: q });
  const core = new MemoryCore([pose]);
  core.observe(sense({ forward: 0.5 }), 0); // 2 m/s ahead
  core.observe(sense({ forward: 0.5, turn: 1 }), 1); // the turn leaves a sideways speed
  const speed = Math.hypot(0.5 * C.maxSpeed, pose.pose.side);
  assert.ok(Math.abs(pose.pose.side) > 0.2, `sideways ${pose.pose.side} m/s`);
  core.observe(sense({}, true), 2);
  const expected = q * speed * C.dt;
  assert.ok(Math.abs(pose.pose.sigma - expected) < 1e-15, `σ ${pose.pose.sigma} vs ${expected}`);
});

test("nothing of the last room's motion carries over: no speed to slide with, no doubt to add to", () => {
  const q = 2;
  const pose = new PoseModule(C, { contactNoise: q });
  const core = new MemoryCore([pose]);
  core.observe(sense({ forward: 0.5 }), 0);
  core.observe(sense({ forward: 0.5 }, true), 1);
  core.reset();
  // A turn on the first tick of the new room: with no speed remembered, it leaves no sideways speed.
  core.observe(sense({ turn: 1 }), 0);
  assert.equal(pose.pose.side, 0);
  // The first contact of the new room: σ comes from this room alone.
  core.observe(sense({ forward: 0.5 }), 1);
  core.observe(sense({ forward: 0.5 }, true), 2);
  const one = q * 2 * C.dt;
  assert.ok(Math.abs(pose.pose.sigma - one) < 1e-15, `σ ${pose.pose.sigma} vs ${one}`);
});
