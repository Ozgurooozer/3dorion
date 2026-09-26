// brain-lab/learning/selection.test.ts — competitive selection (TASARIM-005 S1): on each axis the most
// salient candidate wins, rest is a candidate, the learned Go − NoGo value decides, and what is chosen
// is what learning gives credit to. Every case starts from a fresh brain.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { bornGraph } from "../development/index.ts";
import { Ledger } from "../registry/index.ts";
import { ACTIONS } from "../regions/index.ts";
import { sensorNodeIds } from "../sensorimotor/index.ts";
import { DEFAULT_CONFIG as C, Room, makeConfig, runEpisode } from "../world/index.ts";
import { CompetitiveSelector, Learner, createAgent, type SelectionParams } from "./index.ts";

const HUNGRY = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
const quiet: Partial<SelectionParams> = { explore: 0, noiseGain: 0 };

/** A newborn whose learning weights are all zero, so each test sets exactly the values it needs. */
function blankGraph(seed = 1) {
  const g = bornGraph(C, { seed, group: "reflexless" });
  for (const e of g.connections) if (e.to.startsWith("bg.go.") || e.to.startsWith("bg.nogo.")) if (/^(ray|touch|intero|proprio)/.test(e.from)) e.weight = 0;
  return g;
}
const setWeight = (g: ReturnType<typeof bornGraph>, from: string, to: string, w: number) => {
  g.connections.find((e) => e.from === from && e.to === to)!.weight = w;
};
const senses = (over: Record<string, number> = {}) => ({ ...Object.fromEntries(sensorNodeIds(C).map((id) => [id, 0])), ...over });

test("a learned Go value for left, with left food in sight, makes the turn axis choose left", () => {
  const g = blankGraph();
  setWeight(g, "ray4.food", "bg.go.left", 1);
  const choice = new CompetitiveSelector(g, 1, quiet).choose(senses({ "ray4.food": 0.8 }));
  assert.equal(choice.selected.left, 1);
  assert.equal(choice.selected.right, 0);
});

test("a learned NoGo value suppresses: Go 1 alone turns left, Go 1 with NoGo 1 rests", () => {
  const goOnly = blankGraph();
  setWeight(goOnly, "ray4.food", "bg.go.left", 1);
  assert.equal(new CompetitiveSelector(goOnly, 1, quiet).choose(senses({ "ray4.food": 0.8 })).selected.left, 1);
  const goAndNoGo = blankGraph();
  setWeight(goAndNoGo, "ray4.food", "bg.go.left", 1);
  setWeight(goAndNoGo, "ray4.food", "bg.nogo.left", 1);
  assert.equal(new CompetitiveSelector(goAndNoGo, 1, quiet).choose(senses({ "ray4.food": 0.8 })).action.turn, 0);
});

test("rest wins when nothing is worth more than the rest bias: a sated blank brain does nothing", () => {
  const choice = new CompetitiveSelector(blankGraph(), 1, quiet).choose(senses({ "intero.hunger": 0 }));
  assert.deepEqual(choice.action, { thrust: 0, turn: 0 });
});

test("hunger alone moves a blank brain: vigor × hunger above the rest bias", () => {
  const choice = new CompetitiveSelector(blankGraph(), 1, { ...quiet, vigor: 1, restBias: 0.3 }).choose(senses({ "intero.hunger": 0.6 }));
  assert.equal(choice.selected.forward + choice.selected.back, 1, "the thrust axis acts");
  assert.equal(choice.selected.left + choice.selected.right, 1, "the turn axis acts");
});

test("each axis chooses at most one: antagonists never together", () => {
  const sel = new CompetitiveSelector(blankGraph(), 3, { vigor: 1 });
  for (let t = 0; t < 2000; t++) {
    const c = sel.choose(senses({ "intero.hunger": 0.7 }));
    assert.ok(c.selected.forward + c.selected.back <= 1, `tick ${t} thrust`);
    assert.ok(c.selected.left + c.selected.right <= 1, `tick ${t} turn`);
  }
});

test("both axes act together: the body can turn while it moves forward", () => {
  const g = blankGraph();
  setWeight(g, "ray4.food", "bg.go.left", 1);
  setWeight(g, "ray4.food", "bg.go.forward", 1);
  const c = new CompetitiveSelector(g, 1, quiet).choose(senses({ "ray4.food": 0.8 }));
  assert.deepEqual(c.action, { thrust: 1, turn: 1 });
});

