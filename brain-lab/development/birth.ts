// brain-lab/development/birth.ts — the newborn regional brain (TASARIM-BOLGELI-BEYIN.md §4–§7).
//
// Nature gives the structure: every region and every innate pathway, with fixed weights.
// Experience gives the weights of the learning pathways (senses → Go/NoGo), which start
// weak and random. The "reflexive" group is also born with two body-only reflexes placed on
// the learning pathway, so learning can erase them.
"use strict";

import type { BrainBaglantisi, BrainDugumu, BrainGrafi } from "../brain-ir/ir.ts";
import { ACTIONS, HYP_NODES, OPPOSITE, REGION_TYPE, checkPathways, kcId, latId, nodeId, recId } from "../regions/index.ts";
import { MOTOR_NODE_IDS, RAY_KINDS, rayNodeId, sensorNodeIds } from "../sensorimotor/index.ts";
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

/**
 * Innate orienting (series 003b, exploratory): each ray is born slightly more strongly wired to
 * the Go of the action that points where the ray looks — left rays → turn left, the centre ray →
 * forward, right rays → turn right. The newborn analogue is the rooting reflex (touch a cheek,
 * the head turns to that side). It is STRUCTURE, not a goal: it is the same for walls, food and
 * threats, it is too weak to select an action alone, and it sits on the learning pathway, so
 * experience decides what to approach and what to avoid. "away" mirrors it (the control).
 */
export interface Orienting {
  readonly strength: number;
  readonly direction: "toward" | "away";
}

/**
 * Expansion layer (TASARIM-004 M2), after the fly's Kenyon cells: `cells` binary units, each
 * wired (weight 1, innate) to `inputs` senses drawn at random, firing when the sum reaches
 * `threshold`. The learning pathways then start from these cells instead of the raw senses —
 * any conjunction the cells happen to encode ("food on the left AND hungry") can be learned.
 * Reflexes of the reflexive group stay on the direct sense pathway.
 */
export interface Expansion {
  readonly cells: number;
  readonly inputs: number;
  readonly threshold: number;
}

export interface BirthSpec {
  readonly seed: number;
  readonly group: InnateGroup;
  readonly maxInitial?: number;
  readonly orienting?: Orienting | null;
  readonly expansion?: Expansion | null;
  /**
   * Bilateral comparison (TASARIM-004 M3): per kind of thing seen, a left and a right cell; each
   * side's rays excite their own side's cell and inhibit the other's (the centre ray neither), so a
   * cell fires by how much more its side sees. Which difference drives which action is learned:
   * the cells join the learning sources, weak and random like the rest. Same for every kind.
   */
  readonly bilateral?: boolean;
  /**
   * Strength of generator → Go (default INNATE.generatorToGo, 0.6: a generator alone passes
   * selection). Weaker generators leave room for learned inputs to decide (series 004, G): the
   * newborn still moves (Go keeps half its state, so 0.3 settles at 0.6), but a burst of noise no
   * longer overrides what has been learned. Must stay above 0 and at most the default.
   */
  readonly generatorToGo?: number;
  /** Recalled senses (TASARIM-008 §16, A3): their nodes and, for the innate control, their rule synapses. */
  readonly recall?: RecallBirth | null;
}

/**
 * The recalled-sense nodes (region rec, one per ray angle) and how their rule synapses (P18: rec → Go) come to be
 * (meeting 2026-09-26-a3-kural-dogumu K1, K2):
 *   "grown"  (B): none at birth; each is born in life when it first earns a quantum (learner.ts)
 *   "innate" (D): every rec → Go synapse from birth, weak and random in [0, maxInitial] like every learning pathway,
 *            drawn from its own random stream, so the rest of the newborn is the same brain as B's
 */
export interface RecallBirth {
  readonly rules: "grown" | "innate";
  /** D's rule synapses start in [0, maxInitial] (default DEFAULT_MAX_INITIAL); 0 makes D the same brain as B. */
  readonly maxInitial?: number;
}

