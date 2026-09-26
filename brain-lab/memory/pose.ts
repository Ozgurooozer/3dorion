// brain-lab/memory/pose.ts — H1, "where am I?" (TASARIM-007 §5): path integration from the body's own motion
// senses. The pose is in the body's own frame: every room starts at (0, 0) facing 0, and the module never learns
// where the room, its walls or anything in it are. Content is state; nothing is learned or written to a ledger.
//
// The body feels its turn command (motion.turn) and its speed along its heading (motion.forward). TASARIM-007 as
// first written integrated only those two. But a turning body keeps part of its old velocity and slides sideways
// for a while (drag multiplies the velocity by k = 1 − drag·dt every tick), and the forward sense does not feel
// that. The sideways speed s follows from the physics alone (world/physics.ts moveBody: turn, push along the new
// heading, drag, move):
//     s ← k · (s·cos Δ − F·sin Δ)        F: last tick's forward speed, Δ: this tick's turn
// The push acts along the heading, so it never adds sideways speed. Away from walls this is exact.
//
// Walls: a wall removes the part of the velocity that points into it. The body feels the bump and its new forward
// speed, but the motion sense alone does not say which wall it touched or at what angle, so a body sliding along a
// wall moves in a way the motion sense cannot follow. That is the one source of error left, and the only thing that
// lowers the pose's confidence. The "wall" contact rule (A1b) closes most of it with sight: a touched wall is at
// exactly the body's radius, so two rays whose wall points lie on a line at that distance show the wall's direction
// (touchedWalls), and after the contact the velocity runs along that wall.
//
// The constants used (tick length, top speed, turn rate, drag, push, body radius, ray angles) are the body's own:
// innate knowledge, like knowing how strong one's own muscles are. No position of anything in the world is ever read.
"use strict";

import { wrapAngle, type Observation, type WorldConfig } from "../world/index.ts";
import type { MemoryModule, WorkingMemory } from "./core.ts";

export interface PoseParams {
  /** Model the sideways slide of a turning body (true), or integrate the forward speed only (false: TASARIM-007 as first written). */
  readonly sideslip: boolean;
  /**
   * At a wall contact: keep the modelled sideways speed, set it to 0, or ("wall", A1b) find the touched wall with the
   * rays and let the velocity run along it — falling back to 0 when the wall is not seen.
   */
  readonly contact: "keep" | "zero" | "wall";
  /**
   * How unsure a tick in wall contact makes the position: the standard deviation grows by `contactNoise` × the
   * distance the body was moving per tick before it (variances add). A body resting against a wall loses no
   * confidence; one that slides along it does.
   */
  readonly contactNoise: number;
}

/**
 * Measured in A1 and A1b (LAB-DEFTERI, 2026-09-26; experiments/pose-a1.ts), on the reference bodies, never on the K1n
 * learners that set the gate. The "wall" rule left the least error (mean end-of-life error 0.71 m; zero 1.18 m, keep
 * 1.75 m), and a contact noise of 1.52 makes σ match the error there (on K1n: error / σ = 0.60). A1 alone had chosen
 * "zero" with a noise of 2.76.
 */
export const DEFAULT_POSE: PoseParams = Object.freeze({ sideslip: true, contact: "wall", contactNoise: 1.52 });

export interface Pose {
  /** Metres from where the room started, along the heading the body had then. */
  readonly x: number;
  /** Metres from where the room started, to the left of that heading. */
  readonly y: number;
  /** Radians in [0, 2π); 0 is the heading at the start. */
  readonly heading: number;
  /** Modelled sideways speed, m/s, positive to the left. */
  readonly side: number;
  /** Standard deviation of the position, m. */
  readonly sigma: number;
}

/** Every room starts here: the body's own origin. */
const START: Pose = Object.freeze({ x: 0, y: 0, heading: 0, side: 0, sigma: 0 });

/** Where the pose lives in working memory. */
export const POSE_SLOT = "self.pose";