test("the selector reads the live graph: a weight changed after construction changes the choice", () => {
  const g = blankGraph();
  const sel = new CompetitiveSelector(g, 1, quiet);
  assert.equal(sel.choose(senses({ "ray0.food": 0.8 })).selected.right, 0);
  setWeight(g, "ray0.food", "bg.go.right", 1);
  assert.equal(sel.choose(senses({ "ray0.food": 0.8 })).selected.right, 1);
});

test("exploration: with explore 1 every axis is random, all three candidates appear", () => {
  const sel = new CompetitiveSelector(blankGraph(), 5, { explore: 1 });
  const seen = new Set<string>();
  for (let t = 0; t < 300; t++) seen.add(JSON.stringify(sel.choose(senses()).action.turn));
  assert.deepEqual([...seen].sort(), ["-1", "0", "1"]);
});

test("exploration is marked on the choice", () => {
  const c = new CompetitiveSelector(blankGraph(), 5, { explore: 1 }).choose(senses());
  assert.deepEqual(c.explored, [true, true]);
});

test("same seed, same choices", () => {
  const run = () => { const s = new CompetitiveSelector(blankGraph(), 9); return Array.from({ length: 200 }, () => JSON.stringify(s.choose(senses({ "intero.hunger": 0.5 })).selected)).join(); };
  assert.equal(run(), run());
});

test("bad parameters are refused", () => {
  for (const p of [{ explore: -0.1 }, { explore: 1.1 }, { noiseGain: -1 }, { restBias: Number.NaN }, { vigor: -0.5 }]) {
    assert.throws(() => new CompetitiveSelector(blankGraph(), 1, p), RangeError, JSON.stringify(p));
  }
});

test("a learning pathway that does not start at a sense is refused (selection reads senses directly)", () => {
  const g = bornGraph(C, { seed: 1, group: "reflexless", expansion: { cells: 4, inputs: 4, threshold: 1 } });
  assert.throws(() => new CompetitiveSelector(g, 1), /reads senses directly/);
});

test("direct eligibility: the sense of this tick paired with the action chosen on this tick", () => {
  const ledger = new Ledger("DNK-0001", blankGraph());
  const learner = new Learner(structuredClone(ledger.graph), ledger, { lambda: 0.5 });
  learner.updateEligibilityDirect(senses({ "ray4.food": 0.8 }), { forward: 0, back: 0, left: 1, right: 0 });
  assert.equal(learner.eligibility("ray4.food", "bg.go.left"), 0.8);
  assert.equal(learner.eligibility("ray4.food", "bg.nogo.left"), 0.8, "NoGo of the chosen action is eligible too");
  assert.equal(learner.eligibility("ray4.food", "bg.go.right"), 0, "the action not chosen gets no credit");
  learner.updateEligibilityDirect(senses(), { forward: 0, back: 0, left: 0, right: 0 });
  assert.equal(learner.eligibility("ray4.food", "bg.go.left"), 0.4, "it decays by λ");
});

test("agent with selection: acts through the selector, learns on the record, replays", () => {
  const ledger = new Ledger("DNK-0002", bornGraph(C, { seed: 2, group: "reflexless" }));
  const agent = createAgent({ cfg: HUNGRY, ledger, noiseSeed: 2, critic: {}, learning: { quantum: 0.005 }, teachAtDeath: false, selection: {} });
  for (let ep = 1; ep <= 3; ep++) { agent.startEpisode(ep); runEpisode(new Room(200 + ep, HUNGRY), agent.policy, 1500, false, agent.hooks); }
  agent.drainWrites();
  assert.ok(agent.lastChoice, "the selector made the choices");
  assert.ok(ledger.entries.some((e) => e.kind === "weight"), "nothing was learned");
  assert.ok(ledger.matches(agent.graph));
  assert.equal(JSON.stringify(new Ledger(ledger.subjectId, ledger.birthGraph, ledger.entries).graph), JSON.stringify(ledger.graph));
});

