// brain-lab/development/development.test.ts — newborns: spontaneous movement gives experience,
// birth wiring is weak and random, innate reflexes exist only in the reflexive group.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BrainSimulator } from "../brain-ir/simulator.ts";
import { checkGraph, graphHash } from "../registry/index.ts";
import { brainController, checkWiring, sensorNodeIds } from "../sensorimotor/index.ts";
import { DEFAULT_CONFIG as C, Room, runEpisode, type RoomState } from "../world/index.ts";
import {
  DEFAULT_MAX_WEIGHT, INNATE_REFLEXES, SPONTANEOUS_IDS, SpontaneousGenerator, bornGraph, spontaneousTarget,
} from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SILENT = { pOn: 0, pOff: 1 };

function newborn(seed: number, group: "reflexless" | "reflexive", babble = true) {
  const graph = bornGraph(C, { seed, group });
  const gen = new SpontaneousGenerator(seed + 1000, babble ? undefined : SILENT);
  const ctl = brainController(new BrainSimulator(graph), C, { keepSteps: true, extraInputs: gen.asExtraInputs() });
  return { graph, ctl };
}

const travelled = (room: Room, start: { x: number; y: number }) => Math.hypot(room.state().body.x - start.x, room.state().body.y - start.y);

test("dependencies: world, sensorimotor, brain-ir and registry never import development", () => {
  for (const dir of ["../world", "../sensorimotor", "../brain-ir", "../registry", "../neuromodulation"]) {
    for (const f of readdirSync(join(HERE, dir)).filter((n) => n.endsWith(".ts"))) {
      assert.doesNotMatch(readFileSync(join(HERE, dir, f), "utf8"), /development\//, `${dir}/${f} imports development`);
    }
  }
});

// --- spontaneous activity ------------------------------------------------------

test("spontaneous bursts: deterministic per seed, silent at pOn 0, and match their rates over time", () => {
  const a = new SpontaneousGenerator(5);
  const b = new SpontaneousGenerator(5);
  for (let t = 0; t < 200; t++) assert.deepEqual(a.next(), b.next());
  const quiet = new SpontaneousGenerator(5, SILENT);
  for (let t = 0; t < 500; t++) assert.ok(Object.values(quiet.next()).every((v) => v === 0));

  const g = new SpontaneousGenerator(9, { pOn: 0.05, pOff: 0.2 });
  let on = 0;
  let bursts = 0;
  let prev = 0;
  const N = 40_000;
  for (let t = 0; t < N; t++) {
    const v = g.next()["spont.forward"] as number;
    on += v;
    if (v === 1 && prev === 0) bursts++;
    prev = v;
  }
  const expectedOn = 0.05 / (0.05 + 0.2);
  assert.ok(Math.abs(on / N - expectedOn) < 0.02, `on-fraction ${on / N} vs ${expectedOn}`);
  assert.ok(Math.abs(on / bursts - 1 / 0.2) < 0.4, `mean burst ${on / bursts} vs 5`);
  assert.throws(() => new SpontaneousGenerator(1, { pOn: 1.2, pOff: 0.1 }), RangeError);
});

test("controller: extra inputs must have nodes and may not overwrite a world sense", () => {
  const graph = bornGraph(C, { seed: 1, group: "reflexless" });
  const sim = () => new BrainSimulator(graph);
  assert.throws(() => brainController(sim(), C, { extraInputs: { ids: ["spont.ghost"], next: () => ({}) } }), /has no node/);
  assert.throws(() => brainController(sim(), C, { extraInputs: { ids: ["ray2.food"], next: () => ({}) } }), /overwrite a world sense/);
});

// --- birth ----------------------------------------------------------------------

test("birth: a valid, deterministic brain; random weights stay weak; reflexes only in the reflexive group", () => {
  for (const seed of [1, 2, 3, 40]) {
    for (const group of ["reflexless", "reflexive"] as const) {
      const g = bornGraph(C, { seed, group });
      assert.doesNotThrow(() => { checkGraph(g); checkWiring(g, C); });
      assert.equal(graphHash(bornGraph(C, { seed, group })), graphHash(g), "birth is not deterministic");
      const reflexKeys = new Set(INNATE_REFLEXES.map((r) => `${r.from}->${r.to}`));
      for (const e of g.connections) {
        const key = `${e.from}->${e.to}`;
        if (e.from.startsWith("spont.")) assert.equal(e.to, spontaneousTarget(e.from));
        else if (group === "reflexive" && reflexKeys.has(key)) assert.ok(Math.abs(e.weight) > DEFAULT_MAX_WEIGHT);
        else assert.ok(Math.abs(e.weight) <= DEFAULT_MAX_WEIGHT, `${key} ${e.weight} is not weak`);
      }
      const has = (k: string) => g.connections.some((e) => `${e.from}->${e.to}` === k && Math.abs(e.weight) > DEFAULT_MAX_WEIGHT);
      for (const k of reflexKeys) assert.equal(has(k), group === "reflexive", `${group} ${seed}: reflex ${k}`);
      assert.equal(g.connections.filter((e) => e.from.startsWith("spont.")).length, SPONTANEOUS_IDS.length);
    }
  }
  // Compare wiring, not the whole graph: the graph's name carries the seed and would hide a seed-blind birth.
  const wiring = (seed: number) => JSON.stringify(bornGraph(C, { seed, group: "reflexless" }).connections);
  assert.notEqual(wiring(1), wiring(2), "different seeds must give different wiring");
  assert.throws(() => bornGraph(C, { seed: 1, group: "reflexless", maxWeight: 0.6 }), /that is behavior/);
  const dense = bornGraph(C, { seed: 1, group: "reflexless", density: 1 });
  assert.equal(dense.connections.length, sensorNodeIds(C).length * 4 + SPONTANEOUS_IDS.length);
});

test("measured, not assumed: weak random wiring alone rarely moves a newborn", () => {
  let movedFar = 0;
  let motorTicks = 0;
  let ticks = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const room = new Room(seed);
    const start = room.state().body;
    const { ctl } = newborn(seed, "reflexless", false);
    const ep = runEpisode(room, ctl.policy, 600);
    ticks += ep.ticks;
    motorTicks += ctl.steps.filter((s) => ["motor.forward", "motor.back", "motor.left", "motor.right"].some((m) => s.outputs[m] === 1)).length;
    if (travelled(room, start) > 1) movedFar++;
  }
  // Recorded for the notebook; the bound only guards against birth wiring turning into behavior.
  console.log(`  [measured] no babbling: motors active on ${(100 * motorTicks / ticks).toFixed(1)}% of ticks, ${movedFar}/20 moved >1 m`);
  assert.ok(movedFar <= 5, `${movedFar}/20 newborns travel without babbling: birth wiring acts like behavior`);
});

