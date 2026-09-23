// brain-lab/neuromodulation/predictor.ts — what outcome the brain expects next.
// First version is stateless: it expects "what usually happens", not "what happens here".
// State-dependent prediction needs learning and plugs in behind the same interface.
"use strict";

export interface Predictor {
  predict(): number;
  learn(outcome: number): void;
  snapshot(): { readonly kind: string; readonly value: number };
}

export class RunningMeanPredictor implements Predictor {
  readonly rate: number;
  private value: number;

  constructor(rate = 0.05, initial = 0) {
    if (!(rate > 0 && rate <= 1)) throw new RangeError(`rate must be in (0, 1], got ${rate}`);
    this.rate = rate;
    this.value = initial;
  }

  predict(): number {
    return this.value;
  }

  learn(outcome: number): void {
    this.value += this.rate * (outcome - this.value);
  }

  snapshot() {
    return { kind: "running-mean", value: this.value };
  }
}
