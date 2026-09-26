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
//
// Rule growth (TASARIM-008 §7, §16; meeting 2026-09-26-a3-kural-dogumu K1): a growable synapse that does not exist yet is
// a candidate. It keeps an eligibility and a pending change exactly as a synapse of weight 0 would, and is born (edge+)
// the first time it earns a quantum; a grown synapse whose weight returns to 0 is pruned (edge-) and is a candidate
// again, its eligibility and pending change kept. So a brain that grows its rule synapses lives the same life as one
// born with them at weight 0 (a guard test says so): what growth changes is which synapses exist, not the arithmetic.
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
  /**
   * Who counts as "post" in eligibility. "neuron": the Go/NoGo cell itself (active even when its
   * action is not chosen). "selected": the action's selection unit — learning only on the action
   * actually taken (OpAL, Collins & Frank 2014); pre is then the sense two ticks earlier
   * (sense → Go → selection).
   */
  readonly gate: "neuron" | "selected";
  /** Dopamine dips are floored at −dipFloor (dips have a limited range: Bayer & Glimcher 2005). */
  readonly dipFloor: number | null;
  /**
   * At the end of each episode, every Go/NoGo cell scales its learning inputs so their sum returns
   * to its birth sum, keeping their ratios (synaptic scaling, Turrigiano).
   */
  readonly scaling: boolean;
}

export const DEFAULT_LEARNING: LearningParams = Object.freeze({
  eta: 0.1, lambda: 0.9, quantum: 0.001, wMax: 2, frozen: false,
  learnGo: true, learnNoGo: true, senseFilter: null, dopamine: "full",
  gate: "neuron", dipFloor: null, scaling: false,
});

interface Synapse { readonly edge: BrainBaglantisi; readonly sign: 1 | -1; readonly selector: string; e: number; pending: number; readonly grown: boolean }
/** A growable synapse not (or no longer) in the brain: it learns as a synapse of weight 0 would, until it is born. */
interface Candidate { readonly from: string; readonly to: string; readonly sign: 1 | -1; readonly selector: string; e: number; pending: number }
type Pair = { readonly from: string; readonly to: string };

export class Learner {
  readonly params: LearningParams;
  private readonly ledger: Ledger;
  private readonly graph: BrainGrafi;
  private synapses: Synapse[];
  private candidates: Candidate[];
  private episode = 0;
  private older: Readonly<Record<string, number>> = {};
  private readonly birthSums = new Map<string, number>();

  /**
   * `graph` must be the live graph the simulator runs on: weights are changed in place, and synapses are born into it
   * and pruned from it. `grow` names the synapses that grow in life (born at their first earned quantum, pruned at 0):
   * each must be on a learning pathway; those already in the graph are grown ones, the rest are candidates.
   */
  constructor(graph: BrainGrafi, ledger: Ledger, params: Partial<LearningParams> = {}, grow: readonly Pair[] = []) {
    this.params = { ...DEFAULT_LEARNING, ...params };
    const p = this.params;
    if (!(p.eta >= 0) || !(p.lambda >= 0 && p.lambda < 1) || !(p.quantum > 0) || !(p.wMax > 0) || (p.dipFloor !== null && !(p.dipFloor >= 0))) {
      throw new RangeError(`bad learning params ${JSON.stringify(p)}`);
    }
    if (!ledger.matches(graph)) throw new Error(`${ledger.subjectId}: live brain does not match its ledger before learning starts`);
    this.ledger = ledger;
    this.graph = graph;
    const growable = new Set(grow.map((g) => edgeKey(g)));
    if (growable.size !== grow.length) throw new Error("a growable synapse is named twice");
    for (const g of grow) if (!isPlastic(g)) throw new Error(`${edgeKey(g)} is on no learning pathway: nothing grows there`);
    const senseOk = p.senseFilter === null ? () => true : ((re) => (id: string) => re.test(id))(new RegExp(p.senseFilter));
    const pathOk = (to: string) => (regionOf(to)!.region === "bg.nogo" ? p.learnNoGo : p.learnGo);
    const learns = (c: Pair) => isPlastic(c) && senseOk(c.from) && pathOk(c.to);
    this.synapses = graph.connections.filter(learns).map((edge) => ({ edge, ...Learner.shape(edge), e: 0, pending: 0, grown: growable.has(edgeKey(edge)) }));
    const present = new Set(graph.connections.map((c) => edgeKey(c)));
    this.candidates = grow.filter((g) => !present.has(edgeKey(g)) && learns(g)).map((g) => ({ from: g.from, to: g.to, ...Learner.shape(g), e: 0, pending: 0 }));
    for (const s of this.synapses) this.birthSums.set(s.edge.to, (this.birthSums.get(s.edge.to) ?? 0) + s.edge.weight);
  }

