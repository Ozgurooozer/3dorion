// brain-lab/neuromodulation/dopamine.test.ts — the teaching signal must show the known
// signatures of dopamine before anything is allowed to learn from it. Reward is homeostatic:
// r = D(before) − D(after), D = hunger² + injury² (Keramati & Gutkin 2014).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BrainSimulator } from "../brain-ir/simulator.ts";
import { brainController, sensorimotorScaffold } from "../sensorimotor/index.ts";
import { DEFAULT_CONFIG as C, Rng, Room, runEpisode, type Observation, type Policy, type RoomState } from "../world/index.ts";
import { DopamineChannel, RunningMeanPredictor, drive, outcomeOf, outcomeParts, withDopamine } from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const CENTER = { x: C.width / 2, y: C.height / 2 };
const BASAL = C.basalEnergyCost;

const body = (energy: number, health = 1): Observation => ({ rays: [], bump: false, energy, health, motion: { forward: 0, turn: 0 } });

/** Feeds (energy, health) body states as ticks 0..n-1; returns the signals. */
function feed(ch: DopamineChannel, states: [number, number][]) {
  return states.map(([e, h], i) => ch.observe(body(e, h), i));
}

function roomWith(entities: RoomState["entities"], energy: number): Room {
  const base = new Room(1).state();
  return Room.fromState({ ...base, body: { ...base.body, energy }, entities });
}

const still: Policy = () => ({ thrust: 0, turn: 0 });

// --- structure ---------------------------------------------------------------

