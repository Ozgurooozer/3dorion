// brain-lab/viewer/beyin3d-layout.test.ts — the 3D brain's layout: every neuron placed once, nowhere twice, and the
// sides line up (a left ray, the left lane and the left motor are all on +z). Each case builds its own brain.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { bornGraph } from "../development/index.ts";
import { memId } from "../regions/index.ts";
import { DEFAULT_CONFIG as C } from "../world/index.ts";
import { COLUMN_X, LANE, layout3d } from "./beyin3d-layout.ts";

const ids = (recall: boolean, mems = 0) => [
  ...bornGraph(C, { seed: 1, group: "reflexive", ...(recall ? { recall: { rules: "grown" as const } } : {}) }).nodes.map((n) => n.id),
  ...Array.from({ length: mems }, (_, i) => memId(i + 1)),
];

test("every neuron of a newborn with recall and 13 memory neurons gets a position, and no two share one", () => {
  const all = ids(true, 13);
  const pos = layout3d(all, C.rayAngles);
  assert.equal(pos.size, all.length);
  const keys = [...pos.values()].map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`);
  assert.equal(new Set(keys).size, keys.length, "positions are distinct");
});

test("the left side is +z everywhere: the leftmost ray, the left lane's Go and the left motor", () => {
  const pos = layout3d(ids(false), C.rayAngles);
  const leftRay = C.rayAngles.indexOf(Math.max(...C.rayAngles));
  assert.ok(pos.get(`ray${leftRay}.food`)!.z > 0, "leftmost ray");
  assert.equal(pos.get("bg.go.left")!.z, LANE.left);
  assert.equal(pos.get("motor.left")!.z, LANE.left);
  assert.ok(LANE.left! > 0 && LANE.right! < 0);
});

test("columns follow the signal: sense < recalled sense < Go < selection < motor", () => {
  const pos = layout3d(ids(true), C.rayAngles);
  const x = (id: string) => pos.get(id)!.x;
  assert.ok(x("ray0.food") < x("rec0.food") && x("rec0.food") < x("bg.go.left") && x("bg.go.left") < x("bg.out.left") && x("bg.out.left") < x("motor.left"));
  assert.equal(x("bg.nogo.left"), COLUMN_X["bg.nogo"]);
});

test("a recalled sense sits in line with its ray (same z), Go above NoGo", () => {
  const pos = layout3d(ids(true), C.rayAngles);
  C.rayAngles.forEach((_, i) => assert.equal(pos.get(`rec${i}.food`)!.z, pos.get(`ray${i}.food`)!.z, `ray ${i}`));
  assert.ok(pos.get("bg.go.forward")!.y > pos.get("bg.nogo.forward")!.y);
});
