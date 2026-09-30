// brain-lab/experiments/yon-teshis.test.ts — the turn probe on hand-set brains with known answers: a blank brain has no
// margin, a food-only brain always turns toward, a brain that keeps turning cannot be pulled back by the same food.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { BrainGrafi } from "../brain-ir/ir.ts";
import { actionOfAngle, bornGraph } from "../development/index.ts";
import { isPlastic } from "../regions/index.ts";
import { rayNodeId } from "../sensorimotor/encode.ts";
import { ROOM3 } from "./conditions.ts";
import { PROBE, sideSweep, topSides, turnProbe } from "./yon-teshis.ts";

/** A newborn with every learning weight at 0: the probe must see nothing but noise. */
function blank(): BrainGrafi {
  const g = structuredClone(bornGraph(ROOM3, { seed: 1, group: "reflexless" }));
  for (const e of g.connections) if (isPlastic(e)) (e as { weight: number }).weight = 0;
  return g;
}
function set(g: BrainGrafi, from: string, to: string, w: number): void {
  const e = g.connections.find((c) => c.from === from && c.to === to);
  assert.ok(e && isPlastic(e), `${from} → ${to} is a learning edge of the newborn`);
  (e as { weight: number }).weight = w;
}
const sideRays = ROOM3.rayAngles.flatMap((a, i) => { const s = actionOfAngle(a); return s === "forward" ? [] : [[i, s] as const]; });

test("a blank brain: no food margin, no perseverance, no side habit", () => {
  const p = turnProbe(blank(), ROOM3);
  assert.equal(p.foodMargin, 0);
  assert.equal(p.persevere, 0);
  assert.equal(p.hungerSide, 0);
  assert.equal(p.forwardFood, 0);
});

test("a blank brain: noise alone turns toward the food about half the time", () => {
  const p = turnProbe(blank(), ROOM3);
  // Measured 0.498–0.499 over probe seeds 1–7 (2026-09-30); the band allows any fair noise and refuses a side bias.
  assert.ok(p.foodWins > 0.4 && p.foodWins < 0.6, `wins ${p.foodWins}`);
});

test("food → Go of its own side, stronger than the noise can reach: always toward, even against a turn it is in", () => {
  const g = blank();
  for (const [i, s] of sideRays) set(g, rayNodeId(i, "food"), `bg.go.${s}`, 1);
  const p = turnProbe(g, ROOM3);
  assert.equal(p.foodMargin, PROBE.proximity, "margin = proximity × weight");
  assert.equal(p.foodWins, 1);
  assert.equal(p.foodWinsAgainstTurn, 1, "no proprio weights: the turn already made pulls nothing");
});

test("food on both sides alike: no margin, whatever the weight", () => {
  const g = blank();
  for (const [i] of sideRays) { set(g, rayNodeId(i, "food"), "bg.go.left", 2); set(g, rayNodeId(i, "food"), "bg.go.right", 2); }
  assert.equal(turnProbe(g, ROOM3).foodMargin, 0);
});

test("a strong turn habit (proprio → keep turning) beats a weaker food margin once the body turns away", () => {
  const g = blank();
  for (const [i, s] of sideRays) set(g, rayNodeId(i, "food"), `bg.go.${s}`, 0.5);
  for (const s of ["left", "right"] as const) set(g, `proprio.${s}`, `bg.go.${s}`, 1);
  const p = turnProbe(g, ROOM3);
  assert.equal(p.persevere, 1);
  assert.ok(p.foodWins > 0.9, `still toward when not turning (${p.foodWins})`);
  assert.equal(p.foodWinsAgainstTurn, 0, "0.3 margin − 1 habit is out of the noise's reach");
});

test("NoGo counts against its action: food → NoGo of the away side is a margin too", () => {
  const g = blank();
  for (const [i, s] of sideRays) set(g, rayNodeId(i, "food"), `bg.nogo.${s === "left" ? "right" : "left"}`, 0.5);
  assert.equal(turnProbe(g, ROOM3).foodMargin, PROBE.proximity * 0.5);
});

test("hunger → one side only is a side habit, signed left − right", () => {
  const g = blank();
  set(g, "intero.hunger", "bg.go.right", 0.2);
  assert.equal(turnProbe(g, ROOM3).hungerSide, -0.2);
});

test("a hunger habit stronger than the food margin: food on the habit's side always wins, on the other side never", () => {
  const g = blank();
  for (const [i, s] of sideRays) set(g, rayNodeId(i, "food"), `bg.go.${s}`, 0.5); // margin 0.3
  set(g, "intero.hunger", "bg.go.right", 2); // at hunger 0.5: 1.0 toward the right, beyond margin + noise
  const p = turnProbe(g, ROOM3);
  assert.equal(p.foodWinsAgainstHabit, 0, "food on the left loses to the habit");
  assert.equal(p.foodWins, 0.5, "half the side rays are on the habit's side and win, half lose");
});

test("side sweep: a blank brain has no side anywhere; a habit on the centre food ray is found there and nowhere else", () => {
  const g = blank();
  assert.ok([...sideSweep(g).values()].every((v) => v === 0));
  set(g, rayNodeId(2, "food"), "bg.go.right", 1.4);
  const sweep = sideSweep(g);
  assert.equal(sweep.get(rayNodeId(2, "food")), -1.4);
  assert.deepEqual([...sweep].filter(([, v]) => v !== 0).map(([s]) => s), [rayNodeId(2, "food")]);
  assert.equal(turnProbe(g, ROOM3).hungerSide, 0, "the hunger-only probe cannot see it (Kart 3)");
});

test("top sides: senses from every subject count, a missing one as 0 (the first subject alone is not the key)", () => {
  const a = new Map([["ray2.food", 0.2]]);
  const b = new Map([["ray2.food", -0.4], ["rec0.food", 1.8]]);
  assert.deepEqual(topSides([a, b], 2), [["rec0.food", 0.9], ["ray2.food", 0.30000000000000004]]);
});

test("no habit: the habit-free share is the share over all side rays", () => {
  const g = blank();
  for (const [i, s] of sideRays) set(g, rayNodeId(i, "food"), `bg.go.${s}`, 0.2);
  const p = turnProbe(g, ROOM3);
  assert.equal(p.foodWinsAgainstHabit, p.foodWins);
});
