// brain-lab/development/noise.ts — the noise sources of the pattern generators (cpg.noise.*).
// A physical source of randomness, not behavior: each generator gets its own slowly varying
// noise, so spontaneous movements come in natural bursts. Whether a burst becomes a movement
// is decided inside the brain — by the hunger drive (P4) and by action selection (bg).
//
//   n ← a·n + (1 − a)·u        u uniform in [0, 1): temporally correlated ("colored") noise
//   out = clamp(0.5 + s·(n − 0.5), 0, 1)
// The stretch s restores a spread close to a uniform variable (smoothing alone would squeeze
// every value toward 0.5 and turn the drive into an on/off switch instead of a graded rate).
"use strict";

import type { BrainInputlari } from "../brain-ir/ir.ts";
import { ACTIONS, nodeId } from "../regions/index.ts";
import { Rng } from "../world/index.ts";

export const NOISE_IDS: readonly string[] = Object.freeze(ACTIONS.map((a) => nodeId("noise", a)));

export interface NoiseShape {
  /** Memory of the noise per tick, in [0, 1): higher = longer bursts. */
  readonly smoothing: number;
}

export const DEFAULT_NOISE: NoiseShape = Object.freeze({ smoothing: 0.8 });

export class NoiseGenerator {
  readonly shape: NoiseShape;
  private readonly rng: Rng;
  private readonly level = new Map<string, number>();
  private readonly stretch: number;

  constructor(seed: number, shape: NoiseShape = DEFAULT_NOISE) {
    if (!(shape.smoothing >= 0 && shape.smoothing < 1)) throw new RangeError(`smoothing must be in [0, 1), got ${shape.smoothing}`);
    this.shape = shape;
    this.rng = new Rng(seed);
    const a = shape.smoothing;
    // Stationary spread of the smoothed sequence is sd(u)·(1−a)/√(1−a²); stretch it back to sd(u).
    this.stretch = Math.sqrt(1 - a * a) / (1 - a);
    for (const id of NOISE_IDS) this.level.set(id, this.rng.next());
  }

  next(): BrainInputlari {
    const a = this.shape.smoothing;
    const out: BrainInputlari = {};
    for (const id of NOISE_IDS) {
      const n = a * this.level.get(id)! + (1 - a) * this.rng.next();
      this.level.set(id, n);
      out[id] = Math.min(1, Math.max(0, 0.5 + this.stretch * (n - 0.5)));
    }
    return out;
  }

  /** For the controller's extraInputs option. */
  asExtraInputs() {
    return { ids: NOISE_IDS, next: () => this.next() };
  }
}
