// brain-lab/experiments/conditions.ts — the one catalogue of experimental conditions.
//
// Every condition is data: a code, what it changes, the agent spec, how the subjects are born, and the
// room. Scripts, the parallel runner and the `lab` command all build conditions from here by code, so a
// condition is defined once and a worker thread can rebuild it from its name (functions, like a
// teacher's policy, are built inside `spec(world)`). Older series scripts keep their own definitions
// as the historical record.
"use strict";

import { oraclePolicy } from "../baselines/index.ts";
import type { AgentSpec } from "../learning/index.ts";
import { makeConfig, type WorldConfig } from "../world/index.ts";
import type { BirthOptions } from "./harness.ts";

export type Spec = Omit<AgentSpec, "cfg" | "ledger" | "noiseSeed">;

export interface ConditionDef {
  readonly what: string;
  /** The agent spec for a room (a room is needed for condition-specific policies like the oracle teacher). */
  readonly spec: (world: WorldConfig) => Spec;
  readonly born?: BirthOptions;
  /** The room; default ROOM1. */
  readonly world?: WorldConfig;
}

/** Room 1: 10 food, no threats, born hungry. */
export const ROOM1 = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
/** Room 2 (Ozyn, 2026-09-25): the threat zones switched on — approach food, keep out of what hurts. */
export const ROOM2 = makeConfig({ initialEnergy: 0.4, threatCount: 2, foodCount: 10 });
export const room = (food: number, threats = 0) => makeConfig({ initialEnergy: 0.4, threatCount: threats, foodCount: food });

/**
 * E7 with λ 0.9 (series 002b), written out instead of read from the git-ignored data folder; a test
 * checks it against the recorded spec when that record exists.
 */
export const E7: Spec = Object.freeze({
  learning: { eta: 0.05, lambda: 0.9, quantum: 0.005, gate: "selected" as const, dipFloor: 0.05 },
  teachAtDeath: false,
  critic: {},
});
const learn = (patch: object): Spec["learning"] => ({ ...E7.learning, ...patch });
const NORM = { alpha: 0.03, normalize: true };
const S1N: Spec = { ...E7, selection: {}, learning: learn({ dipFloor: null }) };

export const CONDITIONS: Readonly<Record<string, ConditionDef>> = Object.freeze({
  A0: { what: "E7 λ0.9 (reference)", spec: () => E7 },
  A1: { what: "E7 + normalised critic (α 0.03/‖x‖²)", spec: () => ({ ...E7, critic: NORM }) },
  A2: { what: "E7 without dip floor", spec: () => ({ ...E7, learning: learn({ dipFloor: null }) }) },
  A3: { what: "E7 with λ 0.97", spec: () => ({ ...E7, learning: learn({ lambda: 0.97 }) }) },
  A4: { what: "E7 + all three (A1+A2+A3)", spec: () => ({ ...E7, critic: NORM, learning: learn({ dipFloor: null, lambda: 0.97 }) }) },
  A5: { what: "A4 + generators → Go 0.3", spec: () => ({ ...E7, critic: NORM, learning: learn({ dipFloor: null, lambda: 0.97 }) }), born: { generatorToGo: 0.3 } },
  G3: { what: "E7 + generators → Go 0.3", spec: () => E7, born: { generatorToGo: 0.3 } },
  S1: { what: "E7 learning + competitive selection", spec: () => ({ ...E7, selection: {} }) },
  S1n: { what: "S1 without dip floor", spec: () => S1N },
  S1a: { what: "S1 + action compartments", spec: () => ({ ...E7, selection: {}, compartments: { mode: "action" as const } }) },
  S1c: { what: "S1 + normalised critic", spec: () => ({ ...E7, selection: {}, critic: NORM }) },
  R0: { what: "room 2 (2 threats): E7", spec: () => E7, world: ROOM2 },
  R1: { what: "room 2 (2 threats): S1", spec: () => ({ ...E7, selection: {} }), world: ROOM2 },
  R1n: { what: "room 2 (2 threats): S1n", spec: () => S1N, world: ROOM2 },
  // Diagnosis of direction (next step, 2026-09-25): S1n taught by the hand-coded oracle — can the
  // selector-driven brain learn "which way" at all when told?
  T1only: { what: "S1n, oracle teacher only (gain 0.3)", spec: (w) => ({ ...S1N, teacher: { policy: oraclePolicy(w), gain: 0.3, mix: "only" as const } }) },
  T1add: { what: "S1n + oracle teacher added to reward (gain 0.3)", spec: (w) => ({ ...S1N, teacher: { policy: oraclePolicy(w), gain: 0.3, mix: "add" as const } }) },
});

export function condition(code: string): ConditionDef {
  const c = CONDITIONS[code];
  if (!c) throw new Error(`unknown condition ${code}; known: ${Object.keys(CONDITIONS).join(", ")}`);
  return c;
}
