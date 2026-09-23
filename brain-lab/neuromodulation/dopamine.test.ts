// brain-lab/neuromodulation/dopamine.test.ts — the teaching signal must show the known
// signatures of dopamine before anything is allowed to learn from it.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BrainSimulator } from "../brain-ir/simulator.ts";
import { brainController, sensorimotorScaffold } from "../sensorimotor/index.ts";
import { DEFAULT_CONFIG as C, Rng, Room, runEpisode, type Observation, type Policy, type RoomState } from "../world/index.ts";
import { DopamineChannel, RunningMeanPredictor, outcomeOf, withDopamine } from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const CENTER = { x: C.width / 2, y: C.height / 2 };
const BASAL = -C.basalEnergyCost;
/** Signature tests isolate the predictor: hunger scaling off (tested on its own below). */
const PURE = { weights: { hungerGain: 0 } } as const;

const body = (energy: number, health = 1): Observation => ({ rays: [], bump: false, energy, health, motion: { forward: 0, turn: 0 } });

/** Feeds a sequence of (energy, health) body states as ticks 0..n-1; returns the signals. */
function feed(ch: DopamineChannel, states: [number, number][], startTick = 0) {
  return states.map(([e, h], i) => ch.observe(body(e, h), startTick + i));
}

/** n ticks of standing still from energy e0: energy falls by the basal cost each tick. */
const rest = (e0: number, n: number, h = 1): [number, number][] => Array.from({ length: n }, (_, i) => [e0 + BASAL * i, h]);

function roomWith(entities: RoomState["entities"], energy = 1): Room {
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

test("outcome: energy and health change, weighted; non-finite input is refused", () => {
  assert.equal(outcomeOf(body(0.5, 1), body(0.8, 1), { healthWeight: 1, hungerGain: 0 }), 0.8 - 0.5);
  assert.equal(outcomeOf(body(0.5, 1), body(0.8, 1)), (0.8 - 0.5) * (1 + 0.5), "default: energy scaled by hunger");
  assert.equal(outcomeOf(body(0.5, 1), body(0.5, 0.9), { healthWeight: 2, hungerGain: 1 }), 2 * (0.9 - 1));
  assert.throws(() => outcomeOf(body(0.5), body(Number.NaN)), RangeError);
  assert.throws(() => new RunningMeanPredictor(0), RangeError);
  assert.throws(() => new RunningMeanPredictor(1.5), RangeError);
});

test("prediction is taken before learning: the surprise is against the old belief", () => {
  const ch = new DopamineChannel({ ...PURE, predictor: new RunningMeanPredictor(0.5) });
  const [, s1, s2] = feed(ch, [[0.5, 1], [0.7, 1], [0.9, 1]]);
  assert.equal(s1!.prediction, 0);
  assert.ok(Math.abs(s1!.delta - 0.2) < 1e-12);
  assert.ok(Math.abs(s2!.prediction - 0.1) < 1e-12, "second prediction must reflect one learning step");
});

// --- signatures of dopamine --------------------------------------------------

test("habituation: a body at rest learns its own metabolism and |δ| fades to ~0", () => {
  const ch = new DopamineChannel({ ...PURE, keepHistory: true });
  runEpisode(roomWith([]), withDopamine(still, ch), 400);
  const h = ch.history;
  assert.ok(Math.abs(h[1]!.delta - BASAL) < 1e-12, "first felt tick is a full surprise");
  assert.ok(Math.abs(h.at(-1)!.delta) < 1e-6, `still surprised at rest: ${h.at(-1)!.delta}`);
  assert.equal(h[0]!.delta, 0, "tick 0 has no previous state, so no signal");
});

test("surprise reward: the first meal after habituation gives a large positive δ", () => {
  const ch = new DopamineChannel({ ...PURE, keepHistory: true });
  const room = roomWith([], 0.5); // hungry enough that +foodGain is not capped at 1
  runEpisode(room, withDopamine(still, ch), 300);
  // Place food on the body and let the same channel feel it.
  const s = room.state();
  const fed = Room.fromState({ ...s, entities: [{ id: "food-0", kind: "food", x: s.body.x, y: s.body.y, r: C.foodRadius }] });
  const tick0 = ch.history.length;
  const policy = withDopamine(still, ch);
  policy(fed.observe(), tick0);
  const r = fed.step(still(fed.observe(), 0));
  const sig = ch.observe(r.observation, tick0 + 1);
  assert.equal(r.foodEaten, 1);
  assert.ok(Math.abs(sig.delta - (C.foodGain + BASAL - sig.prediction)) < 1e-9);
  assert.ok(sig.delta > 0.29, `meal δ ${sig.delta}`);
});

test("expected reward surprises less: regular meals shrink δ, and missing one dips it below zero", () => {
  const ch = new DopamineChannel(PURE);
  const states: [number, number][] = [];
  let e = 0.5;
  for (let t = 0; t < 400; t++) {
    e += t > 0 && t % 5 === 0 ? 0.05 : 0;
    states.push([e, 1]);
  }
  const sig = feed(ch, states);
  const meals = sig.filter((s) => s.tick > 0 && s.tick % 5 === 0);
  assert.ok(meals.at(-1)!.delta < meals[0]!.delta * 0.9, `last meal δ ${meals.at(-1)!.delta} vs first ${meals[0]!.delta}`);
  // A tick with no meal is now worse than expected: negative δ (the expectation has risen).
  assert.ok(sig.at(-1)!.tick % 5 !== 0 && sig.at(-1)!.delta < 0);
});

test("pain habituation: standing in the threat, δ starts clearly negative and fades", () => {
  const ch = new DopamineChannel({ ...PURE, keepHistory: true });
  runEpisode(roomWith([]), withDopamine(still, ch), 300);
  const hurtRoom = roomWith([{ id: "threat-0", kind: "threat", ...CENTER, r: C.threatRadius }], 0.8);
  const signals = [];
  let obs = hurtRoom.observe();
  ch.observe(obs, 0); // a new room is a new episode: tick 0, nothing to compare against
  for (let t = 1; t < 90; t++) {
    const r = hurtRoom.step(still(obs, t));
    obs = r.observation;
    signals.push(ch.observe(obs, t));
  }
  assert.ok(signals[0]!.delta < -0.009, `first pain δ ${signals[0]!.delta}`);
  assert.ok(Math.abs(signals.at(-1)!.delta) < Math.abs(signals[0]!.delta) * 0.1, "pain never became expected");
});

test("relief rebound: after the body expects pain, pain stopping gives positive δ", () => {
  const ch = new DopamineChannel(PURE);
  // 200 ticks at rest, 80 ticks losing health, then health stops falling.
  const states: [number, number][] = [...rest(1, 200)];
  let e = states.at(-1)![0];
  let h = 1;
  for (let i = 0; i < 80; i++) { e += BASAL; h -= C.threatDamage; states.push([e, h]); }
  for (let i = 0; i < 5; i++) { e += BASAL; states.push([e, h]); }
  const sig = feed(ch, states);
  const relief = sig[281]!;
  assert.ok(relief.delta > 0.005, `relief δ ${relief.delta}`);
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
    const g = { ...sensorimotorScaffold(C), connections: [{ from: "ray2.food", to: "motor.forward", weight: 1 }] };
    const ch = new DopamineChannel({ ...PURE, keepHistory: true });
    runEpisode(new Room(3), withDopamine(brainController(new BrainSimulator(g), C).policy, ch), 800);
    return JSON.stringify(ch.history);
  };
  assert.equal(once(), once());
});

