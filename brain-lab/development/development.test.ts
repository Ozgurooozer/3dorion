// brain-lab/development/development.test.ts — the newborn regional brain: hunger moves it,
// a sated one rests, selection keeps antagonists apart, birth wiring is weak and legal.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrainAdimi } from "../brain-ir/ir.ts";
import { BrainSimulator } from "../brain-ir/simulator.ts";
import { checkGraph, graphHash } from "../registry/index.ts";
import { ACTIONS, checkPathways, isPlastic, pathwayOf, senseToMotorDelay } from "../regions/index.ts";
import { brainController, checkWiring, sensorNodeIds } from "../sensorimotor/index.ts";
import { DEFAULT_CONFIG as C, Room, runEpisode, type RoomState } from "../world/index.ts";
import { DEFAULT_MAX_INITIAL, INNATE_REFLEXES, NOISE_IDS, NoiseGenerator, MAX_ORIENTING, actionOfAngle, bornGraph, type InnateGroup } from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

function live(seed: number, group: InnateGroup, energy: number, ticks = 300) {
  const room = new Room(seed, { initialEnergy: energy, threatCount: 0 });
  const start = room.state().body;
  const ctl = brainController(new BrainSimulator(bornGraph(C, { seed, group })), C, {
    keepSteps: true,
    extraInputs: new NoiseGenerator(seed + 99).asExtraInputs(),
  });
  runEpisode(room, ctl.policy, ticks);
  const b = room.state().body;
  return { steps: ctl.steps, moved: Math.hypot(b.x - start.x, b.y - start.y) };
}

const rate = (steps: readonly BrainAdimi[], prefix: string) =>
  steps.reduce((s, st) => s + ACTIONS.filter((a) => st.outputs[`${prefix}.${a}`] === 1).length / ACTIONS.length, 0) / steps.length;

const together = (st: BrainAdimi) =>
  (st.outputs["motor.forward"] === 1 && st.outputs["motor.back"] === 1) || (st.outputs["motor.left"] === 1 && st.outputs["motor.right"] === 1);

