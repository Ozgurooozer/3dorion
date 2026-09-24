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
