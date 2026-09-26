// brain-lab/regions/regions.test.ts — region borders are code borders: every connection must
// travel on a pathway of the table, with the right node types and signs.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrainGrafi } from "../brain-ir/ir.ts";
import { MOTOR_NODE_IDS, sensorNodeIds, sensorimotorScaffold } from "../sensorimotor/index.ts";
import { DEFAULT_CONFIG as C } from "../world/index.ts";
import { ACTIONS, HYP_NODES, PATHWAYS, REGION_TYPE, checkPathways, isPlastic, memId, nodeId, pathwayOf, regionOf } from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every regional node, with no edges: a valid empty regional brain. */
function nodes(): BrainGrafi["nodes"] {
  return [
    ...sensorNodeIds(C).map((id) => ({ id, type: "sensor" as const })),
    ...HYP_NODES.map((id) => ({ id, type: "neuron" as const })),
    ...ACTIONS.flatMap((a) => [
      { id: nodeId("noise", a), type: "input" as const },
      { id: nodeId("cpg", a), type: "decision" as const },
      { id: nodeId("bg.go", a), type: "neuron" as const },
      { id: nodeId("bg.nogo", a), type: "neuron" as const },
      { id: nodeId("bg.out", a), type: "decision" as const },
    ]),
    ...MOTOR_NODE_IDS.map((id) => ({ id, type: "motor" as const })),
  ];
}

const withEdges = (edges: [string, string, number][]): BrainGrafi => ({
  nodes: nodes(),
  connections: edges.map(([from, to, weight]) => ({ from, to, weight })),
});

