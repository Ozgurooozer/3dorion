// brain-lab/sensorimotor/encode.ts — senses → sensor-node inputs, like receptors:
// one node per (ray, kind), firing stronger the closer the thing is. No interpretation.
"use strict";

import type { BrainInputlari } from "../brain-ir/ir.ts";
import type { Observation, RayHit, WorldConfig } from "../world/index.ts";

// KNOWN SHORTCUT (Ozyn, 2026-09-23): rays report a labeled kind, so today the brain is TOLD
// what a threat is. Target: senses carry neutral features only (e.g. color), and "dangerous"
// is discovered by the brain from intero.injury — pain is innate, the meaning of a thing is not.
type SeenKind = Exclude<RayHit, "none">;
// A Record forces this list to stay complete: adding an EntityKind to the world
// fails typecheck here until the new kind gets its own receptors.
const KINDS: Record<SeenKind, true> = { wall: true, food: true, threat: true };
export const RAY_KINDS = Object.freeze(Object.keys(KINDS) as SeenKind[]);

export const BODY_SENSOR_IDS = Object.freeze(["touch.bump", "intero.hunger", "intero.injury"] as const);

export const rayNodeId = (ray: number, kind: SeenKind): string => `ray${ray}.${kind}`;

export function sensorNodeIds(cfg: WorldConfig): string[] {
  const ids: string[] = [];
  cfg.rayAngles.forEach((_, i) => { for (const k of RAY_KINDS) ids.push(rayNodeId(i, k)); });
  return [...ids, ...BODY_SENSOR_IDS];
}

export function encodeObservation(obs: Observation, cfg: WorldConfig): BrainInputlari {
  if (obs.rays.length !== cfg.rayAngles.length) {
    throw new RangeError(`observation has ${obs.rays.length} rays, config expects ${cfg.rayAngles.length}`);
  }
  const inputs: BrainInputlari = {};
  obs.rays.forEach((ray, i) => {
    const proximity = 1 - ray.distance / cfg.rayRange;
    for (const k of RAY_KINDS) inputs[rayNodeId(i, k)] = ray.hit === k ? proximity : 0;
  });
  inputs["touch.bump"] = obs.bump ? 1 : 0;
  // Drives, not raw levels: a full body is silent, a starving or hurt one shouts.
  inputs["intero.hunger"] = 1 - obs.energy;
  inputs["intero.injury"] = 1 - obs.health;
  return inputs;
}
