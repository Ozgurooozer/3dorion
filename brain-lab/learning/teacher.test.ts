// brain-lab/learning/teacher.test.ts — learning from a teacher (T0): only the actions the brain took
// are judged, each by whether the teacher would have taken it, and the lesson reaches only that
// action's synapses. Every case starts from a fresh brain.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { bornGraph } from "../development/index.ts";
import { Ledger } from "../registry/index.ts";
import { ACTIONS } from "../regions/index.ts";
import { DEFAULT_CONFIG as C, Room, makeConfig, runEpisode, type Action, type Observation } from "../world/index.ts";
import { actionsOf, createAgent, teacherDeltas, type AgentSpec } from "./index.ts";

const HUNGRY = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
const ledgerFor = (seed: number) => new Ledger(`DNK-${String(seed).padStart(4, "0")}`, bornGraph(C, { seed, group: "reflexless" }));
const selected = (...actions: string[]) => Object.fromEntries(ACTIONS.map((a) => [`bg.out.${a}`, actions.includes(a) ? 1 : 0]));
const command = (thrust: number, turn: number): Action => ({ thrust, turn });

// --- what a command asks for -------------------------------------------------------------

test("actionsOf: thrust asks for forward or back, turn for left or right, zero for nothing", () => {
  assert.deepEqual([...actionsOf(command(1, 0))], ["forward"]);
  assert.deepEqual([...actionsOf(command(-1, 0))], ["back"]);
  assert.deepEqual([...actionsOf(command(0, 1))], ["left"]);
  assert.deepEqual([...actionsOf(command(0, -1))], ["right"]);
  assert.deepEqual([...actionsOf(command(1, -1))].sort(), ["forward", "right"]);
  assert.equal(actionsOf(command(0, 0)).size, 0);
});

// --- the teacher's signal ----------------------------------------------------------------

test("teacherDeltas: an action taken that the teacher agrees with gets +gain", () => {
  assert.equal(teacherDeltas(selected("left"), command(0, 1), 0.3).left, 0.3);
});

test("teacherDeltas: an action taken that the teacher would not take gets −gain", () => {
  assert.equal(teacherDeltas(selected("right"), command(0, 1), 0.3).right, -0.3);
});

test("teacherDeltas: an action not taken gets nothing, even if the teacher wanted it", () => {
  const d = teacherDeltas(selected("forward"), command(1, 1), 0.3);
  assert.equal(d.left, 0);
  assert.equal(d.back, 0);
  assert.equal(d.right, 0);
});

test("teacherDeltas: nothing taken, nothing judged", () => {
  const d = teacherDeltas(selected(), command(1, 1), 0.3);
  for (const a of ACTIONS) assert.equal(d[a], 0, a);
});

test("teacherDeltas: a negative or non-finite gain is refused", () => {
  for (const gain of [-0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => teacherDeltas(selected("left"), command(0, 1), gain), RangeError, String(gain));
  }
});

// --- the teacher inside a living agent ---------------------------------------------------

const E7_LIKE: Pick<AgentSpec, "learning" | "critic" | "teachAtDeath"> = {
  learning: { gate: "selected", dipFloor: 0.05, quantum: 0.005, eta: 0.05, lambda: 0.9 }, critic: {}, teachAtDeath: false,
};

function live(teacher: AgentSpec["teacher"], opts: { episodes?: number; seed?: number; deltaTransform?: AgentSpec["deltaTransform"] } = {}) {
  const ledger = ledgerFor(opts.seed ?? 11);
  const agent = createAgent({ ...E7_LIKE, cfg: HUNGRY, ledger, noiseSeed: 11, teacher, deltaTransform: opts.deltaTransform });
  for (let ep = 1; ep <= (opts.episodes ?? 2); ep++) {
    agent.startEpisode(ep);
    runEpisode(new Room(1100 + ep, HUNGRY), agent.policy, 1500, false, agent.hooks);
  }
  agent.drainWrites();
  return { ledger, agent };
}

