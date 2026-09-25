// brain-lab/learning/cue-memory.test.ts — the cue memory (TASARIM-006) must credit what was seen shortly
// before an outcome and nothing else, its effect on teaching must be the change of that value, and every
// change must be on the record. Every case starts from a fresh ledger and a fresh memory.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { bornGraph } from "../development/index.ts";
import { Ledger } from "../registry/index.ts";
import { DEFAULT_CONFIG as C, Room, makeConfig, runEpisode, type Observation, type Ray } from "../world/index.ts";
import { CUE_PREFIX, CueMemory, DEFAULT_CUE, type CueParams } from "./cue-memory.ts";
import { createAgent, type AgentSpec } from "./index.ts";

const NOTHING: Ray = { distance: C.rayRange, hit: "none" };

/** A body seeing `hit` on `ray` at `distance` (nothing on the other rays). */
function seeing(ray: number | null, hit: Ray["hit"] = "food", distance = 1): Observation {
  return {
    rays: C.rayAngles.map((_, i) => (i === ray ? { distance, hit } : NOTHING)),
    bump: false, energy: 0.5, health: 1, motion: { forward: 0, turn: 0 },
  };
}
const BLIND = seeing(null);

// A small quantum so single steps are visible; everything else as designed.
// The rule's tests feed outcomes by hand, so they learn from the outcome as given ("signed"); what the
// memory learns from in a living body ("relief", the default) is tested on its own below.
function fresh(params: Partial<CueParams> = {}) {
  const ledger = new Ledger("DNK-0001", bornGraph(C, { seed: 1, group: "reflexless" }));
  return { ledger, memory: new CueMemory(ledger, C, { quantum: 1e-6, outcome: "signed", ...params }) };
}
const weight = (ledger: Ledger, feature: string) => ledger.criticWeight(CUE_PREFIX + feature);

/** Lives a sequence of observations with outcome 0, then `outcome` on the last transition. */
function live(memory: CueMemory, seen: Observation[], outcome: number, from = 0): void {
  for (let i = 1; i < seen.length; i++) memory.step(seen[i - 1]!, seen[i]!, i === seen.length - 1 ? outcome : 0, from + i, 1);
}

// --- what counts as a cue -------------------------------------------------------------------------------

test("cues are the ray senses only (no hunger, no bias, no motion)", () => {
  const { memory } = fresh();
  const cues = Object.keys(memory.cues({ ...seeing(2), bump: true, energy: 0.1 }));
  assert.deepEqual(cues, ["ray2.food"]);
});

test("a cue is stronger the closer the thing is (1 − distance / range)", () => {
  const { memory } = fresh();
  assert.equal(memory.cues(seeing(2, "food", 1))["ray2.food"], 1 - 1 / C.rayRange);
});

test("the value of a scene is 0 before anything was learned", () => {
  const { memory } = fresh();
  assert.equal(memory.value(seeing(2)), 0);
});

// --- credit: what was seen shortly before -------------------------------------------------------------------

test("a cue seen just before a good outcome gains value", () => {
  const { ledger, memory } = fresh();
  memory.step(seeing(2), BLIND, 0.3, 1, 1);
  assert.ok(weight(ledger, "ray2.food") > 0, `value ${weight(ledger, "ray2.food")}`);
});

test("a cue seen just before a bad outcome loses value (a harm is discovered, not labelled)", () => {
  const { ledger, memory } = fresh();
  memory.step(seeing(4, "threat"), BLIND, -0.3, 1, 1);
  assert.ok(weight(ledger, "ray4.threat") < 0, `value ${weight(ledger, "ray4.threat")}`);
});

test("a cue that was not seen gains nothing", () => {
  const { ledger, memory } = fresh();
  memory.step(seeing(2), BLIND, 0.3, 1, 1);
  assert.equal(weight(ledger, "ray0.food"), 0);
});

test("a cue seen several ticks before the outcome still gains value (the trace remembers it)", () => {
  const { ledger, memory } = fresh();
  live(memory, [seeing(1), BLIND, BLIND, BLIND, BLIND], 0.3);
  assert.ok(weight(ledger, "ray1.food") > 0, `value ${weight(ledger, "ray1.food")}`);
});

test("a cue seen on two ticks in a row counts as seen once (the replacing trace is bounded)", () => {
  const once = fresh(), twice = fresh();
  live(once.memory, [BLIND, seeing(2), BLIND], 0.3);
  live(twice.memory, [seeing(2), seeing(2), BLIND], 0.3);
  assert.equal(weight(twice.ledger, "ray2.food"), weight(once.ledger, "ray2.food"));
});

