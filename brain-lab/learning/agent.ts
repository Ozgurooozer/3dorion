// brain-lab/learning/agent.ts — one living subject: body senses → dopamine → learning → brain → action.
//
// Order inside a tick (the order is the science):
//   0. the growing memory, when switched on, hears the senses first: pose, then memory neurons (TASARIM-008)
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
import { brainController, encodeObservation, type BrainController } from "../sensorimotor/index.ts";
import type { EpisodeHooks, Observation, Policy, WorldConfig } from "../world/index.ts";
import { MemoryCore, PoseModule, type PoseParams } from "../memory/index.ts";
import { Compartments, type CompartmentSpec } from "./compartments.ts";
import { Critic, type CriticParams } from "./critic.ts";
import { CueMemory, type CueParams } from "./cue-memory.ts";
import { FoodMemory, type GrowthParams } from "./growth.ts";
import { Learner, type LearningParams } from "./learner.ts";
import { CompetitiveSelector, type Choice, type SelectionParams } from "./selection.ts";
import { teacherDeltas, type TeacherSpec } from "./teacher.ts";

export interface Agent {
  readonly policy: Policy;
  readonly hooks: EpisodeHooks;
  readonly learner: Learner;
  readonly critic: Critic | null;
  /** The cue memory (TASARIM-006), or null when switched off. */
  readonly cue: CueMemory | null;
  /** The growing memory (TASARIM-008): the pose and the food memory neurons, or null when switched off. */
  readonly memory: { readonly core: MemoryCore; readonly pose: PoseModule; readonly food: FoodMemory } | null;
  readonly compartments: Compartments | null;
  readonly dopamine: DopamineChannel;
  readonly controller: BrainController;
  readonly graph: BrainGrafi;
  /** δ that reached the learner on the last tick (after any critic). */
  readonly lastDelta: number;
  /** With competitive selection: the selector and its last choice (salience, exploration). */
  readonly selector: CompetitiveSelector | null;
  readonly lastChoice: Choice | null;
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
  /**
   * Competitive selection (TASARIM-005 S1): actions are chosen by selection.ts from the learned
   * Go − NoGo values of the senses, per axis, instead of by the graph's generators and bg.out cells.
   * Eligibility then pairs this tick's senses with this tick's choice. null/absent = the graph decides.
   */
  readonly selection?: Partial<SelectionParams> | null;
  /**
   * The cue memory (TASARIM-006, "yemek hafızası"): what was seen shortly before an outcome gains value, and
   * the change of that value is added to the δ that teaches Go/NoGo. null/absent = off (bit-identical brain).
   */
  readonly cue?: Partial<CueParams> | null;
  /**
   * The growing memory (TASARIM-008, A2): the pose (memory/pose.ts) and food memory neurons grown in the brain graph,
   * every change on the ledger (growth.ts). It grows even when learning is frozen: forming memories is the core's job,
   * not reflex learning. Nothing reads the memories yet, so behaviour does not change. null/absent = off.
   */
  readonly memory?: { readonly pose?: Partial<PoseParams>; readonly food?: Partial<GrowthParams> } | null;
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
  const cue = spec.cue ? new CueMemory(spec.ledger, spec.cfg, spec.cue) : null;
  if (cue && compartments) throw new Error("the cue memory is not defined for compartments (it shapes the one global δ)");
  // The growing memory (TASARIM-008): it grows in the live graph in step with the ledger, and reads only the senses.
  let memory: Agent["memory"] = null;
  if (spec.memory) {
    const pose = new PoseModule(spec.cfg, spec.memory.pose);
    memory = { core: new MemoryCore([pose]), pose, food: new FoodMemory(spec.ledger, graph, spec.cfg, spec.memory.food) };
  }
  const teacher = spec.teacher ?? null;
  const selector = spec.selection ? new CompetitiveSelector(graph, spec.noiseSeed, spec.selection) : null;
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
  let lastChoice: Choice | null = null;

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
    if (cue) {
      // The change of cue value, added before any normalisation or transform, as part of the brain's own δ.
      const c = cue.step(t === 0 ? null : previousObs, obs, outcome, t, episode, terminal, frozen);
      delta += c.shaping;
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
    if (memory) { // 0: the memory hears the senses first; it grows, it does not act
      memory.core.observe(obs, t);
      writes.push(...memory.food.step(obs, memory.pose.pose, t, episode));
    }
    const signal = dopamine.observe(obs, t); // 1
    teach(obs, signal.outcome, signal.delta, t, false, ["dopamine"]); // 2
    previousObs = obs;
    if (selector) {
      const senses = encodeObservation(obs, spec.cfg) as Record<string, number>;
      const choice = selector.choose(senses); // 3
      lastChoice = choice;
      learner.updateEligibilityDirect(senses, choice.selected); // 4
      previous = CompetitiveSelector.asOutputs(choice);
      return choice.action;
    }
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
    cue,
    memory,
    compartments,
    dopamine,
    controller,
    graph,
    get lastDelta() { return lastDelta; },
    get lastChoice() { return lastChoice; },
    selector,
    startEpisode(n: number) {
      episode = n;
      previous = {};
      previousObs = null;
      learner.startEpisode(n);
      critic?.resetPending();
      compartments?.resetPending();
      cue?.resetEpisode();
      if (memory) { // a new room: the pose starts again and the last room's place memories die (K6)
        memory.core.reset();
        writes.push(...memory.food.newRoom(0, n));
      }
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