/** σ at which the pose's confidence is one half: the A1 gate, 0.5 m. */
export const POSE_SCALE = 0.5;

/** Confidence of a pose with standard deviation `sigma` metres: 1 when certain, ½ at POSE_SCALE. */
export const poseConfidence = (sigma: number): number => 1 / (1 + (sigma / POSE_SCALE) ** 2);

/**
 * The top speed of a body pushing at full thrust from rest: the fixed point of v ← (v + maxAccel·dt)·k. Speed can
 * never exceed it, turning or not, because |v + push| ≤ |v| + maxAccel·dt.
 */
export function terminalSpeed(cfg: WorldConfig): number {
  const k = 1 - cfg.drag * cfg.dt;
  return (cfg.maxAccel * cfg.dt * k) / (1 - k);
}

/**
 * How far from the touching distance (bodyRadius) a line through two wall points may lie and still be a touched
 * wall, and how far a ray may see past a wall and still agree with it (m). Wall points come from exact geometry, off
 * by rounding only (~1e-15 m); a chance line through points of two different walls lands this close almost never.
 */
const TOUCH_TOLERANCE = 1e-6;
/** Wall normals closer than this (rad) are the same wall. */
const SAME_WALL = 1e-6;
const wrapPi = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * The walls the body touches, as seen by its rays: each as the direction of its normal (from the body to the wall),
 * relative to the heading, in (−π, π]. A touched wall is at exactly bodyRadius, so any two rays whose wall points lie
 * on a line at that distance from the body's centre see it; one ray alone is not enough (its wall point fits two
 * mirror-image walls, and a far wall seen at a slant can fake one behind the body). A found wall must also agree
 * with every ray: none may see past it. Two walls = a corner. Empty when no touched wall is seen by two rays.
 */
export function touchedWalls(obs: Observation, cfg: WorldConfig): number[] {
  const r = cfg.bodyRadius;
  const points: { x: number; y: number }[] = [];
  obs.rays.forEach((ray, i) => {
    if (ray.hit === "wall") points.push({ x: ray.distance * Math.cos(cfg.rayAngles[i]!), y: ray.distance * Math.sin(cfg.rayAngles[i]!) });
  });
  const agrees = (phi: number): boolean =>
    obs.rays.every((ray, j) => {
      const c = Math.cos(cfg.rayAngles[j]! - phi);
      if (c <= 1e-12) return true; // this ray points away from the wall or along it
      // Where this ray would meet the wall; a ray never reports more than its range, so a wall beyond reach agrees.
      return ray.distance <= r / c + TOUCH_TOLERANCE;
    });
  const walls: number[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i]!;
      const b = points[j]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 1e-9) continue;
      // The line through a and b: its unit normal, turned to point from the body to the line, and its distance.
      let nx = -(b.y - a.y) / len;
      let ny = (b.x - a.x) / len;
      let h = nx * a.x + ny * a.y;
      if (h < 0) { nx = -nx; ny = -ny; h = -h; }
      if (Math.abs(h - r) > TOUCH_TOLERANCE) continue;
      const phi = Math.atan2(ny, nx);
      if (walls.some((w) => Math.abs(wrapPi(w - phi)) < SAME_WALL) || !agrees(phi)) continue;
      walls.push(phi);
    }
  }
  return walls;
}

/**
 * The sideways speed right after a wall contact, given the touched walls (normals relative to the heading), the
 * sensed forward speed and the modelled sideways speed. After the contact the velocity has no part into the wall:
 * v · n = 0, so F·cos φ + s·sin φ = 0. A wall straight ahead (sin φ = 0) takes only the forward speed and leaves the
 * sideways speed as modelled. A corner stops the body; an unseen wall falls back to the "zero" rule.
 */
export function slideAlong(walls: readonly number[], forward: number, modelled: number): number {
  if (walls.length !== 1) return 0;
  const phi = walls[0]!;
  const s = Math.sin(phi);
  return Math.abs(s) < 1e-9 ? modelled : (-forward * Math.cos(phi)) / s;
}