test("honesty: the channel reads only observations — no world internals, no brain internals", () => {
  for (const f of readdirSync(HERE).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
    const imports = [...readFileSync(join(HERE, f), "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const i of imports) assert.match(i, /^(\.\/[\w-]+\.ts|\.\.\/world\/index\.ts)$/, `${f} imports ${i}`);
  }
  for (const dir of ["../world", "../sensorimotor", "../brain-ir"]) {
    for (const f of readdirSync(join(HERE, dir)).filter((n) => n.endsWith(".ts"))) {
      assert.doesNotMatch(readFileSync(join(HERE, dir, f), "utf8"), /neuromodulation/, `${dir}/${f} imports neuromodulation`);
    }
  }
});

// --- the homeostatic outcome ---------------------------------------------------

test("drive and reward: zero at the setpoint, reward = drive before − drive after, non-finite refused", () => {
  assert.equal(drive(body(1, 1)), 0);
  assert.ok(Math.abs(drive(body(0.4, 0.9)) - (0.36 + 0.01)) < 1e-12);
  assert.ok(Math.abs(drive(body(0.4, 0.9), { healthWeight: 3 }) - (0.36 + 0.03)) < 1e-12);
  assert.ok(Math.abs(outcomeOf(body(0.4), body(0.7)) - (0.36 - 0.09)) < 1e-12);
  assert.throws(() => outcomeOf(body(0.5), body(Number.NaN)), RangeError);
  assert.throws(() => new RunningMeanPredictor(0), RangeError);
  assert.throws(() => new RunningMeanPredictor(1.5), RangeError);
});

test("far from the setpoint every change matters more: a meal when starving, a wound on top of wounds", () => {
  const meal = 0.3;
  const hungry = outcomeOf(body(0.2), body(0.2 + meal));
  const full = outcomeOf(body(0.6), body(0.6 + meal));
  assert.ok(hungry > 2 * full, `hungry ${hungry} vs full ${full}`);
  const firstWound = outcomeOf(body(1, 1), body(1, 0.99));
  const laterWound = outcomeOf(body(1, 0.5), body(1, 0.49));
  assert.ok(firstWound < 0 && laterWound < 10 * firstWound, `first ${firstWound}, later ${laterWound}`);
  assert.ok(Math.abs(outcomeOf(body(1), body(1 - BASAL))) < 1e-6, "a fed body barely feels its metabolism");
});

test("prediction is taken before learning: the surprise is against the old belief", () => {
  const ch = new DopamineChannel({ predictor: new RunningMeanPredictor(0.5) });
  const [, s1, s2] = feed(ch, [[0.3, 1], [0.5, 1], [0.7, 1]]);
  const r1 = outcomeOf(body(0.3), body(0.5));
  assert.equal(s1!.prediction, 0);
  assert.ok(Math.abs(s1!.delta - r1) < 1e-12);
  assert.ok(Math.abs(s2!.prediction - 0.5 * r1) < 1e-12, "second prediction must reflect one learning step");
});

// --- signatures of dopamine (bodies kept hungry so changes are felt) -----------

test("habituation: a hungry body at rest learns its own metabolism and |δ| fades", () => {
  const ch = new DopamineChannel({ keepHistory: true });
  runEpisode(roomWith([], 0.5), withDopamine(still, ch), 400);
  const h = ch.history;
  assert.equal(h[0]!.delta, 0, "tick 0 has no previous state, so no signal");
  assert.ok(h[1]!.delta < 0, "the first felt tick of hunger is a surprise");
  assert.ok(Math.abs(h.at(-1)!.delta) < Math.abs(h[1]!.delta) * 0.1, `still surprised at rest: ${h.at(-1)!.delta} vs ${h[1]!.delta}`);
});

test("surprise reward: the first meal after habituation gives a large positive δ", () => {
  const ch = new DopamineChannel({ keepHistory: true });
  const room = roomWith([], 0.5);
  runEpisode(room, withDopamine(still, ch), 300);
  const s = room.state();
  const fed = Room.fromState({ ...s, entities: [{ id: "food-0", kind: "food", x: s.body.x, y: s.body.y, r: C.foodRadius }] });
  const t0 = ch.history.length;
  ch.observe(fed.observe(), t0);
  const before = fed.observe();
  const r = fed.step(still(before, 0));
  const sig = ch.observe(r.observation, t0 + 1);
  assert.equal(r.foodEaten, 1);
  assert.ok(Math.abs(sig.outcome - outcomeOf(before, r.observation)) < 1e-12);
  assert.ok(sig.delta > 0.25, `meal δ ${sig.delta}`);
});

test("known limit: a stateless expectation cannot anticipate a regular meal (its surprise does not shrink)", () => {
  // Retracts an earlier claim (LAB-DEFTERI 2026-09-23): the "shrinking meal surprise" seen before
  // came from the body filling up (satiety), not from anticipation. With a balanced schedule the
  // surprise stays put. Anticipation needs state-dependent prediction (design §6, second version).
  const ch = new DopamineChannel();
  const states: [number, number][] = [];
  let e = 0.5;
  for (let t = 0; t < 400; t++) {
    e += t > 0 && t % 5 === 0 ? 0.05 : -0.0125; // eat every 5th tick, lose the same in between: energy cycles 0.44–0.5
    states.push([e, 1]);
  }
  const meals = feed(ch, states).filter((s) => s.tick > 0 && s.tick % 5 === 0);
  const first = meals[0]!.delta;
  const last = meals.at(-1)!.delta;
  assert.ok(first > 0 && Math.abs(last - first) < 0.05 * first, `meal δ first ${first}, last ${last}`);
});

test("pain: standing in the threat is felt at once, and gets worse the longer it lasts (convex drive)", () => {
  const ch = new DopamineChannel({ keepHistory: true });
  const hurtRoom = roomWith([{ id: "threat-0", kind: "threat", ...CENTER, r: C.threatRadius }], 0.8);
  let obs = hurtRoom.observe();
  ch.observe(obs, 0);
  const signals = [];
  for (let t = 1; t < 80; t++) {
    obs = hurtRoom.step(still(obs, t)).observation;
    signals.push(ch.observe(obs, t));
  }
  assert.ok(signals[0]!.delta < 0, `first pain δ ${signals[0]!.delta}`);
  assert.ok(signals.at(-1)!.outcome < 5 * signals[0]!.outcome, "a wound on top of wounds must hurt more");
});

test("relief rebound: after the body expects pain, pain stopping gives positive δ", () => {
  const ch = new DopamineChannel();
  const states: [number, number][] = [];
  let e = 0.6;
  let h = 1;
  for (let i = 0; i < 200; i++) { e -= BASAL; states.push([e, h]); }
  for (let i = 0; i < 80; i++) { e -= BASAL; h -= C.threatDamage; states.push([e, h]); }
  for (let i = 0; i < 5; i++) { e -= BASAL; states.push([e, h]); }
  const relief = feed(ch, states)[281]!;
  assert.ok(relief.delta > 0.001, `relief δ ${relief.delta}`);
});

// --- death ---------------------------------------------------------------------

test("death: a strongly negative signal, delivered once, that does not move the everyday expectation", () => {
  const ch = new DopamineChannel({ keepHistory: true });
  const ep = runEpisode(roomWith([], 0.05), withDopamine(still, ch), 100_000, false, ch.hooks());
  assert.equal(ep.doneCause, "starved");
  const deaths = ch.history.filter((s) => s.terminal);
  assert.equal(deaths.length, 1);
  const d = deaths[0]!;
  assert.equal(d.terminal, "starved");
  assert.ok(d.delta < -0.9, `death δ ${d.delta}`);
  const before = ch.history.at(-2)!;
  assert.ok(Math.abs(d.prediction - (before.prediction + 0.05 * (before.outcome - before.prediction))) < 1e-12);
  const after = ch.observe(body(1), 0);
  assert.ok(Math.abs(after.prediction - d.prediction) < 1e-12, "death leaked into the expectation");
  assert.equal(after.delta, 0);
});

test("death hook: not called when an episode stops alive at maxTicks, called once when the body dies", () => {
  let calls = 0;
  const hooks = { onDeath: () => { calls++; } };
  runEpisode(roomWith([], 1), still, 50, false, hooks);
  assert.equal(calls, 0);
  runEpisode(roomWith([], 0.002), still, 100, false, hooks);
  assert.equal(calls, 1);
});

// --- non-interference and determinism ---------------------------------------

test("non-interference: the wrapped policy acts identically and leaves the world bit-identical", () => {
  const make = () => {
    const rng = new Rng(77);
    return (() => ({ thrust: rng.range(-1, 1), turn: rng.range(-1, 1) })) as Policy;
  };
  const plain = runEpisode(new Room(12), make(), 1500);
  const wrapped = runEpisode(new Room(12), withDopamine(make(), new DopamineChannel()), 1500);
  assert.equal(wrapped.finalHash, plain.finalHash);
  assert.equal(wrapped.ticks, plain.ticks);
});

test("determinism: a real brain in a real world gives a bit-identical δ series", () => {
  const once = () => {
    const ch = new DopamineChannel({ keepHistory: true });
    runEpisode(new Room(3, { initialEnergy: 0.4 }), withDopamine(brainController(new BrainSimulator(sensorimotorScaffold(C)), C).policy, ch), 800);
    return JSON.stringify(ch.history);
  };
  assert.equal(once(), once());
});

test("episodes: tick 0 never compares against the previous episode's body", () => {
  const ch = new DopamineChannel();
  feed(ch, Array.from({ length: 50 }, (_, i) => [0.2 - i * BASAL, 1] as [number, number]));
  const fresh = ch.observe(body(1), 0); // new episode, full energy: not a huge "reward"
  assert.equal(fresh.delta, 0);
  assert.equal(ch.modulators().dopamine, 0);
});

test("tonic level: each signal carries the current drive, and the channel reports it", () => {
  const ch = new DopamineChannel();
  const [s0, s1] = feed(ch, [[0.4, 0.9], [0.5, 0.9]]);
  assert.ok(Math.abs(s0!.drive - drive(body(0.4, 0.9))) < 1e-12);
  assert.ok(Math.abs(s1!.drive - drive(body(0.5, 0.9))) < 1e-12);
  assert.equal(ch.modulators().tonic, s1!.drive);
});

// --- outcome split by valence (reward / punishment channels) ----------------------------

test("outcomeParts: eating is relief only", () => {
  const { relief, cost } = outcomeParts(body(0.4), body(0.7));
  assert.ok(relief > 0, `relief ${relief}`);
  assert.equal(cost, 0);
});

test("outcomeParts: spending energy is cost only", () => {
  const { relief, cost } = outcomeParts(body(0.5), body(0.49));
  assert.equal(relief, 0);
  assert.ok(cost < 0, `cost ${cost}`);
});

test("outcomeParts: eating while being hurt gives both signals, not one net number", () => {
  const { relief, cost } = outcomeParts(body(0.4, 0.9), body(0.7, 0.8));
  assert.ok(relief > 0, `relief ${relief}`);
  assert.ok(cost < 0, `cost ${cost}`);
});

test("outcomeParts: on every pair of body states, relief ≥ 0, cost ≤ 0 and relief + cost = outcomeOf", () => {
  // outcomeOf subtracts two drives; outcomeParts subtracts term by term. Same four squares, added in
  // a different order, so the last bit can differ: measured on this grid, at most one ε. Values are
  // at most 2 in size, so one rounding step is at most 2ε.
  const ROUNDING = 2 * Number.EPSILON;
  const levels = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
  for (const e0 of levels) for (const h0 of levels) for (const e1 of levels) for (const h1 of levels) {
    const before = body(e0, h0), after = body(e1, h1);
    const where = `energy ${e0}→${e1}, health ${h0}→${h1}`;
    const { relief, cost } = outcomeParts(before, after);
    assert.ok(relief >= 0, `relief ${relief} at ${where}`);
    assert.ok(cost <= 0, `cost ${cost} at ${where}`);
    const gap = Math.abs(relief + cost - outcomeOf(before, after));
    assert.ok(gap <= ROUNDING, `relief + cost is off by ${gap} at ${where}`);
  }
});

test("outcomeParts: a non-finite body is refused", () => {
  assert.throws(() => outcomeParts(body(0.5), body(Number.NaN)), RangeError);
});
