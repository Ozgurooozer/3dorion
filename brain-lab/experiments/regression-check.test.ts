// brain-lab/experiments/regression-check.test.ts — the regression check's comparisons must catch every difference
// that matters and nothing else: a ledger is compared entry by entry in order and value (ids aside), with growth
// entries left out only when asked (the --hafiza falsification of A2), and a results row field by field.
// Every case builds its own entries.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { BrainDugumu, MemoryRecord } from "../brain-ir/ir.ts";
import type { LedgerEntry } from "../registry/index.ts";
import { GROWTH_KINDS, fieldDifferences, ledgerDifference } from "./regression-check.ts";

const EDGE = { from: "ray2.food", to: "bg.go.forward" };
const weight = (id: number, tick: number, before: number, after: number): LedgerEntry =>
  ({ id: `LRN-${String(id).padStart(8, "0")}`, kind: "weight", tick, episode: 1, cause: ["dopamine"], edge: EDGE, before, after });
const critic = (id: number, tick: number, before: number, after: number): LedgerEntry =>
  ({ id: `LRN-${String(id).padStart(8, "0")}`, kind: "critic", tick, episode: 1, cause: ["dopamine"], feature: "ray2.food", before, after });
const RECORD: MemoryRecord = { what: "food", x: 1, y: 2, strength: 0.5, updated: 3, sightings: 1, born: 3, confirmed: 3 };
const NODE: BrainDugumu = { id: "mem.food.1", type: "memory", memory: RECORD };
const born = (id: number, tick: number): LedgerEntry => ({ id: `LRN-${String(id).padStart(8, "0")}`, kind: "node+", tick, episode: 1, cause: ["food seen"], node: NODE });
const changed = (id: number, tick: number): LedgerEntry =>
  ({ id: `LRN-${String(id).padStart(8, "0")}`, kind: "memory", tick, episode: 1, cause: ["seen again"], node: NODE.id, before: RECORD, after: { ...RECORD, strength: 0.65, confirmed: tick } });
const died = (id: number, tick: number): LedgerEntry => ({ id: `LRN-${String(id).padStart(8, "0")}`, kind: "node-", tick, episode: 1, cause: ["eaten"], node: NODE });

test("ledger: the same entries are no difference", () => {
  const entries = [weight(1, 5, 0.1, 0.105), critic(2, 5, 0, 0.01)];
  assert.equal(ledgerDifference(entries, [weight(1, 5, 0.1, 0.105), critic(2, 5, 0, 0.01)]), null);
});

test("ledger: growth entries in between, left out when asked, are no difference (ids shift, values agree)", () => {
  const recorded = [weight(1, 5, 0.1, 0.105), critic(2, 5, 0, 0.01), weight(3, 9, 0.105, 0.11)];
  const now = [weight(1, 5, 0.1, 0.105), born(2, 6), critic(3, 5, 0, 0.01), changed(4, 30), weight(5, 9, 0.105, 0.11), died(6, 40)];
  assert.equal(ledgerDifference(recorded, now, GROWTH_KINDS), null);
});

test("ledger: the same growth entries are a difference when growth is not left out", () => {
  const recorded = [weight(1, 5, 0.1, 0.105), critic(2, 5, 0, 0.01)];
  const now = [weight(1, 5, 0.1, 0.105), born(2, 6), critic(3, 5, 0, 0.01)];
  const d = ledgerDifference(recorded, now);
  assert.ok(d !== null && d.includes("entry 2"), `the second entry differs: ${d}`);
});

test("ledger: a weight that moved by 1e-12 is a difference, named by its place", () => {
  const d = ledgerDifference([weight(1, 5, 0.1, 0.105), weight(2, 6, 0.105, 0.11)], [weight(1, 5, 0.1, 0.105), weight(2, 6, 0.105, 0.11 + 1e-12)], GROWTH_KINDS);
  assert.ok(d !== null && d.includes("entry 2"), `the second entry differs: ${d}`);
});

