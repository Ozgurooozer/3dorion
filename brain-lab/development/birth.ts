// brain-lab/development/birth.ts — the newborn regional brain (TASARIM-BOLGELI-BEYIN.md §4–§7).
//
// Nature gives the structure: every region and every innate pathway, with fixed weights.
// Experience gives the weights of the learning pathways (senses → Go/NoGo), which start
// weak and random. The "reflexive" group is also born with two body-only reflexes placed on
// the learning pathway, so learning can erase them.
"use strict";

import type { BrainBaglantisi, BrainDugumu, BrainGrafi } from "../brain-ir/ir.ts";
import { ACTIONS, HYP_NODES, OPPOSITE, REGION_TYPE, checkPathways, nodeId } from "../regions/index.ts";
import { MOTOR_NODE_IDS, sensorNodeIds } from "../sensorimotor/index.ts";
import { Rng, type WorldConfig } from "../world/index.ts";

export type InnateGroup = "reflexless" | "reflexive";

/** Innate weights. Each value is a choice of the lab; its reason is next to it. */
export const INNATE = Object.freeze({
  /** P3: the energy deficit is felt one-to-one as hunger. */
  hungerFromDeficit: 1,
  /** P3: damage is felt one-to-one as pain. */
  painFromInjury: 1,
  /** P6: noise alone stays below the generator threshold (0.4 < 0.5) — a sated body rests. */
  noiseToGenerator: 0.4,
  /** P4: hunger lifts the generators; firing starts once hunger > ~0.25 and rises with it. */
  hungerToGenerator: 0.4,
  /** P7: a firing generator proposes its action strongly enough to pass selection on its own. */
  generatorToGo: 0.6,
  /** P5: tonic facilitation — hunger makes every action a little easier to pass. */
  hungerToGo: 0.1,
  /** P8 / P9: Go releases, NoGo holds back, with equal strength. */
  goToOut: 1,
  nogoToOut: -1,
  /**
   * P10: antagonist actions suppress each other. Measured 2026-09-24 (10 seeds, hunger 0.6):
   * −0.5 without persistence let both antagonists reach the motors on 2.7% of ticks; −1 with
   * Go persistence 0.5 brought it to 0.5% and halved motor-pattern flicker (58% → 29%/tick).
   */
  lateral: -1,
  /** Go neurons keep half of their previous state (striatal cells integrate their input). */
  goPersistence: 0.5,
  /** P11: the selected action reaches its muscle. */
  outToMotor: 1,
});

/** Learning pathways (P1, P2) start in [0, maxInitial]: too weak to select anything alone. */
export const DEFAULT_MAX_INITIAL = 0.05;

/**
 * Reflexive group only, on the learning pathway (P1) so they can be unlearned.
 * bump → left: withdraw from what was hit. injury → forward: get away from what hurts.
 * The pain signal (1 − health) grows 0.01 per damaged tick, so its weight is large: the
 * reflex fires once injury reaches ~0.1.
 */
export const INNATE_REFLEXES: readonly BrainBaglantisi[] = Object.freeze([
  { from: "touch.bump", to: "bg.go.left", weight: 0.6 },
  { from: "intero.injury", to: "bg.go.forward", weight: 5 },
]);

export interface BirthSpec {
  readonly seed: number;
  readonly group: InnateGroup;
  readonly maxInitial?: number;
}

export function bornGraph(cfg: WorldConfig, spec: BirthSpec): BrainGrafi {
  const maxInitial = spec.maxInitial ?? DEFAULT_MAX_INITIAL;
  if (!(maxInitial >= 0 && maxInitial < INNATE.generatorToGo)) {
    throw new RangeError(`maxInitial ${maxInitial} would let senses outweigh the generators at birth: that is behavior, not a newborn`);
  }
  const rng = new Rng(spec.seed);
  const node = (id: string, region: keyof typeof REGION_TYPE): BrainDugumu =>
    region === "bg.go" ? { id, type: REGION_TYPE[region], decay: INNATE.goPersistence } : { id, type: REGION_TYPE[region] };

  const senses = sensorNodeIds(cfg);
  const nodes: BrainDugumu[] = [
    ...senses.map((id) => node(id, "sense")),
    ...HYP_NODES.map((id) => node(id, "hyp")),
    ...ACTIONS.flatMap((a) => [
      node(nodeId("noise", a), "noise"),
      node(nodeId("cpg", a), "cpg"),
      node(nodeId("bg.go", a), "bg.go"),
      node(nodeId("bg.nogo", a), "bg.nogo"),
      node(nodeId("bg.out", a), "bg.out"),
    ]),
    ...MOTOR_NODE_IDS.map((id) => node(id, "motor")),
  ];

  const edges = new Map<string, BrainBaglantisi>();
  const add = (from: string, to: string, weight: number) => edges.set(`${from}->${to}`, { from, to, weight });

  add("intero.hunger", "hyp.hunger", INNATE.hungerFromDeficit);
  add("intero.injury", "hyp.pain", INNATE.painFromInjury);
  for (const a of ACTIONS) {
    add(nodeId("noise", a), nodeId("cpg", a), INNATE.noiseToGenerator);
    add("hyp.hunger", nodeId("cpg", a), INNATE.hungerToGenerator);
    add(nodeId("cpg", a), nodeId("bg.go", a), INNATE.generatorToGo);
    add("hyp.hunger", nodeId("bg.go", a), INNATE.hungerToGo);
    add(nodeId("bg.go", a), nodeId("bg.out", a), INNATE.goToOut);
    add(nodeId("bg.nogo", a), nodeId("bg.out", a), INNATE.nogoToOut);
    add(nodeId("bg.go", a), nodeId("bg.go", OPPOSITE[a]), INNATE.lateral);
    add(nodeId("bg.out", a), nodeId("motor", a), INNATE.outToMotor);
  }
  // Learning pathways: every sense to every action's Go and NoGo, weak and random.
  for (const s of senses) {
    for (const a of ACTIONS) {
      add(s, nodeId("bg.go", a), rng.range(0, maxInitial));
      add(s, nodeId("bg.nogo", a), rng.range(0, maxInitial));
    }
  }
  if (spec.group === "reflexive") for (const r of INNATE_REFLEXES) add(r.from, r.to, r.weight);

  const graph: BrainGrafi = { name: `newborn-${spec.group}`, version: "2", nodes, connections: [...edges.values()] };
  checkPathways(graph); // a birth that breaks its own regions is a bug, not a variation
  return graph;
}
