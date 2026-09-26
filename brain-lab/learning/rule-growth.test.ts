// brain-lab/learning/rule-growth.test.ts — rule growth in the learner (A3.1; meeting 2026-09-26-a3-kural-dogumu K1): a
// growable synapse that does not exist yet learns as a synapse of weight 0 would, is born (edge+) at its first earned
// quantum, and a grown one back at 0 is pruned (edge-), a candidate again with its trace. Every case is a fresh brain.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { bornGraph } from "../development/index.ts";
import { Ledger } from "../registry/index.ts";
import { DEFAULT_CONFIG as C } from "../world/index.ts";
import { Learner } from "./index.ts";

const RULE = { from: "rec4.food", to: "bg.go.left" };
const PARAMS = { eta: 1, lambda: 0.9, quantum: 0.005 };
const has = (g: { connections: readonly { from: string; to: string }[] }) => g.connections.some((e) => e.from === RULE.from && e.to === RULE.to);

/** A newborn with the recalled-sense nodes and no rule synapse (B), and a learner that may grow rec4 → Go left. */
function grownBrain(params: Partial<typeof PARAMS & { frozen: boolean; senseFilter: string }> = {}) {
  const ledger = new Ledger("DNK-0001", bornGraph(C, { seed: 1, group: "reflexless", recall: { rules: "grown" } }));
  const graph = structuredClone(ledger.graph);
  const learner = new Learner(graph, ledger, { ...PARAMS, ...params }, [RULE]);
  const eligible = () => learner.updateEligibilityDirect({ "rec4.food": 1 }, { forward: 0, back: 0, left: 1, right: 0 });
  return { ledger, graph, learner, eligible };
}

test("a candidate is born the first time it earns a quantum: one edge+ with that weight, in the live brain and on the ledger", () => {
  const { ledger, graph, learner, eligible } = grownBrain();
  eligible(); // e = 1
  const written = learner.applyDopamine(0.012, 5); // pending 0.012: two quanta
  assert.deepEqual(written.map((e) => e.kind), ["edge+"]);
  assert.deepEqual((written[0] as { edge: unknown }).edge, { ...RULE, weight: 0.01 });
  assert.ok(has(graph), "in the live brain");
  assert.ok(ledger.matches(graph), "the ledger says the same");
  assert.equal(learner.candidateCount, 0);
});

test("a candidate that would lose strength is not born, and its pending change resets as a synapse pinned at 0 does", () => {
  const { graph, learner, eligible } = grownBrain();
  eligible();
  assert.deepEqual(learner.applyDopamine(-0.012, 5), [], "no birth for a loss");
  // Reset: +0.006 is one quantum. Had the −0.012 stayed pending (−0.002 left after its quanta), no quantum would be reached.
  const written = learner.applyDopamine(0.006, 6);
  assert.deepEqual(written.map((e) => e.kind), ["edge+"]);
  assert.equal(graph.connections.find((e) => e.from === RULE.from && e.to === RULE.to)!.weight, 0.005);
});

test("a grown synapse back at 0 is pruned (edge-, weight before), a candidate again with its eligibility; the ledger follows", () => {
  const { ledger, graph, learner, eligible } = grownBrain();
  eligible();
  learner.applyDopamine(0.012, 5); // born at 0.01, 0.002 pending
  const written = learner.applyDopamine(-0.012, 6); // −0.010 pending: two quanta down to 0
  assert.deepEqual(written.map((e) => e.kind), ["edge-"]);
  assert.equal((written[0] as { before: number }).before, 0.01);
  assert.ok(!has(graph), "gone from the live brain");
  assert.ok(ledger.matches(graph));
  assert.equal(learner.candidateCount, 1);
  assert.equal(learner.eligibility(RULE.from, RULE.to), 1, "its trace is kept");
});

test("a pruned rule is born again when it earns a quantum again", () => {
  const { ledger, graph, learner, eligible } = grownBrain();
  eligible();
  learner.applyDopamine(0.012, 5);
  learner.applyDopamine(-0.012, 6);
  assert.deepEqual(learner.applyDopamine(0.006, 7).map((e) => e.kind), ["edge+"]);
  assert.ok(has(graph));
  assert.ok(ledger.matches(graph));
  assert.deepEqual(ledger.entries.map((e) => e.kind), ["edge+", "edge-", "edge+"]);
});

test("frozen, a candidate is never born", () => {
  const { graph, learner, eligible } = grownBrain({ frozen: true });
  eligible();
  assert.deepEqual(learner.applyDopamine(1, 5), []);
  assert.ok(!has(graph));
});

test("a new episode clears a candidate's eligibility and pending change", () => {
  const { learner, eligible } = grownBrain();
  eligible();
  learner.applyDopamine(0.004, 5); // pending 0.004, below a quantum
  learner.startEpisode(2);
  assert.equal(learner.eligibility(RULE.from, RULE.to), 0);
  eligible();
  assert.deepEqual(learner.applyDopamine(0.004, 6), [], "0.004 alone: the earlier 0.004 was cleared, no quantum");
});

test("a candidate filtered out of learning (senseFilter) never learns and is never born", () => {
  const { learner, eligible } = grownBrain({ senseFilter: "^ray" });
  eligible();
  assert.equal(learner.candidateCount, 0);
  assert.deepEqual(learner.applyDopamine(1, 5), []);
});

test("an innate rule synapse (not growable) back at 0 stays in the brain: a weight entry, no pruning", () => {
  const ledger = new Ledger("DNK-0001", bornGraph(C, { seed: 1, group: "reflexless", recall: { rules: "innate", maxInitial: 0 } }));
  const graph = structuredClone(ledger.graph);
  const learner = new Learner(graph, ledger, PARAMS);
  learner.updateEligibilityDirect({ "rec4.food": 1 }, { forward: 0, back: 0, left: 1, right: 0 });
  learner.applyDopamine(0.012, 5);
  assert.deepEqual(learner.applyDopamine(-0.012, 6).map((e) => e.kind), ["weight"]);
  assert.equal(graph.connections.find((e) => e.from === RULE.from && e.to === RULE.to)!.weight, 0);
});

test("only a synapse on a learning pathway can grow, and none may be named twice", () => {
  const ledger = new Ledger("DNK-0001", bornGraph(C, { seed: 1, group: "reflexless", recall: { rules: "grown" } }));
  assert.throws(() => new Learner(structuredClone(ledger.graph), ledger, PARAMS, [{ from: "rec4.food", to: "bg.nogo.left" }]), /no learning pathway/);
  assert.throws(() => new Learner(structuredClone(ledger.graph), ledger, PARAMS, [RULE, { ...RULE }]), /named twice/);
});

test("graph mode: a candidate's trace follows pre·post exactly as a synapse of weight 0 does", () => {
  const grown = grownBrain();
  const innateLedger = new Ledger("DNK-0002", bornGraph(C, { seed: 1, group: "reflexless", recall: { rules: "innate", maxInitial: 0 } }));
  const innate = new Learner(structuredClone(innateLedger.graph), innateLedger, PARAMS);
  for (const [prev, now] of [[{ "rec4.food": 1 }, { "bg.go.left": 1 }], [{ "rec4.food": 0.5 }, { "bg.go.left": 0.3 }], [{}, {}]] as const) {
    grown.learner.updateEligibility(prev, now);
    innate.updateEligibility(prev, now);
    assert.equal(grown.learner.eligibility(RULE.from, RULE.to), innate.eligibility(RULE.from, RULE.to));
  }
  assert.ok(grown.learner.eligibility(RULE.from, RULE.to) > 0, "the trace moved (the check is not empty)");
});
