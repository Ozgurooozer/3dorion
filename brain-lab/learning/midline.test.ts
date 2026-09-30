// brain-lab/learning/midline.test.ts — the midline rule (TASARIM-009 §3a): a sense with no side (hunger, pain, bump,
// forward/back proprio, the centre ray) has one synapse to "turn", in two copies (left, right). Born equal, taught as one,
// so it can make turning more or less likely but never choose the side. Off, every brain is the brain it always was.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { BrainGrafi } from "../brain-ir/ir.ts";
import { INNATE_REFLEXES, bornGraph, midlineSources } from "../development/index.ts";
import { Ledger, type LedgerEntry } from "../registry/index.ts";
import { makeConfig, Room, runEpisode } from "../world/index.ts";
import { Learner, createAgent } from "./index.ts";

const CFG = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
const TURNS = [["bg.go.left", "bg.go.right"], ["bg.nogo.left", "bg.nogo.right"]] as const;
const w = (g: BrainGrafi, from: string, to: string) => g.connections.find((e) => e.from === from && e.to === to)?.weight;
const isMidlineTurn = (from: string, to: string) => midlineSources(CFG).includes(from) && /^bg\.(go|nogo)\.(left|right)$/.test(to);

test("midline sources: the body's sideless senses and every kind seen by the centre ray, nothing lateral", () => {
  assert.deepEqual([...midlineSources(CFG)].sort(), [
    "intero.hunger", "intero.injury", "proprio.backward", "proprio.forward", "ray2.food", "ray2.threat", "ray2.wall", "touch.bump",
  ]);
});

test("midline sources: a room with no centre ray has only the body's", () => {
  const even = makeConfig({ ...CFG, rayAngles: [-0.6, -0.2, 0.2, 0.6] });
  assert.deepEqual([...midlineSources(even)].sort(), ["intero.hunger", "intero.injury", "proprio.backward", "proprio.forward", "touch.bump"]);
});

test("born with the rule: each midline source's left and right turn synapses are equal, Go and NoGo", () => {
  for (const group of ["reflexless", "reflexive"] as const) {
    const g = bornGraph(CFG, { seed: 3, group, midline: true });
    for (const s of midlineSources(CFG)) for (const [l, r] of TURNS) assert.equal(w(g, s, l), w(g, s, r), `${group} ${s} ${l}`);
  }
});

test("born with the rule: the pair is the mean of the two random weights; every other synapse is untouched", () => {
  const plain = bornGraph(CFG, { seed: 4, group: "reflexless" });
  const mid = bornGraph(CFG, { seed: 4, group: "reflexless", midline: true });
  assert.equal(mid.connections.length, plain.connections.length);
  for (const e of plain.connections) {
    if (!isMidlineTurn(e.from, e.to)) { assert.equal(w(mid, e.from, e.to), e.weight, `${e.from} → ${e.to} changed`); continue; }
    const other = e.to.endsWith("left") ? e.to.replace("left", "right") : e.to.replace("right", "left");
    assert.equal(w(mid, e.from, e.to), (e.weight + w(plain, e.from, other)!) / 2, `${e.from} → ${e.to}`);
  }
});

test("off, birth is the birth it always was: same graph, same name", () => {
  const before = bornGraph(CFG, { seed: 5, group: "reflexive" });
  assert.deepEqual(bornGraph(CFG, { seed: 5, group: "reflexive", midline: false }), before);
  assert.ok(!(before.name ?? "").includes("midline"));
  assert.ok((bornGraph(CFG, { seed: 5, group: "reflexive", midline: true }).name ?? "").endsWith("-midline"));
});

test("the innate bump reflex is mirrored: bump → turn, the reflex's weight on both sides (the side is left to the noise)", () => {
  const reflex = INNATE_REFLEXES.find((r) => r.from === "touch.bump")!;
  assert.equal(reflex.to, "bg.go.left", "the reflex this test mirrors");
  assert.equal(w(bornGraph(CFG, { seed: 6, group: "reflexive" }), "touch.bump", "bg.go.left"), reflex.weight, "without the rule: left only");
  const mid = bornGraph(CFG, { seed: 6, group: "reflexive", midline: true });
  assert.equal(w(mid, "touch.bump", "bg.go.left"), reflex.weight);
  assert.equal(w(mid, "touch.bump", "bg.go.right"), reflex.weight);
});

test("the reflex that is not a turn (pain → forward) is not mirrored", () => {
  const plain = bornGraph(CFG, { seed: 6, group: "reflexive" });
  const mid = bornGraph(CFG, { seed: 6, group: "reflexive", midline: true });
  assert.equal(w(mid, "intero.injury", "bg.go.forward"), w(plain, "intero.injury", "bg.go.forward"));
  assert.equal(w(mid, "intero.injury", "bg.go.back"), w(plain, "intero.injury", "bg.go.back"));
});

