// brain-lab/world/entities.ts — things in the room besides walls, and where they may appear.
"use strict";

import type { WorldConfig } from "./config.ts";
import { dist, type Circle, type Vec } from "./geometry.ts";
import type { Rng } from "./rng.ts";
import type { EntityKind } from "./world.ts";

export interface Entity extends Circle { readonly id: string; readonly kind: EntityKind }

/** A circle to keep away from, with an extra gap on top of both radii. */
export interface Keepout { readonly circle: Circle; readonly gap: number }

const MAX_ATTEMPTS = 10_000;

/** Uniform position for a circle of radius r inside the walls and outside every keep-out zone. */
export function sampleFreePosition(rng: Rng, cfg: WorldConfig, r: number, keepouts: readonly Keepout[]): Vec {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const p = { x: rng.range(r, cfg.width - r), y: rng.range(r, cfg.height - r) };
    if (keepouts.every((k) => dist(p, k.circle) > k.circle.r + r + k.gap)) return p;
  }
  // A config that crowds the room must fail loudly, not hang.
  throw new Error(`no free position for r=${r} after ${MAX_ATTEMPTS} tries; room too crowded`);
}

export function foodKeepouts(cfg: WorldConfig, body: Vec, entities: readonly Entity[]): Keepout[] {
  return [
    { circle: { x: body.x, y: body.y, r: cfg.bodyRadius }, gap: cfg.foodClearance },
    ...entities.filter((e) => e.kind === "threat").map((t) => ({ circle: t, gap: 0 })),
  ];
}

/** Threats first (away from the body), then food (away from body and threats). */
export function spawnEntities(rng: Rng, cfg: WorldConfig, body: Vec): Entity[] {
  const out: Entity[] = [];
  const bodyZone = { circle: { x: body.x, y: body.y, r: cfg.bodyRadius }, gap: cfg.threatClearance };
  for (let i = 0; i < cfg.threatCount; i++) {
    const p = sampleFreePosition(rng, cfg, cfg.threatRadius, [bodyZone]);
    out.push({ id: `threat-${i}`, kind: "threat", ...p, r: cfg.threatRadius });
  }
  for (let i = 0; i < cfg.foodCount; i++) {
    const p = sampleFreePosition(rng, cfg, cfg.foodRadius, foodKeepouts(cfg, body, out));
    out.push({ id: `food-${i}`, kind: "food", ...p, r: cfg.foodRadius });
  }
  return out;
}