  private static shape(c: Pair): { sign: 1 | -1; selector: string } {
    return { sign: regionOf(c.to)!.region === "bg.nogo" ? -1 : 1, selector: `bg.out.${regionOf(c.to)!.action}` };
  }

  get plasticCount(): number {
    return this.synapses.length;
  }

  /** Growable synapses not in the brain now. */
  get candidateCount(): number {
    return this.candidates.length;
  }

  /** A new episode: eligibility is a memory of this life's recent moments only. */
  startEpisode(episode: number): void {
    this.episode = episode;
    this.older = {};
    for (const s of this.synapses) { s.e = 0; s.pending = 0; }
    for (const c of this.candidates) { c.e = 0; c.pending = 0; }
  }

  /**
   * Step 2 of a tick: dopamine meets eligibility. Returns the ledger entries it wrote.
   * `dopamine` is one global δ, or — with compartments — the δ each Go/NoGo cell listens to.
   */
  applyDopamine(dopamine: number | ((cell: string) => number), tick: number, cause: readonly string[] = ["dopamine"]): LedgerEntry[] {
    const shape = (d: number) => {
      if (!Number.isFinite(d)) throw new RangeError(`dopamine ${d}`);
      if (this.params.dopamine === "positive") d = Math.max(0, d);
      if (this.params.dipFloor !== null) d = Math.max(-this.params.dipFloor, d);
      return d;
    };
    const global = typeof dopamine === "number" ? shape(dopamine) : null;
    const written: LedgerEntry[] = [];
    if (this.params.frozen || global === 0) return written;
    const { eta, quantum, wMax } = this.params;
    const pruned: Synapse[] = [];
    for (const s of this.synapses) {
      const delta = global ?? shape((dopamine as (cell: string) => number)(s.edge.to));
      if (s.e === 0 || delta === 0) continue;
      s.pending += s.sign * eta * delta * s.e;
      const quanta = Math.trunc(s.pending / quantum);
      if (quanta === 0) continue;
      const before = s.edge.weight;
      const after = Math.min(wMax, Math.max(0, before + quanta * quantum));
      s.pending -= quanta * quantum;
      if (after === before) { s.pending = 0; continue; } // pinned at a bound: nothing to record
      if (s.grown && after === 0) { // a grown rule back at 0 is pruned; it stays a candidate with its trace
        written.push(this.ledger.record({ kind: "edge-", tick, episode: this.episode, cause, edge: { from: s.edge.from, to: s.edge.to }, before }));
        this.graph.connections.splice(this.graph.connections.indexOf(s.edge), 1);
        pruned.push(s);
        continue;
      }
      written.push(this.ledger.record({
        kind: "weight", tick, episode: this.episode, cause, edge: { from: s.edge.from, to: s.edge.to },
        before, after, delta, eligibility: s.e,
      }));
      s.edge.weight = after;
    }
    const born: { candidate: Candidate; edge: BrainBaglantisi }[] = [];
    for (const c of this.candidates) { // as a synapse of weight 0: born when it first earns a quantum
      const delta = global ?? shape((dopamine as (cell: string) => number)(c.to));
      if (c.e === 0 || delta === 0) continue;
      c.pending += c.sign * eta * delta * c.e;
      const quanta = Math.trunc(c.pending / quantum);
      if (quanta === 0) continue;
      const after = Math.min(wMax, Math.max(0, quanta * quantum));
      c.pending -= quanta * quantum;
      if (after === 0) { c.pending = 0; continue; } // pinned at 0, as a synapse of weight 0 would be
      const edge: BrainBaglantisi = { from: c.from, to: c.to, weight: after };
      written.push(this.ledger.record({ kind: "edge+", tick, episode: this.episode, cause, edge: { ...edge } }));
      this.graph.connections.push(edge);
      born.push({ candidate: c, edge });
    }
    // Moved after both passes, so no synapse is taught twice on one tick.
    for (const s of pruned) {
      this.synapses = this.synapses.filter((x) => x !== s);
      this.candidates.push({ from: s.edge.from, to: s.edge.to, sign: s.sign, selector: s.selector, e: s.e, pending: s.pending });
    }
    for (const { candidate: c, edge } of born) {
      this.candidates = this.candidates.filter((x) => x !== c);
      this.synapses.push({ edge, sign: c.sign, selector: c.selector, e: c.e, pending: c.pending, grown: true });
    }
    return written;
  }

