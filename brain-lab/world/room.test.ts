// brain-lab/world/room.test.ts — adversarial tests first: try to break the world
// before trusting it as the ground a brain will learn on.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CONFIG as C, makeConfig } from "./config.ts";
import { foodKeepouts, sampleFreePosition, type Entity } from "./entities.ts";
import { runEpisode } from "./episode.ts";
import { Rng } from "./rng.ts";
import { Room, type RoomState } from "./room.ts";
import type { Action } from "./world.ts";

const food = (x: number, y: number, i = 0): Entity => ({ id: `food-${i}`, kind: "food", x, y, r: C.foodRadius });
const threat = (x: number, y: number, i = 0): Entity => ({ id: `threat-${i}`, kind: "threat", x, y, r: C.threatRadius });
const CENTER = { x: C.width / 2, y: C.height / 2 };

/** A world with a hand-placed layout (no entities unless given), built through the snapshot path. */
function layout(over: { body?: Partial<RoomState["body"]>; entities?: Entity[] }): Room {
  const base = new Room(1).state();
  return Room.fromState({ ...base, body: { ...base.body, ...over.body }, entities: over.entities ?? [] });
}

function randomAction(rng: Rng): Action {
  return { thrust: rng.range(-1, 1), turn: rng.range(-1, 1) };
}

/** Runs `ticks` ticks across as many episodes as needed; returns one hash over every tick. */
function run(worldSeed: number, actionSeed: number, ticks: number): string {
  const actions = new Rng(actionSeed);
  let episode = 0;
  let room = new Room(worldSeed);
  let all = "";
  for (let t = 0; t < ticks; t++) {
    if (room.done) room = new Room(worldSeed + ++episode);
    room.step(randomAction(actions));
    all += room.hash();
  }
  return all;
}

function inBounds(room: Room): boolean {
  const { x, y } = room.state().body;
  const r = C.bodyRadius;
  return x >= r && x <= C.width - r && y >= r && y <= C.height - r;
}

/** A constructor-built world that has already eaten, so its random stream has moved past construction. */
function roomAfterFirstMeal(): { room: Room; rng: Rng } {
  for (let seed = 1; seed <= 200; seed++) {
    const room = new Room(seed);
    const rng = new Rng(seed + 500);
    for (let t = 0; t < 5000 && !room.done; t++) {
      if (room.step(randomAction(rng)).foodEaten > 0 && !room.done) {
        assert.notEqual(room.state().rngState, new Room(seed).state().rngState);
        return { room, rng };
      }
    }
  }
  throw new Error("no seed ever ate; random walk cannot reach food");
}

// --- structure ---------------------------------------------------------------

test("the one-way rule: nothing in world/ imports brain code, and the contract imports nothing", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
    const src = readFileSync(join(dir, f), "utf8");
    const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const i of imports) assert.match(i, /^\.\/[\w-]+\.ts$/, `${f} imports ${i} — world/ may only import its own files`);
    if (f === "world.ts") assert.deepEqual(imports, [], "the World contract must stay dependency-free");
  }
});

// --- config ------------------------------------------------------------------

test("config: invalid physics is rejected before a world can exist", () => {
  const bad = [
    { maxSpeed: 10 }, // maxSpeed·dt >= bodyRadius → tunnelling
    { drag: 20 }, // drag·dt >= 1 → velocity reverses
    { dt: 0 },
    { width: 0.5 },
    { foodCount: 1.5 },
    { basalEnergyCost: -1 },
    { foodGain: Number.NaN },
    { rayAngles: [0, Number.POSITIVE_INFINITY] },
  ];
  for (const b of bad) assert.throws(() => makeConfig(b), RangeError, JSON.stringify(b));
  assert.ok(Object.isFrozen(makeConfig()) && Object.isFrozen(makeConfig().rayAngles));
});

test("config: a room too crowded to place things fails loudly instead of hanging", () => {
  // A threat this big can only sit near the center, where the body is born: no legal place exists.
  assert.throws(() => new Room(1, { threatRadius: 4.5 }), /room too crowded/);
});

test("config: overrides shape the world, and the config is part of its identity", () => {
  const bare = new Room(1, { foodCount: 0, threatCount: 0 });
  assert.equal(bare.state().entities.length, 0);
  const busy = new Room(1, { foodCount: 5, threatCount: 3, threatRadius: 0.8 });
  const kinds = busy.state().entities.map((e) => e.kind);
  assert.equal(kinds.filter((k) => k === "food").length, 5);
  assert.equal(kinds.filter((k) => k === "threat").length, 3);
  assert.notEqual(new Room(1, { foodGain: 0.31 }).hash(), new Room(1).hash(), "config missing from hash");
  const wide = new Room(1, { rayAngles: [0, Math.PI / 2, Math.PI] });
  assert.equal(wide.observe().rays.length, 3);
});