/**
 * Strongest orienting allowed: sight alone must never select an action. Measured 2026-09-24
 * (200 seeds, generators silent, starving body, a wall or food filling both left rays, 60 ticks):
 * 0.02 → no seed selects (the plain newborn: none either); 0.03 → 4/200; 0.05 → 62–71/200.
 * An analytic worst case (all random weights at their maximum, NoGo ignored) is not usable:
 * it forbids even the plain newborn, because in practice NoGo holds the Go cells back.
 */
export const MAX_ORIENTING = 0.02;

/** The action a ray at `angle` points to (positive angle = left). */
export function actionOfAngle(angle: number): "forward" | "left" | "right" {
  return Math.abs(angle) < 1e-9 ? "forward" : angle > 0 ? "left" : "right";
}

export function bornGraph(cfg: WorldConfig, spec: BirthSpec): BrainGrafi {
  const maxInitial = spec.maxInitial ?? DEFAULT_MAX_INITIAL;
  if (!(maxInitial >= 0 && maxInitial < INNATE.generatorToGo)) {
    throw new RangeError(`maxInitial ${maxInitial} would let senses outweigh the generators at birth: that is behavior, not a newborn`);
  }
  const orienting = spec.orienting ?? null;
  if (orienting && spec.expansion) throw new Error("orienting biases the direct sense pathway, which an expansion layer replaces");
  if (orienting && !(orienting.strength > 0 && orienting.strength <= MAX_ORIENTING)) {
    throw new RangeError(`orienting strength ${orienting.strength} would select an action on sight alone: that is behavior, not a newborn`);
  }
  const generatorToGo = spec.generatorToGo ?? INNATE.generatorToGo;
  if (!(generatorToGo > 0 && generatorToGo <= INNATE.generatorToGo)) throw new RangeError(`generatorToGo ${generatorToGo} outside (0, ${INNATE.generatorToGo}]`);
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
    add(nodeId("cpg", a), nodeId("bg.go", a), generatorToGo);
    add("hyp.hunger", nodeId("bg.go", a), INNATE.hungerToGo);
    add(nodeId("bg.go", a), nodeId("bg.out", a), INNATE.goToOut);
    add(nodeId("bg.nogo", a), nodeId("bg.out", a), INNATE.nogoToOut);
    add(nodeId("bg.go", a), nodeId("bg.go", OPPOSITE[a]), INNATE.lateral);
    add(nodeId("bg.out", a), nodeId("motor", a), INNATE.outToMotor);
  }
  // Learning pathways: every sense (or, with an expansion layer, every expansion cell) to every
  // action's Go and NoGo, weak and random.
  const expansion = spec.expansion ?? null;
  const learningSources = expansion ? wireExpansion(expansion, senses, spec.seed, nodes, add) : [...senses];
  if (spec.bilateral) learningSources.push(...wireBilateral(cfg, nodes, add));
  for (const s of learningSources) {
    for (const a of ACTIONS) {
      add(s, nodeId("bg.go", a), rng.range(0, maxInitial));
      add(s, nodeId("bg.nogo", a), rng.range(0, maxInitial));
    }
  }
  if (orienting) {
    const mirror = { forward: "forward", left: "right", right: "left" } as const;
    cfg.rayAngles.forEach((angle, i) => {
      const toward = actionOfAngle(angle);
      const a = orienting.direction === "toward" ? toward : mirror[toward];
      for (const kind of RAY_KINDS) {
        const e = edges.get(`${rayNodeId(i, kind)}->${nodeId("bg.go", a)}`)!;
        add(e.from, e.to, e.weight + orienting.strength);
      }
    });
  }
  if (spec.group === "reflexive") for (const r of INNATE_REFLEXES) add(r.from, r.to, r.weight);
  const recall = spec.recall ?? null;
  if (recall) wireRecall(recall, cfg, spec.seed, nodes, add);

  const tag = (orienting ? `-orient-${orienting.direction}-${orienting.strength}` : "")
    + (expansion ? `-kc${expansion.cells}x${expansion.inputs}t${expansion.threshold}` : "")
    + (spec.bilateral ? "-bilateral" : "")
    + (generatorToGo !== INNATE.generatorToGo ? `-gen${generatorToGo}` : "")
    + (recall ? `-recall-${recall.rules}${recall.rules === "innate" && (recall.maxInitial ?? DEFAULT_MAX_INITIAL) !== DEFAULT_MAX_INITIAL ? `${recall.maxInitial}` : ""}` : "");
  const graph: BrainGrafi = { name: `newborn-${spec.group}${tag}`, version: "2", nodes, connections: [...edges.values()] };
  checkPathways(graph); // a birth that breaks its own regions is a bug, not a variation
  return graph;
}

