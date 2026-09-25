// brain-lab/learning/cue-memory.ts — the cue memory ("yemek hafızası", TASARIM-006): what was seen shortly
// before a good or bad outcome gains or loses value, and the change of that value teaches the actions.
//
//   x_f(s)  the ray senses only (food, wall and threat on every ray; 1 − distance/range) — which of them
//           matter is found by the rule, not chosen by us
//   e_f ← max(λ·e_f, x_f(s))                      the trace: "seen a moment ago" (λ 0.95: half-life ~14 ticks);
//                                                  replacing, bounded by 1 (see CueParams.trace)
//   Φ(s) = Σ v_f · x_f(s)                          the value of what is in sight
//   δc   = r + γ·Φ(s′) − Φ(s)                      r: the relief the outcome gave (a meal); see CueParams.outcome
//   v_f  ← v_f + α·δc·e_f / max(1, Σ x(s)²)        TD(λ) restricted to cues, normalised step
//   shaping = κ·(γ·Φ(s′) − Φ(s))                   added to the δ that teaches Go/NoGo
//
// Why (measured 2026-09-25, experiments/diagnose-critic.ts): the existing critic is TD(0) over every sense;
// its food-ray weights moved 2.2 in total over training and ended at +0.026 — churn, no meaning. The trace
// credits what was seen seconds before a meal, and restricting it to cues keeps hunger, bias and motion
// from soaking up the credit. The shaping term is potential-based (Ng, Harada & Russell 1999): it moves
// credit to the moment the food came into view or closer, without changing what is best to do.
//
// The values live in the ledger as "critic" entries under the "cue/" prefix, so they are on the record and
// replay with the brain, and never mix with the critic's own weights.
"use strict";

import { outcomeParts } from "../neuromodulation/index.ts";
import type { Ledger, LedgerEntry } from "../registry/index.ts";
import { encodeObservation } from "../sensorimotor/index.ts";
import type { Observation, WorldConfig } from "../world/index.ts";

export interface CueParams {
  /** Trace decay per tick: how long "seen a moment ago" lasts. */
  readonly lambda: number;
  readonly gamma: number;
  readonly alpha: number;
  /** κ: how strongly the change of cue value teaches the actions (0 = learns, does not teach). */
  readonly weight: number;
  /** Ledger resolution: a value changes in steps of this size, each step one entry. */
  readonly quantum: number;
  /**
   * How a sighting enters the trace. "replacing": e ← max(λ·e, x), so a cue seen all the time counts as
   * seen once (Singh & Sutton 1996). "accumulating": e ← λ·e + x, the first version (series 006, K2): a wall
   * in constant view built a trace ~1/(1−λ) = 20 times one sighting, the step grew 20-fold and the values
   * churned (wall rays moved 279 in total, ended at −2.3) — the brain got worse than its twin.
   */
  readonly trace: "replacing" | "accumulating";
  /**
   * What the memory learns from. "relief": only what an outcome gave (a drive that shrank — a meal), as
   * approved ("yemek yenince, az önce yemeği gören ışınlara değer yazılsın"); a cue seen without a meal fades
   * toward 0, it is not punished. "signed": the whole outcome, costs of living and moving included (K2, K3):
   * in the scarce room seeing food was mostly followed by the cost of chasing it, food values ended negative
   * (−0.27, K3) and the brain learned to avoid food. Harm is left to a separate, aversive memory.
   */
  readonly outcome: "relief" | "signed";
}

export const DEFAULT_CUE: CueParams = Object.freeze({ lambda: 0.95, gamma: 0.99, alpha: 0.05, weight: 1, quantum: 0.0005, trace: "replacing" as const, outcome: "relief" as const });
export const CUE_PREFIX = "cue/";
const RAY_SENSE = /^ray\d+\./;

export class CueMemory {
  readonly params: CueParams;
  private readonly ledger: Ledger;
  private readonly cfg: WorldConfig;
  private readonly trace = new Map<string, number>();
  private readonly pending = new Map<string, number>();

