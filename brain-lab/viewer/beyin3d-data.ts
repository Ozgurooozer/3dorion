// brain-lab/viewer/beyin3d-data.ts — what the 3D brain page (beyin3d.html) shows: a recorded subject's brain, every
// neuron and synapse with its region, pathway and learned change, and one evaluation room lived tick by tick with the
// activity of every neuron. Like the arena (arena.ts), it runs on the lab's server in Node — the engine the experiment
// ran in — with the experiment's own evaluation spec (harness.ts evaluationSpec: critic, selection AND memory), so a
// filmed room is the measured room; a test checks it against the record.
//
// "Activating" a brain is a counterfactual on the server, never a copy in the browser:
//   silence  — a neuron's outgoing synapses set to 0 on an in-memory copy of the ledger (the record is never touched);
//   birth    — the subject's brain as it was born (what learning changed, seen as behaviour).
// Either one makes the room a different life; the page says so (matches: null).
"use strict";

import type { BrainGrafi } from "../brain-ir/ir.ts";
import { CONDITIONS } from "../experiments/conditions.ts";
import { evaluationSpec, recordedEvaluation } from "../experiments/harness.ts";
import { MAX_TICKS, evalNoise, evalWorld } from "../experiments/seeds.ts";
import { createAgent, type AgentSpec } from "../learning/index.ts";
import { drive } from "../neuromodulation/index.ts";
import { ACTIONS, isPlastic, pathwayOf, regionOf } from "../regions/index.ts";
import { Ledger } from "../registry/ledger.ts";
import type { RegistryStore } from "../registry/store.ts";
import { Room, runEpisode, type DoneCause, type WorldConfig } from "../world/index.ts";
import type { RoomState } from "../world/room.ts";
import { nodeLabel } from "./theme.ts";

export interface NeuronView {
  readonly id: string;
  readonly region: string;
  readonly action: string | null;
  readonly label: string;
  /** A memory neuron grown in life (TASARIM-008), or a node that was not in the birth graph. */
  readonly grown: boolean;
}

export interface SynapseView {
  readonly from: string;
  readonly to: string;
  /** Weight in the brain that lived this room (after silencing, when asked). */
  readonly w: number;
  /** Weight at birth; null when the synapse grew in life. */
  readonly birth: number | null;
  /** Weight the subject really has now (before any silencing). */
  readonly learned: number;
  readonly pathway: string | null;
  readonly learns: boolean;
  /** What the synapse does to the action it reaches: +1 pushes it, −1 holds it back (NoGo, inhibitory pathways, negative weights). */
  readonly effect: 1 | -1;
  readonly why: string;
}

export interface Tick3D {
  readonly t: number;
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly energy: number;
  readonly health: number;
  readonly drive: number;
  readonly meals: number;
  /** Index into Film3D.scenes. */
  readonly scene: number;
  readonly rays: readonly { readonly hit: string; readonly d: number }[];
  /** Activity of every active neuron this tick (0 omitted), rounded. */
  readonly a: Readonly<Record<string, number>>;
  /** Selection: salience per action and which axis was explored (competitive selection only). */
  readonly sal: Readonly<Record<string, number>> | null;
  readonly explored: readonly [boolean, boolean] | null;
  /** δ that reached the learner (a frozen brain feels it, learns nothing). */
  readonly delta: number;
  /** Recall gate (A3): open, and the memory neuron recalled. */
  readonly recall: { readonly open: boolean; readonly id: string | null } | null;
  readonly thrust: number;
  readonly turn: number;
}

export interface Film3D {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly what: string;
  readonly seed: number;
  readonly group: string;
  readonly room: number;
  readonly rooms: number;
  readonly world: WorldConfig;
  readonly mode: "record" | "birth";
  readonly silenced: readonly string[];
  /** "selection": the competitive selector sums senses × learning weights; "graph": the spiking graph runs. */
  readonly machinery: "selection" | "graph";
  readonly neurons: readonly NeuronView[];
  readonly synapses: readonly SynapseView[];
  readonly scenes: readonly RoomState["entities"][];
  readonly ticks: readonly Tick3D[];
  readonly result: { readonly ticks: number; readonly meals: number; readonly doneCause: DoneCause | null; readonly finalHash: string };
  /** true/false against the experiment's record; null for a counterfactual (silence, birth) or when no record exists. */
  readonly matches: boolean | null;
}

