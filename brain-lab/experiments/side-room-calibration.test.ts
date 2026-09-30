// brain-lab/experiments/side-room-calibration.test.ts — Themis §1.1 for the side room ROOM-S: on bodies whose answer is
// known, the room must separate turning toward what is beside you from every habit. Measured 2026-09-30 on seeds 1–8 × 10
// rooms (forward 0 meals, circling 0.20, blind 1.47, seeker 17.4 and 96% alive); here seeds 1–3 × 5 rooms, fixed below.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { burstPolicy, seekerPolicy } from "../baselines/index.ts";
import type { Policy } from "../world/index.ts";
import { ROOM_S } from "./conditions.ts";
import { measureEpisodes, type Eval } from "./harness.ts";

const SEEDS = [1, 2, 3];
const pooled = (make: (seed: number) => Policy) => {
  const es: Eval[] = SEEDS.map((s) => measureEpisodes({ policy: make(s) }, ROOM_S, s, 5, 0));
  const m = (f: (e: Eval) => number) => es.reduce((a, e) => a + f(e), 0) / es.length;
  return { perK: m((e) => e.perK), survival: m((e) => e.survival), steering: m((e) => e.steering ?? 0), drive: m((e) => e.meanDrive) };
};
const forward = pooled(() => () => ({ thrust: 1, turn: 0 }));
const circling = pooled(() => () => ({ thrust: 1, turn: 1 }));
const blind = pooled((s) => burstPolicy(s));
const seeker = pooled((s) => seekerPolicy(ROOM_S, s));

test("forward only (the habit the learners grew) eats nothing in the side room", () => {
  assert.equal(forward.perK, 0, `forward meals/1000 ${forward.perK}`);
  assert.equal(forward.survival, 0);
});

test("forward + always left: a habit, steering exactly 0, and it starves", () => {
  assert.equal(circling.steering, 0);
  assert.equal(circling.survival, 0, `survival ${circling.survival}`);
});

test("the seeker (ceiling) lives: survival ≥ 0.9, steering 1, drive < 0.1", () => {
  assert.ok(seeker.survival >= 0.9, `survival ${seeker.survival}`);
  assert.equal(seeker.steering, 1);
  assert.ok(seeker.drive < 0.1, `drive ${seeker.drive}`);
});

test("the room separates the ceiling from blind movement: seeker meals ≥ 5 × blind, blind survives < 10%", () => {
  assert.ok(seeker.perK >= 5 * blind.perK, `seeker ${seeker.perK} vs blind ${blind.perK}`);
  assert.ok(blind.survival < 0.1, `blind survival ${blind.survival}`);
});
