// brain-lab/learning/critic.ts — a state-dependent value estimate (the "critic" of actor-critic,
// as in OpAL, Collins & Frank 2014). It replaces the stateless expectation when enabled:
//
//   V(s) = Σ_f w_f · x_f(s)                  x: the encoded senses plus a bias of 1
//   δ    = r + γ·V(s′) − V(s)                (terminal: V(s′) = 0)
//   w_f ← w_f + α·δ·x_f(s)                   applied in quanta, each one a ledger "critic" entry
//
// The weights live in the ledger (source of truth), so the critic's learning is on the record too.
// A `prefix` names a separate estimate in the same ledger (dopamine compartments, compartments.ts):
// "left/" + "ray3.food" is the left-turn compartment's weight for that sense.
"use strict";

import type { Ledger, LedgerEntry } from "../registry/index.ts";
import { encodeObservation } from "../sensorimotor/index.ts";
import type { Observation, WorldConfig } from "../world/index.ts";

export interface CriticParams {
  readonly alpha: number;
  readonly gamma: number;
  readonly quantum: number;
  /**
   * Divide the step by the feature energy ‖x‖² (normalised LMS, as the linear-Q baseline does).
   * Measured 2026-09-24: ‖x‖² has median 2.6 (p90 4.3), so a fixed α 0.05 is an effective step of
   * ~0.13 — above the baseline's best (0.03) — and the food weights churned (Σ|Δ| 4.7, net 0.004).
   */
  readonly normalize: boolean;
}

export const DEFAULT_CRITIC: CriticParams = Object.freeze({ alpha: 0.05, gamma: 0.99, quantum: 0.0005, normalize: false });

export class Critic {
  readonly params: CriticParams;
  readonly prefix: string;
  private readonly ledger: Ledger;
  private readonly cfg: WorldConfig;
  private readonly pending = new Map<string, number>();

  constructor(ledger: Ledger, cfg: WorldConfig, params: Partial<CriticParams> = {}, prefix = "") {
    this.params = { ...DEFAULT_CRITIC, ...params };
    const p = this.params;
    if (!(p.alpha >= 0) || !(p.gamma >= 0 && p.gamma <= 1) || !(p.quantum > 0)) throw new RangeError(`bad critic params ${JSON.stringify(p)}`);
    this.ledger = ledger;
    this.cfg = cfg;
    this.prefix = prefix;
  }

  features(obs: Observation): Record<string, number> {
    return { ...(encodeObservation(obs, this.cfg) as Record<string, number>), bias: 1 };
  }

  value(obs: Observation): number {
    let v = 0;
    for (const [f, x] of Object.entries(this.features(obs))) v += this.ledger.criticWeight(this.prefix + f) * x;
    return v;
  }

  /** One transition prev → now with reward r. Returns δ and the ledger entries written. */
  step(prev: Observation | null, now: Observation, r: number, tick: number, episode: number, terminal = false, frozen = false) {
    if (!Number.isFinite(r)) throw new RangeError(`reward ${r}`);
    if (prev === null) return { delta: 0, writes: [] as LedgerEntry[] };
    const delta = r + this.params.gamma * (terminal ? 0 : this.value(now)) - this.value(prev);
    return { delta, writes: frozen ? [] : this.learn(prev, delta, tick, episode) };
  }

  /** w ← w + α·δ·x(s), in quanta, each change a ledger entry. */
  learn(s: Observation, delta: number, tick: number, episode: number): LedgerEntry[] {
    if (!Number.isFinite(delta)) throw new RangeError(`critic δ ${delta}`);
    const writes: LedgerEntry[] = [];
    const { alpha, quantum, normalize } = this.params;
    const features = Object.entries(this.features(s));
    const step = normalize ? alpha / Math.max(1, features.reduce((e, [, x]) => e + x * x, 0)) : alpha;
    for (const [f, x] of features) {
      if (x === 0) continue;
      const p = (this.pending.get(f) ?? 0) + step * delta * x;
      const quanta = Math.trunc(p / quantum);
      this.pending.set(f, p - quanta * quantum);
      if (quanta === 0) continue;
      const before = this.ledger.criticWeight(this.prefix + f);
      writes.push(this.ledger.record({ kind: "critic", tick, episode, cause: ["td"], feature: this.prefix + f, before, after: before + quanta * quantum }));
    }
    return writes;
  }

  resetPending(): void {
    this.pending.clear();
  }
}
