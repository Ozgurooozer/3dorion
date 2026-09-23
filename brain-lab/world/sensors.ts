// brain-lab/world/sensors.ts — what the body can perceive: rays that report distance and kind.
"use strict";

import type { WorldConfig } from "./config.ts";
import type { Entity } from "./entities.ts";
import { rayBoxInside, rayCircle, type Vec } from "./geometry.ts";
import type { Ray } from "./world.ts";

export function castRay(o: Vec, angle: number, entities: readonly Entity[], cfg: WorldConfig): Ray {
  const d = { x: Math.cos(angle), y: Math.sin(angle) };
  let best: Ray = { distance: cfg.rayRange, hit: "none" };
  const wall = rayBoxInside(o, d, cfg.width, cfg.height);
  if (wall < best.distance) best = { distance: wall, hit: "wall" };
  for (const e of entities) {
    const t = rayCircle(o, d, e);
    if (t >= 0 && t < best.distance) best = { distance: t, hit: e.kind };
  }
  return best;
}

export function senseRays(o: Vec, heading: number, entities: readonly Entity[], cfg: WorldConfig): Ray[] {
  return cfg.rayAngles.map((a) => castRay(o, heading + a, entities, cfg));
}
