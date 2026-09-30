// brain-lab/development/directed.test.ts — recall rules "directed" (prereg 004 part B): a labelled birth group in which
// each recalled sense is wired, from birth, to the Go of the direction its ray points to. Every case is a fresh newborn.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { graphHash } from "../registry/index.ts";
import { isPlastic, pathwayOf } from "../regions/index.ts";
import { DEFAULT_CONFIG as C } from "../world/index.ts";
import { actionOfAngle, bornGraph } from "./index.ts";

type Born = ReturnType<typeof bornGraph>;
const recEdges = (g: Born) => g.connections.filter((e) => e.from.startsWith("rec"));
const directed = (weight?: number, seed = 3) => bornGraph(C, { seed, group: "reflexless", recall: { rules: "directed", ...(weight === undefined ? {} : { weight }) } });

test("directed: exactly one rule synapse per ray, rec{i} → the Go of the action ray i points to", () => {
  const rules = recEdges(directed());
  assert.deepEqual(rules.map((e) => `${e.from}->${e.to}`), C.rayAngles.map((a, i) => `rec${i}.food->bg.go.${actionOfAngle(a)}`));
});

test("directed: the weight is the same for every synapse and defaults to 0.3", () => {
  assert.ok(recEdges(directed()).every((e) => e.weight === 0.3), "default");
  assert.ok(recEdges(directed(0.6)).every((e) => e.weight === 0.6), "explicit 0.6");
});

test("directed: every rule synapse is on the rule pathway and plastic (so learning can move it, or a filter can hold it)", () => {
  assert.ok(recEdges(directed()).every((e) => isPlastic(e) && pathwayOf(e)?.id === "P18"));
});

test("directed: the rest of the newborn is the grown newborn — same nodes, same edges before the rules", () => {
  const grown = bornGraph(C, { seed: 3, group: "reflexless", recall: { rules: "grown" } });
  const d = directed();
  assert.deepEqual(d.nodes, grown.nodes, "nodes");
  assert.deepEqual(d.connections.slice(0, grown.connections.length), grown.connections, "edges before the rules");
  assert.equal(d.connections.length, grown.connections.length + C.rayAngles.length);
});

test("directed: no random draw — the same at any seed apart from the seed's own newborn", () => {
  const w = (seed: number) => recEdges(directed(undefined, seed)).map((e) => e.weight);
  assert.deepEqual(w(1), w(9));
});

test("directed: the default weight and an explicit 0.3 are the same newborn, a different weight is not", () => {
  assert.equal(graphHash(directed()), graphHash(directed(0.3)));
  assert.notEqual(graphHash(directed(0.3)), graphHash(directed(0.6)));
  assert.notEqual(directed(0.3).name, directed(0.6).name, "the name says which weight");
});

test("directed: weights outside (0, 0.6] are refused, the edges 0.6 and just above 0 are accepted", () => {
  for (const bad of [0, -0.1, 0.61, 1, Number.NaN]) assert.throws(() => directed(bad), RangeError, `weight ${bad}`);
  for (const ok of [0.6, 0.01]) assert.doesNotThrow(() => directed(ok), `weight ${ok}`);
});

test("directed with maxInitial, and weight with grown or innate, are refused (each option belongs to one group)", () => {
  assert.throws(() => bornGraph(C, { seed: 3, group: "reflexless", recall: { rules: "directed", maxInitial: 0.02 } }), RangeError);
  assert.throws(() => bornGraph(C, { seed: 3, group: "reflexless", recall: { rules: "grown", weight: 0.3 } }), RangeError);
  assert.throws(() => bornGraph(C, { seed: 3, group: "reflexless", recall: { rules: "innate", weight: 0.3 } }), RangeError);
});
