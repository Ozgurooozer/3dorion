// brain-lab/learning/critic-stage4.test.ts — TASARIM-009 stage 4: the critic learns what seeing food is worth.
//   4a lambda: an eligibility trace per feature (TD(λ), backward view), so value flows back from a meal in one pass.
//   4b features "need": every sense also as sense × hunger, so seeing food can be worth more when hungry (need-gated cue
//      value, as hunger neurons gate dopamine cue responses). Off, the critic is the critic it always was.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { bornGraph } from "../development/index.ts";
import { Ledger } from "../registry/index.ts";
import { DEFAULT_CONFIG as C, Room, makeConfig, runEpisode, type Observation } from "../world/index.ts";
import { Critic, createAgent } from "./index.ts";

const ledgerFor = (seed: number) => new Ledger(`DNK-${String(seed).padStart(4, "0")}`, bornGraph(C, { seed, group: "reflexless" }));
const none = { distance: C.rayRange, hit: "none" as const };
const obs = (energy: number, foodAhead: number | null): Observation => ({
  rays: C.rayAngles.map((_, i) => (i === 2 && foodAhead !== null ? { distance: foodAhead, hit: "food" as const } : none)),
  bump: false, energy, health: 1, motion: { forward: 0, turn: 0 },
});

test("off: the params and the features are what they always were", () => {
  const c = new Critic(ledgerFor(1), C);
  assert.ok(!("lambda" in c.params) && !("features" in c.params));
  assert.ok(Object.keys(c.features(obs(0.4, 1))).every((f) => !f.startsWith("need*")));
});

test("need features: every sense × hunger, named need*<sense>; no need*bias, no need*intero.hunger", () => {
  const plain = new Critic(ledgerFor(1), C).features(obs(0.4, 2));
  const need = new Critic(ledgerFor(1), C, { features: "need" }).features(obs(0.4, 2));
  const hunger = plain["intero.hunger"]!;
  for (const [f, x] of Object.entries(plain)) {
    assert.equal(need[f], x, `${f} kept`);
    if (f === "bias" || f === "intero.hunger") assert.ok(!(`need*${f}` in need), `need*${f} should not exist`);
    else assert.equal(need[`need*${f}`], x * hunger, `need*${f}`);
  }
  assert.equal(Object.keys(need).length, 2 * Object.keys(plain).length - 2);
});

/** Seeing food ahead is followed by a meal only when hungry: when sated the same sight is worth nothing. */
function trainNeed(features: "need" | undefined) {
  const critic = new Critic(ledgerFor(2), C, { alpha: 0.05, gamma: 0.9, quantum: 0.00001, ...(features ? { features } : {}) });
  for (let i = 0; i < 400; i++) {
    const t = 10 * i;
    critic.step(obs(0.3, null), obs(0.3, 1), 0, t, 1); critic.step(obs(0.3, 1), obs(0.3, null), 0.3, t + 1, 1); // hungry: meal
    critic.step(obs(0.9, null), obs(0.9, 1), 0, t + 2, 1); critic.step(obs(0.9, 1), obs(0.9, null), 0, t + 3, 1); // sated: none
  }
  const worth = (energy: number) => critic.value(obs(energy, 1)) - critic.value(obs(energy, null));
  return { hungry: worth(0.3), sated: worth(0.9) };
}

test("need features let seeing food be worth more when hungry than when sated; the linear critic cannot tell them apart", () => {
  const need = trainNeed("need"), plain = trainNeed(undefined);
  assert.ok(need.hungry - need.sated > 0.05, `need: hungry ${need.hungry} sated ${need.sated}`);
  // Linear in the senses: the sight adds the same w·x whatever the hunger.
  assert.ok(Math.abs(plain.hungry - plain.sated) < 1e-12, `plain: hungry ${plain.hungry} sated ${plain.sated}`);
});

test("lambda: the trace is γλ·e + x; two steps on the same features move a weight by α·δ·(1 + γλ) in the second", () => {
  const ledger = ledgerFor(3);
  const c = new Critic(ledger, C, { alpha: 0.1, gamma: 0.9, lambda: 0.5, quantum: 0.000001 });
  const s = obs(0.5, null);
  c.learn(s, 1, 0, 1);
  const first = ledger.criticWeight("bias");
  c.learn(s, 1, 1, 1);
  assert.ok(Math.abs(first - 0.1) < 1e-6, `first ${first}`);
  assert.ok(Math.abs(ledger.criticWeight("bias") - first - 0.1 * (1 + 0.9 * 0.5)) < 1e-6, `second ${ledger.criticWeight("bias") - first}`);
});

test("lambda: a new episode clears the trace (resetPending)", () => {
  const ledger = ledgerFor(4);
  const c = new Critic(ledger, C, { alpha: 0.1, gamma: 0.9, lambda: 0.9, quantum: 0.000001 });
  const s = obs(0.5, null);
  c.learn(s, 1, 0, 1);
  c.resetPending();
  const before = ledger.criticWeight("bias");
  c.learn(s, 1, 0, 2);
  assert.ok(Math.abs(ledger.criticWeight("bias") - before - 0.1) < 1e-6, "the old trace leaked into the new episode");
});

test("lambda: in ONE pass value reaches the state two steps before the meal; TD(0) cannot", () => {
  const wallThenFoodThenMeal = (lambda: number | undefined) => {
    const ledger = ledgerFor(5);
    const c = new Critic(ledger, C, { alpha: 0.1, gamma: 0.9, quantum: 0.00001, ...(lambda === undefined ? {} : { lambda }) });
    const base = obs(0.5, null);
    const wall: Observation = { ...base, rays: base.rays.map((r, i) => (i === 0 ? { distance: 0.5, hit: "wall" as const } : r)) };
    c.step(base, wall, 0, 0, 1); c.step(wall, obs(0.5, 1), 0, 1, 1); c.step(obs(0.5, 1), base, 0.3, 2, 1);
    return ledger.criticWeight("ray0.wall");
  };
  assert.equal(wallThenFoodThenMeal(undefined), 0);
  assert.ok(wallThenFoodThenMeal(0.9) > 0.001, `λ 0.9: ${wallThenFoodThenMeal(0.9)}`);
});

test("refused: lambda outside [0, 1], lambda with normalize, unknown features", () => {
  for (const p of [{ lambda: -0.1 }, { lambda: 1.1 }, { lambda: 0.9, normalize: true }, { features: "all" as never }]) {
    assert.throws(() => new Critic(ledgerFor(6), C, p), RangeError, JSON.stringify(p));
  }
});

test("an agent with both switches lives, learns need features on the record, replays, and is deterministic", () => {
  const HUNGRY = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
  const run = () => {
    const ledger = new Ledger("DNK-0007", bornGraph(HUNGRY, { seed: 7, group: "reflexless" }));
    const agent = createAgent({ cfg: HUNGRY, ledger, noiseSeed: 7, selection: {}, critic: { lambda: 0.9, features: "need" }, learning: { quantum: 0.005 } });
    for (let ep = 1; ep <= 2; ep++) { agent.startEpisode(ep); runEpisode(new Room(700 + ep, HUNGRY), agent.policy, 1500, false, agent.hooks); }
    agent.drainWrites();
    assert.ok(ledger.entries.some((e) => e.kind === "critic" && e.feature.startsWith("need*")), "no need feature learned");
    assert.equal(JSON.stringify(new Ledger(ledger.subjectId, ledger.birthGraph, ledger.entries).graph), JSON.stringify(ledger.graph));
    return JSON.stringify(ledger.entries);
  };
  assert.equal(run(), run());
});
