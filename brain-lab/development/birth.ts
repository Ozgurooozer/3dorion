// brain-lab/development/birth.ts — what a newborn brain looks like before any experience.
//
// Every newborn has: all sensor and motor nodes, spontaneous generators wired to their
// motors (innate pattern generators), and weak random sensor→motor connections — too weak
// for any single sense to fire a motor alone, so there is no behavior yet, only material
// for learning to shape.
//
// The "reflexive" group (Ozyn, 2026-09-23: compare both groups) is also born with two innate
// reflexes built only on body senses, never on a labeled sight: bump → turn left (withdraw),
// injury → move forward (flee). Both are ordinary weights that learning may later erase.
"use strict";

import type { BrainBaglantisi, BrainGrafi } from "../brain-ir/ir.ts";
import { MOTOR_NODE_IDS, sensorNodeIds, sensorimotorScaffold } from "../sensorimotor/index.ts";
import { Rng, type WorldConfig } from "../world/index.ts";
import { SPONTANEOUS_IDS, spontaneousTarget } from "./spontaneous.ts";

export type InnateGroup = "reflexless" | "reflexive";

export interface BirthSpec {
  readonly seed: number;
  readonly group: InnateGroup;
  /** Chance that any given sensor→motor pair gets a connection at birth. */
  readonly density?: number;
  /** Random weights are uniform in [-maxWeight, maxWeight]; must stay below the motor threshold. */
  readonly maxWeight?: number;
}

export const DEFAULT_DENSITY = 0.15;
export const DEFAULT_MAX_WEIGHT = 0.3;
const MOTOR_THRESHOLD = 0.5; // ir.ts esik() default; sensors are in [0, 1]

/** Innate reflexes of the reflexive group; weights chosen so each fires on its own. */
export const INNATE_REFLEXES: readonly BrainBaglantisi[] = Object.freeze([
  { from: "touch.bump", to: "motor.left", weight: 0.8 },
  { from: "intero.injury", to: "motor.forward", weight: 5 }, // fires once injury ≥ 0.1
]);

export function bornGraph(cfg: WorldConfig, spec: BirthSpec): BrainGrafi {
  const density = spec.density ?? DEFAULT_DENSITY;
  const maxWeight = spec.maxWeight ?? DEFAULT_MAX_WEIGHT;
  if (!(density >= 0 && density <= 1)) throw new RangeError(`density must be in [0, 1], got ${density}`);
  if (!(maxWeight >= 0 && maxWeight < MOTOR_THRESHOLD)) {
    throw new RangeError(`maxWeight ${maxWeight} would let one sense fire a motor alone: that is behavior, not a newborn`);
  }
  const rng = new Rng(spec.seed);
  const scaffold = sensorimotorScaffold(cfg, `newborn-${spec.group}-${spec.seed}`);
  const edges = new Map<string, BrainBaglantisi>();
  for (const from of sensorNodeIds(cfg)) {
    for (const to of MOTOR_NODE_IDS) {
      if (rng.next() < density) edges.set(`${from}->${to}`, { from, to, weight: rng.range(-maxWeight, maxWeight) });
    }
  }
  if (spec.group === "reflexive") for (const r of INNATE_REFLEXES) edges.set(`${r.from}->${r.to}`, { ...r });
  for (const id of SPONTANEOUS_IDS) edges.set(`${id}->x`, { from: id, to: spontaneousTarget(id), weight: 1 });
  return {
    ...scaffold,
    nodes: [...scaffold.nodes, ...SPONTANEOUS_IDS.map((id) => ({ id, type: "sensor" as const }))],
    connections: [...edges.values()],
  };
}