test("agent with selection: the action returned is the selector's choice", () => {
  const ledger = new Ledger("DNK-0003", bornGraph(C, { seed: 3, group: "reflexless" }));
  const agent = createAgent({ cfg: HUNGRY, ledger, noiseSeed: 3, learning: { frozen: true }, selection: {} });
  agent.startEpisode(1);
  const room = new Room(301, HUNGRY);
  for (let t = 0; t < 50; t++) {
    const a = agent.policy(room.observe(), t);
    assert.deepEqual(a, agent.lastChoice!.action, `tick ${t}`);
    room.step(a);
  }
});

test("agent without selection is unchanged: no selector, no choices", () => {
  const agent = createAgent({ cfg: HUNGRY, ledger: new Ledger("DNK-0004", bornGraph(C, { seed: 4, group: "reflexless" })), noiseSeed: 4 });
  assert.equal(agent.selector, null);
  agent.startEpisode(1);
  runEpisode(new Room(401, HUNGRY), agent.policy, 50, false, agent.hooks);
  assert.equal(agent.lastChoice, null);
});

for (const a of ACTIONS) {
  test(`asOutputs: bg.out.${a} is 1 exactly when ${a} was chosen`, () => {
    const selected = { forward: 0, back: 0, left: 0, right: 0, [a]: 1 } as Record<(typeof ACTIONS)[number], 0 | 1>;
    const out = CompetitiveSelector.asOutputs({ selected, salience: selected, explored: [false, false], action: { thrust: 0, turn: 0 } });
    for (const b of ACTIONS) assert.equal(out[`bg.out.${b}`], b === a ? 1 : 0);
  });
}

// --- recalled senses (TASARIM-008 §16, A3) -----------------------------------------------------------------------------

test("a recalled sense's rule synapse counts like a sense's: its value times its weight", () => {
  const g = bornGraph(C, { seed: 1, group: "reflexless", recall: { rules: "innate", maxInitial: 0 } });
  setWeight(g, "rec4.food", "bg.go.left", 2);
  const s = new CompetitiveSelector(g, 1, quiet);
  const base = s.values(senses()).left;
  assert.ok(Math.abs(s.values(senses({ "rec4.food": 0.3 })).left - base - 0.6) < 1e-12);
});

test("refresh: a synapse born in the live graph after construction counts only once the selector re-reads the graph", () => {
  const g = bornGraph(C, { seed: 1, group: "reflexless", recall: { rules: "grown" } });
  const s = new CompetitiveSelector(g, 1, quiet);
  const before = s.values(senses({ "rec2.food": 1 })).forward;
  g.connections.push({ from: "rec2.food", to: "bg.go.forward", weight: 0.5 });
  assert.equal(s.values(senses({ "rec2.food": 1 })).forward, before, "not seen before refresh()");
  s.refresh();
  assert.ok(Math.abs(s.values(senses({ "rec2.food": 1 })).forward - before - 0.5) < 1e-12, "seen after refresh()");
});

test("the selector sums in edge-key order, however the graph lists its edges (a synapse born in life comes last)", () => {
  // An order-sensitive sum: 2 + 1e-17 − 2 is 0 or 1e-17 in floating point, depending on the order. In edge-key order the
  // recalled sense's term comes before touch.bump's (rec… < touch…); a born synapse is appended after them.
  const g = bornGraph(C, { seed: 1, group: "reflexless", recall: { rules: "innate", maxInitial: 0 } });
  for (const e of g.connections) if (e.to.startsWith("bg.go.") || e.to.startsWith("bg.nogo.")) if (/^(ray|touch|intero|proprio)/.test(e.from)) e.weight = 0;
  setWeight(g, "touch.bump", "bg.go.left", 2);
  setWeight(g, "touch.bump", "bg.nogo.left", 2);
  setWeight(g, "rec4.food", "bg.go.left", 1e-17);
  const sorted = { ...g, connections: [...g.connections].sort((a, b) => (`${a.from}->${a.to}` < `${b.from}->${b.to}` ? -1 : 1)) };
  const bornLast = { ...g, connections: [...sorted.connections.filter((e) => !(e.from === "rec4.food" && e.to === "bg.go.left")), sorted.connections.find((e) => e.from === "rec4.food" && e.to === "bg.go.left")!] };
  const s = { ...senses({ "touch.bump": 1 }), "rec4.food": 1 };
  assert.equal(new CompetitiveSelector(bornLast, 1, quiet).values(s).left, new CompetitiveSelector(sorted, 1, quiet).values(s).left);
});
