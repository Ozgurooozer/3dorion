// brain-lab/world/rng.ts — seeded PRNG (mulberry32).
// Every random draw in the world goes through this; Math.random() would break replay.
"use strict";

export class Rng {
  private s: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed)) throw new RangeError(`seed must be an integer, got ${seed}`);
    this.s = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Internal state, so a world snapshot/hash captures where the stream is. */
  get state(): number {
    return this.s;
  }
}