test("the learner refuses the rule on a brain not born symmetric, without midline sources, or with scaling", () => {
  const asym = bornGraph(CFG, { seed: 7, group: "reflexless" });
  assert.throws(() => new Learner(structuredClone(asym), new Ledger("DNK-0001", asym), { midline: true }, [], midlineSources(CFG)), /not born symmetric/);
  const sym = bornGraph(CFG, { seed: 7, group: "reflexless", midline: true });
  assert.throws(() => new Learner(structuredClone(sym), new Ledger("DNK-0001", sym), { midline: true }, []), /midline sources/);
  assert.throws(() => new Learner(structuredClone(sym), new Ledger("DNK-0001", sym), { midline: true, scaling: true }, [], midlineSources(CFG)), /scaling/);
});

test("the learner refuses a per-cell dopamine with the rule: the two copies must hear one δ", () => {
  const sym = bornGraph(CFG, { seed: 8, group: "reflexless", midline: true });
  const l = new Learner(structuredClone(sym), new Ledger("DNK-0001", sym), { midline: true }, [], midlineSources(CFG));
  assert.throws(() => l.applyDopamine(() => 0.5, 1), /one δ/);
});

test("a pair learns from the mean eligibility of its copies: turning left while hungry moves both copies by half", () => {
  const sym = bornGraph(CFG, { seed: 9, group: "reflexless", midline: true });
  const graph = structuredClone(sym);
  const l = new Learner(graph, new Ledger("DNK-0001", sym), { eta: 0.1, quantum: 0.001, midline: true }, [], midlineSources(CFG));
  const before = w(graph, "intero.hunger", "bg.go.left")!;
  l.updateEligibilityDirect({ "intero.hunger": 1 }, { forward: 0, back: 0, left: 1, right: 0 }); // e left 1, e right 0
  l.applyDopamine(1, 1);
  const step = Math.trunc((0.1 * 1 * 0.5) / 0.001) * 0.001; // η·δ·mean(e), in whole quanta
  assert.equal(w(graph, "intero.hunger", "bg.go.left"), before + step);
  assert.equal(w(graph, "intero.hunger", "bg.go.right"), before + step, "the copy of the turn not taken moves too");
});

/** A life with the rule on: selector, critic, three hungry episodes. */
function midlineLife(seed: number) {
  const g = bornGraph(CFG, { seed, group: "reflexive", midline: true });
  const ledger = new Ledger("DNK-0002", g);
  const agent = createAgent({ cfg: CFG, ledger, noiseSeed: seed, critic: {}, selection: {}, learning: { quantum: 0.005, midline: true } });
  const snapshots: BrainGrafi[] = [];
  for (let ep = 1; ep <= 3; ep++) {
    agent.startEpisode(ep);
    runEpisode(new Room(900 + ep, CFG), agent.policy, 1500, false, agent.hooks);
    agent.drainWrites();
    snapshots.push(structuredClone(agent.graph));
  }
  return { agent, ledger, snapshots };
}

/** The weight changes of a ledger, typed. */
const weights = (l: Ledger) => l.entries.filter((e): e is Extract<LedgerEntry, { kind: "weight" }> => e.kind === "weight");

test("in life the pairs stay equal after every episode, and they did learn", () => {
  const { ledger, snapshots } = midlineLife(11);
  for (const [k, g] of snapshots.entries()) {
    for (const s of midlineSources(CFG)) for (const [l, r] of TURNS) assert.equal(w(g, s, l), w(g, s, r), `episode ${k + 1} ${s} ${l}`);
  }
  assert.ok(weights(ledger).some((e) => isMidlineTurn(e.edge.from, e.edge.to)), "no midline turn synapse learned");
});

test("in life every change of one copy is written with its twin: same tick, same before and after, the other side", () => {
  const { ledger } = midlineLife(12);
  const mid = weights(ledger).filter((e) => isMidlineTurn(e.edge.from, e.edge.to));
  assert.ok(mid.length > 0);
  assert.equal(mid.length % 2, 0);
  for (let i = 0; i < mid.length; i += 2) {
    const [a, b] = [mid[i]!, mid[i + 1]!];
    assert.equal(a.edge.from, b.edge.from);
    assert.equal(a.edge.to.replace(/left|right/, "side"), b.edge.to.replace(/left|right/, "side"));
    assert.notEqual(a.edge.to, b.edge.to);
    assert.deepEqual([a.tick, a.before, a.after], [b.tick, b.before, b.after]);
  }
});

test("in life the lateral and forward synapses still learn one by one, and the ledger replays to the live brain", () => {
  const { agent, ledger } = midlineLife(13);
  assert.ok(weights(ledger).some((e) => !isMidlineTurn(e.edge.from, e.edge.to)), "only midline synapses learned");
  assert.ok(ledger.matches(agent.graph));
  assert.equal(JSON.stringify(new Ledger(ledger.subjectId, ledger.birthGraph, ledger.entries).graph), JSON.stringify(ledger.graph));
});
