// brain-lab/development/spontaneous.ts — spontaneous motor activity ("motor babbling").
// Babies move before they can mean to: random bursts from pattern generators give the
// body its first experiences, which learning can later shape. Random and goal-less by design.
//
// Each generator is a node in the brain (so the trace shows "motor.left fired because of
// spont.left") driven by a two-state burst process: off→on with pOn, on→off with pOff.
"use strict";

import type { BrainInputlari } from "../brain-ir/ir.ts";
import { MOTOR_NODE_IDS } from "../sensorimotor/index.ts";
import { Rng } from "../world/index.ts";

export const SPONTANEOUS_IDS = Object.freeze(MOTOR_NODE_IDS.map((m) => m.replace("motor.", "spont.")));

/** spont.forward → motor.forward, … */
export const spontaneousTarget = (id: string): string => id.replace("spont.", "motor.");

export interface BurstRates {
  readonly pOn: number; // chance per tick that a silent generator starts a burst
  readonly pOff: number; // chance per tick that a burst ends; mean burst ≈ 1/pOff ticks
}

export const DEFAULT_BURSTS: BurstRates = Object.freeze({ pOn: 0.03, pOff: 0.12 });

export class SpontaneousGenerator {
  readonly rates: BurstRates;
  private readonly rng: Rng;
  private readonly on = new Map<string, boolean>();

  constructor(seed: number, rates: BurstRates = DEFAULT_BURSTS) {
    for (const [k, v] of Object.entries(rates)) {
      if (!(v >= 0 && v <= 1)) throw new RangeError(`${k} must be in [0, 1], got ${v}`);
    }
    this.rates = rates;
    this.rng = new Rng(seed);
    for (const id of SPONTANEOUS_IDS) this.on.set(id, false);
  }

  next(): BrainInputlari {
    const out: BrainInputlari = {};
    for (const id of SPONTANEOUS_IDS) {
      const was = this.on.get(id)!;
      const r = this.rng.next();
      const now = was ? r >= this.rates.pOff : r < this.rates.pOn;
      this.on.set(id, now);
      out[id] = now ? 1 : 0;
    }
    return out;
  }

  /** For the controller's extraInputs option. */
  asExtraInputs() {
    return { ids: SPONTANEOUS_IDS, next: () => this.next() };
  }
}
