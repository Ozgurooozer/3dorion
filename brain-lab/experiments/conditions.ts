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
/**
 * Room 3, the scarce room (series 005b, 2026-09-25): 5 food, born at energy 0.8, no threats. Chosen by
 * calibration so blind movement cannot win (random bursts survive 1% of rooms) while using sight does
 * (the seeker survives 92%): in room 1 blind wandering plus "food ahead → forward" came near the ceiling.
 */
export const ROOM3 = makeConfig({ initialEnergy: 0.8, threatCount: 0, foodCount: 5 });
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
  K1n: { what: "room 3 (scarce: 5 food, energy 0.8): S1n", spec: () => S1N, world: ROOM3 },
  // Series 006 (TASARIM-006): S1n + the cue memory ("yemek hafızası") in the scarce room.
  // K2/K2x used the accumulating trace (failed: values churned); written out so the record stays reproducible.
  K2: { what: "room 3 (scarce): S1n + cue memory (κ 1, accumulating trace)", spec: () => ({ ...S1N, cue: { trace: "accumulating" as const, outcome: "signed" as const } }), world: ROOM3 },
  K2x: { what: "room 3 (scarce): S1n + cue memory (κ 3, accumulating trace)", spec: () => ({ ...S1N, cue: { weight: 3, trace: "accumulating" as const, outcome: "signed" as const } }), world: ROOM3 },
  // K3/K3x learned from the signed outcome (failed: food values negative); written out to stay reproducible.
  K3: { what: "room 3 (scarce): S1n + cue memory (κ 1, replacing trace, signed outcome)", spec: () => ({ ...S1N, cue: { outcome: "signed" as const } }), world: ROOM3 },
  K3x: { what: "room 3 (scarce): S1n + cue memory (κ 3, replacing trace, signed outcome)", spec: () => ({ ...S1N, cue: { weight: 3, outcome: "signed" as const } }), world: ROOM3 },
  K4: { what: "room 3 (scarce): S1n + cue memory (κ 1, learns from meals only)", spec: () => ({ ...S1N, cue: {} }), world: ROOM3 },
  K4x: { what: "room 3 (scarce): S1n + cue memory (κ 3, learns from meals only)", spec: () => ({ ...S1N, cue: { weight: 3 } }), world: ROOM3 },
  KT1: { what: "room 3 (scarce): S1n, oracle teacher only (gain 0.3)", spec: (w) => ({ ...S1N, teacher: { policy: oraclePolicy(w), gain: 0.3, mix: "only" as const } }), world: ROOM3 },
  T1only: { what: "S1n, oracle teacher only (gain 0.3)", spec: (w) => ({ ...S1N, teacher: { policy: oraclePolicy(w), gain: 0.3, mix: "only" as const } }) },
  T1add: { what: "S1n + oracle teacher added to reward (gain 0.3)", spec: (w) => ({ ...S1N, teacher: { policy: oraclePolicy(w), gain: 0.3, mix: "add" as const } }) },
  // A3 (TASARIM-008 §16; meeting 2026-09-26-a3-kural-dogumu K1, K2): K1n with the growing memory, the gate and the recalled
  // senses. H3B: the rule synapses rec → Go grow in life (born at their first earned quantum, pruned at 0). H3D, the
  // control: the same synapses innate, weak and random. B equals D born at weight 0 (guard test), so B vs D asks what
  // sparse growth from nothing does against a dense random start.
  H3B: { what: "room 3 (scarce): S1n + memory recall, rule synapses grown (B)", spec: () => ({ ...S1N, memory: { recall: {} } }), born: { recall: { rules: "grown" as const } }, world: ROOM3 },
  H3D: { what: "room 3 (scarce): S1n + memory recall, rule synapses innate (D)", spec: () => ({ ...S1N, memory: { recall: {} } }), born: { recall: { rules: "innate" as const } }, world: ROOM3 },
});

export function condition(code: string): ConditionDef {
  const c = CONDITIONS[code];
  if (!c) throw new Error(`unknown condition ${code}; known: ${Object.keys(CONDITIONS).join(", ")}`);
  return c;
}