const goSum = (ledger: Ledger, action: string) =>
  ledger.graph.connections.filter((e) => e.to === `bg.go.${action}` && /^ray|^touch|^intero|^proprio/.test(e.from)).reduce((s, e) => s + e.weight, 0);
const birthGoSum = (ledger: Ledger, action: string) =>
  ledger.birthGraph.connections.filter((e) => e.to === `bg.go.${action}` && /^ray|^touch|^intero|^proprio/.test(e.from)).reduce((s, e) => s + e.weight, 0);

test("agent: a teacher that always wants left makes left's Go stronger", () => {
  const { ledger } = live({ policy: () => command(0, 1), gain: 0.3, mix: "only" });
  assert.ok(goSum(ledger, "left") > birthGoSum(ledger, "left"), `left Go ${birthGoSum(ledger, "left")} → ${goSum(ledger, "left")}`);
});

test("agent: a teacher that always wants left makes right's Go weaker", () => {
  const { ledger } = live({ policy: () => command(0, 1), gain: 0.3, mix: "only" });
  assert.ok(goSum(ledger, "right") < birthGoSum(ledger, "right"), `right Go ${birthGoSum(ledger, "right")} → ${goSum(ledger, "right")}`);
});

test("agent: the teacher's lessons are on the record, named as the teacher's", () => {
  const { ledger, agent } = live({ policy: () => command(0, 1), gain: 0.3, mix: "only" });
  assert.ok(ledger.matches(agent.graph), "live brain must match its ledger");
  const weights = ledger.entries.filter((e) => e.kind === "weight");
  assert.ok(weights.length > 0, "nothing was learned");
  for (const e of weights) assert.ok(e.cause.includes("teacher"), `${e.id} does not name the teacher`);
});

test("agent: the teacher judges the observation of the tick the brain acted on", () => {
  const shown: Observation[] = [];
  const asked: Observation[] = [];
  const ledger = ledgerFor(12);
  const agent = createAgent({ ...E7_LIKE, cfg: HUNGRY, ledger, noiseSeed: 12, teacher: { policy: (o) => { asked.push(o); return command(1, 0); }, gain: 0.3, mix: "only" } });
  const watching = (o: Observation, t: number) => { shown.push(o); return agent.policy(o, t); };
  agent.startEpisode(1);
  runEpisode(new Room(1201, HUNGRY), watching, 50, false, agent.hooks);
  assert.equal(asked.length, shown.length - 1, "asked once per tick after the first");
  for (let i = 0; i < asked.length; i++) assert.equal(asked[i], shown[i], `tick ${i + 1} must judge the observation of tick ${i}`);
});

test("agent: an added teacher with zero gain learns exactly what the brain learns alone", () => {
  const alone = live(null);
  const silentTeacher = live({ policy: () => command(0, 1), gain: 0, mix: "add" });
  const w = (l: Ledger) => JSON.stringify(l.graph.connections.map((e) => e.weight));
  assert.equal(w(silentTeacher.ledger), w(alone.ledger));
});

test("agent: a teacher only on the teacher's signal learns differently from reward alone", () => {
  const alone = live(null);
  const taught = live({ policy: () => command(0, 1), gain: 0.3, mix: "only" });
  const w = (l: Ledger) => JSON.stringify(l.graph.connections.map((e) => e.weight));
  assert.notEqual(w(taught.ledger), w(alone.ledger));
});

test("agent: the δ transform hears the teacher per action, as teacher/<action>", () => {
  const channels = new Set<string | undefined>();
  live({ policy: () => command(0, 1), gain: 0.3, mix: "only" }, { deltaTransform: (d, _t, ch) => { channels.add(ch); return d; } });
  for (const a of ACTIONS) assert.ok(channels.has(`teacher/${a}`), `teacher/${a} never passed the transform`);
});

test("agent: with the teacher alone, reward teaches nothing — a silent teacher leaves the brain as born", () => {
  const { ledger } = live({ policy: () => command(0, 1), gain: 0, mix: "only" });
  assert.equal(ledger.entries.filter((e) => e.kind === "weight").length, 0);
});