test("episodes: tick 0 never compares against the previous episode's body", () => {
  const ch = new DopamineChannel();
  feed(ch, rest(0.2, 50));
  const fresh = ch.observe(body(1), 0); // new episode, full energy: not a +0.8 "reward"
  assert.equal(fresh.delta, 0);
  assert.equal(ch.modulators().dopamine, 0);
});

// --- hunger and death ------------------------------------------------------------

test("hunger: the same meal is worth more to a hungry body", () => {
  const meal = 0.3;
  const hungry = outcomeOf(body(0.2), body(0.2 + meal));
  const full = outcomeOf(body(0.6), body(0.6 + meal));
  assert.ok(hungry > full, `hungry ${hungry} vs full ${full}`);
  assert.ok(Math.abs(hungry - meal * (1 + 0.8)) < 1e-12 && Math.abs(full - meal * (1 + 0.4)) < 1e-12);
  assert.ok(Math.abs(outcomeOf(body(1), body(0.99)) - (0.99 - 1)) < 1e-15, "at full energy the scale is 1");
  const off = { healthWeight: 1, hungerGain: 0 };
  assert.ok(Math.abs(outcomeOf(body(0.2), body(0.5), off) - outcomeOf(body(0.6), body(0.9), off)) < 1e-12, "hungerGain 0 turns scaling off");
});

test("death: a strongly negative signal, delivered once, that does not move the everyday expectation", () => {
  const ch = new DopamineChannel({ keepHistory: true });
  const room = roomWith([], 0.05);
  const ep = runEpisode(room, withDopamine(still, ch), 100_000, false, ch.hooks());
  assert.equal(ep.doneCause, "starved");
  const deaths = ch.history.filter((s) => s.terminal);
  assert.equal(deaths.length, 1);
  const d = deaths[0]!;
  assert.equal(d.terminal, "starved");
  assert.ok(d.delta < -0.9, `death δ ${d.delta}`);
  const before = ch.history.at(-2)!;
  assert.ok(Math.abs(d.prediction - (before.prediction + 0.05 * (before.outcome - before.prediction))) < 1e-12,
    "the death signal must be judged against the expectation, which death itself does not update");
  const after = ch.observe(body(1), 0);
  assert.ok(Math.abs(after.prediction - d.prediction) < 1e-12, "death leaked into the expectation");
  assert.equal(after.delta, 0);
});

test("death hook: not called when an episode stops alive at maxTicks, called once when the body dies", () => {
  let calls = 0;
  const hooks = { onDeath: () => { calls++; } };
  runEpisode(roomWith([]), still, 50, false, hooks);
  assert.equal(calls, 0);
  runEpisode(roomWith([], 0.002), still, 100, false, hooks);
  assert.equal(calls, 1);
});
