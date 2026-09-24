// brain-lab/baselines/linear-q.ts — a measuring stick, NOT a brain: textbook SARSA(λ) with a
// linear value function (Sutton & Barto 2018, §12.7), given exactly what the brain gets.
//
// Same senses: the 22 encoded sensor values (sensorimotor/encode.ts) plus a bias of 1.
// Same body: the 9 motor commands the brain's 4 binary motors can produce (thrust × turn).
// Same reward: the homeostatic outcome (neuromodulation/outcome.ts), −1 more at death.
// What differs is only the learning machinery — which is the point: it tells us whether the
// room is hard, or our brain is slow.
//
//   Q(s, a) = w_a · x(s)
//   δ       = r + γ·Q(s′, a′) − Q(s, a)            (death: δ = r − Q(s, a))
//   w      ← w + α/‖x‖² · δ · e                    (step size normalised by feature energy)
//   e      ← γλ·e + ∇Q(s′, a′)                     (accumulating eligibility)
//
// Exploration is ε-greedy with a seeded RNG; ties break at random, so an untrained agent
// (all weights 0) is exactly the random policy. Not ledger-tracked: it is not a subject's
// brain, and the experiment stores its weights per episode instead.
"use strict";

import { outcomeOf } from "../neuromodulation/index.ts";
import { encodeObservation, sensorNodeIds } from "../sensorimotor/index.ts";
import { Rng, type Action, type EpisodeHooks, type Observation, type Policy, type WorldConfig } from "../world/index.ts";

/** Every command the brain's antagonist motor pairs can produce. */
export const MOTOR_COMMANDS: readonly Action[] = Object.freeze(
  [-1, 0, 1].flatMap((thrust) => [-1, 0, 1].map((turn) => Object.freeze({ thrust, turn }))),
);

export interface LinearQParams {
  readonly alpha: number;
  readonly gamma: number;
  readonly lambda: number;
  readonly epsilon: number;
  /** Innate value of dying; the same −1 the dopamine channel uses. */
  readonly deathOutcome: number;
  /** true = act only, never change weights (evaluation). */
  readonly frozen: boolean;
}

export const DEFAULT_LINEAR_Q: LinearQParams = Object.freeze({
  alpha: 0.1, gamma: 0.99, lambda: 0.9, epsilon: 0.1, deathOutcome: -1, frozen: false,
});

export class LinearQ {
  readonly params: LinearQParams;
  readonly featureNames: readonly string[];
  /** weights[a][f] — one row per motor command. */
  readonly weights: Float64Array[];
  private readonly cfg: WorldConfig;
  private readonly rng: Rng;
  private trace: Float64Array[];
  private prev: { obs: Observation; x: Float64Array; a: number } | null = null;

  constructor(cfg: WorldConfig, seed: number, params: Partial<LinearQParams> = {}, weights?: readonly (readonly number[])[]) {
    this.params = { ...DEFAULT_LINEAR_Q, ...params };
    const p = this.params;
    if (!(p.alpha >= 0) || !(p.gamma >= 0 && p.gamma <= 1) || !(p.lambda >= 0 && p.lambda <= 1) || !(p.epsilon >= 0 && p.epsilon <= 1) || !Number.isFinite(p.deathOutcome)) {
      throw new RangeError(`bad linear-Q params ${JSON.stringify(p)}`);
    }
    this.cfg = cfg;
    this.rng = new Rng(seed);
    this.featureNames = Object.freeze([...sensorNodeIds(cfg), "bias"]);
    const F = this.featureNames.length;
    if (weights && (weights.length !== MOTOR_COMMANDS.length || weights.some((row) => row.length !== F))) {
      throw new RangeError(`weights must be ${MOTOR_COMMANDS.length}×${F}`);
    }
    this.weights = MOTOR_COMMANDS.map((_, a) => Float64Array.from(weights ? weights[a]! : new Array<number>(F).fill(0)));
    this.trace = this.zeros();
  }

  private zeros(): Float64Array[] {
    return MOTOR_COMMANDS.map(() => new Float64Array(this.featureNames.length));
  }

  features(obs: Observation): Float64Array {
    const enc = encodeObservation(obs, this.cfg) as Record<string, number>;
    return Float64Array.from(this.featureNames, (f) => (f === "bias" ? 1 : enc[f]!));
  }

  q(x: Float64Array, a: number): number {
    const w = this.weights[a]!;
    let v = 0;
    for (let f = 0; f < x.length; f++) v += w[f]! * x[f]!;
    return v;
  }

  /** ε-greedy; ties between best commands broken at random. */
  choose(x: Float64Array, epsilon = this.params.epsilon): number {
    if (this.rng.next() < epsilon) return Math.floor(this.rng.next() * MOTOR_COMMANDS.length);
    let best = Number.NEGATIVE_INFINITY;
    let ties: number[] = [];
    for (let a = 0; a < MOTOR_COMMANDS.length; a++) {
      const v = this.q(x, a);
      if (v > best) { best = v; ties = [a]; } else if (v === best) ties.push(a);
    }
    return ties[Math.floor(this.rng.next() * ties.length)]!;
  }

  private learn(delta: number, x: Float64Array): void {
    if (!Number.isFinite(delta)) throw new RangeError(`δ is ${delta}`);
    let energy = 0;
    for (const v of x) energy += v * v;
    const step = (this.params.alpha / Math.max(1, energy)) * delta;
    for (let a = 0; a < this.weights.length; a++) {
      const w = this.weights[a]!, e = this.trace[a]!;
      for (let f = 0; f < w.length; f++) if (e[f] !== 0) w[f]! += step * e[f]!;
    }
  }

  /** Call before each episode: eligibility does not carry over between lives. */
  startEpisode(): void {
    this.trace = this.zeros();
    this.prev = null;
  }

  readonly policy: Policy = (obs) => {
    const x = this.features(obs);
    const a = this.choose(x);
    const { gamma, lambda, frozen } = this.params;
    if (!frozen) {
      if (this.prev) this.learn(outcomeOf(this.prev.obs, obs) + gamma * this.q(x, a) - this.q(this.prev.x, this.prev.a), this.prev.x);
      for (const e of this.trace) for (let f = 0; f < e.length; f++) e[f]! *= gamma * lambda;
      const e = this.trace[a]!;
      for (let f = 0; f < x.length; f++) e[f]! += x[f]!;
    }
    this.prev = { obs, x, a };
    return MOTOR_COMMANDS[a]!;
  };

  readonly hooks: EpisodeHooks = {
    onDeath: (finalObs) => {
      if (this.params.frozen || !this.prev) return;
      const r = outcomeOf(this.prev.obs, finalObs) + this.params.deathOutcome;
      this.learn(r - this.q(this.prev.x, this.prev.a), this.prev.x);
    },
  };

  snapshot(): number[][] {
    return this.weights.map((w) => Array.from(w));
  }
}
