// brain-lab/experiments/stats.ts — paired tests for "is the learner really different from its control?"
//
// Both take the paired differences (learner − control, one per subject) and return a two-sided p.
//   signTest   — only the direction of each difference counts (exact binomial); robust, weak.
//   wilcoxon   — signed ranks: direction and size; exact distribution when there are no ties and
//                n ≤ 30, normal approximation with tie correction otherwise.
// Zero differences are dropped (the usual convention). Reference values were computed independently
// by enumeration (see stats tests).
"use strict";

export interface PairedTest { readonly n: number; readonly statistic: number; readonly p: number; readonly exact: boolean }

const nonZero = (diffs: readonly number[]) => diffs.filter((d) => {
  if (!Number.isFinite(d)) throw new RangeError(`difference ${d}`);
  return d !== 0;
});

/** Two-sided exact sign test. statistic = number of positive differences. */
export function signTest(diffs: readonly number[]): PairedTest {
  const d = nonZero(diffs);
  const n = d.length;
  const k = d.filter((x) => x > 0).length;
  if (n === 0) return { n, statistic: 0, p: 1, exact: true };
  const tail = Math.min(k, n - k);
  let c = 1, sum = 0; // C(n, 0)
  for (let i = 0; i <= tail; i++) { sum += c; c = (c * (n - i)) / (i + 1); }
  return { n, statistic: k, p: Math.min(1, (2 * sum) / 2 ** n), exact: true };
}

/** Two-sided Wilcoxon signed-rank test. statistic = W+, the sum of ranks of positive differences. */
export function wilcoxon(diffs: readonly number[]): PairedTest {
  const d = nonZero(diffs);
  const n = d.length;
  if (n === 0) return { n, statistic: 0, p: 1, exact: true };
  const order = d.map((x, i) => ({ a: Math.abs(x), i })).sort((x, y) => x.a - y.a);
  const ranks = new Array<number>(n);
  let ties = false, tieTerm = 0;
  for (let i = 0; i < n;) {
    let j = i;
    while (j + 1 < n && order[j + 1]!.a === order[i]!.a) j++;
    const r = (i + j + 2) / 2; // average rank, 1-based
    for (let k = i; k <= j; k++) ranks[order[k]!.i] = r;
    const t = j - i + 1;
    if (t > 1) { ties = true; tieTerm += t ** 3 - t; }
    i = j + 1;
  }
  const w = d.reduce((s, x, i) => s + (x > 0 ? ranks[i]! : 0), 0);
  const total = (n * (n + 1)) / 2;
  if (!ties && n <= 30) {
    // counts[s] = number of sign patterns with W+ = s (ranks 1..n)
    const counts = new Array<number>(total + 1).fill(0);
    counts[0] = 1;
    for (let r = 1; r <= n; r++) for (let s = total; s >= r; s--) counts[s]! += counts[s - r]!;
    const lo = Math.min(w, total - w);
    let tail = 0;
    for (let s = 0; s <= lo; s++) tail += counts[s]!;
    return { n, statistic: w, p: Math.min(1, (2 * tail) / 2 ** n), exact: true };
  }
  const mean = total / 2;
  const sd = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tieTerm / 48);
  const z = (Math.abs(w - mean) - 0.5) / sd;
  return { n, statistic: w, p: Math.min(1, 2 * (1 - normalCdf(z))), exact: false };
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 erf, |error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}
