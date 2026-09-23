// brain-lab/world/physics.ts — how a motor command moves the body, and what the walls do.
"use strict";

import type { WorldConfig } from "./config.ts";
import { wrapAngle, type Vec } from "./geometry.ts";
import type { Action } from "./world.ts";

export interface Body extends Vec { vx: number; vy: number; heading: number; energy: number; health: number }
export interface WallContact { readonly bump: boolean; readonly impactSpeed: number }

export function newBody(cfg: WorldConfig): Body {
  return { x: cfg.width / 2, y: cfg.height / 2, vx: 0, vy: 0, heading: 0, energy: 1, health: 1 };
}

/** Turn, accelerate along the heading, drag, cap speed, integrate, then resolve walls. Mutates b. */
export function moveBody(b: Body, a: Action, cfg: WorldConfig): WallContact {
  const dt = cfg.dt;
  b.heading = wrapAngle(b.heading + a.turn * cfg.maxTurnRate * dt);
  b.vx += Math.cos(b.heading) * a.thrust * cfg.maxAccel * dt;
  b.vy += Math.sin(b.heading) * a.thrust * cfg.maxAccel * dt;
  b.vx *= 1 - cfg.drag * dt;
  b.vy *= 1 - cfg.drag * dt;
  const speed = Math.hypot(b.vx, b.vy);
  if (speed > cfg.maxSpeed) { b.vx *= cfg.maxSpeed / speed; b.vy *= cfg.maxSpeed / speed; }
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // Walls: clamp position, drop the velocity component pointing into the wall.
  const r = cfg.bodyRadius;
  const maxX = cfg.width - r;
  const maxY = cfg.height - r;
  let impact = 0;
  if (b.x < r) { impact = Math.max(impact, -b.vx); b.x = r; b.vx = Math.max(0, b.vx); }
  if (b.x > maxX) { impact = Math.max(impact, b.vx); b.x = maxX; b.vx = Math.min(0, b.vx); }
  if (b.y < r) { impact = Math.max(impact, -b.vy); b.y = r; b.vy = Math.max(0, b.vy); }
  if (b.y > maxY) { impact = Math.max(impact, b.vy); b.y = maxY; b.vy = Math.min(0, b.vy); }
  return { bump: b.x === r || b.x === maxX || b.y === r || b.y === maxY, impactSpeed: impact };
}