test("with the accumulating trace (series 006, K2) sightings add up", () => {
  const once = fresh({ trace: "accumulating" }), twice = fresh({ trace: "accumulating" });
  live(once.memory, [BLIND, seeing(2), BLIND], 0.3);
  live(twice.memory, [seeing(2), seeing(2), BLIND], 0.3);
  assert.ok(weight(twice.ledger, "ray2.food") > weight(once.ledger, "ray2.food"));
});

test("a cue in constant view keeps a trace of at most 1 (no 1/(1−λ) pile-up)", () => {
  const { ledger, memory } = fresh({ lambda: 0.95 });
  const wall = seeing(0, "wall", 0); // x = 1
  for (let i = 0; i < 200; i++) memory.step(wall, wall, 0, i + 1, 1);
  memory.step(wall, BLIND, 0.3, 201, 1);
  // One step with e = 1, Σx² = 1 and δ = 0.3 moves the value by α·0.3 = 0.015 — the whole history adds no more.
  assert.ok(Math.abs(weight(ledger, "ray0.wall") - 0.015) < 1e-6, `value ${weight(ledger, "ray0.wall")}`);
});

test("TD(0) would not have credited it: with λ 0 a cue seen 4 ticks earlier gains nothing", () => {
  const { ledger, memory } = fresh({ lambda: 0 });
  live(memory, [seeing(1), BLIND, BLIND, BLIND, BLIND], 0.3);
  assert.equal(weight(ledger, "ray1.food"), 0);
});

// Seen k ticks before the outcome: credit shrinks by λ per tick. Grid k = 1..6, each from fresh state.
const credit = (k: number) => {
  const { ledger, memory } = fresh();
  live(memory, [seeing(3), ...Array.from({ length: k }, () => BLIND)], 0.3);
  return weight(ledger, "ray3.food");
};
for (let k = 1; k <= 5; k++) {
  test(`credit for a cue seen ${k + 1} ticks before is λ times the credit for ${k} ticks before`, () => {
    // The ratio is exact up to the ledger quantum (1e-6) on values ~1e-2: relative error < 1e-3.
    const ratio = credit(k + 1) / credit(k);
    assert.ok(Math.abs(ratio - DEFAULT_CUE.lambda) < 1e-3, `ratio ${ratio}`);
  });
}

test("the trace starts empty in each room: a cue from the last room earns nothing", () => {
  const { ledger, memory } = fresh();
  memory.step(seeing(2), BLIND, 0, 1, 1);
  memory.resetEpisode();
  memory.step(BLIND, BLIND, 0.3, 1, 2);
  assert.equal(weight(ledger, "ray2.food"), 0);
});

// --- what the memory learns from: relief (a meal), not the cost of living ------------------------------------

/** The same body before and after: `energyBefore` → `energyAfter`, seeing food on ray 2 before. */
const meal = (energyBefore: number, energyAfter: number): [Observation, Observation] =>
  [{ ...seeing(2), energy: energyBefore }, { ...BLIND, energy: energyAfter }];

test("by default the memory learns from relief: a cue seen before a meal gains value", () => {
  const { ledger, memory } = fresh({ outcome: "relief" });
  const [before, after] = meal(0.4, 0.7);
  memory.step(before, after, 0, 1, 1);
  assert.ok(weight(ledger, "ray2.food") > 0, `value ${weight(ledger, "ray2.food")}`);
});

test("by default the memory ignores the cost of living: a cue seen while energy only drains gains no negative value", () => {
  const { ledger, memory } = fresh({ outcome: "relief" });
  const [before, after] = meal(0.5, 0.4985);
  memory.step(before, after, -0.001, 1, 1);
  assert.equal(weight(ledger, "ray2.food"), 0);
});

test("with the signed outcome (K2, K3) the cost of living makes a seen cue negative", () => {
  const { ledger, memory } = fresh({ outcome: "signed" });
  const [before, after] = meal(0.5, 0.4985);
  memory.step(before, after, -0.001, 1, 1);
  assert.ok(weight(ledger, "ray2.food") < 0, `value ${weight(ledger, "ray2.food")}`);
});

test("the default outcome is relief", () => {
  assert.equal(DEFAULT_CUE.outcome, "relief");
});

// --- learning converges instead of churning ----------------------------------------------------------------------

