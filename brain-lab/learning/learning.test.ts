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
import { DEFAULT_CONFIG, Room, makeConfig, runEpisode } from "../world/index.ts";
import { Learner, createAgent, type LearningParams } from "./index.ts";

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