test("dependencies: nothing below development imports it", () => {
  for (const dir of ["../world", "../sensorimotor", "../brain-ir", "../registry", "../neuromodulation", "../regions"]) {
    for (const f of readdirSync(join(HERE, dir)).filter((n) => n.endsWith(".ts"))) {
      assert.doesNotMatch(readFileSync(join(HERE, dir, f), "utf8"), /development\//, `${dir}/${f} imports development`);
    }
  }
});

// --- noise ----------------------------------------------------------------------------

test("noise: deterministic, in [0,1], spread like a uniform variable, and correlated in time", () => {
  const a = new NoiseGenerator(5);
  const b = new NoiseGenerator(5);
  for (let t = 0; t < 100; t++) assert.deepEqual(a.next(), b.next());
  const g = new NoiseGenerator(8);
  const xs: number[] = [];
  for (let t = 0; t < 30_000; t++) xs.push(g.next()[NOISE_IDS[0]!] as number);
  assert.ok(xs.every((x) => x >= 0 && x <= 1));
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
  let lag = 0;
  for (let i = 1; i < xs.length; i++) lag += (xs[i]! - mean) * (xs[i - 1]! - mean);
  const autocorr = lag / (xs.length - 1) / (sd * sd);
  assert.ok(Math.abs(mean - 0.5) < 0.02, `mean ${mean}`);
  assert.ok(sd > 0.2 && sd < 0.32, `spread ${sd} (uniform is 0.289)`);
  assert.ok(autocorr > 0.6, `autocorrelation ${autocorr}: noise must come in bursts`);
  assert.throws(() => new NoiseGenerator(1, { smoothing: 1 }), RangeError);
});

// --- birth ----------------------------------------------------------------------------

test("birth: legal regions, deterministic, weak learning pathways, reflexes only in the reflexive group", () => {
  const reflexKeys = new Set(INNATE_REFLEXES.map((r) => `${r.from}->${r.to}`));
  for (const seed of [1, 2, 40]) {
    for (const group of ["reflexless", "reflexive"] as const) {
      const g = bornGraph(C, { seed, group });
      assert.doesNotThrow(() => { checkGraph(g); checkWiring(g, C); checkPathways(g); });
      assert.equal(graphHash(bornGraph(C, { seed, group })), graphHash(g));
      const plastic = g.connections.filter((e) => isPlastic(e));
      assert.equal(plastic.length, sensorNodeIds(C).length * ACTIONS.length * 2, "every sense must reach every Go and NoGo");
      for (const e of plastic) {
        const key = `${e.from}->${e.to}`;
        if (group === "reflexive" && reflexKeys.has(key)) assert.ok(e.weight > DEFAULT_MAX_INITIAL);
        else assert.ok(e.weight >= 0 && e.weight <= DEFAULT_MAX_INITIAL, `${key} ${e.weight} not weak`);
      }
      for (const k of reflexKeys) {
        const w = g.connections.find((e) => `${e.from}->${e.to}` === k)!.weight;
        assert.equal(w > DEFAULT_MAX_INITIAL, group === "reflexive", `${group}: ${k}`);
      }
      for (const r of INNATE_REFLEXES) assert.equal(pathwayOf(r)?.learns, true, "reflexes must sit on a learning pathway");
    }
  }
  const wiring = (seed: number) => JSON.stringify(bornGraph(C, { seed, group: "reflexless" }).connections);
  assert.notEqual(wiring(1), wiring(2), "different seeds must give different wiring");
  assert.throws(() => bornGraph(C, { seed: 1, group: "reflexless", maxInitial: 0.7 }), /that is behavior/);
});

// --- behavior of the newborn (measured 2026-09-24; see LAB-DEFTERI) -----------------------

test("a sated newborn rests: no generator, no motor, no movement", () => {
  for (let seed = 1; seed <= 5; seed++) {
    const { steps, moved } = live(seed, "reflexless", 1);
    assert.equal(rate(steps, "cpg"), 0);
    assert.equal(rate(steps, "motor"), 0);
    assert.equal(moved, 0);
  }
});

test("hunger moves the newborn, and more hunger means more spontaneous activity", () => {
  const cpgAt = (energy: number) => {
    let r = 0;
    for (let seed = 1; seed <= 8; seed++) r += rate(live(seed, "reflexless", energy, 200).steps, "cpg");
    return r / 8;
  };
  const levels = [0.8, 0.7, 0.6, 0.4].map(cpgAt); // hunger 0.2 → 0.6
  console.log(`  [measured] generator firing at hunger 0.2/0.3/0.4/0.6: ${levels.map((x) => (100 * x).toFixed(1) + "%").join(" / ")}`);
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i]! > levels[i - 1]!, "firing must rise with hunger");
  assert.ok(levels[3]! > 0.2 && levels[3]! < 0.7, `born-hungry firing ${levels[3]} outside the expected band`);
  let movedFar = 0;
  for (let seed = 1; seed <= 10; seed++) if (live(seed, "reflexless", 0.4).moved > 1) movedFar++;
  assert.ok(movedFar >= 8, `only ${movedFar}/10 hungry newborns moved`);
});

test("selection keeps antagonists apart: forward+back or left+right reach the motors on <1% of ticks", () => {
  let co = 0;
  let n = 0;
  for (let seed = 1; seed <= 10; seed++) {
    for (const st of live(seed, "reflexless", 0.4).steps) { n++; if (together(st)) co++; }
  }
  console.log(`  [measured] antagonists together on ${(100 * co / n).toFixed(2)}% of ticks (hunger 0.6)`);
  assert.ok(co / n < 0.01, `${(100 * co / n).toFixed(2)}% of ticks`);
});

test("the trace explains a movement: motor ← selection ← generator ← noise and hunger", () => {
  const { steps } = live(1, "reflexless", 0.4);
  const fired = steps.flatMap((s) => s.trace).find((t) => t.node === "motor.left" && t.activated)!;
  assert.ok(fired, "no left movement in 300 hungry ticks");
  for (const cause of ["bg.out.left", "bg.go.left", "cpg.left", "cpg.noise.left", "hyp.hunger", "intero.hunger"]) {
    assert.ok(fired.causeNodes.includes(cause), `trace misses ${cause}: ${fired.causeNodes.join(",")}`);
  }
});