test("a step is divided by the energy of the cues in sight (two cues at x = 1: half the step each)", () => {
  const { ledger, memory } = fresh({ lambda: 0 });
  const two = { ...seeing(null), rays: C.rayAngles.map((_, i) => (i === 1 || i === 3 ? { distance: 0, hit: "food" as const } : NOTHING)) };
  memory.step(two, BLIND, 0.3, 1, 1);
  // α·r·e / Σx² = 0.05 · 0.3 · 1 / 2 = 0.0075, to the ledger quantum (1e-6).
  assert.ok(Math.abs(weight(ledger, "ray1.food") - 0.0075) < 1e-6, `value ${weight(ledger, "ray1.food")}`);
});

test("a cue that always comes before the same outcome settles near that outcome (it does not grow forever)", () => {
  const { ledger, memory } = fresh({ lambda: 0, alpha: 0.5 });
  for (let i = 0; i < 400; i++) memory.step(seeing(2, "food", 0), BLIND, 0.3, i + 1, 1);
  // x = 1 and Σx² = 1, so v → r = 0.3; after 400 steps of rate 0.5 only the ledger quantum remains.
  assert.ok(Math.abs(weight(ledger, "ray2.food") - 0.3) < 1e-5, `value ${weight(ledger, "ray2.food")}`);
});

// --- effect on teaching: the change of value (potential-based shaping) ----------------------------------------

/** A memory that already values food on the centre ray at 0.5 (learned in a controlled way). */
function valuing() {
  const f = fresh({ lambda: 0, alpha: 1 });
  f.memory.step(seeing(2, "food", 0), BLIND, 0.5, 1, 1);
  f.memory.resetEpisode();
  return f;
}

test("turning food from the side into view of a valued ray is encouraged (shaping > 0)", () => {
  const { memory } = valuing();
  assert.ok(memory.step(seeing(3), seeing(2), 0, 1, 1, false, true).shaping > 0);
});

test("losing sight of valued food is discouraged (shaping < 0)", () => {
  const { memory } = valuing();
  assert.ok(memory.step(seeing(2), BLIND, 0, 1, 1, false, true).shaping < 0);
});

test("coming closer to valued food is encouraged (shaping > 0)", () => {
  const { memory } = valuing();
  assert.ok(memory.step(seeing(2, "food", 3), seeing(2, "food", 1), 0, 1, 1, false, true).shaping > 0);
});

test("shaping is weight × (γ·Φ(next) − Φ(now))", () => {
  const { ledger, memory } = valuing();
  const weighted = new CueMemory(ledger, C, { weight: 2 }); // same learned values, twice the effect
  const now = seeing(2, "food", 3), next = seeing(2, "food", 1);
  const expected = 2 * (DEFAULT_CUE.gamma * memory.value(next) - memory.value(now));
  assert.equal(weighted.step(now, next, 0, 1, 1, false, true).shaping, expected);
});

test("at death the next scene is worth nothing, even if food is in sight (shaping = −weight × Φ(now))", () => {
  const { memory } = valuing();
  const now = seeing(2, "food", 3);
  assert.equal(memory.step(now, seeing(2, "food", 1), 0, 1, 1, true, true).shaping, -memory.value(now));
});

test("shaping does not carry the outcome itself (the reward already teaches through the critic)", () => {
  const { memory } = valuing();
  const now = seeing(2, "food", 3), next = seeing(2, "food", 1);
  assert.equal(memory.step(now, next, 0.3, 1, 1, false, true).shaping, memory.step(now, next, 0, 1, 1, false, true).shaping);
});

test("a memory with weight 0 learns but does not teach", () => {
  const { memory } = fresh({ weight: 0 });
  assert.equal(memory.step(seeing(2), BLIND, 0.3, 1, 1).shaping, 0);
});

// --- the record --------------------------------------------------------------------------------------------------

test("a frozen memory learns nothing", () => {
  const { ledger, memory } = fresh();
  memory.step(seeing(2), BLIND, 0.3, 1, 1, false, true);
  assert.equal(ledger.entries.length, 0);
});

test("every change of a cue value is a ledger entry under the cue/ prefix", () => {
  const { ledger, memory } = fresh();
  live(memory, [seeing(1), seeing(2), BLIND], 0.3);
  assert.ok(ledger.entries.length > 0 && ledger.entries.every((e) => e.kind === "critic" && e.feature.startsWith(CUE_PREFIX)));
});

test("the ledger replays to the same cue values", () => {
  const { ledger, memory } = fresh();
  live(memory, [seeing(1), seeing(2), BLIND], 0.3);
  const replayed = new Ledger(ledger.subjectId, ledger.birthGraph, ledger.entries);
  assert.equal(replayed.criticWeight(CUE_PREFIX + "ray2.food"), weight(ledger, "ray2.food"));
});

