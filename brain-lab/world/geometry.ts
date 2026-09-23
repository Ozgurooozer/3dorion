// brain-lab/world/geometry.ts — plain 2D math, no world knowledge.
"use strict";

export interface Vec { x: number; y: number }
export interface Circle extends Vec { r: number }

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function wrapAngle(a: number): number {
  const t = 2 * Math.PI;
  return ((a % t) + t) % t;
}

/** Distance along unit ray d from o to circle c; 0 if o is inside; -1 if it misses. */
export function rayCircle(o: Vec, d: Vec, c: Circle): number {
  const ox = o.x - c.x;
  const oy = o.y - c.y;
  const cc = ox * ox + oy * oy - c.r * c.r;
  if (cc <= 0) return 0;
  const bb = ox * d.x + oy * d.y;
  const disc = bb * bb - cc;
  if (disc < 0) return -1;
  return -bb - Math.sqrt(disc);
}

/** Distance along unit ray d from a point o inside the box [0,w]×[0,h] to its boundary. */
export function rayBoxInside(o: Vec, d: Vec, w: number, h: number): number {
  let t = Number.POSITIVE_INFINITY;
  if (d.x > 0) t = Math.min(t, (w - o.x) / d.x);
  if (d.x < 0) t = Math.min(t, -o.x / d.x);
  if (d.y > 0) t = Math.min(t, (h - o.y) / d.y);
  if (d.y < 0) t = Math.min(t, -o.y / d.y);
  return t;
}
