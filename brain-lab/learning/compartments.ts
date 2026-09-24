// brain-lab/learning/compartments.ts — dopamine compartments (TASARIM-004-MODULLER.md, M1).
//
// In the fly the mushroom body is split into ~15 compartments and each dopamine neuron type
// teaches only one or two of them (Aso et al. 2014). Here the single global δ is replaced by one
// teaching signal per compartment; every learning synapse listens to its own compartment only.
//
//   "action"  — one compartment per action, with its own expectation Q_a(s) (senses + bias, linear).
//               Its dopamine speaks only when a was the action taken on the last tick:
//                 δ_a = r + γ·V(s′) − Q_a(s)       (V: the shared critic; terminal: V(s′) = 0)
//               Both a's Go and a's NoGo synapses learn from δ_a; Q_a learns from δ_a.
//   "valence" — a reward channel (PAM-like: relief, the drive terms that shrank) and a punishment
//               channel (PPL1-like: cost, the drive terms that grew, and death), each with its own
//               expectation: δ⁺ = r⁺ + γ·V⁺(s′) − V⁺(s), δ⁻ likewise. Go learns from δ⁺ only, NoGo
//               from δ⁻ only (the learner's NoGo sign makes a worse-than-expected cost strengthen NoGo).
//
// Every expectation weight is a ledger "critic" entry named with its compartment ("left/ray3.food").
"use strict";

import { outcomeParts } from "../neuromodulation/index.ts";
import type { Ledger, LedgerEntry } from "../registry/index.ts";
import { ACTIONS, regionOf } from "../regions/index.ts";
import type { Observation, WorldConfig } from "../world/index.ts";
import { Critic, type CriticParams } from "./critic.ts";

export type CompartmentMode = "action" | "valence";

export interface CompartmentSpec {
  readonly mode: CompartmentMode;
  /** Learning of the compartments' own expectations (defaults: the critic's). */
  readonly critic?: Partial<CriticParams>;
}

export interface CompartmentStep {
  readonly prev: Observation | null;
  readonly now: Observation;
  /** Everything the body felt this tick, including the innate death outcome if it died. */
  readonly outcome: number;
  /** Brain outputs of the last tick: which actions were taken. */
  readonly previousOutputs: Readonly<Record<string, number>>;
  readonly tick: number;
  readonly episode: number;
  readonly terminal: boolean;
  readonly frozen: boolean;
  /** Shared state value V(s′) (action mode bootstraps on it). */
  readonly value?: (obs: Observation) => number;
}

export class Compartments {
  readonly mode: CompartmentMode;
  readonly channels: readonly string[];
  private readonly estimates: ReadonlyMap<string, Critic>;

  constructor(ledger: Ledger, cfg: WorldConfig, spec: CompartmentSpec) {
    this.mode = spec.mode;
    this.channels = Object.freeze(spec.mode === "action" ? [...ACTIONS] : ["pos", "neg"]);
    this.estimates = new Map(this.channels.map((c) => [c, new Critic(ledger, cfg, spec.critic, `${c}/`)]));
  }

  /** The compartment a Go/NoGo cell listens to. */
  channelOf(cell: string): string {
    const r = regionOf(cell);
    if (!r || (r.region !== "bg.go" && r.region !== "bg.nogo") || !r.action) throw new Error(`${cell} is not a Go/NoGo cell`);
    return this.mode === "action" ? r.action : r.region === "bg.go" ? "pos" : "neg";
  }

  /** Expectation of one compartment in a state (for tests and analysis). */
  expectation(channel: string, obs: Observation): number {
    return this.estimate(channel).value(obs);
  }

  private estimate(channel: string): Critic {
    const c = this.estimates.get(channel);
    if (!c) throw new Error(`no compartment ${channel}`);
    return c;
  }

  /** One transition: each compartment's δ, and the ledger entries its expectation wrote. */
  step(s: CompartmentStep): { deltas: Record<string, number>; writes: LedgerEntry[] } {
    if (!Number.isFinite(s.outcome)) throw new RangeError(`outcome ${s.outcome}`);
    const deltas: Record<string, number> = Object.fromEntries(this.channels.map((c) => [c, 0]));
    const writes: LedgerEntry[] = [];
    if (s.prev === null) return { deltas, writes };
    const prev = s.prev;
    const teach = (channel: string, delta: number) => {
      deltas[channel] = delta;
      if (!s.frozen) writes.push(...this.estimate(channel).learn(prev, delta, s.tick, s.episode));
    };
    if (this.mode === "action") {
      if (!s.value) throw new Error("action compartments need the shared critic's V(s′)");
      const next = s.terminal ? 0 : s.value(s.now);
      for (const a of this.channels) {
        if (s.previousOutputs[`bg.out.${a}`] !== 1) continue; // this compartment's action was not taken: silent
        const q = this.estimate(a);
        teach(a, s.outcome + q.params.gamma * next - q.value(prev));
      }
    } else {
      // Cost is everything that is not relief: the drive terms that grew, and death if it came.
      const { relief } = outcomeParts(prev, s.now);
      const rewards: Record<string, number> = { pos: relief, neg: s.outcome - relief };
      for (const c of this.channels) {
        const v = this.estimate(c);
        teach(c, rewards[c]! + v.params.gamma * (s.terminal ? 0 : v.value(s.now)) - v.value(prev));
      }
    }
    return { deltas, writes };
  }

  resetPending(): void {
    for (const c of this.estimates.values()) c.resetPending();
  }
}