test("ledger: the same entries in another order are a difference", () => {
  const d = ledgerDifference([weight(1, 5, 0.1, 0.105), critic(2, 5, 0, 0.01)], [critic(1, 5, 0, 0.01), weight(2, 5, 0.1, 0.105)], GROWTH_KINDS);
  assert.ok(d !== null && d.includes("entry 1"), `the first entry differs: ${d}`);
});

test("ledger: an entry at another tick is a difference", () => {
  assert.notEqual(ledgerDifference([weight(1, 5, 0.1, 0.105)], [weight(1, 6, 0.1, 0.105)], GROWTH_KINDS), null);
});

test("ledger: an entry with another cause is a difference", () => {
  const other: LedgerEntry = { ...weight(1, 5, 0.1, 0.105), cause: ["death", "starved"] };
  assert.notEqual(ledgerDifference([weight(1, 5, 0.1, 0.105)], [other], GROWTH_KINDS), null);
});

test("ledger: a recorded entry missing at the end is a difference", () => {
  const d = ledgerDifference([weight(1, 5, 0.1, 0.105), critic(2, 5, 0, 0.01)], [weight(1, 5, 0.1, 0.105), born(2, 6)], GROWTH_KINDS);
  assert.ok(d !== null && d.includes("now 1") && d.includes("recorded 2"), `counts named: ${d}`);
});

test("ledger: an extra learning entry at the end is a difference", () => {
  assert.notEqual(ledgerDifference([weight(1, 5, 0.1, 0.105)], [weight(1, 5, 0.1, 0.105), critic(2, 5, 0, 0.01)], GROWTH_KINDS), null);
});

test("ledger: the growth kinds are exactly birth, record change and death of a neuron", () => {
  assert.deepEqual([...GROWTH_KINDS].sort(), ["memory", "node+", "node-"]);
});

const EVAL = { ticks: 3000, meals: 11.6, meanDrive: 0.021978363099995783, steering: 0.21109179474096523, sideInfo: null as number | null };
/** The next double above x (x > 0): the smallest difference there is. */
function nextUp(x: number): number {
  const bits = new DataView(new ArrayBuffer(8));
  bits.setFloat64(0, x);
  bits.setBigUint64(0, bits.getBigUint64(0) + 1n);
  return bits.getFloat64(0);
}

test("row: the same numbers are no difference", () => {
  assert.deepEqual(fieldDifferences({ l: EVAL, trainPerK: [1.5, 2.25] }, { l: { ...EVAL }, trainPerK: [1.5, 2.25] }), []);
});

test("row: a number one ulp off is a difference, named by its field", () => {
  assert.notEqual(nextUp(EVAL.meanDrive), EVAL.meanDrive);
  const d = fieldDifferences({ l: EVAL, weightEntries: 5 }, { l: { ...EVAL, meanDrive: nextUp(EVAL.meanDrive) }, weightEntries: 5 });
  assert.equal(d.length, 1, d.join("; "));
  assert.ok(d[0]!.startsWith("l "), `the field is named first: ${d[0]}`);
});

test("row: a changed training block is a difference", () => {
  assert.equal(fieldDifferences({ trainPerK: [1.5, 2.25] }, { trainPerK: [1.5, 2.5] }).length, 1);
});

test("row: a recorded field the new row lacks is a difference", () => {
  assert.equal(fieldDifferences({ l: EVAL, y: EVAL }, { l: EVAL }).length, 1);
});

test("row: a field the record does not carry (a newer measure) is not compared", () => {
  assert.deepEqual(fieldDifferences({ l: EVAL }, { l: EVAL, harmPerK: 0 }), []);
});

test("row: values the record could only keep as JSON wrote them (−0 as 0, NaN as null) agree with it", () => {
  assert.deepEqual(fieldDifferences({ harmPerK: 0, steering: null }, { harmPerK: -0, steering: Number.NaN }), []);
});

test("row: null in the record and null now agree; null against a number does not", () => {
  assert.deepEqual(fieldDifferences({ steering: null }, { steering: null }), []);
  assert.equal(fieldDifferences({ steering: null }, { steering: 0 }).length, 1);
});