  constructor(ledger: Ledger, cfg: WorldConfig, params: Partial<CueParams> = {}) {
    const p = { ...DEFAULT_CUE, ...params };
    const ok = p.lambda >= 0 && p.lambda <= 1 && p.gamma >= 0 && p.gamma <= 1 && p.alpha >= 0 && p.quantum > 0 && Number.isFinite(p.weight) && (p.trace === "replacing" || p.trace === "accumulating") && (p.outcome === "relief" || p.outcome === "signed");
    if (!ok) throw new RangeError(`bad cue memory params ${JSON.stringify(p)}`);
    this.params = p;
    this.ledger = ledger;
    this.cfg = cfg;
  }

  /** The cues in sight: ray senses with a non-zero reading. */
  cues(obs: Observation): Record<string, number> {
    const all = encodeObservation(obs, this.cfg) as Record<string, number>;
    return Object.fromEntries(Object.entries(all).filter(([f, x]) => RAY_SENSE.test(f) && x !== 0));
  }

  /** Φ(s): the learned value of what is in sight. */
  value(obs: Observation): number {
    let v = 0;
    for (const [f, x] of Object.entries(this.cues(obs))) v += this.ledger.criticWeight(CUE_PREFIX + f) * x;
    return v;
  }

  /**
   * One transition prev → now with the body's outcome r. Returns the shaping term for the learner (computed
   * from the values before this step's learning), the memory's own δ, and the ledger entries written.
   */
  step(prev: Observation | null, now: Observation, r: number, tick: number, episode: number, terminal = false, frozen = false): { shaping: number; delta: number; writes: LedgerEntry[] } {
    if (!Number.isFinite(r)) throw new RangeError(`cue memory: outcome ${r} is not finite`);
    if (prev === null) return { shaping: 0, delta: 0, writes: [] };
    const { lambda, gamma, weight } = this.params;
    const x = this.cues(prev);
    for (const [f, e] of this.trace) this.trace.set(f, lambda * e);
    const accumulate = this.params.trace === "accumulating";
    for (const [f, v] of Object.entries(x)) {
      const e = this.trace.get(f) ?? 0;
      this.trace.set(f, accumulate ? e + v : Math.max(e, v));
    }
    const before = this.value(prev);
    const after = terminal ? 0 : this.value(now);
    const learnFrom = this.params.outcome === "relief" ? outcomeParts(prev, now).relief : r;
    const delta = learnFrom + gamma * after - before;
    const shaping = weight * (gamma * after - before);
    const energy = Object.values(x).reduce((s, v) => s + v * v, 0);
    return { shaping, delta, writes: frozen ? [] : this.learn(delta / Math.max(1, energy), tick, episode) };
  }

  /** v_f ← v_f + α·δ·e_f, in quanta, each change a ledger entry. */
  private learn(delta: number, tick: number, episode: number): LedgerEntry[] {
    const writes: LedgerEntry[] = [];
    const { alpha, quantum } = this.params;
    for (const [f, e] of this.trace) {
      if (e === 0) continue;
      const p = (this.pending.get(f) ?? 0) + alpha * delta * e;
      const quanta = Math.trunc(p / quantum);
      this.pending.set(f, p - quanta * quantum);
      if (quanta === 0) continue;
      const feature = CUE_PREFIX + f;
      const before = this.ledger.criticWeight(feature);
      writes.push(this.ledger.record({ kind: "critic", tick, episode, cause: ["cue"], feature, before, after: before + quanta * quantum }));
    }
    return writes;
  }

  /** How many cues are remembered as "seen a moment ago" (0 after resetEpisode). */
  get traced(): number {
    return this.trace.size;
  }

  /** A new room: nothing has been seen yet (the learned values stay). */
  resetEpisode(): void {
    this.trace.clear();
    this.pending.clear();
  }
}
