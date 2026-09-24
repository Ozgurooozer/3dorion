// brain-lab/baselines/oracle.ts — a HAND-CODED ceiling, NOT a brain and never a behavior we ship.
// It exists only to show what "good" looks like in this room with these senses: steer toward
// the nearest food in sight, otherwise wander forward and turn away from walls close ahead.
// A learner reaching a large share of this number is doing well; the gap is the room's headroom.
"use strict";

import { Rng, type Action, type Observation, type Policy, type WorldConfig } from "../world/index.ts";

/** Wall closer than this ahead (metres) → turn away. */
export const ORACLE_WALL_DISTANCE = 1;

export function oracleAction(obs: Observation, cfg: WorldConfig): Action {
  let best = -1;
  obs.rays.forEach((r, i) => {
    if (r.hit === "food" && (best < 0 || r.distance < obs.rays[best]!.distance)) best = i;
  });
  if (best >= 0) {
    const angle = cfg.rayAngles[best]!;
    return { thrust: 1, turn: Math.abs(angle) < 1e-9 ? 0 : angle > 0 ? 1 : -1 };
  }
  const ahead = obs.rays[cfg.rayAngles.findIndex((a) => Math.abs(a) < 1e-9)];
  if (obs.bump || (ahead && ahead.hit === "wall" && ahead.distance < ORACLE_WALL_DISTANCE)) return { thrust: 0, turn: 1 };
  return { thrust: 1, turn: 0 };
}

export const oraclePolicy = (cfg: WorldConfig): Policy => (obs) => oracleAction(obs, cfg);

/**
 * A second hand-coded ceiling, measured 2026-09-24 to beat the oracle two to one (25.8 vs 12.4
 * meals/1000 ticks): steer like the oracle when food is in sight, otherwise wander in random
 * 10-tick bursts of any command. The oracle's own search (straight ahead, turn at walls) sweeps
 * the same lanes; random bursts cover the room. Seeded, so replayable.
 */
export function seekerPolicy(cfg: WorldConfig, seed: number): Policy {
  const rng = new Rng(seed);
  let burst: Action = { thrust: 0, turn: 0 };
  let left = 0;
  return (obs) => {
    if (obs.rays.some((r) => r.hit === "food")) return oracleAction(obs, cfg);
    if (left-- <= 0) {
      left = 9;
      burst = { thrust: Math.floor(rng.next() * 3) - 1, turn: Math.floor(rng.next() * 3) - 1 };
    }
    return burst;
  };
}