test("reflexive newborn: a bump selects a left turn; the reflexless one has no such reflex", () => {
  const atWall = (): Room => {
    const s = new Room(1, { foodCount: 0, threatCount: 0 }).state();
    return Room.fromState({ ...s, body: { ...s.body, x: C.width - C.bodyRadius - 0.01, heading: 0, vx: 2, energy: 1 } } as RoomState);
  };
  const turns = (group: InnateGroup) => {
    // Sated (energy 1): no spontaneous activity, so any turn comes from the reflex alone.
    const ctl = brainController(new BrainSimulator(bornGraph(C, { seed: 3, group })), C, { extraInputs: new NoiseGenerator(1).asExtraInputs() });
    return runEpisode(atWall(), ctl.policy, 6, true).records.map((r) => r.action.turn);
  };
  assert.ok(turns("reflexive").includes(1), `reflexive: ${turns("reflexive")}`);
  assert.ok(!turns("reflexless").includes(1), `reflexless: ${turns("reflexless")}`);
});

// --- innate orienting (series 003b, exploratory) --------------------------------------------

test("orienting: only each ray's Go of its own direction is raised, by exactly the strength, for every kind", () => {
  const s = 0.02;
  const plain = bornGraph(C, { seed: 3, group: "reflexless" });
  const w = (g: typeof plain, from: string, to: string) => g.connections.find((e) => e.from === from && e.to === to)!.weight;
  for (const direction of ["toward", "away"] as const) {
    const g = bornGraph(C, { seed: 3, group: "reflexless", orienting: { strength: s, direction } });
    assert.doesNotThrow(() => { checkGraph(g); checkWiring(g, C); checkPathways(g); });
    assert.equal(g.connections.length, plain.connections.length, "no new edges: orienting is a weight, not a pathway");
    assert.notEqual(graphHash(g), graphHash(plain));
    assert.match(g.name ?? "", new RegExp(`orient-${direction}-${s}`));
    let raised = 0;
    for (const e of g.connections) {
      const d = e.weight - w(plain, e.from, e.to);
      const ray = /^ray(\d+)\.(wall|food|threat)$/.exec(e.from);
      const toward = ray ? actionOfAngle(C.rayAngles[Number(ray[1])]!) : null;
      const mirrored = toward === "left" ? "right" : toward === "right" ? "left" : toward;
      const expected = ray && e.to === `bg.go.${direction === "toward" ? toward : mirrored}`;
      if (expected) { raised++; assert.ok(Math.abs(d - s) < 1e-12, `${e.from}->${e.to} +${d}`); }
      else assert.equal(d, 0, `${e.from}->${e.to} changed`);
    }
    assert.equal(raised, C.rayAngles.length * 3);
  }
  assert.equal(actionOfAngle(C.rayAngles[4]!), "left");
  assert.equal(actionOfAngle(C.rayAngles[0]!), "right");
  assert.equal(actionOfAngle(C.rayAngles[2]!), "forward");
});

test("orienting stays below selection: at the bound, a starving newborn staring at a wall never acts without its generators", () => {
  const max = MAX_ORIENTING;
  assert.ok(max > 0 && max < DEFAULT_MAX_INITIAL);
  assert.throws(() => bornGraph(C, { seed: 1, group: "reflexless", orienting: { strength: max * 1.01, direction: "toward" } }), /that is behavior/);
  assert.throws(() => bornGraph(C, { seed: 1, group: "reflexless", orienting: { strength: 0, direction: "toward" } }), /that is behavior/);
  const silentNoise = Object.fromEntries(NOISE_IDS.map((id) => [id, 0]));
  // Every left ray sees a wall at zero distance; the body is nearly starved.
  const inputs = { ...Object.fromEntries(sensorNodeIds(C).map((id) => [id, 0])), ...silentNoise, "intero.hunger": 1, "ray3.wall": 1, "ray4.wall": 1 };
  const fires = (g: ReturnType<typeof bornGraph>) => {
    const sim = new BrainSimulator(g);
    let n = 0;
    for (let t = 0; t < 60; t++) n += ACTIONS.filter((a) => sim.step(inputs).outputs[`bg.out.${a}`] === 1).length;
    return n;
  };
  let overFires = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const g = bornGraph(C, { seed, group: "reflexless", orienting: { strength: max, direction: "toward" } });
    assert.equal(fires(g), 0, `seed ${seed}`);
    // The bound is not arbitrary: 2.5× past it (edited by hand, as birth refuses), sight alone selects in some seeds.
    const over = { ...g, connections: g.connections.map((e) => (/^ray[34]\.wall$/.test(e.from) && e.to === "bg.go.left" ? { ...e, weight: e.weight + 1.5 * max } : e)) };
    if (fires(over) > 0) overFires++;
  }
  assert.ok(overFires > 0, "a stronger bias would already be a reflex");
});