export interface SubjectRow {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly command: string;
  readonly seed: number;
  readonly group: string;
  readonly trainEpisodes: number;
  readonly drive: number;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** The newest learner of every (code, command, seed, group, training length), newest first; controls left out. */
export function subjectRows(lines: readonly string[]): SubjectRow[] {
  const seen = new Map<string, SubjectRow>();
  for (const text of lines) {
    if (text.trim() === "") continue;
    const r = JSON.parse(text) as { code: string; command: string; control: string; seed: number; group: string; learner: string; trainEpisodes?: number; l: { meanDrive?: number } };
    if (r.control !== "none") continue;
    const key = `${r.code}/${r.command}/${r.seed}/${r.group}/${r.trainEpisodes ?? 40}`;
    seen.delete(key);
    seen.set(key, { id: r.learner, name: "", code: r.code, command: r.command, seed: r.seed, group: r.group, trainEpisodes: r.trainEpisodes ?? 40, drive: r3(r.l.meanDrive ?? NaN) });
  }
  return [...seen.values()].reverse();
}

/** The neurons and synapses of `graph`, against the birth graph and the brain the subject really has. */
export function brainView(graph: BrainGrafi, birth: BrainGrafi, learned: BrainGrafi): { neurons: NeuronView[]; synapses: SynapseView[] } {
  const bornNodes = new Set(birth.nodes.map((n) => n.id));
  const key = (e: { from: string; to: string }) => `${e.from}->${e.to}`;
  const birthW = new Map(birth.connections.map((e) => [key(e), e.weight]));
  const learnedW = new Map(learned.connections.map((e) => [key(e), e.weight]));
  const neurons = graph.nodes.map((n) => {
    const r = regionOf(n.id);
    return { id: n.id, region: r?.region ?? n.type, action: r?.action ?? null, label: nodeLabel(n.id), grown: !bornNodes.has(n.id) };
  });
  const synapses = graph.connections.map((e) => {
    const p = pathwayOf(e);
    return {
      from: e.from, to: e.to, w: r3(e.weight), birth: birthW.has(key(e)) ? r3(birthW.get(key(e))!) : null,
      learned: r3(learnedW.get(key(e)) ?? e.weight), pathway: p?.id ?? null, learns: isPlastic(e),
      effect: p?.sign === "negative" || e.weight < 0 || regionOf(e.to)?.region === "bg.nogo" ? (-1 as const) : (1 as const), why: p?.why ?? "",
    };
  });
  return { neurons, synapses };
}

export interface FilmOptions {
  readonly room: number;
  readonly silence?: readonly string[];
  readonly birth?: boolean;
}

/** One evaluation room of a recorded subject, lived on the server tick by tick (rooms before it lived first, as measured). */
export function film3d(store: RegistryStore, id: string, code: string, o: FilmOptions): Film3D {
  const subject = store.loadSubject(id);
  const world = subject.birth.worldConfig;
  const real = store.openLedger(id);
  const training = store.listRuns(id).find((r) => r.header.purpose.endsWith(" train"));
  const spec = (training?.header.meta.spec ?? {}) as Partial<AgentSpec>;
  const evalRun = recordedEvaluation(store, id);
  const rooms = evalRun?.episodes.length ?? 1;
  if (!(o.room >= 1 && o.room <= Math.max(rooms, 1))) throw new RangeError(`room ${o.room} outside 1…${rooms}`);
  const silence = [...new Set(o.silence ?? [])];
  const learned = structuredClone(real.graph); // before any silencing: the weights the subject really has
  const ledger = o.birth ? new Ledger(id, real.birthGraph) : real;
  for (const node of silence) {
    if (!ledger.graph.nodes.some((n) => n.id === node)) throw new RangeError(`no neuron ${node}`);
    for (const e of ledger.graph.connections.filter((c) => c.from === node && c.weight !== 0)) {
      ledger.record({ kind: "weight", tick: 0, episode: 0, cause: ["sustur", node], edge: { from: e.from, to: e.to }, before: e.weight, after: 0 });
    }
  }
  const lived = structuredClone(ledger.graph); // the brain that lives the room, before memory grows in it
  const agent = createAgent({ ...evaluationSpec(spec as never), cfg: world, ledger, noiseSeed: evalNoise(subject.birth.seed), learning: { ...spec.learning, frozen: true } });
  for (let ep = 1; ep < o.room; ep++) {
    agent.startEpisode(ep);
    runEpisode(new Room(evalWorld(subject.birth.seed, ep), world), agent.policy, MAX_TICKS, false, agent.hooks);
  }
  agent.startEpisode(o.room);
  const room = new Room(evalWorld(subject.birth.seed, o.room), world);
  const selection = agent.selector !== null;
  const scenes: RoomState["entities"][] = [];
  let sceneKey = "";
  const ticks: Tick3D[] = [];
  let obs = room.observe();
  let t = 0, meals = 0;
  let doneCause: DoneCause | null = null;
  const weightOf = new Map<string, { from: string; w: number }[]>();
  const incoming = () => { // the live graph: memory neurons and rule synapses may be born while the room is lived
    weightOf.clear();
    for (const e of agent.graph.connections) if (isPlastic(e)) (weightOf.get(e.to) ?? weightOf.set(e.to, []).get(e.to)!).push({ from: e.from, w: e.weight });
  };
  while (t < MAX_TICKS && !room.done) {
    const action = agent.policy(obs, t);
    const a: Record<string, number> = {};
    if (selection) {
      incoming();
      // What the selector read this tick (the senses and, with recall on, the recalled senses), as the agent gave it.
      for (const [k, v] of Object.entries(agent.lastSenses ?? {})) if (v !== 0) a[k] = r3(v);
      // Go and NoGo: the sum each learning synapse brings (weight × sense), as the selector sums it before the sign.
      for (const act of ACTIONS) for (const pre of ["bg.go.", "bg.nogo."]) {
        const node = pre + act;
        const sum = (weightOf.get(node) ?? []).reduce((s, x) => s + x.w * (a[x.from] ?? 0), 0);
        if (sum !== 0) a[node] = r3(sum);
      }
      const c = agent.lastChoice!;
      for (const act of ACTIONS) if (c.selected[act]) a[`bg.out.${act}`] = 1;
    } else {
      for (const [k, v] of Object.entries(agent.controller.last?.outputs ?? {})) if (v !== 0) a[k] = r3(v);
    }
    if (action.thrust > 0) a["motor.forward"] = 1; else if (action.thrust < 0) a["motor.back"] = 1;
    if (action.turn > 0) a["motor.left"] = 1; else if (action.turn < 0) a["motor.right"] = 1;
    const s = room.state();
    const key = JSON.stringify(s.entities);
    if (key !== sceneKey) { scenes.push(s.entities.map((e) => ({ ...e, x: r3(e.x), y: r3(e.y) }))); sceneKey = key; }
    const choice = agent.lastChoice;
    ticks.push({
      t, x: r3(s.body.x), y: r3(s.body.y), heading: r3(s.body.heading), energy: r3(obs.energy), health: r3(obs.health), drive: r3(drive(obs)),
      meals, scene: scenes.length - 1, rays: obs.rays.map((r) => ({ hit: r.hit, d: r3(r.distance) })), a,
      sal: selection && choice ? Object.fromEntries(ACTIONS.map((x) => [x, r3(choice.salience[x])])) : null,
      explored: selection && choice ? choice.explored : null, delta: r3(agent.lastDelta),
      recall: agent.lastRecall ? { open: agent.lastRecall.open, id: agent.lastRecall.recalled?.id ?? null } : null,
      thrust: action.thrust, turn: action.turn,
    });
    const step = room.step(action);
    meals += step.foodEaten;
    doneCause = step.doneCause;
    obs = step.observation;
    t++;
  }
  if (doneCause !== null) agent.hooks.onDeath?.(obs, doneCause, t);
  const finalHash = room.hash();
  const recorded = evalRun?.episodes.find((e) => e.episode === o.room);
  const counterfactual = silence.length > 0 || o.birth === true;
  const { neurons, synapses } = brainView(lived, real.birthGraph, learned);
  return {
    id, name: subject.name, code, what: CONDITIONS[code]?.what ?? "", seed: subject.birth.seed, group: subject.group,
    room: o.room, rooms, world, mode: o.birth ? "birth" : "record", silenced: silence,
    machinery: selection ? "selection" : "graph", neurons, synapses, scenes, ticks,
    result: { ticks: t, meals, doneCause, finalHash },
    // The world hash covers the eaten food too; meals are compared as well so a mismatch names itself.
    matches: counterfactual || !recorded ? null : recorded.summary.finalHash === finalHash && recorded.summary.foodEaten === meals,
  };
}
