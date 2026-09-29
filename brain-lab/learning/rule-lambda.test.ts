// brain-lab/learning/rule-lambda.test.ts — ruleLambda (ön-kayıt 003): a longer eligibility trace for the rule synapses
// only (recalled sense → Go/NoGo). Off (null) it changes nothing. Every case is a fresh brain.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { bornGraph } from "../development/index.ts";
import { Ledger } from "../registry/index.ts";
import { DEFAULT_CONFIG as C } from "../world/index.ts";
import { Learner } from "./index.ts";

const RULE = { from: "rec4.food", to: "bg.go.left" };
const SENSE = { from: "ray4.food", to: "bg.go.left" };
const LEFT = { forward: 0, back: 0, left: 1, right: 0 } as const;
const NONE = { forward: 0, back: 0, left: 0, right: 0 } as const;

/** A newborn with recalled senses, the rule grown in life (a candidate) and the real sense synapse present. */
function brain(params: { ruleLambda?: number | null; lambda?: number } = {}) {
  const ledger = new Ledger("DNK-0001", bornGraph(C, { seed: 1, group: "reflexless", recall: { rules: "grown" } }));
  const graph = structuredClone(ledger.graph);
  const learner = new Learner(graph, ledger, { eta: 1, lambda: 0.9, quantum: 0.005, ...params }, [RULE]);
  const fire = () => learner.updateEligibilityDirect({ "rec4.food": 1, "ray4.food": 1 }, LEFT);
  const decay = () => learner.updateEligibilityDirect({}, NONE);
  return { learner, fire, decay };
}

test("off (null, the default): the rule trace and the sense trace both decay at lambda", () => {
  const { learner, fire, decay } = brain();
  fire();
  for (let i = 0; i < 5; i++) decay();
  assert.ok(Math.abs(learner.eligibility(RULE.from, RULE.to) - 0.9 ** 5) < 1e-12, "rule trace");
  assert.ok(Math.abs(learner.eligibility(SENSE.from, SENSE.to) - 0.9 ** 5) < 1e-12, "sense trace");
});

test("null is identical to leaving ruleLambda out, tick for tick", () => {
  const a = brain(), b = brain({ ruleLambda: null });
  for (const step of [(x: typeof a) => x.fire(), (x: typeof a) => x.decay(), (x: typeof a) => x.fire()]) { step(a); step(b); }
  assert.equal(a.learner.eligibility(RULE.from, RULE.to), b.learner.eligibility(RULE.from, RULE.to));
  assert.equal(a.learner.eligibility(SENSE.from, SENSE.to), b.learner.eligibility(SENSE.from, SENSE.to));
});

test("on: the rule trace decays at ruleLambda and the real-sense trace stays at lambda", () => {
  const { learner, fire, decay } = brain({ ruleLambda: 0.97 });
  fire();
  for (let i = 0; i < 20; i++) decay();
  assert.ok(Math.abs(learner.eligibility(RULE.from, RULE.to) - 0.97 ** 20) < 1e-12, "rule trace at 0.97");
  assert.ok(Math.abs(learner.eligibility(SENSE.from, SENSE.to) - 0.9 ** 20) < 1e-12, "sense trace still at 0.9");
});

test("on: a rule synapse that is already in the graph (innate, D) uses ruleLambda too", () => {
  const ledger = new Ledger("DNK-0002", bornGraph(C, { seed: 1, group: "reflexless", recall: { rules: "innate" } }));
  const graph = structuredClone(ledger.graph);
  const learner = new Learner(graph, ledger, { eta: 1, lambda: 0.9, ruleLambda: 0.97 });
  learner.updateEligibilityDirect({ "rec4.food": 1 }, LEFT);
  learner.updateEligibilityDirect({}, NONE);
  assert.ok(Math.abs(learner.eligibility(RULE.from, RULE.to) - 0.97) < 1e-12);
});

test("on, gate 'neuron' path (updateEligibility): the rule trace also uses ruleLambda", () => {
  const ledger = new Ledger("DNK-0003", bornGraph(C, { seed: 1, group: "reflexless", recall: { rules: "innate" } }));
  const graph = structuredClone(ledger.graph);
  const learner = new Learner(graph, ledger, { eta: 1, lambda: 0.9, ruleLambda: 0.97, gate: "neuron" });
  learner.updateEligibility({ "rec4.food": 1 }, { "bg.go.left": 1 });
  learner.updateEligibility({}, {});
  assert.ok(Math.abs(learner.eligibility(RULE.from, RULE.to) - 0.97) < 1e-12);
});

test("ruleLambda outside [0, 1) is refused, the edges 0 and just under 1 are accepted", () => {
  for (const bad of [-0.1, 1, 1.5, Number.NaN]) assert.throws(() => brain({ ruleLambda: bad }), RangeError, `ruleLambda ${bad}`);
  for (const ok of [0, 0.999]) assert.doesNotThrow(() => brain({ ruleLambda: ok }), `ruleLambda ${ok}`);
});