// --- physics -----------------------------------------------------------------

test("tunnelling: full thrust into every wall and corner never leaves the room", () => {
  const headings = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, Math.PI / 4, (5 * Math.PI) / 4];
  for (const heading of headings) {
    const room = layout({ body: { heading } });
    for (let t = 0; t < 1000 && !room.done; t++) {
      room.step({ thrust: 1, turn: 0 });
      assert.ok(inBounds(room), `left the room at heading ${heading.toFixed(2)}, tick ${t}`);
    }
  }
});

test("tunnelling: random motor noise over 20 seeds never leaves the room", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const room = new Room(seed);
    const rng = new Rng(seed * 7919);
    for (let t = 0; t < 2000 && !room.done; t++) {
      room.step(randomAction(rng));
      assert.ok(inBounds(room), `seed ${seed} left the room at tick ${t}`);
    }
  }
});

test("motion follows the equations: thrust, drag and turning, on both axes", () => {
  // v ← (v + a·dt)(1 − drag·dt); x ← x + v·dt. Checked against a hand recurrence, per axis.
  const k = 1 - C.drag * C.dt;
  for (const [heading, axis] of [[0, "x"], [Math.PI / 2, "y"], [Math.PI, "x"]] as const) {
    const room = layout({ body: { heading } });
    const sign = heading === Math.PI ? -1 : 1;
    let v = 0;
    let p = axis === "x" ? CENTER.x : CENTER.y;
    for (let t = 0; t < 30; t++) {
      room.step({ thrust: 1, turn: 0 });
      v = (v + sign * C.maxAccel * C.dt) * k;
      p += v * C.dt;
      const b = room.state().body;
      const [bv, bp] = axis === "x" ? [b.vx, b.x] : [b.vy, b.y];
      assert.ok(Math.abs(bv - v) < 1e-12 && Math.abs(bp - p) < 1e-12, `heading ${heading} tick ${t}: v ${bv} vs ${v}`);
    }
  }
  const turner = layout({});
  for (let t = 0; t < 10; t++) turner.step({ thrust: 0, turn: 1 });
  assert.ok(Math.abs(turner.state().body.heading - C.maxTurnRate * C.dt * 10) < 1e-12);
  // Terminal speed under constant thrust stays below the cap: the cap is a safety net, not the physics.
  assert.ok((C.maxAccel * C.dt * k) / (1 - k) < C.maxSpeed);
});

test("proprioception: the body feels its own motion — still, forward, backward, turning", () => {
  const still = layout({});
  assert.deepEqual(still.step({ thrust: 0, turn: 0 }).observation.motion, { forward: 0, turn: 0 });

  const ahead = layout({ body: { heading: Math.PI / 2 } });
  for (let t = 0; t < 20; t++) ahead.step({ thrust: 1, turn: 0 });
  const m = ahead.observe().motion;
  const b = ahead.state().body;
  assert.ok(m.forward > 0.1, `forward ${m.forward}`);
  assert.ok(Math.abs(m.forward - Math.hypot(b.vx, b.vy) / C.maxSpeed) < 1e-12, "forward must be speed along the heading");

  const back = layout({});
  for (let t = 0; t < 20; t++) back.step({ thrust: -1, turn: 0 });
  assert.ok(back.observe().motion.forward < -0.1);

  const turning = layout({});
  assert.equal(turning.step({ thrust: 0, turn: 0.5 }).observation.motion.turn, 0.5);
  assert.equal(turning.step({ thrust: 0, turn: -1 }).observation.motion.turn, -1);

  const room = new Room(5);
  const rng = new Rng(5);
  for (let t = 0; t < 2000 && !room.done; t++) {
    const { forward, turn } = room.step({ thrust: rng.range(-1, 1), turn: rng.range(-1, 1) }).observation.motion;
    assert.ok(Math.abs(forward) <= 1 && Math.abs(turn) <= 1, `motion out of range at ${t}`);
  }
});

test("wall hit reports bump and impact speed, and the observation carries the bump", () => {
  const room = layout({ body: { x: C.width - C.bodyRadius - 0.05, heading: 0, vx: 3 } });
  const r = room.step({ thrust: 0, turn: 0 });
  assert.equal(r.bump, true);
  assert.ok(r.impactSpeed > 0);
  assert.equal(r.observation.bump, true);
  assert.equal(room.state().body.vx, 0);
});

// --- homeostasis -------------------------------------------------------------

