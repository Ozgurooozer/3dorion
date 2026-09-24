// brain-lab/experiments/measures.test.ts — the orientation measure must mean what it says.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG as C, type Action, type Observation, type Ray } from "../world/index.ts";
import { LAG, approach, foodSide, orientation, towardFood } from "./measures.ts";

const none: Ray = { distance: C.rayRange, hit: "none" };
const obsWithFood = (ray: number | null, distance = 2): Observation => ({
  rays: C.rayAngles.map((_, i) => (i === ray ? { distance, hit: "food" as const } : none)),
  bump: false, energy: 0.5, health: 1, motion: { forward: 0, turn: 0 },
});

test("food side follows the ray angles: positive angle is left", () => {
  assert.equal(foodSide(obsWithFood(null), C), null);
  assert.equal(foodSide(obsWithFood(2), C), "center");
  assert.equal(foodSide(obsWithFood(3), C), "left");
  assert.equal(foodSide(obsWithFood(4), C), "left");
  assert.equal(foodSide(obsWithFood(0), C), "right");
  const two = obsWithFood(0, 3);
  const both: Observation = { ...two, rays: two.rays.map((r, i) => (i === 4 ? { distance: 1, hit: "food" as const } : r)) };
  assert.equal(foodSide(both, C), "left", "the nearest food decides");
});

test("toward food: turn to its side, or go straight when it is ahead", () => {
  const act = (thrust: number, turn: number): Action => ({ thrust, turn });
  assert.equal(towardFood("left", act(0, 1)), true);
  assert.equal(towardFood("left", act(1, -1)), false);
  assert.equal(towardFood("right", act(0, -1)), true);
  assert.equal(towardFood("center", act(1, 0)), true);
  assert.equal(towardFood("center", act(1, 1)), false);
  assert.equal(towardFood("center", act(0, 0)), false, "standing still is not orienting");
});

test("orientation uses the conduction delay: the action at t answers the sight at t − LAG", () => {
  const T = 10;
  const obs = Array.from({ length: T }, (_, t) => obsWithFood(t === 2 ? 4 : null)); // food on the left at tick 2 only
  const actions = Array.from({ length: T }, (_, t): Action => ({ thrust: 0, turn: t === 2 + LAG ? 1 : 0 }));
  assert.deepEqual(orientation(obs, actions, C), { seen: 1, toward: 1, index: 1 });
  const early = Array.from({ length: T }, (_, t): Action => ({ thrust: 0, turn: t === 2 ? 1 : 0 }));
  assert.deepEqual(orientation(obs, early, C), { seen: 1, toward: 0, index: 0 }, "a same-tick turn cannot be a response");
  assert.equal(orientation(obs.map(() => obsWithFood(null)), actions, C).index, null, "no food in sight → no index");
});

test("approach: counts food getting closer between consecutive sightings; turning in place never counts", () => {
  const seq = [obsWithFood(2, 3), obsWithFood(2, 2.5), obsWithFood(2, 2.5), obsWithFood(null), obsWithFood(3, 1), obsWithFood(3, 0.8)];
  assert.deepEqual(approach(seq), { pairs: 3, closer: 2, index: 2 / 3 });
  assert.equal(approach([obsWithFood(null), obsWithFood(null)]).index, null);
});
