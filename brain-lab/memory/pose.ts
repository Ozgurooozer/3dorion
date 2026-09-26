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
// speed, but not which wall it touched or at what angle, so a body sliding along a wall moves in a way this module
// cannot see. That is the one source of error left, and the only thing that lowers the pose's confidence.
//
// The constants used (tick length, top speed, turn rate, drag, push) are the body's own: innate knowledge, like
// knowing how strong one's own muscles are. No position of anything in the world is ever read.
"use strict";

import { wrapAngle, type Observation, type WorldConfig } from "../world/index.ts";
import type { MemoryModule, WorkingMemory } from "./core.ts";

export interface PoseParams {
  /** Model the sideways slide of a turning body (true), or integrate the forward speed only (false: TASARIM-007 as first written). */
  readonly sideslip: boolean;
  /** At a wall contact: keep the modelled sideways speed, or set it to 0. */
  readonly contact: "keep" | "zero";
  /**
   * How unsure a tick in wall contact makes the position: the standard deviation grows by `contactNoise` × the
   * distance the body was moving per tick before it (variances add). A body resting against a wall loses no
   * confidence; one that slides along it does.
   */
  readonly contactNoise: number;
}

/**
 * Measured in A1 (LAB-DEFTERI, 2026-09-26; experiments/pose-a1.ts), on the reference bodies, never on the K1n learners
 * that set the gate: zeroing the sideways speed at contact left less error than keeping it (mean end-of-life error
 * 1.18 m vs 1.75 m), and a contact noise of 2.76 makes σ match the error there (on K1n: error / σ = 0.73).
 */
export const DEFAULT_POSE: PoseParams = Object.freeze({ sideslip: true, contact: "zero", contactNoise: 2.76 });

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

export class PoseModule implements MemoryModule {
  readonly name = "pose";
  readonly params: PoseParams;
  private readonly cfg: WorldConfig;
  private readonly k: number;
  private current: Pose = START;
  private lastForward = 0;
  private variance = 0;

  constructor(cfg: WorldConfig, params: Partial<PoseParams> = {}) {
    const p = { ...DEFAULT_POSE, ...params };
    if (typeof p.sideslip !== "boolean") throw new RangeError(`bad pose params: sideslip must be true or false, got ${String(p.sideslip)}`);
    if (p.contact !== "keep" && p.contact !== "zero") throw new RangeError(`bad pose params: contact must be "keep" or "zero", got ${String(p.contact)}`);
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

  reset(): void {
    this.current = START;
    this.lastForward = 0;
    this.variance = 0;
  }

  observe(obs: Observation, tick: number, working: WorkingMemory): void {
    const { dt, maxSpeed, maxTurnRate } = this.cfg;
    const before = this.current;
    // The same arithmetic, in the same order, as world/physics.ts: the heading comes out bit for bit.
    const turn = obs.motion.turn * maxTurnRate * dt;
    const heading = wrapAngle(before.heading + turn);
    const forward = obs.motion.forward * maxSpeed;
    let side = this.params.sideslip ? this.k * (before.side * Math.cos(turn) - this.lastForward * Math.sin(turn)) : 0;
    if (obs.bump) {
      const speedBefore = Math.hypot(this.lastForward, before.side);
      this.variance += (this.params.contactNoise * speedBefore * dt) ** 2;
      if (this.params.contact === "zero") side = 0;
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
