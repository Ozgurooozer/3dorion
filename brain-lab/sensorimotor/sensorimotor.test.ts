// brain-lab/sensorimotor/sensorimotor.test.ts — adversarial tests first: try to break
// the nerves between world and brain before trusting anything built on them.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrainGrafi } from "../brain-ir/ir.ts";
import { BrainSimulator } from "../brain-ir/simulator.ts";
import { DEFAULT_CONFIG as C, Rng, Room, makeConfig, runEpisode, type Observation, type RoomState } from "../world/index.ts";
import {
  BODY_SENSOR_IDS, MOTOR_NODE_IDS, RAY_KINDS, brainController, checkWiring, decodeMotor,
  encodeObservation, sensorNodeIds, sensorimotorScaffold,
} from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const CENTER = { x: C.width / 2, y: C.height / 2 };

/** Scaffold plus hand-drawn edges. Test fixtures only: shipped brains never get hand-wired behavior. */
function wired(edges: [string, string, number][], extraNodes: BrainGrafi["nodes"] = []): BrainGrafi {
  const g = sensorimotorScaffold(C, "test-fixture");
  return { ...g, nodes: [...g.nodes, ...extraNodes], connections: edges.map(([from, to, weight]) => ({ from, to, weight })) };
}

/** A world with only the given food items, no threats, body at the center facing +x. */
function roomWithFood(...foods: { x: number; y: number }[]): Room {
  const base = new Room(1).state();
  const entities: RoomState["entities"] = foods.map((f, i) => ({ id: `food-${i}`, kind: "food", ...f, r: C.foodRadius }));
  return Room.fromState({ ...base, entities });
}

// --- structure ---------------------------------------------------------------

test("dependency direction: neither world/ nor brain-ir/ imports sensorimotor", () => {
  for (const dir of ["../world", "../brain-ir"]) {
    const abs = join(HERE, dir);
    for (const f of readdirSync(abs).filter((n) => n.endsWith(".ts"))) {
      assert.doesNotMatch(readFileSync(join(abs, f), "utf8"), /sensorimotor/, `${dir}/${f} reaches into sensorimotor`);
    }
  }
});

// --- encoding ----------------------------------------------------------------

test("encoding: every node value matches a hand computation", () => {
  const obs: Observation = {
    rays: [
      { distance: C.rayRange, hit: "none" },
      { distance: 1, hit: "wall" },
      { distance: 2.5, hit: "food" },
      { distance: 0, hit: "threat" },
      { distance: 4, hit: "food" },
    ],
    bump: true,
    energy: 0.25,
    health: 0.9,
  };
  const inputs = encodeObservation(obs, C);
  const expected: Record<string, number> = {};
  for (const id of sensorNodeIds(C)) expected[id] = 0;
  Object.assign(expected, {
    "ray1.wall": 1 - 1 / C.rayRange,
    "ray2.food": 1 - 2.5 / C.rayRange,
    "ray3.threat": 1,
    "ray4.food": 1 - 4 / C.rayRange,
    "touch.bump": 1,
    "intero.hunger": 1 - 0.25,
    "intero.injury": 1 - 0.9,
  });
  assert.deepEqual(inputs, expected);
});

test("encoding: over real worlds every value is in [0,1] and each ray lights at most one kind", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const room = new Room(seed);
    const rng = new Rng(seed);
    for (let t = 0; t < 500 && !room.done; t++) {
      const inputs = encodeObservation(room.observe(), C);
      assert.deepEqual(Object.keys(inputs).sort(), sensorNodeIds(C).sort());
      for (const [id, v] of Object.entries(inputs)) assert.ok(typeof v === "number" && v >= 0 && v <= 1, `${id}=${v}`);
      C.rayAngles.forEach((_, i) => {
        const lit = RAY_KINDS.filter((k) => (inputs[`ray${i}.${k}`] as number) > 0);
        assert.ok(lit.length <= 1, `ray${i} lights ${lit.join("+")}`);
      });
      room.step({ thrust: rng.range(-1, 1), turn: rng.range(-1, 1) });
    }
  }
});

test("encoding: sensor list follows the ray config, and a mismatched observation is refused", () => {
  const three = makeConfig({ rayAngles: [-1, 0, 1] });
  assert.equal(sensorNodeIds(three).length, 3 * RAY_KINDS.length + BODY_SENSOR_IDS.length);
  assert.equal(sensorNodeIds(C).length, 18);
  assert.throws(() => encodeObservation(new Room(1).observe(), three), /5 rays, config expects 3/);
});

// --- decoding ----------------------------------------------------------------

test("decoding: all 16 motor spike patterns give the right command, and the world accepts each", () => {
  for (let bits = 0; bits < 16; bits++) {
    const [f, b, l, r] = [0, 1, 2, 3].map((i) => (bits >> i) & 1);
    const a = decodeMotor({ "motor.forward": f!, "motor.back": b!, "motor.left": l!, "motor.right": r! });
    assert.deepEqual(a, { thrust: f! - b!, turn: l! - r! }, `bits ${bits}`);
    assert.doesNotThrow(() => new Room(1).step(a));
  }
});

test("decoding: a missing or non-spike motor output is refused", () => {
  const ok = { "motor.forward": 0, "motor.back": 0, "motor.left": 0, "motor.right": 0 };
  for (const bad of [{ ...ok, "motor.back": 0.7 }, { ...ok, "motor.left": 2 }, { "motor.forward": 1 }]) {
    assert.throws(() => decodeMotor(bad), RangeError, JSON.stringify(bad));
  }
});