test("babbling gives experience: newborns move, touch walls, and the trace names the generator", () => {
  let moved = 0;
  let bumps = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const room = new Room(seed);
    const start = room.state().body;
    const { ctl } = newborn(seed, "reflexless", true);
    const ep = runEpisode(room, ctl.policy, 600);
    bumps += ep.bumps;
    if (travelled(room, start) > 1) moved++;
    if (seed === 1) {
      const fired = ctl.steps.flatMap((s) => s.trace).find((t) => t.node === "motor.left" && t.activated)!;
      assert.ok(fired, "no left turn in 600 ticks of babbling");
      assert.ok(fired.causeNodes.includes("spont.left"), "trace does not show the spontaneous cause");
    }
  }
  console.log(`  [measured] with babbling: ${moved}/20 moved >1 m, ${bumps} wall contacts in total`);
  assert.ok(moved >= 15, `only ${moved}/20 babbling newborns moved`);
});

test("reflexive newborn: a bump turns it left next tick; the reflexless one has no such reflex", () => {
  const atWall = (): Room => {
    const s = new Room(1, { foodCount: 0, threatCount: 0 }).state();
    return Room.fromState({ ...s, body: { ...s.body, x: C.width - C.bodyRadius - 0.01, heading: 0, vx: 2 } } as RoomState);
  };
  const turnsAfterBump = (group: "reflexless" | "reflexive") => {
    const room = atWall();
    const { ctl } = newborn(3, group, false);
    const ep = runEpisode(room, ctl.policy, 4, true);
    return ep.records.map((r) => r.action.turn);
  };
  const reflexive = turnsAfterBump("reflexive");
  assert.ok(reflexive.slice(1).includes(1), `reflexive turns: ${reflexive}`);
  const reflexless = turnsAfterBump("reflexless");
  assert.ok(!reflexless.includes(1), `reflexless turns: ${reflexless}`);
});
