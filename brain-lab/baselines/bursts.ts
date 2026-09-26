// brain-lab/baselines/bursts.ts — hand-written reference bodies that move without a brain (series 005b,
// moved here from experiments/calibrate-005b.ts so the A1 memory measurement uses the same bodies):
//   blind    random 10-tick bursts of any command, blind to everything: what movement alone gets
//   centre   the blind bursts, but "food straight ahead → forward": what S1n learned (series 005a)
// Neither is a brain; both are seeded, so every life replays.
"use strict";

import { Rng, type Action, type Observation, type Policy, type WorldConfig } from "../world/index.ts";

/** How many ticks a burst holds its command. */
export const BURST_TICKS = 10;

/** Random bursts of BURST_TICKS ticks of any of the 9 commands; `sees` may take over a tick (the body's only use of sight). */
export function burstPolicy(seed: number, sees: (obs: Observation) => Action | null = () => null): Policy {
  const rng = new Rng(seed);
  let burst: Action = { thrust: 0, turn: 0 };
  let left = 0;
  return (obs) => {
    const seen = sees(obs);
    if (seen) return seen;
    if (left-- <= 0) {
      left = BURST_TICKS - 1;
      burst = { thrust: Math.floor(rng.next() * 3) - 1, turn: Math.floor(rng.next() * 3) - 1 };
    }
    return burst;
  };
}

/** Blind bursts, except "food on the straight-ahead ray → forward". */
export function centrePolicy(cfg: WorldConfig, seed: number): Policy {
  const ahead = cfg.rayAngles.findIndex((a) => Math.abs(a) < 1e-9);
  if (ahead < 0) throw new RangeError("the centre body needs a ray pointing straight ahead");
  return burstPolicy(seed, (obs) => (obs.rays[ahead]!.hit === "food" ? { thrust: 1, turn: 0 } : null));
}
