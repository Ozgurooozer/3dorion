// brain-lab/learning/compartments.test.ts — dopamine compartments (TASARIM-004 M1) must teach
// only their own synapses, from their own expectation, and everything they learn is on the record.
// Every case starts from a fresh compartment set: no case may see what another one learned.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { bornGraph } from "../development/index.ts";
import { outcomeOf } from "../neuromodulation/index.ts";
import { Ledger } from "../registry/index.ts";
import { ACTIONS } from "../regions/index.ts";
import { DEFAULT_CONFIG as C, Room, makeConfig, runEpisode, type Observation, type Ray } from "../world/index.ts";
import { Compartments, Learner, createAgent, type CompartmentMode, type CriticParams } from "./index.ts";

const HUNGRY = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
const NOTHING: Ray = { distance: C.rayRange, hit: "none" };

function bodyAt(energy: number, opts: { foodOnRay?: number; health?: number } = {}): Observation {
  return {
    rays: C.rayAngles.map((_, i) => (i === opts.foodOnRay ? { distance: 1, hit: "food" as const } : NOTHING)),
    bump: false, energy, health: opts.health ?? 1, motion: { forward: 0, turn: 0 },
  };
}

const ledgerFor = (seed: number) => new Ledger(`DNK-${String(seed).padStart(4, "0")}`, bornGraph(C, { seed, group: "reflexless" }));

function fresh(mode: CompartmentMode, critic: Partial<CriticParams> = {}) {
  const ledger = ledgerFor(1);
  return { ledger, compartments: new Compartments(ledger, C, { mode, critic: { quantum: 0.0001, ...critic } }) };
}

/** Brain outputs of the last tick in which exactly `actions` were selected. */
const selected = (...actions: string[]) => Object.fromEntries(ACTIONS.map((a) => [`bg.out.${a}`, actions.includes(a) ? 1 : 0]));

// A standard transition: food seen on ray 3, then a meal (energy 0.4 → 0.7), after a left turn.
const SAW_FOOD = bodyAt(0.4, { foodOnRay: 3 });
const ATE = bodyAt(0.7);
const MEAL = outcomeOf(SAW_FOOD, ATE);

function transition(c: Compartments, over: Partial<Parameters<Compartments["step"]>[0]> = {}) {
  return c.step({
    prev: SAW_FOOD, now: ATE, outcome: MEAL, previousOutputs: selected("left"),
    tick: 1, episode: 1, terminal: false, frozen: false, value: () => 0, ...over,
  });
}

// --- which cell listens to which compartment ---------------------------------------------

test("action mode: each action's Go and NoGo listen to that action's compartment", () => {
  const { compartments } = fresh("action");
  assert.deepEqual(compartments.channels, [...ACTIONS]);
  for (const a of ACTIONS) {
    assert.equal(compartments.channelOf(`bg.go.${a}`), a);
    assert.equal(compartments.channelOf(`bg.nogo.${a}`), a);
  }
});

test("valence mode: every Go listens to reward, every NoGo to punishment", () => {
  const { compartments } = fresh("valence");
  assert.deepEqual(compartments.channels, ["pos", "neg"]);
  for (const a of ACTIONS) {
    assert.equal(compartments.channelOf(`bg.go.${a}`), "pos");
    assert.equal(compartments.channelOf(`bg.nogo.${a}`), "neg");
  }
});

test("only Go/NoGo cells have a compartment", () => {
  const { compartments } = fresh("action");
  for (const cell of ["bg.out.left", "motor.left", "ray0.food", "hyp.hunger"]) {
    assert.throws(() => compartments.channelOf(cell), /not a Go\/NoGo/, cell);
  }
});

// --- action mode --------------------------------------------------------------------------

test("action mode: the compartment of the action taken gets δ = r + γ·V(s′) − Q(s)", () => {
  const { compartments } = fresh("action", { gamma: 0.9 });
  const { deltas } = transition(compartments, { value: () => 0.5 });
  const expected = MEAL + 0.9 * 0.5; // Q starts at 0
  assert.ok(Math.abs(deltas.left! - expected) < 1e-12, `left δ ${deltas.left}, expected ${expected}`);
});

test("action mode: compartments of actions not taken stay silent", () => {
  const { compartments } = fresh("action");
  const { deltas } = transition(compartments);
  for (const a of ACTIONS.filter((x) => x !== "left")) assert.equal(deltas[a], 0, a);
});

