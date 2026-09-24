// brain-lab/experiments/measures.ts — what we measure about behavior, defined once.
//
// Orientation ("yönelim"): of the moments when food is in sight, how often does the body's
// action go toward it? Food seen on the left → turning left counts; on the right → turning
// right; straight ahead → moving forward without turning. The brain needs LAG ticks for a
// sight to reach the muscles (sense → Go → selection → motor), so the action at tick t is
// compared with what was seen at tick t − LAG.
"use strict";

import type { Action, Observation, WorldConfig } from "../world/index.ts";

/** Conduction delay of the regional brain from a sense to a motor, in ticks. */
export const LAG = 3;

export type Side = "left" | "center" | "right";

/** Side of the nearest food in sight, or null. Positive ray angle = left (heading increases). */
export function foodSide(obs: Observation, cfg: WorldConfig): Side | null {
  let best = -1;
  obs.rays.forEach((r, i) => {
    if (r.hit === "food" && (best < 0 || r.distance < obs.rays[best]!.distance)) best = i;
  });
  if (best < 0) return null;
  const angle = cfg.rayAngles[best]!;
  return Math.abs(angle) < 1e-9 ? "center" : angle > 0 ? "left" : "right";
}

export function towardFood(side: Side, action: Action): boolean {
  if (side === "left") return action.turn > 0;
  if (side === "right") return action.turn < 0;
  return action.thrust > 0 && action.turn === 0;
}

/**
 * Approach: of the consecutive tick pairs where food is in sight both times, how often the
 * nearest food got closer. Harder to game than orientation: turning on the spot never counts.
 */
export function approach(observations: readonly Observation[]): { pairs: number; closer: number; index: number | null } {
  const nearest = (o: Observation) => {
    let d = Number.POSITIVE_INFINITY;
    for (const r of o.rays) if (r.hit === "food" && r.distance < d) d = r.distance;
    return d;
  };
  let pairs = 0;
  let closer = 0;
  for (let t = 1; t < observations.length; t++) {
    const a = nearest(observations[t - 1]!);
    const b = nearest(observations[t]!);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    pairs++;
    if (b < a) closer++;
  }
  return { pairs, closer, index: pairs > 0 ? closer / pairs : null };
}

export interface Orientation { readonly seen: number; readonly toward: number; readonly index: number | null }

/** `observations[t]` is what the brain sensed at tick t; `actions[t]` what it did at tick t. */
export function orientation(observations: readonly Observation[], actions: readonly Action[], cfg: WorldConfig, lag = LAG): Orientation {
  let seen = 0;
  let toward = 0;
  for (let t = lag; t < actions.length; t++) {
    const side = foodSide(observations[t - lag]!, cfg);
    if (!side) continue;
    seen++;
    if (towardFood(side, actions[t]!)) toward++;
  }
  return { seen, toward, index: seen > 0 ? toward / seen : null };
}
