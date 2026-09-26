// brain-lab/learning/selection.ts — competitive action selection (TASARIM-005, S1).
//
// The basal ganglia's job in biology is to choose among competing action channels: the most salient
// channel wins and the rest are held back (Redgrave, Prescott & Gurney 1999). Measured 2026-09-24,
// our graph did not do this: pattern generators passed selection on their own, and what was learned
// only mattered once it grew past ~0.2 — so learning never took over behaviour (no improvement loop).
//
// Here each movement axis is one competition with three candidates:
//   thrust {forward, back, rest} · turn {left, right, rest}
//   salience(a)  = Σ_s (w_Go(s→a) − w_NoGo(s→a))·x_s     the learned value of a in this situation
//                + vigor · hunger                          tonic drive: a hungry body is readier to act
//                + noiseGain · (noise_a − ½)               small coloured exploration (the old generators)
//   salience(rest) = restBias
// The highest salience on each axis wins; with probability `explore` the axis picks a candidate at random.
// Both axes act together, so the body can turn while it moves.
//
// The learned values are the ordinary Go/NoGo weights of the live graph (read by reference, so every
// change the learner writes to the ledger is what the selector sees). Only sense → Go/NoGo weights
// count: selection reads the senses directly, the graph's generators and lateral inhibition play no part.
// Recalled senses (region rec, TASARIM-008 §16) are read the same way, from the values the core wrote for this tick;
// when a rule synapse is born or pruned in life, refresh() re-reads the graph.
"use strict";

import type { BrainGrafi } from "../brain-ir/ir.ts";
import { NOISE_IDS, NoiseGenerator } from "../development/index.ts";
import { edgeKey } from "../registry/index.ts";
import { ACTIONS, isPlastic, nodeId, regionOf, type ActionName } from "../regions/index.ts";
import { Rng, type Action } from "../world/index.ts";

export interface SelectionParams {
  /** Probability per axis per tick of a random candidate. */
  readonly explore: number;
  /** Weight of the coloured noise (noise − ½ is in [−½, ½]). */
  readonly noiseGain: number;
  /** Salience of resting on an axis. */
  readonly restBias: number;
  /** How much hunger raises every movement's salience. */
  readonly vigor: number;
}

/**
 * Calibrated 2026-09-24 on newborns (5 seeds × 5 episodes): vigor 1 kept the body moving 89% of the time
 * and it starved (survival 4%); vigor 0.5 / rest 0.3 rests 22% of ticks, survival 12% (graph newborn: 48%,
 * 8%). With hand-set food weights 0.5 the same settings steer at 0.34 (graph brain needs ~2 for 0.52).
 */
export const DEFAULT_SELECTION: SelectionParams = Object.freeze({ explore: 0.05, noiseGain: 0.4, restBias: 0.3, vigor: 0.5 });

export const AXES = Object.freeze([
  Object.freeze(["forward", "back"] as const),
  Object.freeze(["left", "right"] as const),
]);

export interface Choice {
  /** 1 for the action taken on each axis (at most one per axis), 0 otherwise. */
  readonly selected: Readonly<Record<ActionName, 0 | 1>>;
  readonly salience: Readonly<Record<ActionName, number>>;
  /** Whether each axis was decided by exploration instead of salience. */
  readonly explored: readonly [boolean, boolean];
  readonly action: Action;
}

interface Term { readonly edge: { readonly from: string; readonly to: string; readonly weight: number }; readonly sign: 1 | -1 }

export class CompetitiveSelector {
  readonly params: SelectionParams;
  private readonly graph: BrainGrafi;
  private terms: ReadonlyMap<ActionName, readonly Term[]>;
  private readonly noise: NoiseGenerator;
  private readonly rng: Rng;

  /** `graph` must be the live graph the learner changes; weights are read on every choice. */
  constructor(graph: BrainGrafi, seed: number, params: Partial<SelectionParams> = {}) {
    this.params = { ...DEFAULT_SELECTION, ...params };
    const p = this.params;
    if (!(p.explore >= 0 && p.explore <= 1) || !(p.noiseGain >= 0) || !Number.isFinite(p.restBias) || !(p.vigor >= 0)) {
      throw new RangeError(`bad selection params ${JSON.stringify(p)}`);
    }
    this.graph = graph;
    this.terms = CompetitiveSelector.read(graph);
    this.noise = new NoiseGenerator(seed);
    this.rng = new Rng(seed * 7 + 3);
  }

  /**
   * The learning edges of the graph, by the action they feed; only senses and recalled senses may feed selection. Each
   * action's terms are summed in edge-key order — the ledger's canonical order, the order of every brain born before
   * rule growth — so a synapse born in life (added last to the graph) changes a sum only by its value, never by
   * where it stands: floating-point addition depends on order.
   */
  private static read(graph: BrainGrafi): ReadonlyMap<ActionName, readonly Term[]> {
    const terms = new Map<ActionName, Term[]>(ACTIONS.map((a) => [a, []]));
    for (const edge of graph.connections) {
      if (!isPlastic(edge)) continue;
      const from = regionOf(edge.from);
      const to = regionOf(edge.to)!;
      if (from?.region !== "sense" && from?.region !== "rec") {
        throw new Error(`competitive selection reads senses directly; ${edge.from} → ${edge.to} comes from ${from?.region}`);
      }
      terms.get(to.action!)!.push({ edge, sign: to.region === "bg.go" ? 1 : -1 });
    }
    const key = (t: Term) => edgeKey(t.edge);
    for (const list of terms.values()) list.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
    return terms;
  }

  /** Re-reads the live graph's learning edges: call after a synapse was born or pruned (A3's rule growth). */
  refresh(): void {
    this.terms = CompetitiveSelector.read(this.graph);
  }

  /** The learned value of every action for these sense inputs (no drive, no noise). */
  values(senses: Readonly<Record<string, number>>): Record<ActionName, number> {
    const v = {} as Record<ActionName, number>;
    for (const a of ACTIONS) v[a] = this.terms.get(a)!.reduce((s, t) => s + t.sign * t.edge.weight * (senses[t.edge.from] ?? 0), 0);
    return v;
  }

  choose(senses: Readonly<Record<string, number>>): Choice {
    const { explore, noiseGain, restBias, vigor } = this.params;
    const noise = this.noise.next();
    const learned = this.values(senses);
    const hunger = senses["intero.hunger"] ?? 0;
    const salience = {} as Record<ActionName, number>;
    for (const a of ACTIONS) salience[a] = learned[a] + vigor * hunger + noiseGain * ((noise[NOISE_IDS[ACTIONS.indexOf(a)]!] as number) - 0.5);
    const selected = { forward: 0, back: 0, left: 0, right: 0 } as Record<ActionName, 0 | 1>;
    const explored: [boolean, boolean] = [false, false];
    AXES.forEach(([a, b], i) => {
      let winner: ActionName | null;
      if (this.rng.next() < explore) {
        explored[i] = true;
        winner = [a, b, null][Math.floor(this.rng.next() * 3)] ?? null;
      } else {
        const best = salience[a] >= salience[b] ? a : b;
        winner = salience[best] > restBias ? best : null;
      }
      if (winner) selected[winner] = 1;
    });
    return {
      selected, salience, explored,
      action: { thrust: selected.forward - selected.back, turn: selected.left - selected.right },
    };
  }

  /** Brain-output-shaped view of a choice (bg.out.<action>), for compartments and the teacher. */
  static asOutputs(c: Choice): Record<string, number> {
    return Object.fromEntries(ACTIONS.map((a) => [nodeId("bg.out", a), c.selected[a]]));
  }
}