test("action mode: only the taken action's expectation learns, and on the record under its name", () => {
  const { ledger, compartments } = fresh("action", { alpha: 0.5 });
  const { writes } = transition(compartments);
  assert.ok(writes.length > 0, "nothing was learned");
  for (const w of writes) {
    assert.equal(w.kind, "critic");
    if (w.kind === "critic") assert.ok(w.feature.startsWith("left/"), w.feature);
  }
  assert.ok(ledger.criticWeight("left/ray3.food") > 0, "left should now expect value where it was taken");
  assert.equal(ledger.criticWeight("ray3.food"), 0, "the shared critic's weights must stay untouched");
});

test("action mode: two actions taken together each answer to their own expectation", () => {
  const { compartments } = fresh("action", { alpha: 0.5 });
  transition(compartments); // left has now seen this meal once
  const { deltas } = transition(compartments, { previousOutputs: selected("left", "forward") });
  assert.ok(deltas.left! < deltas.forward!, `left (expects it) ${deltas.left} should be less surprised than forward ${deltas.forward}`);
});

test("action mode: repeated meals after a left turn make left expect them — its surprise shrinks", () => {
  const { compartments } = fresh("action", { alpha: 0.2 });
  const first = transition(compartments).deltas.left!;
  for (let i = 0; i < 40; i++) transition(compartments);
  const later = transition(compartments).deltas.left!;
  assert.ok(later < first / 3, `surprise ${first} → ${later}`);
  assert.equal(compartments.expectation("right", SAW_FOOD), 0, "right never took this path");
});

test("action mode: at death there is no next state to bootstrap on", () => {
  const { compartments } = fresh("action");
  const { deltas } = transition(compartments, { terminal: true, value: () => 99 });
  assert.equal(deltas.left, MEAL);
});

test("action mode: no previous state (first tick) or no action taken → all silent", () => {
  for (const over of [{ prev: null }, { previousOutputs: selected() }]) {
    const { compartments } = fresh("action");
    const { deltas } = transition(compartments, over);
    for (const a of ACTIONS) assert.equal(deltas[a], 0, `${a} with ${JSON.stringify(over)}`);
  }
});

test("action mode refuses to run without the shared value V(s′)", () => {
  const { compartments } = fresh("action");
  assert.throws(() => transition(compartments, { value: undefined }), /need the shared critic/);
});

// --- valence mode -------------------------------------------------------------------------

test("valence mode: a meal speaks on the reward channel only", () => {
  const { compartments } = fresh("valence");
  const { deltas } = transition(compartments);
  assert.ok(deltas.pos! > 0, `reward δ ${deltas.pos}`);
  assert.equal(deltas.neg, 0);
});

test("valence mode: spending energy speaks on the punishment channel only", () => {
  const { compartments } = fresh("valence");
  const prev = bodyAt(0.5), now = bodyAt(0.49);
  const { deltas } = transition(compartments, { prev, now, outcome: outcomeOf(prev, now) });
  assert.equal(deltas.pos, 0);
  assert.ok(deltas.neg! < 0, `punishment δ ${deltas.neg}`);
});

test("valence mode: death lands on the punishment channel", () => {
  const { compartments } = fresh("valence");
  const prev = bodyAt(0.02), now = bodyAt(0);
  const { deltas } = transition(compartments, { prev, now, outcome: outcomeOf(prev, now) - 1, terminal: true });
  assert.equal(deltas.pos, 0);
  assert.ok(deltas.neg! < -1, `punishment δ ${deltas.neg}`);
});

test("valence mode: eating while being hurt is two signals at once", () => {
  const { compartments } = fresh("valence");
  const prev = bodyAt(0.4, { health: 0.9 }), now = bodyAt(0.7, { health: 0.8 });
  const { deltas } = transition(compartments, { prev, now, outcome: outcomeOf(prev, now) });
  assert.ok(deltas.pos! > 0, `reward δ ${deltas.pos}`);
  assert.ok(deltas.neg! < 0, `punishment δ ${deltas.neg}`);
});