// --- expansion layer (TASARIM-004 M2) --------------------------------------------------------

const KC_SPEC = { cells: 16, inputs: 4, threshold: 1 };
const withKc = (seed: number, group: InnateGroup = "reflexless") => bornGraph(C, { seed, group, expansion: KC_SPEC });
const kcInputs = (g: ReturnType<typeof bornGraph>, cell: string) => g.connections.filter((e) => e.to === cell);

test("expansion null or absent: the newborn is exactly the plain one", () => {
  assert.equal(graphHash(bornGraph(C, { seed: 5, group: "reflexive", expansion: null })), graphHash(bornGraph(C, { seed: 5, group: "reflexive" })));
});

test("expansion: the innate part of the brain (drive, generators, selection, motors) is unchanged", () => {
  const innate = (g: ReturnType<typeof bornGraph>) => JSON.stringify(g.connections.filter((e) => !isPlastic(e) && !e.to.startsWith("kc.")));
  assert.equal(innate(withKc(5)), innate(bornGraph(C, { seed: 5, group: "reflexless" })));
});

test("expansion: legal regions, one cell per requested unit, each a thresholded decision cell", () => {
  const g = withKc(5);
  assert.doesNotThrow(() => { checkGraph(g); checkWiring(g, C); checkPathways(g); });
  const cells = g.nodes.filter((n) => n.id.startsWith("kc."));
  assert.equal(cells.length, KC_SPEC.cells);
  for (const c of cells) {
    assert.equal(c.type, "decision", c.id);
    assert.equal(c.threshold, KC_SPEC.threshold, c.id);
  }
});

test("expansion: each cell samples exactly `inputs` different senses, with innate weight 1", () => {
  const g = withKc(5);
  const senses = new Set(sensorNodeIds(C));
  for (const c of g.nodes.filter((n) => n.id.startsWith("kc."))) {
    const ins = kcInputs(g, c.id);
    assert.equal(ins.length, KC_SPEC.inputs, c.id);
    assert.equal(new Set(ins.map((e) => e.from)).size, KC_SPEC.inputs, `${c.id} has a repeated input`);
    for (const e of ins) {
      assert.ok(senses.has(e.from), `${c.id} listens to ${e.from}, not a sense`);
      assert.equal(e.weight, 1);
      assert.equal(isPlastic(e), false, "the expansion wiring must be innate");
    }
  }
});

test("expansion: learning starts from the cells — every cell reaches every Go and NoGo, weakly", () => {
  const g = withKc(5);
  const plastic = g.connections.filter((e) => isPlastic(e));
  assert.equal(plastic.length, KC_SPEC.cells * ACTIONS.length * 2);
  for (const e of plastic) {
    assert.match(e.from, /^kc\.\d+$/, `${e.from}->${e.to} learns but does not start from a cell`);
    assert.ok(e.weight >= 0 && e.weight <= DEFAULT_MAX_INITIAL, `${e.from}->${e.to} ${e.weight}`);
  }
});

test("expansion: the reflexive group keeps its reflexes on the direct sense pathway", () => {
  const g = withKc(5, "reflexive");
  for (const r of INNATE_REFLEXES) {
    const e = g.connections.find((c) => c.from === r.from && c.to === r.to);
    assert.ok(e, `${r.from}->${r.to} missing`);
    assert.equal(e.weight, r.weight);
  }
});

test("expansion: the graph's name says how the layer was built", () => {
  assert.match(withKc(5).name ?? "", /kc16x4t1/);
});

test("expansion: deterministic per seed, different across seeds", () => {
  assert.equal(graphHash(withKc(5)), graphHash(withKc(5)));
  const wiring = (seed: number) => JSON.stringify(withKc(seed).connections.filter((e) => e.to.startsWith("kc.")));
  assert.notEqual(wiring(5), wiring(6));
});

test("expansion: bad sizes, and orienting on a pathway it replaces, are refused", () => {
  for (const bad of [{ cells: 0, inputs: 4, threshold: 1 }, { cells: 8, inputs: 0, threshold: 1 }, { cells: 8, inputs: 99, threshold: 1 }, { cells: 8, inputs: 4, threshold: 0 }, { cells: 2.5, inputs: 4, threshold: 1 }]) {
    assert.throws(() => bornGraph(C, { seed: 1, group: "reflexless", expansion: bad }), RangeError, JSON.stringify(bad));
  }
  assert.throws(() => bornGraph(C, { seed: 1, group: "reflexless", expansion: KC_SPEC, orienting: { strength: 0.01, direction: "toward" } }), /replaces/);
});

