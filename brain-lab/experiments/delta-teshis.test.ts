// brain-lab/experiments/delta-teshis.test.ts — the δ readings on hand-made lives with known answers.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Observation } from "../world/index.ts";
import { ROOM3 } from "./conditions.ts";
import { BEFORE_MEAL, beforeMeal, foodSide, turnAdvantage, type Tick } from "./delta-teshis.ts";

// ROOM3 rays: 0, 1 right; 2 centre; 3, 4 left.
const none = { distance: ROOM3.rayRange, hit: "none" as const };
const seeing = (...rays: number[]): Observation => ({
  rays: ROOM3.rayAngles.map((_, i) => (rays.includes(i) ? { distance: 1, hit: "food" as const } : none)),
  bump: false, energy: 0.5, health: 1, motion: { forward: 0, turn: 0 },
});

test("food side: one side only; the centre ray or both sides give no answer", () => {
  assert.equal(foodSide(seeing(4), ROOM3), "left");
  assert.equal(foodSide(seeing(0, 1), ROOM3), "right");
  assert.equal(foodSide(seeing(), ROOM3), null);
  assert.equal(foodSide(seeing(2, 4), ROOM3), null, "food ahead too");
  assert.equal(foodSide(seeing(0, 4), ROOM3), null, "both sides");
});

const tick = (foodSide: Tick["foodSide"], turn: number, delta: number, ate = false): Tick => ({ foodSide, turn, delta, ate });

test("turn advantage: the δ of the NEXT tick, by the move made with food on one side", () => {
  const a = turnAdvantage([
    tick("left", 1, 9), tick(null, 0, 0.5), // toward (left turn, food left) → next δ 0.5
    tick("right", 1, 9), tick(null, 0, -0.2), // away → −0.2
    tick("right", -1, 9), tick(null, 0, 0.3), // toward → 0.3
    tick("left", 0, 9), tick(null, 0, 0.1), // no turn → 0.1
    tick(null, 1, 9), tick(null, 0, 7), // no food on one side: not counted
  ]);
  assert.equal(a.toward, 0.4);
  assert.equal(a.away, -0.2);
  assert.equal(a.straight, 0.1);
  assert.deepEqual([a.nToward, a.nAway, a.nStraight], [2, 1, 1]);
});

test("turn advantage: the last tick has no next tick and is not counted", () => {
  assert.equal(turnAdvantage([tick("left", 1, 0)]).nToward, 0);
});

test("before the meal: the BEFORE_MEAL ticks before each meal tick, the meal tick itself left out", () => {
  const ticks = Array.from({ length: 50 }, (_, i) => tick(null, 0, i >= 30 - BEFORE_MEAL && i < 30 ? 1 : 0, i === 30));
  ticks[30] = tick(null, 0, 100, true);
  const b = beforeMeal(ticks);
  assert.equal(b.before, 1);
  assert.equal(b.meals, 1);
  assert.equal(b.all, (BEFORE_MEAL + 100) / 50);
});