test("valence mode: expectations are recorded under pos/ and neg/ only", () => {
  const { ledger, compartments } = fresh("valence");
  transition(compartments);
  const features = ledger.entries.flatMap((e) => (e.kind === "critic" ? [e.feature] : []));
  assert.ok(features.some((f) => f.startsWith("pos/")), "the reward channel learned nothing");
  for (const f of features) assert.match(f, /^(pos|neg)\//);
});

// --- frozen, learner, agent ---------------------------------------------------------------

test("frozen compartments compute δ but write nothing", () => {
  const { ledger, compartments } = fresh("action");
  const { deltas, writes } = transition(compartments, { frozen: true });
  assert.ok(deltas.left! > 0, "δ should still be computed");
  assert.equal(writes.length, 0);
  assert.equal(ledger.entries.length, 0);
});

test("learner: an eligible synapse whose compartment is silent does not change", () => {
  const ledger = ledgerFor(6);
  const graph = structuredClone(ledger.graph);
  const learner = new Learner(graph, ledger, { quantum: 0.0001 });
  const silent = Object.fromEntries(graph.nodes.map((n) => [n.id, 0]));
  learner.updateEligibility({ ...silent, "ray3.food": 1 }, { ...silent, "bg.go.left": 1, "bg.go.right": 1 });
  const weight = (to: string) => graph.connections.find((e) => e.from === "ray3.food" && e.to === to)!.weight;
  const leftBefore = weight("bg.go.left"), rightBefore = weight("bg.go.right");
  learner.applyDopamine((cell) => (cell.endsWith(".left") ? 0.5 : 0), 1);
  assert.ok(weight("bg.go.left") > leftBefore, "left's compartment spoke: its synapse should grow");
  assert.equal(weight("bg.go.right"), rightBefore, "right's compartment was silent");
});

test("learner: a non-finite compartment δ is refused", () => {
  const ledger = ledgerFor(6);
  const learner = new Learner(structuredClone(ledger.graph), ledger);
  assert.throws(() => learner.applyDopamine(() => Number.NaN, 1), RangeError);
});

function liveAgent(mode: CompartmentMode) {
  const ledger = ledgerFor(7);
  const channelsSeen = new Set<string | undefined>();
  const agent = createAgent({
    cfg: HUNGRY, ledger, noiseSeed: 7, learning: { gate: "selected", dipFloor: 0.05, quantum: 0.005 }, critic: {}, teachAtDeath: false,
    compartments: { mode }, deltaTransform: (d, _tick, channel) => { channelsSeen.add(channel); return d; },
  });
  for (let ep = 1; ep <= 3; ep++) { agent.startEpisode(ep); runEpisode(new Room(700 + ep, HUNGRY), agent.policy, 1500, false, agent.hooks); }
  agent.drainWrites();
  return { ledger, agent, channelsSeen };
}

for (const mode of ["action", "valence"] as const) {
  test(`agent (${mode} compartments): the live brain matches its ledger, and the ledger replays`, () => {
    const { ledger, agent } = liveAgent(mode);
    assert.ok(ledger.matches(agent.graph));
    assert.ok(ledger.entries.some((e) => e.kind === "weight"), "synapses never learned");
    const replay = new Ledger(ledger.subjectId, ledger.birthGraph, ledger.entries);
    const learned = ledger.entries.find((e) => e.kind === "critic" && e.feature.includes("/"));
    assert.ok(learned && learned.kind === "critic", "compartment expectations never learned");
    assert.equal(replay.criticWeight(learned.feature), ledger.criticWeight(learned.feature));
  });

  test(`agent (${mode} compartments): same seeds, same ledger`, () => {
    assert.equal(JSON.stringify(liveAgent(mode).ledger.entries), JSON.stringify(liveAgent(mode).ledger.entries));
  });

  test(`agent (${mode} compartments): the δ transform is called once per compartment, by name`, () => {
    const { agent, channelsSeen } = liveAgent(mode);
    assert.deepEqual([...channelsSeen].sort(), [...agent.compartments!.channels].sort());
  });
}

test("agent: action compartments without a critic are refused", () => {
  assert.throws(() => createAgent({ cfg: HUNGRY, ledger: ledgerFor(8), noiseSeed: 1, compartments: { mode: "action" } }), /need a critic/);
});

test("agent: compartments with δ normalisation are refused (not defined)", () => {
  assert.throws(
    () => createAgent({ cfg: HUNGRY, ledger: ledgerFor(8), noiseSeed: 1, critic: {}, compartments: { mode: "valence" }, rpeNormalization: { rate: 0.01 } }),
    /not defined/,
  );
});

test("agent: compartments null and absent are the same brain", () => {
  const ledgerOf = (compartments: null | undefined) => {
    const ledger = ledgerFor(9);
    const agent = createAgent({ cfg: HUNGRY, ledger, noiseSeed: 9, learning: { gate: "selected", quantum: 0.005 }, critic: {}, compartments });
    agent.startEpisode(1);
    runEpisode(new Room(901, HUNGRY), agent.policy, 1500, false, agent.hooks);
    return JSON.stringify(ledger.entries);
  };
  assert.equal(ledgerOf(null), ledgerOf(undefined));
});