test("expansion: a cell fires on a conjunction of its senses, not on one weak sense", () => {
  const g = withKc(5);
  const cell = "kc.0";
  const [a, b] = kcInputs(g, cell).map((e) => e.from);
  const silent = { ...Object.fromEntries(sensorNodeIds(C).map((id) => [id, 0])), ...Object.fromEntries(NOISE_IDS.map((id) => [id, 0])) };
  const fires = (inputs: Record<string, number>) => {
    const sim = new BrainSimulator(g);
    sim.step(inputs);
    return sim.step(inputs).outputs[cell] === 1;
  };
  assert.equal(fires({ ...silent, [a!]: 0.6 }), false, "one sense at 0.6 is below the threshold");
  assert.equal(fires({ ...silent, [a!]: 0.6, [b!]: 0.6 }), true, "two senses at 0.6 reach it together");
});

test("sense-to-motor delay: 3 ticks without the expansion layer, 4 with it", () => {
  assert.equal(senseToMotorDelay(bornGraph(C, { seed: 1, group: "reflexless" })), 3);
  assert.equal(senseToMotorDelay(withKc(1)), 4);
});

// --- bilateral comparison (TASARIM-004 M3) ---------------------------------------------------

const withLat = (seed: number, group: InnateGroup = "reflexless") => bornGraph(C, { seed, group, bilateral: true });

test("bilateral off or absent: the newborn is exactly the plain one", () => {
  assert.equal(graphHash(bornGraph(C, { seed: 5, group: "reflexive", bilateral: false })), graphHash(bornGraph(C, { seed: 5, group: "reflexive" })));
});

test("bilateral: everything the plain newborn has stays as it was, including its learning weights", () => {
  const plain = bornGraph(C, { seed: 5, group: "reflexless" });
  const lat = withLat(5);
  for (const e of plain.connections) {
    const same = lat.connections.find((x) => x.from === e.from && x.to === e.to);
    assert.ok(same, `${e.from}->${e.to} disappeared`);
    assert.equal(same.weight, e.weight, `${e.from}->${e.to}`);
  }
});

test("bilateral: one neuron per kind and side, legal regions, name says so", () => {
  const g = withLat(5);
  assert.doesNotThrow(() => { checkGraph(g); checkWiring(g, C); checkPathways(g); });
  const cells = g.nodes.filter((n) => n.id.startsWith("lat."));
  assert.deepEqual(cells.map((n) => n.id).sort(), ["lat.food.left", "lat.food.right", "lat.threat.left", "lat.threat.right", "lat.wall.left", "lat.wall.right"]);
  for (const c of cells) assert.equal(c.type, "neuron", c.id);
  assert.match(g.name ?? "", /bilateral/);
});

test("bilateral: each side's rays excite their own side's cell and inhibit the other; the centre ray is not wired", () => {
  const g = withLat(5);
  const w = (from: string, to: string) => g.connections.find((e) => e.from === from && e.to === to)?.weight;
  C.rayAngles.forEach((angle, i) => {
    const side = actionOfAngle(angle);
    for (const kind of ["wall", "food", "threat"]) {
      const ray = `ray${i}.${kind}`;
      if (side === "forward") {
        assert.equal(w(ray, `lat.${kind}.left`), undefined, `${ray} (centre) → left`);
        assert.equal(w(ray, `lat.${kind}.right`), undefined, `${ray} (centre) → right`);
      } else {
        const other = side === "left" ? "right" : "left";
        assert.equal(w(ray, `lat.${kind}.${side}`), 1, `${ray} → own side`);
        assert.equal(w(ray, `lat.${kind}.${other}`), -1, `${ray} → other side`);
      }
    }
  });
});

test("bilateral: a cell hears only its own kind of thing", () => {
  const g = withLat(5);
  for (const e of g.connections.filter((x) => x.to.startsWith("lat."))) {
    const kind = e.to.split(".")[1];
    assert.match(e.from, new RegExp(`^ray\\d+\\.${kind}$`), `${e.from} → ${e.to}`);
  }
});

