// brain-lab/learning/learning.test.ts — the learning rule must change only what may learn,
// in the right direction, in recorded quanta, and leave a ledger that replays to the live brain.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bornGraph } from "../development/index.ts";
import { Ledger, canonicalGraph } from "../registry/index.ts";
import { checkPathways, isPlastic } from "../regions/index.ts";
import { DEFAULT_CONFIG, Room, makeConfig, runEpisode, type Observation } from "../world/index.ts";
import { Critic, Learner, createAgent, type LearningParams } from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const HUNGRY = makeConfig({ initialEnergy: 0.4, threatCount: 0 });

const ledgerFor = (seed: number) => new Ledger(`DNK-${String(seed).padStart(4, "0")}`, bornGraph(DEFAULT_CONFIG, { seed, group: "reflexless" }));

/** Lives `episodes` episodes; returns the agent, its ledger, and every ledger entry written. */
function life(seed: number, episodes: number, learning: Partial<LearningParams> = {}, ticks = 1500) {
  const ledger = ledgerFor(seed);
  const agent = createAgent({ cfg: HUNGRY, ledger, noiseSeed: seed + 99, learning });
  let food = 0;
  for (let ep = 1; ep <= episodes; ep++) {
    agent.startEpisode(ep);
    food += runEpisode(new Room(seed * 1000 + ep, HUNGRY), agent.policy, ticks, false, agent.hooks).foodEaten;
  }
  return { agent, ledger, writes: agent.drainWrites(), food };
}