  /** Step 4 of a tick: mark which learning edges just carried a signal into an active target. */
  updateEligibility(previousOutputs: Readonly<Record<string, number>>, outputs: Readonly<Record<string, number>>): void {
    const { lambda, gate } = this.params;
    const mark = (from: string, to: string, selector: string, e: number) => {
      const pre = gate === "selected" ? this.older[from] ?? 0 : previousOutputs[from] ?? 0;
      const post = gate === "selected" ? outputs[selector] ?? 0 : outputs[to] ?? 0;
      return lambda * e + pre * post;
    };
    for (const s of this.synapses) s.e = mark(s.edge.from, s.edge.to, s.selector, s.e);
    for (const c of this.candidates) c.e = mark(c.from, c.to, c.selector, c.e);
    this.older = previousOutputs;
  }

  /**
   * Eligibility for competitive selection (TASARIM-005 S1): the selector reads the senses of this
   * tick and picks actions on this tick, so pre is the sense now and post is 1 for the actions taken.
   */
  updateEligibilityDirect(senses: Readonly<Record<string, number>>, selected: Readonly<Record<string, 0 | 1>>): void {
    const { lambda } = this.params;
    for (const s of this.synapses) {
      const action = s.selector.slice("bg.out.".length);
      s.e = lambda * s.e + (senses[s.edge.from] ?? 0) * (selected[action] ?? 0);
    }
    for (const c of this.candidates) {
      const action = c.selector.slice("bg.out.".length);
      c.e = lambda * c.e + (senses[c.from] ?? 0) * (selected[action] ?? 0);
    }
  }

  /**
   * End of an episode. With scaling on, each Go/NoGo cell brings the sum of its learning inputs
   * back to its birth sum, multiplying all of them by one factor. Changes move in whole quanta
   * and each is a ledger entry, like any other learning.
   */
  endEpisode(tick: number): LedgerEntry[] {
    const written: LedgerEntry[] = [];
    if (!this.params.scaling || this.params.frozen) return written;
    const { quantum, wMax } = this.params;
    const byCell = new Map<string, Synapse[]>();
    for (const s of this.synapses) byCell.set(s.edge.to, [...(byCell.get(s.edge.to) ?? []), s]);
    for (const [cell, syns] of byCell) {
      const sum = syns.reduce((a, s) => a + s.edge.weight, 0);
      const target = this.birthSums.get(cell)!;
      if (sum <= 0 || target <= 0) continue;
      const factor = target / sum;
      for (const s of syns) {
        const quanta = Math.trunc((s.edge.weight * factor - s.edge.weight) / quantum);
        if (quanta === 0) continue;
        const before = s.edge.weight;
        const after = Math.min(wMax, Math.max(0, before + quanta * quantum));
        if (after === before) continue;
        written.push(this.ledger.record({
          kind: "weight", tick, episode: this.episode, cause: ["scaling"], edge: { from: s.edge.from, to: s.edge.to }, before, after,
        }));
        s.edge.weight = after;
      }
    }
    return written;
  }

  /** Sum of learning weights into one Go/NoGo cell (for tests and analysis). */
  inputSum(cell: string): number {
    return this.synapses.filter((s) => s.edge.to === cell).reduce((a, s) => a + s.edge.weight, 0);
  }

  /** For tests and the viewer: current eligibility of one learning edge, or of a candidate not yet born. */
  eligibility(from: string, to: string): number {
    const key = edgeKey({ from, to });
    return this.synapses.find((s) => edgeKey(s.edge) === key)?.e ?? this.candidates.find((c) => edgeKey(c) === key)?.e ?? 0;
  }
}
