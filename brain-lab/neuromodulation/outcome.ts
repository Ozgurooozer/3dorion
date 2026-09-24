// brain-lab/neuromodulation/outcome.ts — how good the last tick felt, from the body's own senses.
//
// Homeostatic reward (Keramati & Gutkin 2014): the drive D is the body's distance from its
// setpoint, and the reward is how much that distance shrank:
//   D = hunger² + healthWeight·injury²      hunger = 1 − energy, injury = 1 − health
//   r = D(before) − D(after)
// Squaring makes the same change matter more the further the body is from its setpoint: a
// meal is worth more when starving, a wound hurts more on top of wounds. A body at its
// setpoint feels nothing. Valuing the setpoint is innate; what moves the body toward it is learned.
"use strict";

import type { Observation } from "../world/index.ts";

export interface OutcomeWeights {
  /** How much injury counts against hunger in the drive. */
  readonly healthWeight: number;
}

export const DEFAULT_OUTCOME_WEIGHTS: OutcomeWeights = Object.freeze({ healthWeight: 1 });

/** Distance from the setpoint: 0 when fed and unhurt, up to 1 + healthWeight. */
export function drive(o: Pick<Observation, "energy" | "health">, w: OutcomeWeights = DEFAULT_OUTCOME_WEIGHTS): number {
  const hunger = 1 - o.energy;
  const injury = 1 - o.health;
  return hunger * hunger + w.healthWeight * injury * injury;
}

export function outcomeOf(prev: Observation, next: Observation, w: OutcomeWeights = DEFAULT_OUTCOME_WEIGHTS): number {
  const v = drive(prev, w) - drive(next, w);
  if (!Number.isFinite(v)) throw new RangeError(`outcome is not finite (energy ${next.energy}, health ${next.health})`);
  return v;
}