test("dependencies: nothing below learning imports it", () => {
  for (const dir of ["../world", "../sensorimotor", "../brain-ir", "../registry", "../neuromodulation", "../regions", "../development"]) {
    for (const f of readdirSync(join(HERE, dir)).filter((n) => n.endsWith(".ts"))) {
      assert.doesNotMatch(readFileSync(join(HERE, dir, f), "utf8"), /learning\//, `${dir}/${f} imports learning`);
    }
  }
});

// --- the rule itself, on hand-made moments -----------------------------------------

function unitLearner(params: Partial<LearningParams> = {}) {
  const ledger = ledgerFor(1);
  const graph = structuredClone(ledger.graph);
  return { learner: new Learner(graph, ledger, { quantum: 0.001, ...params }), graph, ledger };
}
const w = (g: { connections: { from: string; to: string; weight: number }[] }, from: string, to: string) =>
  g.connections.find((c) => c.from === from && c.to === to)!.weight;

test("direction: dopamine up strengthens Go and weakens NoGo on eligible edges; down does the reverse", () => {
  for (const sign of [1, -1]) {
    const { learner, graph } = unitLearner({ eta: 1 });
    learner.startEpisode(1);
    const go0 = w(graph, "ray2.food", "bg.go.forward");
    const nogo0 = w(graph, "ray2.food", "bg.nogo.forward");
    learner.updateEligibility({ "ray2.food": 1 }, { "bg.go.forward": 1, "bg.nogo.forward": 1 });
    learner.applyDopamine(sign * 0.01, 1);
    assert.equal(Math.sign(w(graph, "ray2.food", "bg.go.forward") - go0), sign, "Go moved the wrong way");
    const nogo1 = w(graph, "ray2.food", "bg.nogo.forward");
    if (sign === 1) assert.ok(nogo1 < nogo0 || nogo1 === 0, `NoGo must weaken (or sit at 0): ${nogo0} → ${nogo1}`);
    else assert.ok(nogo1 > nogo0, `NoGo must strengthen: ${nogo0} → ${nogo1}`);
    assert.equal(w(graph, "ray2.food", "bg.go.left"), structuredClone(ledgerFor(1).graph).connections.find((c) => c.from === "ray2.food" && c.to === "bg.go.left")!.weight, "a non-eligible edge changed");
  }
});

test("eligibility: built by co-activity, decays by λ each silent tick, reset at a new episode", () => {
  const { learner } = unitLearner({ lambda: 0.5 });
  learner.startEpisode(1);
  learner.updateEligibility({ "touch.bump": 1 }, { "bg.go.left": 1 });
  assert.equal(learner.eligibility("touch.bump", "bg.go.left"), 1);
  learner.updateEligibility({}, {});
  learner.updateEligibility({}, {});
  assert.equal(learner.eligibility("touch.bump", "bg.go.left"), 0.25);
  assert.equal(learner.eligibility("touch.bump", "bg.go.right"), 0, "only the co-active edge is eligible");
  learner.startEpisode(2);
  assert.equal(learner.eligibility("touch.bump", "bg.go.left"), 0);
});

test("quanta: nothing moves below one quantum; each crossing is one ledger entry of whole quanta", () => {
  const { learner, graph, ledger } = unitLearner({ eta: 1, quantum: 0.01, lambda: 0 });
  learner.startEpisode(1);
  const start = w(graph, "ray2.food", "bg.go.forward");
  const push = (delta: number) => { learner.updateEligibility({ "ray2.food": 1 }, { "bg.go.forward": 1 }); return learner.applyDopamine(delta, 1); };
  assert.equal(push(0.004).length, 0);
  assert.equal(push(0.004).length, 0);
  assert.equal(w(graph, "ray2.food", "bg.go.forward"), start, "moved below a quantum");
  const wrote = push(0.004).filter((e) => e.kind === "weight" && e.edge.to === "bg.go.forward");
  assert.equal(wrote.length, 1);
  assert.ok(Math.abs(w(graph, "ray2.food", "bg.go.forward") - start - 0.01) < 1e-12);
  assert.ok(ledger.matches(graph));
});

test("bounds: learning weights stay in [0, wMax]; a pinned weight writes nothing", () => {
  const { learner, graph } = unitLearner({ eta: 100, quantum: 0.001, lambda: 0, wMax: 0.2 });
  learner.startEpisode(1);
  for (let i = 0; i < 20; i++) { learner.updateEligibility({ "ray2.food": 1 }, { "bg.go.forward": 1 }); learner.applyDopamine(0.5, i); }
  assert.equal(w(graph, "ray2.food", "bg.go.forward"), 0.2);
  learner.updateEligibility({ "ray2.food": 1 }, { "bg.go.forward": 1 });
  assert.equal(learner.applyDopamine(0.5, 99).filter((e) => e.kind === "weight" && e.edge.to === "bg.go.forward").length, 0);
  for (let i = 0; i < 20; i++) { learner.updateEligibility({ "ray2.food": 1 }, { "bg.go.forward": 1 }); learner.applyDopamine(-0.5, i); }
  assert.equal(w(graph, "ray2.food", "bg.go.forward"), 0);
});

test("parameters and preconditions are checked", () => {
  assert.throws(() => unitLearner({ lambda: 1 }), RangeError);
  assert.throws(() => unitLearner({ quantum: 0 }), RangeError);
  const ledger = ledgerFor(1);
  const off = structuredClone(ledger.graph);
  off.connections[0]!.weight += 0.5;
  assert.throws(() => new Learner(off, ledger), /does not match its ledger/);
  const { learner } = unitLearner();
  assert.throws(() => learner.applyDopamine(Number.NaN, 1), RangeError);
});

// --- a whole life ---------------------------------------------------------------------

test("a learning life: only learning edges change, every change is on the ledger, replay = live brain", () => {
  const { agent, ledger, writes } = life(3, 4);
  const born = canonicalGraph(bornGraph(DEFAULT_CONFIG, { seed: 3, group: "reflexless" }));
  const weightWrites = writes.filter((e) => e.kind === "weight");
  assert.ok(weightWrites.length > 0, "a hungry newborn over 4 episodes never learned anything");
  // Learning must happen while living, not only at the moment of death.
  const whileAlive = weightWrites.filter((e) => e.cause.includes("dopamine")).length;
  const atDeath = weightWrites.filter((e) => e.cause.includes("death")).length;
  assert.ok(whileAlive > 0, `only death taught anything (${atDeath} entries at death)`);
  for (const e of weightWrites) assert.ok(isPlastic(e.edge), `innate edge ${e.edge.from}->${e.edge.to} changed`);
  const live = agent.graph;
  for (const c of live.connections) {
    const b = born.connections.find((x) => x.from === c.from && x.to === c.to)!;
    if (!isPlastic(c)) assert.equal(c.weight, b.weight, `innate ${c.from}->${c.to} drifted without a record`);
    else assert.ok(c.weight >= 0 && c.weight <= 2);
  }
  assert.ok(ledger.matches(live), "the live brain learned something off the record");
  assert.ok(new Ledger(ledger.subjectId, born, ledger.entries).matches(live), "birth + ledger does not replay to the live brain");
  assert.doesNotThrow(() => checkPathways(live));
  console.log(`  [measured] 4 hungry episodes: ${weightWrites.length} weight entries, stage ${ledger.stage}`);
});

test("stages: E1 on the first tick lived, E2 on the first weight change, recorded in the ledger", () => {
  const { ledger } = life(3, 1);
  const stages = ledger.entries.filter((e) => e.kind === "stage");
  assert.deepEqual(stages.map((e) => e.kind === "stage" && e.to), ["E1", "E2"]);
  assert.equal(ledger.stage, "E2");
});

test("frozen twin: lives the same life but its brain never changes", () => {
  const { ledger, agent } = life(3, 2, { frozen: true });
  assert.equal(ledger.entries.filter((e) => e.kind === "weight").length, 0);
  assert.equal(ledger.stage, "E1");
  assert.ok(ledger.matches(agent.graph));
});

test("determinism: the same subject lives the same life — identical ledger, identical food", () => {
  const a = life(5, 2);
  const b = life(5, 2);
  assert.equal(JSON.stringify(a.ledger.entries), JSON.stringify(b.ledger.entries));
  assert.equal(a.food, b.food);
});

// --- ablation switches (diagnostic experiments) ---------------------------------------

test("ablations: each switch removes exactly its mechanism and nothing else", () => {
  const plastic = (p: Partial<LearningParams>) => unitLearner(p).learner.plasticCount;
  const full = plastic({});
  assert.equal(plastic({ learnNoGo: false }), full / 2, "Go only must keep exactly the Go half");
  assert.equal(plastic({ learnGo: false }), full / 2);
  const outside = plastic({ senseFilter: "^(ray|touch)" });
  assert.equal(outside, full - 6 * 4 * 2, "interoception and proprioception (6 senses: hunger, injury, 4 motion) leave the learning set");

  const { learner, graph } = unitLearner({ eta: 1, dopamine: "positive" });
  learner.startEpisode(1);
  const go0 = w(graph, "ray2.food", "bg.go.forward");
  learner.updateEligibility({ "ray2.food": 1 }, { "bg.go.forward": 1 });
  assert.equal(learner.applyDopamine(-0.5, 1).length, 0, "a dip taught something under dopamine: positive");
  assert.equal(w(graph, "ray2.food", "bg.go.forward"), go0);
  assert.ok(learner.applyDopamine(0.5, 2).length > 0, "a burst must still teach");
});

test("ablation: without teaching at death, dying changes no weight", () => {
  const ledger = ledgerFor(7);
  const agent = createAgent({ cfg: makeConfig({ initialEnergy: 0.05, threatCount: 0, foodCount: 0 }), ledger, noiseSeed: 1, teachAtDeath: false });
  agent.startEpisode(1);
  const ep = runEpisode(new Room(7, makeConfig({ initialEnergy: 0.05, threatCount: 0, foodCount: 0 })), agent.policy, 5000, false, agent.hooks);
  assert.equal(ep.doneCause, "starved");
  assert.equal(ledger.entries.filter((e) => e.kind === "weight" && e.cause.includes("death")).length, 0);
});

// --- series 002 mechanisms -----------------------------------------------------------------

test("selected gate: only the chosen action's edges become eligible, with the sense from two ticks before", () => {
  const { learner } = unitLearner({ gate: "selected", lambda: 0 });
  learner.startEpisode(1);
  // t−2: food seen; t−1: nothing new; t: the LEFT action is selected (its Go cell and the others' are all active)
  learner.updateEligibility({}, { "ray4.food": 1 });
  learner.updateEligibility({ "ray4.food": 1 }, {});
  learner.updateEligibility({}, { "bg.out.left": 1, "bg.go.left": 1, "bg.go.right": 1, "bg.nogo.right": 1 });
  assert.equal(learner.eligibility("ray4.food", "bg.go.left"), 1, "the chosen action's Go must be eligible");
  assert.equal(learner.eligibility("ray4.food", "bg.nogo.left"), 1, "the chosen action's NoGo must be eligible");
  assert.equal(learner.eligibility("ray4.food", "bg.go.right"), 0, "an unchosen action learned");
  assert.equal(learner.eligibility("ray4.food", "bg.nogo.right"), 0, "an unchosen action learned");
  // the neuron gate, same moments: every active Go/NoGo cell becomes eligible
  const n = unitLearner({ gate: "neuron", lambda: 0 }).learner;
  n.startEpisode(1);
  n.updateEligibility({ "ray4.food": 1 }, { "bg.out.left": 1, "bg.go.left": 1, "bg.go.right": 1 });
  assert.equal(n.eligibility("ray4.food", "bg.go.right"), 1);
});

test("dip floor: dips below −floor teach only as much as −floor", () => {
  const run = (dipFloor: number | null) => {
    const { learner, graph } = unitLearner({ eta: 1, lambda: 0, quantum: 0.0001, dipFloor });
    learner.startEpisode(1);
    const before = w(graph, "ray2.food", "bg.nogo.forward");
    learner.updateEligibility({ "ray2.food": 1 }, { "bg.nogo.forward": 1 });
    learner.applyDopamine(-1, 1);
    return w(graph, "ray2.food", "bg.nogo.forward") - before;
  };
  assert.ok(Math.abs(run(0.05) - 0.05) < 1e-9, `floored change ${run(0.05)}`);
  assert.ok(Math.abs(run(null) - 1) < 1e-9);
  assert.throws(() => unitLearner({ dipFloor: -1 }), RangeError);
});

test("synaptic scaling: each Go/NoGo cell returns to its birth input sum, ratios kept, every change on the ledger", () => {
  const { learner, graph, ledger } = unitLearner({ eta: 5, lambda: 0, quantum: 0.0001, scaling: true });
  learner.startEpisode(1);
  const birth = learner.inputSum("bg.go.forward");
  for (let i = 0; i < 5; i++) { learner.updateEligibility({ "ray2.food": 1 }, { "bg.go.forward": 1 }); learner.applyDopamine(0.2, i); }
  assert.ok(learner.inputSum("bg.go.forward") > birth + 1, "setup: the cell should have grown");
  const ratioBefore = w(graph, "ray2.food", "bg.go.forward") / w(graph, "ray1.wall", "bg.go.forward");
  const wrote = learner.endEpisode(99);
  assert.ok(wrote.length > 0 && wrote.every((e) => e.cause.includes("scaling")));
  assert.ok(Math.abs(learner.inputSum("bg.go.forward") - birth) < 22 * 0.0001 + 1e-9, `sum ${learner.inputSum("bg.go.forward")} vs birth ${birth}`);
  const ratioAfter = w(graph, "ray2.food", "bg.go.forward") / w(graph, "ray1.wall", "bg.go.forward");
  assert.ok(Math.abs(ratioAfter / ratioBefore - 1) < 0.1, "scaling changed the ratios, not just the sum");
  assert.ok(ledger.matches(graph));
  assert.equal(unitLearner({ scaling: false }).learner.endEpisode(1).length, 0);
});

test("critic: learns to anticipate a regular meal — the surprise at the meal shrinks (the stateless expectation could not)", () => {
  const ledger = ledgerFor(1);
  const critic = new Critic(ledger, DEFAULT_CONFIG, { alpha: 0.1, quantum: 0.0001 });
  const none = { distance: DEFAULT_CONFIG.rayRange, hit: "none" as const };
  const seeFood: Observation = { rays: DEFAULT_CONFIG.rayAngles.map((_, i) => (i === 2 ? { distance: 0.5, hit: "food" as const } : none)), bump: false, energy: 0.5, health: 1, motion: { forward: 0, turn: 0 } };
  const blind: Observation = { ...seeFood, rays: seeFood.rays.map(() => none) };
  const surprises: number[] = [];
  for (let i = 0; i < 200; i++) {
    critic.step(blind, seeFood, 0, 2 * i, 1);
    surprises.push(critic.step(seeFood, blind, 0.3, 2 * i + 1, 1).delta); // the meal comes after seeing food
  }
  assert.ok(surprises.at(-1)! < surprises[0]! * 0.5, `meal surprise ${surprises[0]} → ${surprises.at(-1)}`);
  assert.ok(ledger.criticWeight("ray2.food") > 0, "seeing food should come to predict value");
  assert.ok(ledger.entries.every((e) => e.kind === "critic"));
  assert.ok(new Ledger(ledger.subjectId, ledger.birthGraph, ledger.entries).criticWeight("ray2.food") === ledger.criticWeight("ray2.food"));
});

test("agent with critic, selected gate, dip floor and scaling: legal, on the record, deterministic", () => {
  const run = () => {
    const ledger = ledgerFor(4);
    const agent = createAgent({ cfg: HUNGRY, ledger, noiseSeed: 9, learning: { gate: "selected", dipFloor: 0.05, scaling: true, quantum: 0.005 }, critic: {}, teachAtDeath: false });
    for (let ep = 1; ep <= 3; ep++) {
      agent.startEpisode(ep);
      const r = runEpisode(new Room(4000 + ep, HUNGRY), agent.policy, 1500, false, agent.hooks);
      agent.finishEpisode(r.ticks);
    }
    agent.drainWrites();
    assert.ok(ledger.matches(agent.graph));
    assert.doesNotThrow(() => checkPathways(agent.graph));
    assert.equal(ledger.entries.filter((e) => e.kind === "weight" && e.cause.includes("death")).length, 0, "death taught");
    return JSON.stringify(ledger.entries);
  };
  const a = run();
  assert.equal(run(), a);
  assert.ok(JSON.parse(a).some((e: { kind: string }) => e.kind === "critic"), "the critic never learned");
});

test("deltaTransform: the learner receives the transformed dopamine", () => {
  const ledger = ledgerFor(5);
  const agent = createAgent({ cfg: HUNGRY, ledger, noiseSeed: 1, deltaTransform: () => 0 });
  agent.startEpisode(1);
  runEpisode(new Room(5001, HUNGRY), agent.policy, 800, false, agent.hooks);
  assert.equal(ledger.entries.filter((e) => e.kind === "weight" && !e.cause.includes("death")).length, 0);
});

test("RPE normalization: δ is divided by its running typical size (scale-free teaching signal)", () => {
  const seen: number[] = [];
  const ledger = ledgerFor(6);
  const agent = createAgent({ cfg: HUNGRY, ledger, noiseSeed: 2, rpeNormalization: { rate: 0.01 }, deltaTransform: (d) => { seen.push(d); return 0; } });
  agent.startEpisode(1);
  runEpisode(new Room(6001, HUNGRY), agent.policy, 600, false, agent.hooks);
  const typical = seen.slice(100).reduce((s, d) => s + Math.abs(d), 0) / (seen.length - 100);
  assert.ok(typical > 0.2 && typical < 5, `normalized |δ| should be of order 1, got ${typical}`);
});

test("critic bootstraps: value flows back one step further (wall seen → food seen → meal) — only TD can do this", () => {
  const ledger = ledgerFor(1);
  const critic = new Critic(ledger, DEFAULT_CONFIG, { alpha: 0.1, gamma: 0.9, quantum: 0.0001 });
  const none = { distance: DEFAULT_CONFIG.rayRange, hit: "none" as const };
  const base: Observation = { rays: DEFAULT_CONFIG.rayAngles.map(() => none), bump: false, energy: 0.5, health: 1, motion: { forward: 0, turn: 0 } };
  const sees = (ray: number, hit: "wall" | "food"): Observation => ({ ...base, rays: base.rays.map((r, i) => (i === ray ? { distance: 0.5, hit } : r)) });
  const wall = sees(0, "wall"), food = sees(2, "food");
  for (let i = 0; i < 300; i++) {
    critic.step(base, wall, 0, 3 * i, 1);
    critic.step(wall, food, 0, 3 * i + 1, 1);
    critic.step(food, base, 0.3, 3 * i + 2, 1);
  }
  assert.ok(ledger.criticWeight("ray0.wall") > 0.01, `the state two steps before the meal never gained value: ${ledger.criticWeight("ray0.wall")}`);
});

test("agent: with a critic, the learner is taught by the critic's δ, not the stateless one", () => {
  const record = (critic: boolean) => {
    const seen: number[] = [];
    const agent = createAgent({ cfg: HUNGRY, ledger: ledgerFor(8), noiseSeed: 3, critic: critic ? { alpha: 0.5, quantum: 0.0001 } : null, deltaTransform: (d) => { seen.push(d); return d; } });
    agent.startEpisode(1);
    runEpisode(new Room(8001, HUNGRY), agent.policy, 400, false, agent.hooks);
    return seen;
  };
  const withCritic = record(true);
  const stateless = record(false);
  const differ = withCritic.filter((d, i) => Math.abs(d - (stateless[i] ?? 0)) > 1e-9).length;
  assert.ok(differ > 50, `critic δ reached the learner on only ${differ} ticks`);
});