export class PoseModule implements MemoryModule {
  readonly name = "pose";
  readonly params: PoseParams;
  private readonly cfg: WorldConfig;
  private readonly k: number;
  private current: Pose = START;
  private lastForward = 0;
  private variance = 0;
  private wallsNow: readonly number[] | null = null;

  constructor(cfg: WorldConfig, params: Partial<PoseParams> = {}) {
    const p = { ...DEFAULT_POSE, ...params };
    if (typeof p.sideslip !== "boolean") throw new RangeError(`bad pose params: sideslip must be true or false, got ${String(p.sideslip)}`);
    if (p.contact !== "keep" && p.contact !== "zero" && p.contact !== "wall") throw new RangeError(`bad pose params: contact must be "keep", "zero" or "wall", got ${String(p.contact)}`);
    if (!(Number.isFinite(p.contactNoise) && p.contactNoise >= 0)) throw new RangeError(`bad pose params: contactNoise must be a finite number >= 0, got ${p.contactNoise}`);
    // The sideways model has no speed cap in it; the world caps speed at maxSpeed. Refuse a world where that cap can bite.
    if (p.sideslip && !(terminalSpeed(cfg) < cfg.maxSpeed)) {
      throw new RangeError(`the sideslip model assumes the speed cap is never reached, but this body reaches ${terminalSpeed(cfg)} m/s >= maxSpeed ${cfg.maxSpeed}`);
    }
    this.params = Object.freeze(p);
    this.cfg = cfg;
    this.k = 1 - cfg.drag * cfg.dt;
  }

  /** The latest pose. */
  get pose(): Pose {
    return this.current;
  }

  /** With the "wall" contact rule: the touched walls found on the last tick (normals relative to the heading); null when not in contact or another rule. */
  get walls(): readonly number[] | null {
    return this.wallsNow;
  }

  reset(): void {
    this.current = START;
    this.lastForward = 0;
    this.variance = 0;
    this.wallsNow = null;
  }

  observe(obs: Observation, tick: number, working: WorkingMemory): void {
    const { dt, maxSpeed, maxTurnRate } = this.cfg;
    const before = this.current;
    // The same arithmetic, in the same order, as world/physics.ts: the heading comes out bit for bit.
    const turn = obs.motion.turn * maxTurnRate * dt;
    const heading = wrapAngle(before.heading + turn);
    const forward = obs.motion.forward * maxSpeed;
    let side = this.params.sideslip ? this.k * (before.side * Math.cos(turn) - this.lastForward * Math.sin(turn)) : 0;
    this.wallsNow = null;
    if (obs.bump) {
      const speedBefore = Math.hypot(this.lastForward, before.side);
      this.variance += (this.params.contactNoise * speedBefore * dt) ** 2;
      if (this.params.contact === "zero") side = 0;
      else if (this.params.contact === "wall") {
        this.wallsNow = Object.freeze(touchedWalls(obs, this.cfg));
        side = slideAlong(this.wallsNow, forward, side);
      }
    }
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    this.current = Object.freeze({
      x: before.x + (forward * c - side * s) * dt,
      y: before.y + (forward * s + side * c) * dt,
      heading,
      side,
      sigma: Math.sqrt(this.variance),
    });
    this.lastForward = forward;
    working.write(POSE_SLOT, this.current, { tick, source: "inferred", confidence: poseConfidence(this.current.sigma) });
  }
}

/**
 * A pose in the room's frame, given where the room started the body. For grading and drawing only: the brain
 * never has `start`.
 */
export function inRoom(p: Pose, start: { readonly x: number; readonly y: number; readonly heading: number }): { x: number; y: number; heading: number } {
  const c = Math.cos(start.heading);
  const s = Math.sin(start.heading);
  return { x: start.x + c * p.x - s * p.y, y: start.y + s * p.x + c * p.y, heading: wrapAngle(start.heading + p.heading) };
}