// --- wiring ------------------------------------------------------------------

test("wiring: a graph missing a nerve, or with a nerve of the wrong type, is refused by name", () => {
  const g = sensorimotorScaffold(C);
  assert.doesNotThrow(() => checkWiring(g, C));
  const noSensor = { ...g, nodes: g.nodes.filter((n) => n.id !== "ray2.food") };
  assert.throws(() => brainController(new BrainSimulator(noSensor), C), /missing sensor ray2\.food/);
  const noMotor = { ...g, nodes: g.nodes.filter((n) => n.id !== "motor.left") };
  assert.throws(() => brainController(new BrainSimulator(noMotor), C), /missing motor motor\.left/);
  const wrongType = { ...g, nodes: g.nodes.map((n) => (n.id === "motor.back" ? { ...n, type: "neuron" as const } : n)) };
  assert.throws(() => checkWiring(wrongType, C), /motor\.back is neuron, must be motor/);
  assert.equal(g.connections.length, 0, "the scaffold must not carry behavior");
  assert.deepEqual(g.nodes.filter((n) => n.type === "motor").map((n) => n.id), [...MOTOR_NODE_IDS]);
});

// --- end to end --------------------------------------------------------------

test("dead brain: an unconnected scaffold never moves and starves on schedule", () => {
  const room = new Room(7);
  const start = room.state().body;
  const { policy, steps } = brainController(new BrainSimulator(sensorimotorScaffold(C)), C, { keepSteps: true });
  const ep = runEpisode(room, policy, 100_000);
  assert.equal(ep.doneCause, "starved");
  assert.ok(Math.abs(ep.ticks - 1 / C.basalEnergyCost) <= 1, `starved after ${ep.ticks}`);
  assert.equal(ep.bumps, 0);
  const end = room.state().body;
  assert.deepEqual({ x: end.x, y: end.y }, { x: start.x, y: start.y });
  assert.ok(steps.every((s) => MOTOR_NODE_IDS.every((id) => s.outputs[id] === 0)));
});

test("pipe test: one hand-drawn arc ray2.food → motor.forward carries the body to food and it eats", () => {
  const room = roomWithFood({ x: CENTER.x + 2, y: CENTER.y });
  const { policy, steps } = brainController(new BrainSimulator(wired([["ray2.food", "motor.forward", 1]])), C, { keepSteps: true });
  const ep = runEpisode(room, policy, 60, true);
  assert.ok(ep.foodEaten >= 1, "the arc never delivered the body to the food");
  // Stimulus is there from tick 0; a direct arc acts one tick later.
  assert.equal(ep.records[0]!.action.thrust, 0);
  assert.equal(ep.records[1]!.action.thrust, 1);
  assert.equal(steps[0]!.inputs["ray2.food"], 1 - (2 - C.foodRadius) / C.rayRange);
});

test("conduction delay: sensor → neuron → motor acts exactly two ticks after the stimulus", () => {
  const room = roomWithFood({ x: CENTER.x + 2, y: CENTER.y });
  const g = wired([["ray2.food", "relay", 1], ["relay", "motor.forward", 1]], [{ id: "relay", type: "neuron" }]);
  const ep = runEpisode(room, brainController(new BrainSimulator(g), C).policy, 5, true);
  assert.deepEqual(ep.records.map((r) => r.action.thrust), [0, 0, 1, 1, 1]);
});

test("the trace follows the arc: the motor's causes name the sensor that drove it", () => {
  const room = roomWithFood({ x: CENTER.x + 2, y: CENTER.y });
  const { policy, steps } = brainController(new BrainSimulator(wired([["ray2.food", "motor.forward", 1]])), C, { keepSteps: true });
  runEpisode(room, policy, 2);
  const fwd = steps[1]!.trace.find((t) => t.node === "motor.forward")!;
  const bare = brainController(new BrainSimulator(wired([["ray2.food", "motor.forward", 1]])), C);
  assert.equal(bare.last, null);
  runEpisode(roomWithFood({ x: CENTER.x + 2, y: CENTER.y }), bare.policy, 2);
  assert.deepEqual(bare.last!.states, steps[1]!.states, "last is not the latest step");
  assert.equal(bare.steps.length, 0);
  assert.equal(fwd.activated, true);
  assert.ok(fwd.causeNodes.includes("ray2.food"));
});

test("determinism: same world seed and same graph give identical worlds and brain states", () => {
  const g = wired([
    ["ray2.food", "motor.forward", 1],
    ["ray1.food", "motor.left", 1],
    ["ray3.food", "motor.right", 1],
    ["ray2.wall", "motor.left", 0.8],
    ["intero.hunger", "motor.forward", 0.6],
  ]);
  const once = () => {
    const c = brainController(new BrainSimulator(g), C, { keepSteps: true });
    const ep = runEpisode(new Room(21), c.policy, 3000);
    return { hash: ep.finalHash, ticks: ep.ticks, states: JSON.stringify(c.steps.map((s) => s.states)) };
  };
  const a = once();
  const b = once();
  assert.equal(b.hash, a.hash);
  assert.equal(b.ticks, a.ticks);
  assert.equal(b.states, a.states);
});
