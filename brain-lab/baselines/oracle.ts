// brain-lab/baselines/oracle.ts — a HAND-CODED ceiling, NOT a brain and never a behavior we ship.
// It exists only to show what "good" looks like in this room with these senses: steer toward
// the nearest food in sight, otherwise wander forward and turn away from walls close ahead.
// A learner reaching a large share of this number is doing well; the gap is the room's headroom.
"use strict";

import type { Action, Observation, Policy, WorldConfig } from "../world/index.ts";

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
