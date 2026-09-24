// brain-lab/experiments/measures.test.ts — the orientation measure must mean what it says.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG as C, Room, makeConfig, runEpisode, type Action, type Observation, type Ray } from "../world/index.ts";
import { LAG, approach, foodSide, orientation, steering, steeringIndex, towardFood, turnToward } from "./measures.ts";

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

test("turn direction: only side sightings followed by a turn count; a one-sided habit scores chance", () => {
  const act = (turn: number): Action => ({ thrust: 1, turn });
  // lag 0: food left, right, ahead, none; turning left every tick
  const obs = [obsWithFood(4), obsWithFood(0), obsWithFood(2), obsWithFood(null), obsWithFood(3), obsWithFood(1)];
  assert.deepEqual(turnToward(obs, obs.map(() => act(1)), C, 0), { turns: 4, toward: 2, index: 0.5 }, "always-left habit = chance");
  const steer = [act(1), act(-1), act(0), act(0), act(1), act(-1)];
  assert.deepEqual(turnToward(obs, steer, C, 0), { turns: 4, toward: 4, index: 1 });
  const away = [act(-1), act(1), act(0), act(0), act(-1), act(1)];
  assert.deepEqual(turnToward(obs, away, C, 0), { turns: 4, toward: 0, index: 0 });
  assert.deepEqual(turnToward(obs, obs.map(() => act(0)), C, 0), { turns: 0, toward: 0, index: null }, "no turns, no index");
  // default lag is the brain's conduction delay
  const late = Array.from({ length: 6 + LAG }, (_, t): Action => act(t === LAG ? 1 : 0));
  assert.deepEqual(turnToward([...obs, ...obs], late, C), { turns: 1, toward: 1, index: 1 });
});

// --- steering index ------------------------------------------------------------------------

// Food on the left (ray 4), on the right (ray 0), alternating; lag 0 so each action answers its own tick.
const SIDES = [obsWithFood(4), obsWithFood(0), obsWithFood(4), obsWithFood(0)];
const turns = (...ts: number[]): Action[] => ts.map((turn) => ({ thrust: 1, turn }));

test("steering: turning toward the food on each side scores 1", () => {
  assert.equal(steering(SIDES, turns(1, -1, 1, -1), C, 0).index, 1);
});

test("steering: turning away on each side scores −1", () => {
  assert.equal(steering(SIDES, turns(-1, 1, -1, 1), C, 0).index, -1);
});

test("steering: a one-sided habit scores 0, whichever side", () => {
  assert.equal(steering(SIDES, turns(1, 1, 1, 1), C, 0).index, 0);
  assert.equal(steering(SIDES, turns(-1, -1, -1, -1), C, 0).index, 0);
});

test("steering: steering on one side only (left toward left food, never right) scores 0.5", () => {
  assert.equal(steering(SIDES, turns(1, 0, 1, 0), C, 0).index, 0.5);
});

test("steering: not turning at all scores 0", () => {
  assert.equal(steering(SIDES, turns(0, 0, 0, 0), C, 0).index, 0);
});

test("steering: food seen on one side only gives no index", () => {
  assert.equal(steering([obsWithFood(4), obsWithFood(3)], turns(1, 1), C, 0).index, null);
});

test("steering: pooled counts give the index of the pooled behaviour", () => {
  const a = steering(SIDES, turns(1, -1, 1, -1), C, 0);
  const b = steering(SIDES, turns(1, 1, 1, 1), C, 0);
  const pooled = {
    leftSeen: a.leftSeen + b.leftSeen, rightSeen: a.rightSeen + b.rightSeen,
    leftTurnWhenLeft: a.leftTurnWhenLeft + b.leftTurnWhenLeft, rightTurnWhenLeft: a.rightTurnWhenLeft + b.rightTurnWhenLeft,
    leftTurnWhenRight: a.leftTurnWhenRight + b.leftTurnWhenRight, rightTurnWhenRight: a.rightTurnWhenRight + b.rightTurnWhenRight,
  };
  assert.equal(steeringIndex(pooled), 0.5);
});

test("steering vs turnToward in the real room: a food-blind always-left body is 0 on steering but below 0.5 on turnToward", () => {
  const room = new Room(1500, makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 }));
  const first = room.observe();
  const { records } = runEpisode(room, () => ({ thrust: 1, turn: 1 }), 3000, true);
  const obs = [first, ...records.map((r) => r.result.observation)];
  const actions = records.map((r) => r.action);
  assert.equal(steering(obs, actions, C, 0).index, 0);
  const t = turnToward(obs, actions, C, 0).index!;
  assert.ok(t < 0.5, `turnToward ${t}: the closed-loop bias this index exists to avoid`);
});
