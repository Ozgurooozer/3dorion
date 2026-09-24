// brain-lab/learning/agent.ts — one living subject: body senses → dopamine → learning → brain → action.
//
// Order inside a tick (the order is the science):
//   1. dopamine feels the last transition (δ — from the stateless expectation, or from the critic)
//   2. δ meets eligibility → weights change (on the record)
//   3. the brain steps with its new weights → an action
//   4. eligibility marks what just fired together
// Death reaches steps 1–2 through the episode hook (unless teachAtDeath is off).
// finishEpisode() runs end-of-episode plasticity (synaptic scaling, when enabled).
"use strict";

import type { BrainGrafi } from "../brain-ir/ir.ts";
import { BrainSimulator } from "../brain-ir/simulator.ts";
import { NoiseGenerator } from "../development/index.ts";
import { DopamineChannel } from "../neuromodulation/index.ts";
import type { Ledger, LedgerEntry } from "../registry/index.ts";
import { ACTIONS, regionOf } from "../regions/index.ts";
import { brainController, type BrainController } from "../sensorimotor/index.ts";
import type { EpisodeHooks, Observation, Policy, WorldConfig } from "../world/index.ts";
import { Compartments, type CompartmentSpec } from "./compartments.ts";
import { Critic, type CriticParams } from "./critic.ts";
import { Learner, type LearningParams } from "./learner.ts";
import { teacherDeltas, type TeacherSpec } from "./teacher.ts";

export interface Agent {
  readonly policy: Policy;
  readonly hooks: EpisodeHooks;
  readonly learner: Learner;
  readonly critic: Critic | null;
  readonly compartments: Compartments | null;
  readonly dopamine: DopamineChannel;
  readonly controller: BrainController;
  readonly graph: BrainGrafi;
  /** δ that reached the learner on the last tick (after any critic). */
  readonly lastDelta: number;
  /** Call before each episode (numbered from 1). */
  startEpisode(episode: number): void;
  /** Call after each episode: end-of-episode plasticity (scaling). */
  finishEpisode(tick: number): void;
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
  /** State-dependent value estimate; null/absent = the stateless expectation of the dopamine channel. */
  readonly critic?: Partial<CriticParams> | null;
  /**
   * Optional hook between dopamine and learning (negative controls, e.g. shuffled dopamine).
   * Receives the δ the brain computed; returns the δ the learner gets.
   */
  readonly deltaTransform?: (delta: number, tick: number, channel?: string) => number;
  /**
   * Dopamine compartments (TASARIM-004 M1): each Go/NoGo cell learns from its own compartment's δ
   * instead of the global one. "action" mode needs `critic` (it bootstraps on the shared V).
   * deltaTransform then receives each compartment's δ with the compartment as `channel`.
   */
  readonly compartments?: CompartmentSpec | null;
  /**
   * Divide δ by a running estimate of its typical size (mean |δ|, time constant 1/rate), so the
   * scale of the teaching signal does not depend on the scale of rewards — the idea behind OpAL*
   * (Jaskir & Frank 2023). null/absent = off.
   */
  readonly rpeNormalization?: { readonly rate: number } | null;
  /**
   * Learning from a teacher (teacher.ts): each action the brain took hears whether the teacher would
   * have taken it. "only": the teacher's signal replaces reward dopamine; "add": it is added to it.
   * deltaTransform receives it per action as channel "teacher/<action>".
   */
  readonly teacher?: (TeacherSpec & { readonly mix: "only" | "add" }) | null;
}

