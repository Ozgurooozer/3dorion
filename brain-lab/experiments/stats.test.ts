// brain-lab/experiments/stats.test.ts — the paired tests against values computed independently by
// enumerating every sign pattern (Python, 2026-09-25), not by the formulas under test.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalCdf, signTest, wilcoxon } from "./stats.ts";

const close = (a: number, b: number, tol = 1e-12) => Math.abs(a - b) <= tol;

test("sign test: 10 of 10 positive → p = 2·0.5¹⁰ = 0.001953125", () => {
  const r = signTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(close(r.p, 0.001953125), `${r.p}`);
});

test("sign test: 16 of 20 positive → p = 0.0118179321 (enumerated)", () => {
  const diffs = [...Array(16).fill(1), ...Array(4).fill(-1)];
  assert.ok(close(signTest(diffs).p, 0.01181793212890625), `${signTest(diffs).p}`);
});

test("sign test: zero differences are dropped", () => {
  assert.equal(signTest([0, 0, 1, -1]).n, 2);
});

test("wilcoxon: n 10 all positive → exact p 0.001953125", () => {
  const r = wilcoxon([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.exact, true);
  assert.equal(r.statistic, 55);
  assert.ok(close(r.p, 0.001953125), `${r.p}`);
});

test("wilcoxon: n 10 with W+ = 8 → exact p 0.048828125 (the classic critical value)", () => {
  // ranks 1..10; positives at ranks 1, 3, 4 → W+ = 8
  const r = wilcoxon([0.1, -0.2, 0.3, 0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -1.0]);
  assert.equal(r.statistic, 8);
  assert.ok(close(r.p, 0.048828125), `${r.p}`);
});

test("wilcoxon: n 8 with W+ = 3 → exact p 0.0390625", () => {
  const r = wilcoxon([0.1, 0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8]);
  assert.equal(r.statistic, 3);
  assert.ok(close(r.p, 0.0390625), `${r.p}`);
});

test("wilcoxon: n 12 with W+ = 20 → exact p 0.1513671875", () => {
  // ranks 1..12; positives at ranks 1, 2, 3, 6, 8 → W+ = 20
  const d = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((r) => ([1, 2, 3, 6, 8].includes(r) ? r : -r));
  const res = wilcoxon(d);
  assert.equal(res.statistic, 20);
  assert.ok(close(res.p, 0.1513671875), `${res.p}`);
});

test("wilcoxon: the test is symmetric — flipping every sign gives the same p", () => {
  const d = [0.3, -0.1, 0.5, 0.7, -0.2, 0.9, 0.4];
  assert.ok(close(wilcoxon(d).p, wilcoxon(d.map((x) => -x)).p));
});

test("wilcoxon: ties fall back to the normal approximation, and say so", () => {
  const r = wilcoxon([1, 1, 1, -1, 2, 2, 3]);
  assert.equal(r.exact, false);
  assert.ok(r.p > 0 && r.p <= 1);
});

test("wilcoxon: tied sizes share the average rank — [1, −1, 2] gives W+ = 1.5 + 3 = 4.5", () => {
  assert.equal(wilcoxon([1, -1, 2]).statistic, 4.5);
});

test("wilcoxon: no non-zero differences → p 1", () => {
  assert.equal(wilcoxon([0, 0, 0]).p, 1);
});

test("a non-finite difference is refused", () => {
  assert.throws(() => wilcoxon([1, Number.NaN]), RangeError);
  assert.throws(() => signTest([Number.POSITIVE_INFINITY]), RangeError);
});

test("normal CDF: known points to 1e-6", () => {
  assert.ok(close(normalCdf(0), 0.5, 1e-7));
  assert.ok(close(normalCdf(1.959963985), 0.975, 1e-6));
  assert.ok(close(normalCdf(-1), 0.158655254, 1e-6));
});