test("bilateral: the cells are learning sources — each reaches every Go and NoGo, weakly", () => {
  const g = withLat(5);
  const fromLat = g.connections.filter((e) => e.from.startsWith("lat."));
  assert.equal(fromLat.length, 6 * ACTIONS.length * 2);
  for (const e of fromLat) {
    assert.equal(isPlastic(e), true, `${e.from}->${e.to}`);
    assert.ok(e.weight >= 0 && e.weight <= DEFAULT_MAX_INITIAL, `${e.from}->${e.to} ${e.weight}`);
  }
});

test("bilateral: food on the left lights only the left food cell; food ahead lights neither", () => {
  const g = withLat(5);
  const silent = { ...Object.fromEntries(sensorNodeIds(C).map((id) => [id, 0])), ...Object.fromEntries(NOISE_IDS.map((id) => [id, 0])) };
  const cellsAfter = (inputs: Record<string, number>) => {
    const sim = new BrainSimulator(g);
    sim.step(inputs);
    return sim.step(inputs).outputs;
  };
  const left = cellsAfter({ ...silent, "ray4.food": 0.8 });
  assert.ok(left["lat.food.left"]! > 0, "left food cell should fire");
  assert.equal(left["lat.food.right"], 0);
  assert.equal(left["lat.wall.left"], 0, "a wall cell must not answer to food");
  const ahead = cellsAfter({ ...silent, "ray2.food": 0.8 });
  assert.equal(ahead["lat.food.left"], 0);
  assert.equal(ahead["lat.food.right"], 0);
  const both = cellsAfter({ ...silent, "ray4.food": 0.8, "ray0.food": 0.3 });
  assert.ok(Math.abs(both["lat.food.left"]! - 0.5) < 1e-12, `more on the left: the cell reports the difference, got ${both["lat.food.left"]}`);
});

test("bilateral and expansion together: legal, both layers present", () => {
  const g = bornGraph(C, { seed: 5, group: "reflexless", bilateral: true, expansion: { cells: 8, inputs: 4, threshold: 1 } });
  assert.doesNotThrow(() => checkPathways(g));
  assert.ok(g.nodes.some((n) => n.id.startsWith("lat.")));
  assert.ok(g.nodes.some((n) => n.id.startsWith("kc.")));
});

// --- generator strength (series 004, G) --------------------------------------------------------

test("generatorToGo: default and explicit default are the same newborn", () => {
  assert.equal(graphHash(bornGraph(C, { seed: 3, group: "reflexless", generatorToGo: 0.6 })), graphHash(bornGraph(C, { seed: 3, group: "reflexless" })));
});

test("generatorToGo: only the generator → Go edges change, to the given weight; the name says so", () => {
  const plain = bornGraph(C, { seed: 3, group: "reflexless" });
  const weak = bornGraph(C, { seed: 3, group: "reflexless", generatorToGo: 0.3 });
  assert.match(weak.name ?? "", /gen0\.3/);
  for (const e of weak.connections) {
    const p = plain.connections.find((x) => x.from === e.from && x.to === e.to)!;
    const isGenerator = /^cpg\.(forward|back|left|right)$/.test(e.from) && e.to.startsWith("bg.go.");
    assert.equal(e.weight, isGenerator ? 0.3 : p.weight, `${e.from}->${e.to}`);
  }
});

test("generatorToGo: zero, negative or above the innate default is refused", () => {
  for (const g of [0, -0.1, 0.7]) assert.throws(() => bornGraph(C, { seed: 1, group: "reflexless", generatorToGo: g }), RangeError, String(g));
});

test("generatorToGo 0.3: a hungry newborn still moves", () => {
  let moved = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const room = new Room(seed, { initialEnergy: 0.4, threatCount: 0 });
    const start = room.state().body;
    const ctl = brainController(new BrainSimulator(bornGraph(C, { seed, group: "reflexless", generatorToGo: 0.3 })), C, { extraInputs: new NoiseGenerator(seed + 99).asExtraInputs() });
    runEpisode(room, ctl.policy, 300);
    const b = room.state().body;
    if (Math.hypot(b.x - start.x, b.y - start.y) > 1) moved++;
  }
  assert.ok(moved >= 8, `only ${moved}/10 moved`);
});

// --- recalled senses (TASARIM-008 §16, A3) -----------------------------------------------------------------------------

const recNodes = (g: ReturnType<typeof bornGraph>) => g.nodes.filter((n) => n.id.startsWith("rec"));
const recEdges = (g: ReturnType<typeof bornGraph>) => g.connections.filter((e) => e.from.startsWith("rec"));

