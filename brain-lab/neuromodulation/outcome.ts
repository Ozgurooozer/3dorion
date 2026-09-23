// brain-lab/neuromodulation/outcome.ts — how good the last tick felt, from the body's own senses.
// The brain cannot see the world's internals; it only feels energy and health change.
// Valuing "more energy, less injury" is innate; what causes those changes must be learned.
"use strict";

import type { Observation } from "../world/index.ts";

export function outcomeOf(prev: Observation, next: Observation, healthWeight = 1): number {
  const v = next.energy - prev.energy + healthWeight * (next.health - prev.health);
  if (!Number.isFinite(v)) throw new RangeError(`outcome is not finite (energy ${next.energy}, health ${next.health})`);
  return v;
}
