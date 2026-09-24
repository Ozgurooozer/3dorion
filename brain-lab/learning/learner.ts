// brain-lab/learning/learner.ts — three-factor learning on the pathways that may learn
// (senses → Go/NoGo, pathway table P1/P2), after Frank 2005:
//
//   eligibility   e ← λ·e + pre·post        pre: source output last tick (an edge carries
//                                           last tick's signal), post: target output now
//   Go edge       Δw = +η·δ·e               dopamine up → the proposal that led here passes easier
//   NoGo edge     Δw = −η·δ·e               dopamine down → the same proposal is held back
//
// Changes build up per edge and are applied in quanta: once the pending change reaches one
// quantum, the weight moves by whole quanta and the ledger gets one LRN entry. Every change
// to the brain is on the record; nothing below one quantum ever touches a weight.
"use strict";

import type { BrainBaglantisi, BrainGrafi } from "../brain-ir/ir.ts";
import type { Ledger, LedgerEntry } from "../registry/index.ts";
import { edgeKey } from "../registry/index.ts";
import { isPlastic, regionOf } from "../regions/index.ts";

export interface LearningParams {
  readonly eta: number; // learning rate
  readonly lambda: number; // eligibility memory per tick, in [0, 1)
  readonly quantum: number; // smallest weight change that is applied and recorded
  readonly wMax: number; // weights stay in [0, wMax] (learning pathways are excitatory)
  /** A frozen learner computes everything but changes nothing: the control twin. */
  readonly frozen: boolean;
  // Ablation switches for diagnostic experiments; the defaults are the full rule.
  /** Learn on Go edges. */
  readonly learnGo: boolean;
  /** Learn on NoGo edges. */
  readonly learnNoGo: boolean;
  /** If set, only learning edges whose source sense matches this pattern may change. */
  readonly senseFilter: string | null;
  /** "positive": dopamine dips teach nothing (only bursts do). */
  readonly dopamine: "full" | "positive";
}

export const DEFAULT_LEARNING: LearningParams = Object.freeze({
  eta: 0.1, lambda: 0.9, quantum: 0.001, wMax: 2, frozen: false,
  learnGo: true, learnNoGo: true, senseFilter: null, dopamine: "full",
});

interface Synapse { readonly edge: BrainBaglantisi; readonly sign: 1 | -1; e: number; pending: number }

export class Learner {
  readonly params: LearningParams;
  private readonly ledger: Ledger;
  private readonly synapses: Synapse[];
  private episode = 0;

  /** `graph` must be the live graph the simulator runs on: weights are changed in place. */
  constructor(graph: BrainGrafi, ledger: Ledger, params: Partial<LearningParams> = {}) {
    this.params = { ...DEFAULT_LEARNING, ...params };
    const p = this.params;
    if (!(p.eta >= 0) || !(p.lambda >= 0 && p.lambda < 1) || !(p.quantum > 0) || !(p.wMax > 0)) {
      throw new RangeError(`bad learning params ${JSON.stringify(p)}`);
    }
    if (!ledger.matches(graph)) throw new Error(`${ledger.subjectId}: live brain does not match its ledger before learning starts`);
    this.ledger = ledger;
    const senseOk = p.senseFilter === null ? () => true : ((re) => (id: string) => re.test(id))(new RegExp(p.senseFilter));
    const pathOk = (to: string) => (regionOf(to)!.region === "bg.nogo" ? p.learnNoGo : p.learnGo);
    this.synapses = graph.connections.filter((c) => isPlastic(c) && senseOk(c.from) && pathOk(c.to)).map((edge) => ({
      edge,
      sign: regionOf(edge.to)!.region === "bg.nogo" ? -1 : 1,
      e: 0,
      pending: 0,
    }));
  }

  get plasticCount(): number {
    return this.synapses.length;
  }

  /** A new episode: eligibility is a memory of this life's recent moments only. */
  startEpisode(episode: number): void {
    this.episode = episode;
    for (const s of this.synapses) { s.e = 0; s.pending = 0; }
  }

  /** Step 2 of a tick: dopamine meets eligibility. Returns the ledger entries it wrote. */
  applyDopamine(delta: number, tick: number, cause: readonly string[] = ["dopamine"]): LedgerEntry[] {
    if (!Number.isFinite(delta)) throw new RangeError(`dopamine ${delta}`);
    const written: LedgerEntry[] = [];
    if (this.params.dopamine === "positive") delta = Math.max(0, delta);
    if (this.params.frozen || delta === 0) return written;
    const { eta, quantum, wMax } = this.params;
    for (const s of this.synapses) {
      if (s.e === 0) continue;
      s.pending += s.sign * eta * delta * s.e;
      const quanta = Math.trunc(s.pending / quantum);
      if (quanta === 0) continue;
      const before = s.edge.weight;
      const after = Math.min(wMax, Math.max(0, before + quanta * quantum));
      s.pending -= quanta * quantum;
      if (after === before) { s.pending = 0; continue; } // pinned at a bound: nothing to record
      written.push(this.ledger.record({
        kind: "weight", tick, episode: this.episode, cause, edge: { from: s.edge.from, to: s.edge.to },
        before, after, delta, eligibility: s.e,
      }));
      s.edge.weight = after;
    }
    return written;
  }

  /** Step 4 of a tick: mark which learning edges just carried a signal into an active target. */
  updateEligibility(previousOutputs: Readonly<Record<string, number>>, outputs: Readonly<Record<string, number>>): void {
    const { lambda } = this.params;
    for (const s of this.synapses) {
      const pre = previousOutputs[s.edge.from] ?? 0;
      const post = outputs[s.edge.to] ?? 0;
      s.e = lambda * s.e + pre * post;
    }
  }

  /** For tests and the viewer: current eligibility of one learning edge. */
  eligibility(from: string, to: string): number {
    return this.synapses.find((s) => edgeKey(s.edge) === edgeKey({ from, to }))?.e ?? 0;
  }
}