test("recall null or absent: the newborn is exactly the plain one", () => {
  assert.deepEqual(bornGraph(C, { seed: 3, group: "reflexless", recall: null }), bornGraph(C, { seed: 3, group: "reflexless" }));
});

test("recall grown (B): one sensor node per ray angle, after every other node, and no rule synapse at birth", () => {
  const plain = bornGraph(C, { seed: 3, group: "reflexive" });
  const grown = bornGraph(C, { seed: 3, group: "reflexive", recall: { rules: "grown" } });
  assert.deepEqual(recNodes(grown), C.rayAngles.map((_, i) => ({ id: `rec${i}.food`, type: "sensor" })));
  assert.deepEqual(grown.nodes.slice(0, plain.nodes.length), plain.nodes, "every other node as the plain newborn, in its order");
  assert.equal(recEdges(grown).length, 0);
  assert.deepEqual(grown.connections, plain.connections, "every edge as the plain newborn");
});

test("recall innate (D): every rec → Go synapse, weak and random in [0, 0.05], after every other edge", () => {
  const plain = bornGraph(C, { seed: 3, group: "reflexive" });
  const innate = bornGraph(C, { seed: 3, group: "reflexive", recall: { rules: "innate" } });
  const rules = recEdges(innate);
  assert.deepEqual(rules.map((e) => `${e.from}->${e.to}`), C.rayAngles.flatMap((_, i) => ACTIONS.map((a) => `rec${i}.food->bg.go.${a}`)));
  assert.ok(rules.every((e) => e.weight >= 0 && e.weight <= DEFAULT_MAX_INITIAL), "weak");
  assert.ok(new Set(rules.map((e) => e.weight)).size > 1, "random, not one value");
  assert.ok(rules.every((e) => isPlastic(e) && pathwayOf(e)?.id === "P18"), "on the rule pathway, learning");
  assert.deepEqual(innate.connections.slice(0, plain.connections.length), plain.connections, "the rest is the plain newborn (own random stream)");
});

test("recall innate: the rule synapses' weights are their own draws, not a copy of the first learning weights", () => {
  const plain = bornGraph(C, { seed: 3, group: "reflexless" });
  const firstLearning = plain.connections.filter((e) => isPlastic(e)).slice(0, 20).map((e) => e.weight);
  const rules = recEdges(bornGraph(C, { seed: 3, group: "reflexless", recall: { rules: "innate" } })).map((e) => e.weight);
  assert.equal(rules.length, 20);
  assert.notDeepEqual(rules, firstLearning);
});

test("recall innate with maxInitial 0: every rule synapse is born at 0", () => {
  assert.ok(recEdges(bornGraph(C, { seed: 3, group: "reflexless", recall: { rules: "innate", maxInitial: 0 } })).every((e) => e.weight === 0));
});

test("recall innate: deterministic per seed, different across seeds", () => {
  const w = (seed: number) => recEdges(bornGraph(C, { seed, group: "reflexless", recall: { rules: "innate" } })).map((e) => e.weight);
  assert.deepEqual(w(4), w(4));
  assert.notDeepEqual(w(4), w(5));
});

test("recall: the graph's name says how the rule synapses come to be", () => {
  assert.match(bornGraph(C, { seed: 3, group: "reflexless", recall: { rules: "grown" } }).name ?? "", /-recall-grown$/);
  assert.match(bornGraph(C, { seed: 3, group: "reflexless", recall: { rules: "innate" } }).name ?? "", /-recall-innate$/);
  assert.match(bornGraph(C, { seed: 3, group: "reflexless", recall: { rules: "innate", maxInitial: 0 } }).name ?? "", /-recall-innate0$/);
});

test("recall: unknown rules, birth weights for grown synapses, or weights that could select alone are refused", () => {
  assert.throws(() => bornGraph(C, { seed: 1, group: "reflexless", recall: { rules: "sometimes" as "grown" } }), RangeError);
  assert.throws(() => bornGraph(C, { seed: 1, group: "reflexless", recall: { rules: "grown", maxInitial: 0.05 } }), RangeError);
  for (const m of [-0.01, 0.6]) assert.throws(() => bornGraph(C, { seed: 1, group: "reflexless", recall: { rules: "innate", maxInitial: m } }), RangeError, String(m));
});
