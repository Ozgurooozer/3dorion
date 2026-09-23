// brain-lab/world/world.ts — the contract between a world and whatever drives it.
// A brain (or a baseline policy, or a test) depends on this file only, never on Room,
// so a different world (more rooms, a 3D body later) can be swapped in behind it.
"use strict";

/** Kinds of things that can exist in a world besides walls. Add a kind here to extend the world. */
export type EntityKind = "food" | "threat";

/** Raw motor command, both in [-1, 1]. Never a behavior. */
export interface Action { readonly thrust: number; readonly turn: number }

export type RayHit = "none" | "wall" | EntityKind;
export interface Ray { readonly distance: number; readonly hit: RayHit }

/** Raw senses only: no position, no map, no interpretation. */
export interface Observation {
  readonly rays: readonly Ray[];
  readonly bump: boolean;
  readonly energy: number;
  readonly health: number;
  /** Proprioception: the body's own motion, each in [-1, 1]. */
  readonly motion: Motion;
}

/** forward: speed along the heading / maxSpeed (negative = backing up); turn: last turn command. */
export interface Motion { readonly forward: number; readonly turn: number }

export type DoneCause = "starved" | "killed";

export interface StepResult {
  readonly observation: Observation;
  readonly bump: boolean;
  readonly impactSpeed: number;
  readonly foodEaten: number;
  readonly damage: number;
  /** energyAfter = energyBefore - basal - motor + food, except when clamped at 0. */
  readonly energyLedger: { readonly basal: number; readonly motor: number; readonly food: number };
  readonly done: boolean;
  readonly doneCause: DoneCause | null;
}

export interface World {
  readonly done: boolean;
  observe(): Observation;
  step(action: Action): StepResult;
  /** Equal hashes = bit-identical worlds; the replay check. */
  hash(): string;
}
