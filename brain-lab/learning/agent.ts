// brain-lab/learning/agent.ts — one living subject: body senses → dopamine → learning → brain → action.
//
// Order inside a tick (the order is the science):
//   1. dopamine feels the last transition (δ)
//   2. δ meets eligibility → weights change (on the record)
//   3. the brain steps with its new weights → an action
//   4. eligibility marks what just fired together
// Death reaches steps 1–2 through the episode hook, so the last moments before dying are taught too.
"use strict";

import type { BrainGrafi } from "../brain-ir/ir.ts";
import { BrainSimulator } from "../brain-ir/simulator.ts";
import { NoiseGenerator } from "../development/index.ts";
import { DopamineChannel } from "../neuromodulation/index.ts";
import type { Ledger, LedgerEntry } from "../registry/index.ts";
import { brainController, type BrainController } from "../sensorimotor/index.ts";
import type { EpisodeHooks, Policy, WorldConfig } from "../world/index.ts";
import { Learner, type LearningParams } from "./learner.ts";

export interface Agent {
  readonly policy: Policy;
  readonly hooks: EpisodeHooks;
  readonly learner: Learner;
  readonly dopamine: DopamineChannel;
  readonly controller: BrainController;
  readonly graph: BrainGrafi;
  /** Call before each episode (numbered from 1). */
  startEpisode(episode: number): void;
  /** Ledger entries written since the last call. */
  drainWrites(): LedgerEntry[];
}

export interface AgentSpec {
  readonly cfg: WorldConfig;
  readonly ledger: Ledger;
  readonly noiseSeed: number;
  readonly learning?: Partial<LearningParams>;
  readonly keepSteps?: boolean;
  /** Ablation: if false, dying still produces a dopamine signal but teaches nothing. Default true. */
  readonly teachAtDeath?: boolean;
  /** Innate value of dying (default −1, see neuromodulation). A lab parameter, varied in pilot 001c. */
  readonly deathOutcome?: number;
}

export function createAgent(spec: AgentSpec): Agent {
  // The live brain starts as exactly what the ledger says it is.
  const graph = structuredClone(spec.ledger.graph);
  const sim = new BrainSimulator(graph);
  const learner = new Learner(graph, spec.ledger, spec.learning);
  const dopamine = new DopamineChannel(spec.deathOutcome === undefined ? {} : { deathOutcome: spec.deathOutcome });
  const noise = new NoiseGenerator(spec.noiseSeed);
  const controller = brainController(sim, spec.cfg, { keepSteps: spec.keepSteps ?? false, extraInputs: noise.asExtraInputs() });
  let episode = 0;
  let tick = 0;
  let previous: Readonly<Record<string, number>> = {};
  let writes: LedgerEntry[] = [];

  const stage = (to: "E1" | "E2", reason: string) => {
    const from = spec.ledger.stage;
    const next = from === "E0" ? "E1" : from === "E1" ? "E2" : null;
    if (next === to) writes.push(spec.ledger.record({ kind: "stage", tick, episode, cause: [], from, to, reason }));
  };

  const policy: Policy = (obs, t) => {
    tick = t;
    if (t === 0 && spec.ledger.stage === "E0") stage("E1", "first tick lived");
    const signal = dopamine.observe(obs, t); // 1
    const changed = learner.applyDopamine(signal.delta, t); // 2
    if (changed.length > 0) { writes.push(...changed); stage("E2", "first weight change"); }
    const action = controller.policy(obs, t); // 3
    const outputs = controller.last!.outputs;
    learner.updateEligibility(previous, outputs); // 4
    previous = outputs;
    return action;
  };

  const hooks: EpisodeHooks = {
    onDeath: (obs, cause, t) => {
      tick = t;
      const signal = dopamine.observeDeath(obs, t, cause);
      if (spec.teachAtDeath === false) return;
      const changed = learner.applyDopamine(signal.delta, t, ["death", cause]);
      if (changed.length > 0) { writes.push(...changed); stage("E2", "first weight change"); }
    },
  };

  return {
    policy,
    hooks,
    learner,
    dopamine,
    controller,
    graph,
    startEpisode(n: number) {
      episode = n;
      previous = {};
      learner.startEpisode(n);
    },
    drainWrites() {
      const out = writes;
      writes = [];
      return out;
    },
  };
}