test("the cue memory does not touch the critic's own weights (no prefix clash)", () => {
  const { ledger, memory } = fresh();
  memory.step(seeing(2), BLIND, 0.3, 1, 1);
  assert.equal(ledger.criticWeight("ray2.food"), 0);
});

// --- parameters ----------------------------------------------------------------------------------------------------

const BAD: readonly [string, Partial<CueParams>][] = [
  ["lambda < 0", { lambda: -0.1 }], ["lambda > 1", { lambda: 1.1 }], ["gamma > 1", { gamma: 1.5 }],
  ["alpha < 0", { alpha: -1 }], ["quantum 0", { quantum: 0 }], ["weight NaN", { weight: NaN }],
  ["an unknown trace", { trace: "sticky" as "replacing" }], ["an unknown outcome", { outcome: "both" as "relief" }],
];
for (const [label, params] of BAD) {
  test(`a cue memory refuses ${label}`, () => {
    assert.throws(() => fresh(params), /bad cue memory params/);
  });
}

test("a non-finite outcome is refused, not learned", () => {
  const { memory } = fresh();
  assert.throws(() => memory.step(seeing(2), BLIND, NaN, 1, 1), /outcome/);
});

// --- in a living subject (agent.ts) -------------------------------------------------------------------------------

const SCARCE = makeConfig({ initialEnergy: 0.8, threatCount: 0, foodCount: 5 });
// S1n as in experiments/conditions.ts, written out (learning/ does not import experiments/).
const S1N: Omit<AgentSpec, "cfg" | "ledger" | "noiseSeed"> = {
  learning: { eta: 0.05, lambda: 0.9, quantum: 0.005, gate: "selected", dipFloor: null }, teachAtDeath: false, critic: {}, selection: {},
};

/** One subject living `rooms` rooms from birth; returns its ledger and the world hashes. */
function lifeOf(extra: Partial<AgentSpec>, rooms = 2) {
  const ledger = new Ledger("DNK-0001", bornGraph(SCARCE, { seed: 3, group: "reflexless" }));
  const agent = createAgent({ ...S1N, ...extra, cfg: SCARCE, ledger, noiseSeed: 11 });
  const hashes: string[] = [];
  for (let ep = 1; ep <= rooms; ep++) {
    agent.startEpisode(ep);
    hashes.push(runEpisode(new Room(100 + ep, SCARCE), agent.policy, 3000, false, agent.hooks).finalHash);
    agent.finishEpisode(0);
  }
  return { ledger, agent, hashes };
}

test("a subject with the cue memory switched off lives exactly as one without the switch (bit-identical)", () => {
  assert.deepEqual(lifeOf({ cue: null }).hashes, lifeOf({}).hashes);
});

test("a subject with the cue memory switched off writes exactly the same ledger", () => {
  assert.equal(lifeOf({ cue: null }).ledger.hash(), lifeOf({}).ledger.hash());
});

test("a subject with the cue memory writes cue values to its ledger", () => {
  const { ledger } = lifeOf({ cue: {} });
  assert.ok(ledger.entries.some((e) => e.kind === "critic" && e.feature.startsWith(CUE_PREFIX)));
});

test("a subject with the cue memory still matches its ledger (every change on the record)", () => {
  const { ledger, agent } = lifeOf({ cue: {} });
  assert.ok(ledger.matches(agent.graph));
});

test("a subject with the cue memory lives differently (the switch does something)", () => {
  assert.notDeepEqual(lifeOf({ cue: {} }).hashes, lifeOf({}).hashes);
});

test("a frozen subject with the cue memory writes no cue values", () => {
  const { ledger } = lifeOf({ cue: {}, learning: { ...S1N.learning, frozen: true } });
  assert.ok(!ledger.entries.some((e) => e.kind === "critic" && e.feature.startsWith(CUE_PREFIX)));
});

test("a subject starts every room with nothing remembered as just seen", () => {
  const { agent } = lifeOf({ cue: {} }, 1);
  agent.startEpisode(2);
  assert.equal(agent.cue!.traced, 0);
});

test("a subject that has lived a room remembers something as just seen (the check above is not vacuous)", () => {
  const { agent } = lifeOf({ cue: {} }, 1);
  assert.ok(agent.cue!.traced > 0);
});

test("the cue memory refuses to work with dopamine compartments", () => {
  assert.throws(() => lifeOf({ cue: {}, compartments: { mode: "valence" } }, 1), /not defined for compartments/);
});
