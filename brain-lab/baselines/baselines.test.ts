// brain-lab/baselines/baselines.test.ts — the measuring sticks must measure honestly:
// same senses, same body, same reward as the brain; the learner learns what SARSA(λ) says it
// should, the untrained learner is the random policy, and the oracle really is a ceiling.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeMotor, sensorNodeIds } from "../sensorimotor/index.ts";
import { DEFAULT_CONFIG as C, Room, makeConfig, runEpisode, type Observation, type Ray } from "../world/index.ts";
import { LinearQ, MOTOR_COMMANDS, oracleAction, oraclePolicy, seekerPolicy } from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const HUNGRY = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
const none: Ray = { distance: C.rayRange, hit: "none" };
const obs = (over: Partial<Observation> = {}, foodRay: number | null = null): Observation => ({
  rays: C.rayAngles.map((_, i) => (i === foodRay ? { distance: 1, hit: "food" as const } : none)),
  bump: false, energy: 0.5, health: 1, motion: { forward: 0, turn: 0 }, ...over,
});
const col = (q: LinearQ, feature: string) => q.weights.map((w) => w[q.featureNames.indexOf(feature)]!);

test("dependencies: nothing below baselines imports it, and it does not use the brain's learning", () => {
  for (const dir of ["../world", "../sensorimotor", "../brain-ir", "../registry", "../neuromodulation", "../regions", "../development", "../learning"]) {
    for (const f of readdirSync(join(HERE, dir)).filter((n) => n.endsWith(".ts"))) {
      assert.doesNotMatch(readFileSync(join(HERE, dir, f), "utf8"), /baselines\//, `${dir}/${f} imports baselines`);
    }
  }
  for (const f of readdirSync(HERE).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
    assert.doesNotMatch(readFileSync(join(HERE, f), "utf8"), /learning\/|brain-ir\/|regions\/|development\//, `${f} leans on the brain`);
  }
});

test("same body: the 9 commands are exactly what the brain's 4 binary motors can produce", () => {
  const fromMotors = new Set<string>();
  for (let m = 0; m < 16; m++) {
    const a = decodeMotor({ "motor.forward": m & 1, "motor.back": (m >> 1) & 1, "motor.left": (m >> 2) & 1, "motor.right": (m >> 3) & 1 });
    fromMotors.add(`${a.thrust},${a.turn}`);
  }
  assert.deepEqual(new Set(MOTOR_COMMANDS.map((a) => `${a.thrust},${a.turn}`)), fromMotors);
  assert.equal(MOTOR_COMMANDS.length, 9);
});

test("same senses: features are the brain's sensor nodes plus a bias, nothing else", () => {
  const q = new LinearQ(C, 1);
  assert.deepEqual(q.featureNames, [...sensorNodeIds(C), "bias"]);
  const x = q.features(obs({ energy: 0.3 }, 3));
  assert.equal(x[q.featureNames.indexOf("ray3.food")], 1 - 1 / C.rayRange);
  assert.equal(x[q.featureNames.indexOf("intero.hunger")], 1 - 0.3);
  assert.equal(x[q.featureNames.indexOf("bias")], 1);
});

test("bad parameters and wrong-shaped weights are refused", () => {
  for (const p of [{ alpha: -1 }, { gamma: 1.5 }, { lambda: -0.1 }, { epsilon: 2 }, { deathOutcome: Number.NaN }]) {
    assert.throws(() => new LinearQ(C, 1, p), RangeError, JSON.stringify(p));
  }
  assert.throws(() => new LinearQ(C, 1, {}, [[0]]), RangeError);
});

test("an untrained learner is the random policy: all 9 commands, about equally often", () => {
  const q = new LinearQ(C, 7, { epsilon: 0 });
  const counts = new Array<number>(9).fill(0);
  const x = q.features(obs());
  for (let i = 0; i < 9000; i++) counts[q.choose(x)]!++;
  for (const c of counts) assert.ok(c > 850 && c < 1150, `counts ${counts}`);
});

test("a meal after an action raises that action's value in that state — and only that action's", () => {
  const q = new LinearQ(C, 3, { epsilon: 0, alpha: 0.5 });
  q.startEpisode();
  const before = obs({ energy: 0.4 }, 2);
  const a = MOTOR_COMMANDS.indexOf(q.policy(before, 0));
  q.policy(obs({ energy: 0.7 }), 1); // ate: drive fell
  const food = col(q, "ray2.food");
  assert.ok(food[a]! > 0, "chosen action gained value");
  food.forEach((w, i) => { if (i !== a) assert.equal(w, 0, `action ${i} untouched`); });
});

test("a cost after an action lowers its value; frozen learners never change", () => {
  const q = new LinearQ(C, 3, { epsilon: 0, alpha: 0.5 });
  q.startEpisode();
  const a = MOTOR_COMMANDS.indexOf(q.policy(obs({ energy: 0.5 }), 0));
  q.policy(obs({ energy: 0.4 }), 1);
  assert.ok(col(q, "bias")[a]! < 0);
  const f = new LinearQ(C, 3, { frozen: true });
  runEpisode(new Room(1, HUNGRY), f.policy, 500, false, f.hooks);
  assert.ok(f.weights.every((w) => w.every((v) => v === 0)));
});

test("eligibility: a meal two ticks later credits the earlier sight only when λ > 0", () => {
  const run = (lambda: number) => {
    const q = new LinearQ(C, 5, { epsilon: 0, alpha: 0.5, lambda });
    q.startEpisode();
    q.policy(obs({ energy: 0.4 }, 0), 0); // food seen on ray 0
    q.policy(obs({ energy: 0.4 }), 1);    // nothing happens
    q.policy(obs({ energy: 0.7 }), 2);    // meal
    return col(q, "ray0.food").reduce((s, w) => s + w, 0);
  };
  assert.equal(run(0), 0);
  assert.ok(run(0.9) > 0);
});

test("bootstrapping: moving into a state that looks valuable raises the last action's value, even with no reward", () => {
  const F = new LinearQ(C, 1).featureNames;
  const hopeful = MOTOR_COMMANDS.map(() => F.map((f) => (f === "ray4.food" ? 1 : 0)));
  const q = new LinearQ(C, 2, { epsilon: 0, alpha: 0.5 }, hopeful);
  q.startEpisode();
  const a = MOTOR_COMMANDS.indexOf(q.policy(obs({ energy: 0.5 }), 0));
  q.policy(obs({ energy: 0.5 }, 4), 1); // same drive, but food in sight
  assert.ok(col(q, "bias")[a]! > 0);
});

test("eligibility does not carry over into the next life", () => {
  const q = new LinearQ(C, 5, { epsilon: 0, alpha: 0.5, lambda: 1 });
  q.startEpisode();
  q.policy(obs({ energy: 0.4 }, 1), 0); // seen at the end of one life
  q.startEpisode();
  q.policy(obs({ energy: 0.4 }), 0);
  q.policy(obs({ energy: 0.7 }), 1);    // meal in the next life
  assert.deepEqual(col(q, "ray1.food"), new Array(9).fill(0));
});

test("death is terminal and bad: the last action loses value; no death, no update", () => {
  const q = new LinearQ(C, 9, { epsilon: 0, alpha: 0.5 });
  q.startEpisode();
  const a = MOTOR_COMMANDS.indexOf(q.policy(obs({ energy: 0.1 }), 0));
  q.hooks.onDeath!(obs({ energy: 0.1 }), "starved", 1);
  assert.ok(col(q, "bias")[a]! < 0);
  const fresh = new LinearQ(C, 9);
  fresh.startEpisode();
  fresh.hooks.onDeath!(obs(), "starved", 0); // died before acting: nothing to blame
  assert.ok(fresh.weights.every((w) => w.every((v) => v === 0)));
});

test("determinism: same seeds → same world hash and same weights; a snapshot restores the values", () => {
  const live = (seed: number) => {
    const q = new LinearQ(HUNGRY, seed);
    const hashes: string[] = [];
    for (let ep = 1; ep <= 3; ep++) { q.startEpisode(); hashes.push(runEpisode(new Room(ep, HUNGRY), q.policy, 800, false, q.hooks).finalHash); }
    return { q, hashes };
  };
  const a = live(11), b = live(11), c = live(12);
  assert.deepEqual(a.hashes, b.hashes);
  assert.deepEqual(a.q.snapshot(), b.q.snapshot());
  assert.notDeepEqual(a.q.snapshot(), c.q.snapshot());
  assert.ok(a.q.snapshot().flat().some((v) => v !== 0) && a.q.snapshot().flat().every(Number.isFinite));
  const restored = new LinearQ(HUNGRY, 1, { frozen: true }, a.q.snapshot());
  const x = restored.features(obs({}, 2));
  for (let k = 0; k < 9; k++) assert.equal(restored.q(x, k), a.q.q(x, k));
});

test("oracle steers to the nearest food's side, turns from close walls, and is a real ceiling", () => {
  assert.deepEqual(oracleAction(obs({}, 4), C), { thrust: 1, turn: 1 });
  assert.deepEqual(oracleAction(obs({}, 0), C), { thrust: 1, turn: -1 });
  assert.deepEqual(oracleAction(obs({}, 2), C), { thrust: 1, turn: 0 });
  const wall = obs();
  const blocked: Observation = { ...wall, rays: wall.rays.map((r, i) => (i === 2 ? { distance: 0.5, hit: "wall" as const } : r)) };
  assert.deepEqual(oracleAction(blocked, C), { thrust: 0, turn: 1 });
  let oracle = 0, random = 0;
  for (let s = 1; s <= 3; s++) {
    oracle += runEpisode(new Room(s, HUNGRY), oraclePolicy(HUNGRY), 3000).foodEaten;
    const q = new LinearQ(HUNGRY, s, { frozen: true });
    random += runEpisode(new Room(s, HUNGRY), q.policy, 3000).foodEaten;
  }
  assert.ok(oracle > 2 * random, `oracle ${oracle} vs random ${random}`);
});

test("seeker: steers like the oracle whenever food is in sight", () => {
  const seek = seekerPolicy(C, 3);
  for (const ray of [0, 2, 4]) assert.deepEqual(seek(obs({}, ray), 0), oracleAction(obs({}, ray), C), `food on ray ${ray}`);
});

test("seeker: without food it holds each random command for 10 ticks", () => {
  const seek = seekerPolicy(C, 3);
  const cmds = Array.from({ length: 30 }, (_, t) => JSON.stringify(seek(obs(), t)));
  for (let block = 0; block < 3; block++) assert.equal(new Set(cmds.slice(block * 10, block * 10 + 10)).size, 1, `block ${block}`);
});

test("seeker: same seed, same wandering; a different seed wanders differently", () => {
  const walk = (seed: number) => { const s = seekerPolicy(C, seed); return Array.from({ length: 200 }, (_, t) => JSON.stringify(s(obs(), t))).join(); };
  assert.equal(walk(4), walk(4));
  assert.notEqual(walk(4), walk(5));
});