/**
 * Adds the expansion cells and their innate input wiring; returns the cells (the new learning
 * sources). Drawn from its own random stream, so the rest of the newborn does not depend on it.
 */
function wireExpansion(e: Expansion, senses: readonly string[], seed: number, nodes: BrainDugumu[], add: (from: string, to: string, w: number) => void): string[] {
  if (!(Number.isInteger(e.cells) && e.cells > 0) || !(Number.isInteger(e.inputs) && e.inputs > 0 && e.inputs <= senses.length) || !(e.threshold > 0)) {
    throw new RangeError(`bad expansion ${JSON.stringify(e)}`);
  }
  const rng = new Rng(seed * 7919 + 13);
  const cells: string[] = [];
  for (let i = 0; i < e.cells; i++) {
    const id = kcId(i);
    nodes.push({ id, type: REGION_TYPE.kc, threshold: e.threshold });
    const pool = [...senses];
    for (let k = 0; k < e.inputs; k++) {
      const [pick] = pool.splice(Math.floor(rng.next() * pool.length), 1);
      add(pick!, id, 1);
    }
    cells.push(id);
  }
  return cells;
}

/**
 * Adds the recalled-sense nodes after every other node and, for the innate control, their rule synapses after every
 * other edge, from their own random stream: the rest of the newborn does not depend on them.
 */
function wireRecall(r: RecallBirth, cfg: WorldConfig, seed: number, nodes: BrainDugumu[], add: (from: string, to: string, w: number) => void): void {
  if (r.rules !== "grown" && r.rules !== "innate") throw new RangeError(`recall rules must be "grown" or "innate", got ${JSON.stringify(r.rules)}`);
  const max = r.maxInitial ?? DEFAULT_MAX_INITIAL;
  if (r.rules === "grown" && r.maxInitial !== undefined) throw new RangeError("grown rule synapses have no birth weights (maxInitial is for the innate control)");
  if (!(max >= 0 && max < INNATE.generatorToGo)) throw new RangeError(`recall maxInitial ${max} would let a memory outweigh the generators at birth`);
  const ids = cfg.rayAngles.map((_, i) => recId(i));
  for (const id of ids) nodes.push({ id, type: REGION_TYPE.rec });
  if (r.rules === "grown") return;
  const rng = new Rng(seed * 7919 + 101);
  for (const id of ids) for (const a of ACTIONS) add(id, nodeId("bg.go", a), rng.range(0, max));
}

/** Adds the bilateral comparison cells and their innate wiring; returns them (new learning sources). */
function wireBilateral(cfg: WorldConfig, nodes: BrainDugumu[], add: (from: string, to: string, w: number) => void): string[] {
  const cells: string[] = [];
  for (const kind of RAY_KINDS) {
    for (const side of ["left", "right"] as const) {
      const id = latId(kind, side);
      nodes.push({ id, type: REGION_TYPE.lat });
      cells.push(id);
    }
    cfg.rayAngles.forEach((angle, i) => {
      const side = actionOfAngle(angle);
      if (side === "forward") return; // the centre ray sees both sides equally
      const other = side === "left" ? "right" : "left";
      add(rayNodeId(i, kind), latId(kind, side), 1);
      add(rayNodeId(i, kind), latId(kind, other), -1);
    });
  }
  return cells;
}
