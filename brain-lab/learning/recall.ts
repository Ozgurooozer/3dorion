// brain-lab/learning/recall.ts — the gate and the one-step recall (TASARIM-008 §6, §16; meeting
// 2026-09-26-a3-kural-dogumu K3, K4). Innate core: the rules never change in life. They read the senses, the pose and the
// memory neurons, and write the recalled senses — working memory, never on the ledger (K4 of 2026-09-26-buyuyen-hafiza).
//
//   gate open   hunger (1 − energy) ≥ H and no ray sees food; H 0.2, the regional brain's "fed" line
//   recalled    the live food memory with the largest strength × max(0, 1 − d / rayRange), d and bearing from the pose:
//               "the strongest and nearest" in one number; a memory beyond a ray's reach is not recalled (the full
//               scan, A5, looks for it)
//   senses      rec{i}.food of the ray angle nearest the bearing — beyond the outer rays, the outer ray of its side —
//               carries strength × proximity; every other rec node is 0, and all are 0 while the gate is closed
//
// Both the brain (agent.ts) and the A3 measurements (experiments/recall-a3.ts) recall through these functions, so what
// is measured is what the brain was given.
"use strict";

import type { MemoryRecord } from "../brain-ir/ir.ts";
import type { Pose } from "../memory/index.ts";
import { recId } from "../regions/index.ts";
import type { Observation, WorldConfig } from "../world/index.ts";
import type { LiveMemory } from "./growth.ts";

export interface RecallParams {
  /** The gate opens at this hunger (1 − energy) or more, while no ray sees food. */
  readonly hunger: number;
}

/** Meeting 2026-09-26-a3-kural-dogumu K3 (0.2: 38 votes, 0.25: 28, 0: 18). */
export const DEFAULT_RECALL: RecallParams = Object.freeze({ hunger: 0.2 });

/** The recalled-sense nodes, one per ray angle, in ray order. */
export function recallNodeIds(cfg: WorldConfig): string[] {
  return cfg.rayAngles.map((_, i) => recId(i));
}

/** K7a: open when the body is hungry and sees no food. */
export function gateOpen(obs: Observation, hunger: number): boolean {
  return 1 - obs.energy >= hunger && !obs.rays.some((r) => r.hit === "food");
}

export interface Recalled {
  /** The memory neuron recalled. */
  readonly id: string;
  /** strength × proximity, in (0, 1]. */
  readonly value: number;
  /** Radians in [−π, π) from the pose's heading, positive to the left. */
  readonly bearing: number;
  /** Metres from the pose. */
  readonly distance: number;
  /** The ray whose angle is nearest the bearing: the rec node the memory falls on. */
  readonly ray: number;
}

/** An angle in [−π, π). */
export function signedAngle(a: number): number {
  const t = 2 * Math.PI;
  return ((((a + Math.PI) % t) + t) % t) - Math.PI;
}

/** The index of the ray angle nearest `bearing` (the first one on a tie); past the outer rays, the outer ray of that side. */
export function nearestRay(bearing: number, cfg: WorldConfig): number {
  let best = 0;
  cfg.rayAngles.forEach((a, i) => { if (Math.abs(a - bearing) < Math.abs(cfg.rayAngles[best]! - bearing)) best = i; });
  return best;
}

/**
 * The one memory recalled: the largest strength × max(0, 1 − distance / rayRange), the first of equals in `live` order
 * (birth order); null when no memory is both alive and within a ray's reach. `strength` gives a memory's strength now
 * (with its time fading, FoodMemory.strengthAt).
 */
export function recallFood(live: readonly LiveMemory[], pose: Pose, strength: (m: MemoryRecord) => number, cfg: WorldConfig): Recalled | null {
  let best: Recalled | null = null;
  for (const m of live) {
    const dx = m.memory.x - pose.x;
    const dy = m.memory.y - pose.y;
    const distance = Math.hypot(dx, dy);
    const value = strength(m.memory) * Math.max(0, 1 - distance / cfg.rayRange);
    if (!(value > 0) || (best !== null && value <= best.value)) continue;
    const bearing = signedAngle(Math.atan2(dy, dx) - pose.heading);
    best = { id: m.id, value, bearing, distance, ray: nearestRay(bearing, cfg) };
  }
  return best;
}

/** The recalled senses: every rec node 0 except the one the recalled memory falls on. */
export function recalledSenses(r: Recalled | null, cfg: WorldConfig): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of recallNodeIds(cfg)) out[id] = 0;
  if (r) out[recId(r.ray)] = r.value;
  return out;
}