export function createAgent(spec: AgentSpec): Agent {
  // The live brain starts as exactly what the ledger says it is.
  const graph = structuredClone(spec.ledger.graph);
  const sim = new BrainSimulator(graph);
  const learner = new Learner(graph, spec.ledger, spec.learning);
  const critic = spec.critic ? new Critic(spec.ledger, spec.cfg, spec.critic) : null;
  const compartments = spec.compartments ? new Compartments(spec.ledger, spec.cfg, spec.compartments) : null;
  if (compartments?.mode === "action" && !critic) throw new Error("action compartments need a critic (they bootstrap on its V)");
  if (compartments && spec.rpeNormalization) throw new Error("rpeNormalization is not defined for compartments");
  const teacher = spec.teacher ?? null;
  const frozen = learner.params.frozen;
  const dopamine = new DopamineChannel(spec.deathOutcome === undefined ? {} : { deathOutcome: spec.deathOutcome });
  const noise = new NoiseGenerator(spec.noiseSeed);
  const controller = brainController(sim, spec.cfg, { keepSteps: spec.keepSteps ?? false, extraInputs: noise.asExtraInputs() });
  let episode = 0;
  let tick = 0;
  let previous: Readonly<Record<string, number>> = {};
  let previousObs: Observation | null = null;
  let writes: LedgerEntry[] = [];
  let lastDelta = 0;
  let typical = 0; // running mean |δ| for rpeNormalization

  const stage = (to: "E1" | "E2", reason: string) => {
    const from = spec.ledger.stage;
    const next = from === "E0" ? "E1" : from === "E1" ? "E2" : null;
    if (next === to) writes.push(spec.ledger.record({ kind: "stage", tick, episode, cause: [], from, to, reason }));
  };

  /** Steps 1–2: turn the felt outcome into δ (critic or stateless) and let it teach. */
  const teach = (obs: Observation, outcome: number, statelessDelta: number, t: number, terminal: boolean, cause: string[]) => {
    let delta = statelessDelta;
    if (critic) {
      const c = critic.step(t === 0 ? null : previousObs, obs, outcome, t, episode, terminal, frozen);
      delta = c.delta;
      writes.push(...c.writes);
    }
    // The reward signal each Go/NoGo cell hears: one global δ, or its compartment's δ.
    let reward: number | ((cell: string) => number);
    if (compartments) {
      const c = compartments.step({
        prev: t === 0 ? null : previousObs, now: obs, outcome, previousOutputs: previous, tick: t, episode, terminal, frozen,
        value: critic ? (o) => critic.value(o) : undefined,
      });
      writes.push(...c.writes);
      const deltas = { ...c.deltas };
      if (spec.deltaTransform) for (const k of Object.keys(deltas)) deltas[k] = spec.deltaTransform(deltas[k]!, t, k);
      reward = (cell) => deltas[compartments.channelOf(cell)]!;
    } else {
      if (spec.rpeNormalization) {
        const rate = spec.rpeNormalization.rate;
        typical = typical === 0 ? Math.abs(delta) : (1 - rate) * typical + rate * Math.abs(delta);
        delta = typical > 1e-12 ? delta / typical : 0;
      }
      if (spec.deltaTransform) delta = spec.deltaTransform(delta, t);
      reward = delta;
    }
    lastDelta = delta;
    let dopamine = reward;
    if (teacher) {
      // The teacher judges the action the brain took on the last tick, from what the body sensed then.
      const judged = t === 0 || previousObs === null ? null : teacherDeltas(previous, teacher.policy(previousObs, t - 1), teacher.gain);
      if (judged && spec.deltaTransform) for (const a of ACTIONS) judged[a] = spec.deltaTransform(judged[a], t, `teacher/${a}`);
      const heard = (cell: string) => (judged ? judged[regionOf(cell)!.action!] : 0);
      const fromReward = reward;
      dopamine = teacher.mix === "only" ? heard : (cell) => (typeof fromReward === "number" ? fromReward : fromReward(cell)) + heard(cell);
    }
    const changed = learner.applyDopamine(dopamine, t, teacher ? [...cause, "teacher"] : cause);
    if (changed.length > 0) { writes.push(...changed); stage("E2", "first weight change"); }
  };

  const policy: Policy = (obs, t) => {
    tick = t;
    if (t === 0 && spec.ledger.stage === "E0") stage("E1", "first tick lived");
    const signal = dopamine.observe(obs, t); // 1
    teach(obs, signal.outcome, signal.delta, t, false, ["dopamine"]); // 2
    previousObs = obs;
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
      if (spec.teachAtDeath === false) return; // a dead animal does not learn
      teach(obs, signal.outcome, signal.delta, t, true, ["death", cause]);
    },
  };

  return {
    policy,
    hooks,
    learner,
    critic,
    compartments,
    dopamine,
    controller,
    graph,
    get lastDelta() { return lastDelta; },
    startEpisode(n: number) {
      episode = n;
      previous = {};
      previousObs = null;
      learner.startEpisode(n);
      critic?.resetPending();
      compartments?.resetPending();
    },
    finishEpisode(t: number) {
      writes.push(...learner.endEpisode(t));
    },
    drainWrites() {
      const out = writes;
      writes = [];
      return out;
    },
  };
}