test("energy ledger balances exactly every tick, and energy never exceeds 1", () => {
  for (let seed = 1; seed <= 10; seed++) {
    const room = new Room(seed);
    const rng = new Rng(seed + 1000);
    while (!room.done) {
      const before = room.state().body.energy;
      const r = room.step(randomAction(rng));
      const after = room.state().body.energy;
      const { basal, motor, food: gain } = r.energyLedger;
      if (!r.done) assert.equal(after, before - basal - motor + gain, `seed ${seed} ledger drift`);
      assert.ok(after <= 1 && after >= 0 && gain >= 0);
    }
  }
});

test("eating at full energy caps at 1, and eaten food respawns under the same id", () => {
  const room = layout({ body: { energy: 1 }, entities: [food(CENTER.x, CENTER.y)] });
  const r = room.step({ thrust: 0, turn: 0 });
  assert.equal(r.foodEaten, 1);
  assert.ok(room.state().body.energy <= 1);
  const [f] = room.state().entities;
  assert.equal(f!.id, "food-0");
  assert.notDeepEqual({ x: f!.x, y: f!.y }, CENTER);
});

test("standing still starves in the expected number of ticks", () => {
  const room = layout({});
  let ticks = 0;
  while (!room.done) { room.step({ thrust: 0, turn: 0 }); ticks++; }
  assert.equal(room.state().doneCause, "starved");
  assert.ok(Math.abs(ticks - 1 / C.basalEnergyCost) <= 1, `starved after ${ticks} ticks`);
});

test("threat: damages inside, not outside, stacks when overlapping, and kills", () => {
  const outside = layout({ entities: [threat(1.5, 1.5)] });
  assert.equal(outside.step({ thrust: 0, turn: 0 }).damage, 0);

  const two = layout({ entities: [threat(CENTER.x, CENTER.y, 0), threat(CENTER.x + 0.5, CENTER.y, 1)] });
  assert.equal(two.step({ thrust: 0, turn: 0 }).damage, 2 * C.threatDamage);

  const inside = layout({ entities: [threat(CENTER.x, CENTER.y)] });
  let ticks = 0;
  while (!inside.done) { inside.step({ thrust: 0, turn: 0 }); ticks++; }
  assert.equal(inside.state().doneCause, "killed");
  assert.ok(ticks <= Math.ceil(1 / C.threatDamage) + 1, `killed after ${ticks} ticks`);
});

test("food never spawns inside a wall, a threat, or the body (10 000 draws)", () => {
  const rng = new Rng(2026);
  const m = C.foodRadius;
  for (let i = 0; i < 10_000; i++) {
    const t = threat(rng.range(2, 8), rng.range(2, 8));
    const body = { x: rng.range(0.3, 9.7), y: rng.range(0.3, 9.7) };
    const p = sampleFreePosition(rng, C, m, foodKeepouts(C, body, [t]));
    assert.ok(p.x >= m && p.x <= C.width - m && p.y >= m && p.y <= C.height - m, "in wall");
    assert.ok(Math.hypot(p.x - t.x, p.y - t.y) > t.r + m, "in threat");
    assert.ok(Math.hypot(p.x - body.x, p.y - body.y) > C.bodyRadius + m, "on body");
  }
});

// --- determinism and replay -------------------------------------------------

test("determinism: same seeds give bit-identical worlds over 5000 ticks; other seeds differ", () => {
  const a = run(42, 7, 5000);
  assert.equal(run(42, 7, 5000), a);
  assert.notEqual(run(43, 7, 5000), a, "world seed has no effect");
  assert.notEqual(run(42, 8, 5000), a, "action stream has no effect");
});

test("snapshot round-trip: fromState(s).state() is exactly s, after the random stream has moved", () => {
  const s = roomAfterFirstMeal().room.state();
  assert.deepEqual(Room.fromState(s).state(), s);
  assert.deepEqual(Room.fromState(JSON.parse(JSON.stringify(s)) as RoomState).state(), s, "snapshot not JSON-safe");
});

test("snapshot replay carries the random stream: respawns after restore match a never-restored world", () => {
  // Ground truth is a world built by the constructor only, so a fromState bug cannot hide in both sides.
  const { room: original, rng } = roomAfterFirstMeal();
  const copy = Room.fromState(original.state());
  let respawns = 0;
  for (let t = 0; t < 20_000 && !original.done && respawns === 0; t++) {
    const a = randomAction(rng);
    respawns += original.step(a).foodEaten;
    copy.step(a);
    assert.equal(copy.hash(), original.hash(), `diverged at tick ${t}`);
  }
  assert.ok(respawns > 0 || original.done, "test never reached a respawn or episode end");
});