test("dependencies: regions import only brain-ir types; world, sensorimotor, brain-ir never import regions", () => {
  for (const f of readdirSync(HERE).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
    const imports = [...readFileSync(join(HERE, f), "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const i of imports) assert.match(i, /^(\.\/[\w-]+\.ts|\.\.\/brain-ir\/ir\.ts)$/, `${f} imports ${i}`);
  }
  for (const dir of ["../world", "../sensorimotor", "../brain-ir", "../registry", "../neuromodulation"]) {
    for (const f of readdirSync(join(HERE, dir)).filter((n) => n.endsWith(".ts"))) {
      assert.doesNotMatch(readFileSync(join(HERE, dir, f), "utf8"), /regions\//, `${dir}/${f} imports regions`);
    }
  }
});

test("regions: every node id maps to exactly one region, per-action regions know their action", () => {
  assert.deepEqual(regionOf("ray3.food"), { region: "sense" });
  assert.deepEqual(regionOf("proprio.left"), { region: "sense" });
  assert.deepEqual(regionOf("hyp.hunger"), { region: "hyp" });
  assert.deepEqual(regionOf("cpg.noise.left"), { region: "noise", action: "left" });
  assert.deepEqual(regionOf("cpg.left"), { region: "cpg", action: "left" });
  assert.deepEqual(regionOf("bg.nogo.back"), { region: "bg.nogo", action: "back" });
  assert.deepEqual(regionOf("motor.forward"), { region: "motor", action: "forward" });
  for (const bad of ["spont.left", "cpg.jump", "bg.go", "hyp.thirst", "relay", "motor.jump"]) assert.equal(regionOf(bad), null, bad);
  const all = nodes();
  assert.equal(new Set(all.map((n) => n.id)).size, all.length);
  for (const n of all) assert.equal(REGION_TYPE[regionOf(n.id)!.region], n.type, n.id);
});

test("memory neurons (TASARIM-008) belong to region mem, are numbered, and must be of type memory", () => {
  assert.deepEqual(regionOf(memId(7)), { region: "mem" });
  assert.equal(memId(7), "mem.food.7");
  for (const bad of ["mem.food", "mem.food.x", "mem.food.-1", "mem.wall.1", "mem.1"]) assert.equal(regionOf(bad), null, bad);
  const grown = withEdges([]);
  assert.doesNotThrow(() => checkPathways({ ...grown, nodes: [...grown.nodes, { id: memId(1), type: "memory" }] }));
  assert.throws(() => checkPathways({ ...grown, nodes: [...grown.nodes, { id: memId(1), type: "neuron" }] }), /mem\.food\.1 is neuron, region mem needs memory/);
});

test("a valid empty regional brain passes; the old flat brain (sense → motor) is refused", () => {
  assert.doesNotThrow(() => checkPathways(withEdges([])));
  const flat = { ...sensorimotorScaffold(C), connections: [{ from: "ray2.food", to: "motor.forward", weight: 1 }] };
  assert.throws(() => checkPathways(flat), /ray2\.food->motor\.forward is not in the pathway table/);
});

test("every row of the table accepts its own kind of edge", () => {
  const ok: [string, string, number][] = [
    ["ray2.food", "bg.go.left", 0.03], // P1
    ["touch.bump", "bg.nogo.forward", 0.02], // P2
    ["intero.hunger", "hyp.hunger", 1], // P3
    ["intero.injury", "hyp.pain", 3], // P3
    ["hyp.hunger", "cpg.right", 0.5], // P4
    ["hyp.hunger", "bg.go.back", 0.1], // P5
    ["cpg.noise.left", "cpg.left", 0.4], // P6
    ["cpg.left", "bg.go.left", 0.6], // P7
    ["bg.go.left", "bg.out.left", 1], // P8
    ["bg.nogo.left", "bg.out.left", -1], // P9
    ["bg.go.left", "bg.go.right", -0.5], // P10
    ["bg.out.left", "motor.left", 1], // P11
  ];
  assert.doesNotThrow(() => checkPathways(withEdges(ok)));
  assert.deepEqual(ok.map(([from, to]) => pathwayOf({ from, to })!.id), ["P1", "P2", "P3", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11"]);
  assert.equal(new Set(PATHWAYS.map((p) => p.id)).size, PATHWAYS.length);
  for (const p of PATHWAYS) assert.ok(p.why.length > 20, `${p.id} has no real reason`);
});

test("forbidden: crossed actions, wrong pairs, goal-shaped shortcuts, wrong signs, unknown or mistyped nodes", () => {
  const refuse = (edges: [string, string, number][], re: RegExp) => assert.throws(() => checkPathways(withEdges(edges)), re);
  refuse([["cpg.left", "bg.go.right", 0.6]], /cpg\.left->bg\.go\.right is not in the pathway table/);
  refuse([["cpg.noise.left", "cpg.right", 0.4]], /not in the pathway table/);
  refuse([["bg.out.left", "motor.right", 1]], /not in the pathway table/);
  refuse([["bg.go.left", "bg.go.forward", -0.5]], /not in the pathway table/); // not antagonists
  refuse([["intero.hunger", "hyp.pain", 1]], /not in the pathway table/);
  refuse([["hyp.pain", "cpg.left", 1]], /not in the pathway table/); // only hunger drives the generators
  refuse([["ray2.food", "hyp.hunger", 1]], /not in the pathway table/); // prediction pathway: later, and learned
  refuse([["ray2.food", "cpg.forward", 1]], /not in the pathway table/); // a sight cannot command a generator
  refuse([["ray2.food", "bg.out.forward", 1]], /not in the pathway table/); // nor bypass selection
  refuse([["bg.go.left", "bg.go.right", 0.5]], /must be negative/);
  refuse([["bg.nogo.left", "bg.out.left", 1]], /must be negative/);
  refuse([["ray2.food", "bg.go.left", -0.1]], /must be positive/);
  assert.throws(() => checkPathways({ nodes: [...nodes(), { id: "relay", type: "neuron" }], connections: [] }), /relay belongs to no region/);
  const mistyped = nodes().map((n) => (n.id === "cpg.left" ? { ...n, type: "neuron" as const } : n));
  assert.throws(() => checkPathways({ nodes: mistyped, connections: [] }), /cpg\.left is neuron, region cpg needs decision/);
});

test("plasticity: only edges into selection (from senses, the expansion layer, the side comparison or recalled senses) learn; every innate pathway is fixed", () => {
  assert.equal(isPlastic({ from: "ray0.food", to: "bg.go.left" }), true);
  assert.equal(isPlastic({ from: "proprio.forward", to: "bg.nogo.back" }), true);
  assert.equal(isPlastic({ from: "kc.7", to: "bg.go.right" }), true);
  assert.equal(isPlastic({ from: "kc.7", to: "bg.nogo.forward" }), true);
  assert.equal(isPlastic({ from: "ray0.food", to: "kc.7" }), false, "the expansion itself is innate");
  assert.equal(isPlastic({ from: "lat.food.left", to: "bg.go.left" }), true);
  assert.equal(isPlastic({ from: "ray4.food", to: "lat.food.left" }), false, "the side comparison itself is innate");
  assert.equal(isPlastic({ from: "rec3.food", to: "bg.go.left" }), true, "a recalled sense's rule synapse learns (P18)");
  for (const [from, to] of [["intero.hunger", "hyp.hunger"], ["hyp.hunger", "cpg.left"], ["cpg.left", "bg.go.left"], ["bg.out.left", "motor.left"], ["ray0.food", "motor.left"]]) {
    assert.equal(isPlastic({ from: from!, to: to! }), false, `${from}->${to}`);
  }
  assert.deepEqual(PATHWAYS.filter((p) => p.learns).map((p) => p.id), ["P1", "P2", "P13", "P14", "P16", "P17", "P18"]);
});

test("recalled senses: their only pathway is to Go (§7); to NoGo, to a motor or from a memory neuron there is none", () => {
  assert.equal(regionOf("rec0.food")?.region, "rec");
  assert.equal(regionOf("rec2.wall"), null, "only food is recalled so far; a new kind is a design decision");
  assert.equal(pathwayOf({ from: "rec2.food", to: "bg.go.forward" })?.id, "P18");
  for (const [from, to] of [["rec2.food", "bg.nogo.forward"], ["rec2.food", "motor.forward"], ["mem.food.1", "rec2.food"], ["ray2.food", "rec2.food"]]) {
    assert.equal(pathwayOf({ from: from!, to: to! }), null, `${from}->${to}`);
  }
});
