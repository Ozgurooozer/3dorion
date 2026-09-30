// brain-lab/experiments/kredi-teshis.test.ts — the credit split on hand-written ledger entries with known answers.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { bornGraph } from "../development/index.ts";
import { Ledger, type LedgerEntry } from "../registry/index.ts";
import { ROOM3 } from "./conditions.ts";
import { MEAL_WINDOW, creditSplit, foodWorth, mealTicks, turnClass } from "./kredi-teshis.ts";

// ROOM3 rays: 0, 1 right; 2 centre; 3, 4 left.
let n = 0;
const entry = (from: string, to: string, before: number, after: number, tick: number, episode = 1, cause = ["dopamine"]): LedgerEntry =>
  ({ kind: "weight", id: `LRN-${++n}`, tick, episode, cause, edge: { from, to }, before, after });

test("turn classes: side food toward / away, centre food, anything else; non-turn synapses are not classed", () => {
  assert.equal(turnClass("ray4.food", "bg.go.left", ROOM3), "sideToward");
  assert.equal(turnClass("ray0.food", "bg.nogo.right", ROOM3), "sideToward");
  assert.equal(turnClass("ray4.food", "bg.go.right", ROOM3), "sideAway");
  assert.equal(turnClass("ray2.food", "bg.go.left", ROOM3), "centreFood");
  assert.equal(turnClass("intero.hunger", "bg.go.right", ROOM3), "other");
  assert.equal(turnClass("ray4.wall", "bg.go.left", ROOM3), "other");
  assert.equal(turnClass("ray4.food", "bg.go.forward", ROOM3), null);
});

test("a Go rise counts up, a NoGo rise counts down (net for the action), each by its size", () => {
  const c = creditSplit([entry("ray4.food", "bg.go.left", 0.1, 0.3, 50), entry("ray4.food", "bg.nogo.left", 0.1, 0.15, 60)], new Map(), ROOM3);
  assert.equal(c.sideToward.up.toFixed(6), "0.200000");
  assert.equal(c.sideToward.down.toFixed(6), "0.050000");
});

test("at a meal means the meal tick up to MEAL_WINDOW ticks after it, in the same episode", () => {
  const meals = new Map([[1, [100]]]);
  const at = (tick: number, episode = 1) => creditSplit([entry("ray4.food", "bg.go.right", 0, 0.01, tick, episode)], meals, ROOM3).sideAway.upAtMeal > 0;
  assert.equal(at(99), false, "before the meal");
  assert.equal(at(100), true);
  assert.equal(at(100 + MEAL_WINDOW), true);
  assert.equal(at(101 + MEAL_WINDOW), false);
  assert.equal(at(100, 2), false, "another episode's tick 100");
});

test("only dopamine learning counts; critic, scaling or death entries do not", () => {
  const c = creditSplit([entry("ray4.food", "bg.go.left", 0, 0.1, 5, 1, ["scaling"]), entry("ray4.food", "bg.go.left", 0, 0.1, 5, 1, ["death", "starved"])], new Map(), ROOM3);
  assert.equal(c.sideToward.up, 0);
});

test("food worth: a linear critic's food weight is the worth, hungry or sated; a need weight adds only when hungry", () => {
  const graph = bornGraph(ROOM3, { seed: 1, group: "reflexless" });
  const ledger = new Ledger("DNK-0001", graph);
  for (const [feature, after] of [["ray2.food", 0.1], ["need*ray2.food", 0.5]] as const) ledger.record({ kind: "critic", tick: 0, episode: 1, cause: ["td"], feature, before: 0, after });
  const proximity = 1 - 2 / ROOM3.rayRange; // food 2 m ahead
  const linear = foodWorth(ledger, ROOM3, {});
  assert.ok(Math.abs(linear.hungry - 0.1 * proximity) < 1e-12 && Math.abs(linear.sated - 0.1 * proximity) < 1e-12, JSON.stringify(linear));
  const need = foodWorth(ledger, ROOM3, { features: "need" });
  assert.ok(Math.abs(need.hungry - (0.1 + 0.5 * 0.6) * proximity) < 1e-12, `hungry ${need.hungry}`);
  assert.ok(Math.abs(need.sated - (0.1 + 0.5 * 0.1) * proximity) < 1e-12, `sated ${need.sated}`);
});

test("meal ticks come from the training run's meal events, by episode", () => {
  const runs = [
    { header: { purpose: "lab tara eval (learning frozen)" }, episodes: [{ episode: 1, events: [{ tick: 9, kind: "meal" }] }] },
    { header: { purpose: "lab tara train" }, episodes: [{ episode: 1, events: [{ tick: 5, kind: "meal" }, { tick: 7, kind: "bump" }] }, { episode: 2, events: [] }] },
  ];
  assert.deepEqual([...mealTicks(runs)], [[1, [5]], [2, []]]);
  assert.throws(() => mealTicks([runs[0]!]), /no training run/);
});