test("a non-default config survives the snapshot round-trip", () => {
  const room = new Room(4, { foodCount: 6, threatCount: 2, threatRadius: 0.9, rayAngles: [0] });
  const copy = Room.fromState(room.state());
  assert.equal(copy.hash(), room.hash());
  assert.equal(copy.observe().rays.length, 1);
});

// --- contract ----------------------------------------------------------------

test("invalid motor commands are rejected loudly and change nothing", () => {
  const room = new Room(3);
  const h = room.hash();
  const bad: Action[] = [
    { thrust: Number.NaN, turn: 0 },
    { thrust: 0, turn: Number.POSITIVE_INFINITY },
    { thrust: 1.0001, turn: 0 },
    { thrust: 0, turn: -2 },
    { thrust: "1" as unknown as number, turn: 0 },
  ];
  for (const a of bad) assert.throws(() => room.step(a), RangeError, JSON.stringify(a));
  assert.equal(room.hash(), h);
});

test("a finished episode refuses further steps", () => {
  const room = layout({ body: { energy: C.basalEnergyCost } });
  const r = room.step({ thrust: 0, turn: 0 });
  assert.equal(r.done, true);
  assert.equal(r.doneCause, "starved");
  assert.throws(() => room.step({ thrust: 0, turn: 0 }), /episode is over/);
});

test("snapshots and observations are copies: mutating them cannot reach the world", () => {
  const room = new Room(11);
  const h = room.hash();
  const s = room.state() as unknown as { body: { x: number }; entities: { x: number }[] };
  s.body.x = -50;
  s.entities[0]!.x = -50;
  const o = room.observe() as unknown as { rays: unknown[]; energy: number };
  o.rays.length = 0;
  o.energy = 0;
  assert.equal(room.hash(), h);
  assert.equal(room.observe().rays.length, C.rayAngles.length);
});

// --- senses ------------------------------------------------------------------

test("rays: distances match hand-computed geometry", () => {
  // Body at (6,5) facing +x. Rays at -60°, -30°, 0°, +30°, +60°.
  const cos30 = Math.cos(Math.PI / 6);
  const room = layout({
    body: { x: 6, y: 5, heading: 0 },
    entities: [food(8, 5), threat(6 + 3 * Math.cos(Math.PI / 3), 5 + 3 * Math.sin(Math.PI / 3))],
  });
  const [m60, m30, ahead, p30, p60] = room.observe().rays;
  assert.equal(ahead!.hit, "food");
  assert.ok(Math.abs(ahead!.distance - (2 - C.foodRadius)) < 1e-9);
  assert.equal(p30!.hit, "wall");
  assert.ok(Math.abs(p30!.distance - 4 / cos30) < 1e-9);
  assert.equal(m30!.hit, "wall");
  assert.ok(Math.abs(m30!.distance - 4 / cos30) < 1e-9);
  assert.equal(p60!.hit, "threat");
  assert.ok(Math.abs(p60!.distance - (3 - C.threatRadius)) < 1e-9);
  // -60°: y-wall at 5 / sin60 ≈ 5.77, x-wall at 4 / cos60 = 8 — both beyond range.
  assert.deepEqual(m60, { distance: C.rayRange, hit: "none" });
});

test("rays: beyond range is 'none', inside a threat reads distance 0", () => {
  const far = layout({ body: { x: 1, y: 5, heading: 0 } });
  assert.deepEqual(far.observe().rays[2], { distance: C.rayRange, hit: "none" });
  const inside = layout({ entities: [threat(CENTER.x, CENTER.y)] });
  for (const ray of inside.observe().rays) assert.deepEqual(ray, { distance: 0, hit: "threat" });
});

// --- episode loop ------------------------------------------------------------

test("runEpisode: drives any World, respects maxTicks, and its totals match its records", () => {
  const policy = (seed: number) => {
    const rng = new Rng(seed);
    return () => randomAction(rng);
  };
  const a = runEpisode(new Room(9), policy(1), 800, true);
  const b = runEpisode(new Room(9), policy(1), 800, true);
  assert.equal(a.finalHash, b.finalHash);
  assert.ok(a.ticks <= 800 && a.records.length === a.ticks);
  assert.equal(a.foodEaten, a.records.reduce((s, r) => s + r.result.foodEaten, 0));
  assert.equal(a.damage, a.records.reduce((s, r) => s + r.result.damage, 0));
  assert.equal(a.bumps, a.records.filter((r) => r.result.bump).length);
  assert.equal(runEpisode(new Room(9), policy(1), 800).records.length, 0, "records kept when not asked");

  const still = runEpisode(layout({}), () => ({ thrust: 0, turn: 0 }), 100_000);
  assert.equal(still.doneCause, "starved");
});
