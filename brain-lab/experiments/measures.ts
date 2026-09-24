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

export interface TurnToward { readonly turns: number; readonly toward: number; readonly index: number | null }

/**
 * Direction ("dönüş yönü"): of the ticks where food was seen to one SIDE `lag` ticks earlier and
 * the body turned, how often it turned toward that side. On fixed sequences a one-sided habit scores
 * 0.5 — but NOT in the closed loop (measured 2026-09-24: food-blind "forward + always left" 0.465,
 * "always right" 0.498, random 0.49–0.51), because turning moves food across the view. Prefer
 * `steering`, which is habit-free; this one is kept for comparison with earlier series.
 * `lag` is the actor's own sense→motor delay: LAG for the regional brain, 0 for a policy that
 * acts on the observation it is given.
 */
export function turnToward(observations: readonly Observation[], actions: readonly Action[], cfg: WorldConfig, lag = LAG): TurnToward {
  let turns = 0;
  let toward = 0;
  for (let t = lag; t < actions.length; t++) {
    const side = foodSide(observations[t - lag]!, cfg);
    const turn = actions[t]!.turn;
    if (side === null || side === "center" || turn === 0) continue;
    turns++;
    if ((side === "left") === (turn > 0)) toward++;
  }
  return { turns, toward, index: turns > 0 ? toward / turns : null };
}

/** Counts behind the steering index; kept so indices can be pooled over episodes. */
export interface Steering {
  /** Ticks with food seen on the left / right (lag ticks before the action). */
  readonly leftSeen: number;
  readonly rightSeen: number;
  /** Of those, ticks turning left / turning right. */
  readonly leftTurnWhenLeft: number;
  readonly rightTurnWhenLeft: number;
  readonly leftTurnWhenRight: number;
  readonly rightTurnWhenRight: number;
  readonly index: number | null;
}

/**
 * Steering index ("yönlendirme"), in [−1, 1]:
 *   ½·[(P(left | food left) − P(left | food right)) + (P(right | food right) − P(right | food left))]
 * Measured 2026-09-24 that turnToward is NOT habit-free in the closed loop: a food-blind "forward +
 * always left" body scores 0.465, because food on its turning side is brought to the centre fast
 * while food on the other side lingers at the side. This index compares each side's probabilities
 * separately, so a habit cancels out: always-left scores 0, random ~0, perfect steering 1, perfect
 * steering away −1.
 */
export function steering(observations: readonly Observation[], actions: readonly Action[], cfg: WorldConfig, lag = LAG): Steering {
  const c = { leftSeen: 0, rightSeen: 0, leftTurnWhenLeft: 0, rightTurnWhenLeft: 0, leftTurnWhenRight: 0, rightTurnWhenRight: 0 };
  for (let t = lag; t < actions.length; t++) {
    const side = foodSide(observations[t - lag]!, cfg);
    const turn = actions[t]!.turn;
    if (side === "left") { c.leftSeen++; if (turn > 0) c.leftTurnWhenLeft++; if (turn < 0) c.rightTurnWhenLeft++; }
    if (side === "right") { c.rightSeen++; if (turn > 0) c.leftTurnWhenRight++; if (turn < 0) c.rightTurnWhenRight++; }
  }
  return { ...c, index: steeringIndex(c) };
}

/** The index from (possibly pooled) counts; null unless food was seen on both sides. */
export function steeringIndex(c: Omit<Steering, "index">): number | null {
  if (c.leftSeen === 0 || c.rightSeen === 0) return null;
  const toLeft = c.leftTurnWhenLeft / c.leftSeen - c.leftTurnWhenRight / c.rightSeen;
  const toRight = c.rightTurnWhenRight / c.rightSeen - c.rightTurnWhenLeft / c.leftSeen;
  return (toLeft + toRight) / 2;
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
