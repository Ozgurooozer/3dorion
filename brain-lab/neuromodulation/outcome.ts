// brain-lab/neuromodulation/outcome.ts — how good the last tick felt, from the body's own senses.
// The brain cannot see the world's internals; it only feels energy and health change.
// Valuing "more energy, less injury" is innate; what causes those changes must be learned.
"use strict";

import type { Observation } from "../world/index.ts";

export interface OutcomeWeights {
  /** How much a unit of health counts against a unit of energy. */
  readonly healthWeight: number;
  /** Energy matters more when hungry: its value is scaled by 1 + hungerGain·(1 − energy before). */
  readonly hungerGain: number;
}

export const DEFAULT_OUTCOME_WEIGHTS: OutcomeWeights = Object.freeze({ healthWeight: 1, hungerGain: 1 });

export function outcomeOf(prev: Observation, next: Observation, w: OutcomeWeights = DEFAULT_OUTCOME_WEIGHTS): number {
  const hunger = 1 - prev.energy;
  const v = (next.energy - prev.energy) * (1 + w.hungerGain * hunger) + w.healthWeight * (next.health - prev.health);
  if (!Number.isFinite(v)) throw new RangeError(`outcome is not finite (energy ${next.energy}, health ${next.health})`);
  return v;
}
