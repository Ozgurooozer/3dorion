// brain-lab/neuromodulation/dopamine.ts — dopamine as a global teaching signal, not a neuron:
// δ = outcome − prediction, computed once per tick from the body's senses.
// Nothing consumes it yet; plasticity will (Δw = η·δ·eligibility).
"use strict";

import type { Observation, Policy } from "../world/index.ts";
import { outcomeOf } from "./outcome.ts";
import { RunningMeanPredictor, type Predictor } from "./predictor.ts";

/** Global/regional modulator channels (ORION-BRAIN-IR-CONTEXT.md §4); only dopamine is live. */
export interface Neuromodulator {
  readonly dopamine: number;
  readonly serotonin?: number;
  readonly acetylcholine?: number;
}

export interface DopamineSignal {
  readonly tick: number;
  readonly outcome: number;
  readonly prediction: number;
  readonly delta: number;
}

export class DopamineChannel {
  private readonly predictor: Predictor;
  private readonly healthWeight: number;
  private readonly keepHistory: boolean;
  private prev: Observation | null = null;
  private lastSignal: DopamineSignal | null = null;
  private readonly log: DopamineSignal[] = [];

  constructor(opts: { predictor?: Predictor; healthWeight?: number; keepHistory?: boolean } = {}) {
    this.predictor = opts.predictor ?? new RunningMeanPredictor();
    this.healthWeight = opts.healthWeight ?? 1;
    this.keepHistory = opts.keepHistory ?? false;
  }

  /**
   * Feed the observation of `tick`. Tick 0 starts an episode: there is no previous body state,
   * so no outcome and no learning. Expectations carry over between episodes, like a real brain.
   */
  observe(obs: Observation, tick: number): DopamineSignal {
    let signal: DopamineSignal;
    if (tick === 0 || this.prev === null) {
      signal = { tick, outcome: 0, prediction: this.predictor.predict(), delta: 0 };
    } else {
      const outcome = outcomeOf(this.prev, obs, this.healthWeight);
      const prediction = this.predictor.predict(); // before learning: the surprise is against the old belief
      this.predictor.learn(outcome);
      signal = { tick, outcome, prediction, delta: outcome - prediction };
    }
    this.prev = { ...obs, rays: [...obs.rays] };
    this.lastSignal = signal;
    if (this.keepHistory) this.log.push(signal);
    return signal;
  }

  get last(): DopamineSignal | null {
    return this.lastSignal;
  }

  get history(): readonly DopamineSignal[] {
    return this.log;
  }

  modulators(): Neuromodulator {
    return { dopamine: this.lastSignal?.delta ?? 0 };
  }
}

/** Feeds the channel on every tick; the wrapped policy's actions are untouched. */
export function withDopamine(policy: Policy, channel: DopamineChannel): Policy {
  return (obs, tick) => {
    channel.observe(obs, tick);
    return policy(obs, tick);
  };
}
