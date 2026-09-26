// brain-lab/learning/growth.test.ts — the growing food memory (TASARIM-008 §5, A2): a memory neuron is born where
// food is seen and nothing is remembered, confirmed when it is seen there again, faded by surprise or by time, and
// killed when its food is eaten, when it fades below the floor or when the room changes. Every change is on the
// ledger and in the live brain at once. Every case starts from a fresh ledger and a fresh memory.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { BrainGrafi } from "../brain-ir/ir.ts";
import { bornGraph } from "../development/index.ts";
import { CONDITIONS, ROOM3 } from "../experiments/conditions.ts";
import type { Pose } from "../memory/index.ts";
import { Ledger, graphHash } from "../registry/index.ts";
import { checkPathways } from "../regions/index.ts";
import { sensorimotorScaffold } from "../sensorimotor/index.ts";
import { DEFAULT_CONFIG as C, Rng, Room, runEpisode, type Observation, type Ray } from "../world/index.ts";
import { DEFAULT_GROWTH, FoodMemory, createAgent, type AgentSpec, type GrowthParams } from "./index.ts";

const R_FOOD = C.foodRadius;
const AHEAD = C.rayAngles.indexOf(0);

function fresh(params: Partial<GrowthParams> = {}) {
  const ledger = new Ledger("DNK-0001", sensorimotorScaffold(C, "growth-test"));
  const graph: BrainGrafi = structuredClone(ledger.graph);
  return { ledger, graph, food: new FoodMemory(ledger, graph, C, params) };
}
const at = (x = 0, y = 0, heading = 0): Pose => ({ x, y, heading, side: 0, sigma: 0 });
/** Rays seeing food on the given rays at the given distances; every other ray sees `rest`. */
function seeing(food: Record<number, number>, energy = 0.5, rest: Ray = { distance: C.rayRange, hit: "none" }): Observation {
  const rays = C.rayAngles.map((_, i): Ray => (i in food ? { distance: food[i]!, hit: "food" } : rest));
  return { rays, bump: false, energy, health: 1, motion: { forward: 0, turn: 0 } };
}
/** Every ray stopped at 0.3 m by a wall: nothing seen, no place looked at. */
const blind = (energy = 0.5): Observation => seeing({}, energy, { distance: 0.3, hit: "wall" });
const kinds = (ledger: Ledger) => ledger.entries.map((e) => e.kind);

// --- birth ---------------------------------------------------------------------------------------------------------

test("food seen where nothing is remembered: a memory neuron is born at the food's centre, on the ledger and in the brain", () => {
  const { ledger, graph, food } = fresh();
  food.step(seeing({ [AHEAD]: 2 }), at(), 0, 1);
  assert.deepEqual(food.live.map((m) => m.id), ["mem.food.1"]);
  assert.deepEqual(food.live[0]!.memory, { what: "food", x: 2 + R_FOOD, y: 0, strength: 0.5, updated: 0, sightings: 1, born: 0, confirmed: 0 });
  assert.deepEqual(kinds(ledger), ["node+"]);
  assert.ok(ledger.matches(graph));
});

test("the place is where the pose says the body is, turned by where it looks", () => {
  const { food } = fresh();
  food.step(seeing({ [AHEAD]: 1 }), at(3, 4, Math.PI / 2), 0, 1); // facing +y
  const m = food.live[0]!.memory;
  assert.ok(Math.abs(m.x - 3) < 1e-12 && Math.abs(m.y - (4 + 1 + R_FOOD)) < 1e-12, `(${m.x}, ${m.y})`);
});

test("two rays seeing the same food make one memory", () => {
  const { food } = fresh();
  food.step(seeing({ [AHEAD]: 0.5, [AHEAD + 1]: 0.5 }), at(), 0, 1); // points 0.39 m apart
  assert.equal(food.live.length, 1);
});

test("food seen farther than the vigilance from every memory is a new memory", () => {
  const { food } = fresh();
  food.step(seeing({ [AHEAD]: 2, [AHEAD + 1]: 2 }), at(), 0, 1); // points 1.16 m apart
  assert.deepEqual(food.live.map((m) => m.id), ["mem.food.1", "mem.food.2"]);
});

// --- confirmation ----------------------------------------------------------------------------------------------------

test("food seen there again within the gap writes nothing: the same look is not new evidence", () => {
  const { ledger, food } = fresh();
  food.step(seeing({ [AHEAD]: 2 }), at(), 0, 1);
  for (let t = 1; t < DEFAULT_GROWTH.confirmGap; t++) food.step(seeing({ [AHEAD]: 2.05 }), at(), t, 1);
  assert.deepEqual(kinds(ledger), ["node+"]);
});

test("food seen there again after the gap confirms the memory: strength up, place averaged, last confirmation moved", () => {
  const { ledger, food } = fresh();
  food.step(seeing({ [AHEAD]: 2 }), at(), 0, 1);
  const t = DEFAULT_GROWTH.confirmGap;
  food.step(seeing({ [AHEAD]: 2.05 }), at(), t, 1);
  const w = 0.5 * (1 - DEFAULT_GROWTH.timeFade) ** t; // faded since birth, then confirmed
  const m = food.live[0]!.memory;
  assert.ok(Math.abs(m.strength - (w + DEFAULT_GROWTH.confirmRate * (1 - w))) < 1e-15, `strength ${m.strength}`);
  assert.ok(Math.abs(m.x - (2 + R_FOOD + 0.05 / 2)) < 1e-12, `x ${m.x}`);
  assert.equal(m.sightings, 2);
  assert.equal(m.confirmed, t);
  assert.equal(m.born, 0);
  assert.deepEqual(kinds(ledger), ["node+", "memory"]);
});

test("the place averages at most maxSightings sightings: beyond that each sighting still moves it by 1/maxSightings", () => {
  const { food } = fresh({ maxSightings: 2 });
  const gap = DEFAULT_GROWTH.confirmGap;
  food.step(seeing({ [AHEAD]: 2 }), at(), 0, 1); // x = 2.25
  food.step(seeing({ [AHEAD]: 2.1 }), at(), gap, 1); // (2.25 + 2.35) / 2 = 2.30
  food.step(seeing({ [AHEAD]: 2.2 }), at(), 2 * gap, 1); // 2.30 + (2.45 − 2.30) / 2 = 2.375
  const m = food.live[0]!.memory;
  assert.equal(m.sightings, 2);
  assert.ok(Math.abs(m.x - 2.375) < 1e-12, `x ${m.x}`);
});

// --- fading and death -------------------------------------------------------------------------------------------------

test("surprises within the gap count once: looking at the empty place every tick weakens the memory every 5 ticks", () => {
  const { ledger, food } = fresh();
  food.step(seeing({ [AHEAD]: 2 }), at(), 0, 1);
  for (let t = 1; t < DEFAULT_GROWTH.surpriseGap; t++) food.step(seeing({}), at(), t, 1);
  assert.deepEqual(kinds(ledger), ["node+"], "no surprise within the gap after birth");
  food.step(seeing({}), at(), DEFAULT_GROWTH.surpriseGap, 1);
  assert.deepEqual(kinds(ledger), ["node+", "memory"]);
});

test("a remembered place behind the body is never looked at, whatever the rays see ahead", () => {
  const { ledger, food } = fresh();
  food.step(seeing({ [AHEAD]: 2 }), at(), 0, 1); // remembered at (2.25, 0)
  food.step(seeing({}), at(4.5, 0), 10, 1); // now 2.25 m past it, facing away
  assert.deepEqual(kinds(ledger), ["node+"]);
});

test("a ray must see clearly past the food's far edge: seeing a wall just behind the remembered centre is no surprise", () => {
  const { ledger, food } = fresh();
  food.step(seeing({ [AHEAD]: 2 }), at(), 0, 1); // centre remembered at 2.25
  food.step(seeing({}, 0.5, { distance: 2.25 + 0.1, hit: "wall" }), at(), 10, 1); // within the food's radius beyond the centre
  assert.deepEqual(kinds(ledger), ["node+"]);
});

test("a memory seen this tick but not confirmed (inside the gap) is not refuted by another ray passing near it", () => {
  const { ledger, food } = fresh({ surpriseRadius: 0.5 });
  food.step(seeing({ [AHEAD]: 0.5 }), at(), 0, 1); // remembered at (0.75, 0)
  // Tick 6: past the surprise gap, inside the confirmation gap. The ahead ray sees the food again; the 30° ray passes
  // 0.375 m from the place (within this test's 0.5 m radius) and sees beyond.
  food.step(seeing({ [AHEAD]: 0.5 }), at(), 6, 1);
  assert.deepEqual(kinds(ledger), ["node+"]);
});

test("energy unchanged is no meal", () => {
  const { food } = fresh();
  food.step(seeing({ [AHEAD]: 0.75 }, 0.5), at(), 0, 1);
  food.step(blind(0.5), at(1, 0), 1, 1);
  assert.equal(food.live.length, 1);
});

test("a meal with every memory out of reach kills nothing", () => {
  const { food } = fresh();
  food.step(seeing({ [AHEAD + 2]: 2.75 }, 0.5), at(), 0, 1); // 3 m out at 60°
  food.step(blind(0.8), at(0.5, 0), 1, 1);
  assert.equal(food.live.length, 1);
});

test("surprise: a ray that looks through the remembered place and sees beyond it weakens the memory, and three looks kill it", () => {
  const { ledger, food } = fresh();
  food.step(seeing({ [AHEAD]: 2 }), at(), 0, 1);
  const gap = DEFAULT_GROWTH.surpriseGap;
  food.step(seeing({}), at(), gap, 1);
  food.step(seeing({}), at(), 2 * gap, 1);
  assert.equal(food.live.length, 1, "alive after two surprises");
  food.step(seeing({}), at(), 3 * gap, 1);
  assert.equal(food.live.length, 0, `dead after three surprises (tick ${3 * gap})`);
  assert.deepEqual(kinds(ledger), ["node+", "memory", "memory", "node-"]);
});

test("a ray stopped short of the remembered place (something in front) is no surprise", () => {
  const { ledger, food } = fresh();
  food.step(seeing({ [AHEAD]: 2 }), at(), 0, 1);
  food.step(seeing({}, 0.5, { distance: 1, hit: "wall" }), at(), 10, 1);
  assert.deepEqual(kinds(ledger), ["node+"]);
});

test("a ray passing wide of the remembered place is no surprise", () => {
  const { ledger, food } = fresh();
  food.step(seeing({ [AHEAD]: 2 }), at(), 0, 1);
  food.step(seeing({}), at(0, 0, Math.PI / 12), 10, 1); // rays now 15° off the place: 0.58 m wide of it
  assert.deepEqual(kinds(ledger), ["node+"]);
});

test("a memory never confirmed nor refuted fades with time and dies at the floor, with nothing written in between", () => {
  const { ledger, food } = fresh();
  food.step(seeing({ [AHEAD]: 2 }), at(), 0, 1);
  const dies = Math.ceil(Math.log(DEFAULT_GROWTH.floor / 0.5) / Math.log(1 - DEFAULT_GROWTH.timeFade)); // 1609
  for (let t = 1; t < dies; t++) food.step(blind(), at(), t, 1);
  assert.equal(food.live.length, 1, `alive at tick ${dies - 1}`);
  food.step(blind(), at(), dies, 1);
  assert.equal(food.live.length, 0, `dead at tick ${dies}`);
  assert.deepEqual(kinds(ledger), ["node+", "node-"]);
});

test("a meal kills the memory nearest the body, within reach; a memory out of reach survives", () => {
  const { food } = fresh();
  food.step(seeing({ [AHEAD]: 0.75, [AHEAD + 2]: 2.75 }, 0.5), at(), 0, 1); // (1, 0) and 3 m out at 60°
  assert.equal(food.live.length, 2);
  food.step(blind(0.8), at(0.5, 0), 1, 1); // energy rose: a meal, 0.5 m from the first memory
  assert.deepEqual(food.live.map((m) => m.id), ["mem.food.2"]);
});

test("without a meal, a body standing on a remembered place does not kill it", () => {
  const { food } = fresh();
  food.step(seeing({ [AHEAD]: 0.75 }, 0.5), at(), 0, 1);
  food.step(blind(0.49), at(1, 0), 1, 1); // energy fell: no meal
  assert.equal(food.live.length, 1);
});

test("a new room: every memory dies (K6)", () => {
  const { ledger, graph, food } = fresh();
  food.step(seeing({ [AHEAD]: 2, [AHEAD + 1]: 2 }), at(), 0, 1);
  const written = food.newRoom(0, 2);
  assert.equal(written.length, 2);
  assert.equal(food.live.length, 0);
  assert.ok(ledger.matches(graph));
});

test("births beyond the cap are refused and counted", () => {
  const { food } = fresh({ cap: 2 });
  food.step(seeing({ [AHEAD - 2]: 2, [AHEAD]: 2, [AHEAD + 2]: 2 }), at(), 0, 1);
  assert.equal(food.live.length, 2);
  assert.equal(food.refused, 1);
});

// --- the record ---------------------------------------------------------------------------------------------------------

test("memory neurons are numbered in birth order and never reused: after deaths, across rooms, after a reload", () => {
  const { ledger, graph, food } = fresh();
  food.step(seeing({ [AHEAD]: 2, [AHEAD + 1]: 2 }), at(), 0, 1);
  food.newRoom(0, 2);
  food.step(seeing({ [AHEAD]: 2 }), at(), 0, 2);
  assert.deepEqual(food.live.map((m) => m.id), ["mem.food.3"]);
  const reloaded = new FoodMemory(new Ledger("DNK-0001", sensorimotorScaffold(C, "growth-test"), ledger.entries), structuredClone(graph), C);
  reloaded.step(seeing({ [AHEAD + 1]: 2 }), at(), 1, 2);
  assert.deepEqual(reloaded.live.map((m) => m.id), ["mem.food.3", "mem.food.4"]);
});

test("over a whole random life the live brain equals the ledger after every step, and birth + ledger replays it", () => {
  const { ledger, graph, food } = fresh();
  const rng = new Rng(7);
  let energy = 0.5;
  for (let t = 0; t < 600; t++) {
    const seen: Record<number, number> = {};
    for (let i = 0; i < C.rayAngles.length; i++) if (rng.next() < 0.15) seen[i] = 0.4 + 4 * rng.next();
    energy += rng.next() < 0.02 ? 0.3 : -0.001;
    food.step(seeing(seen, energy), at(4 * rng.next() - 2, 4 * rng.next() - 2, 2 * Math.PI * rng.next()), t, 1);
    assert.ok(ledger.matches(graph), `tick ${t}`);
  }
  assert.ok(ledger.entries.length > 50, `${ledger.entries.length} entries: the life was not quiet`);
  assert.equal(new Ledger("DNK-0001", sensorimotorScaffold(C, "growth-test"), ledger.entries).hash(), graphHash(graph));
});

test("growth happens only in the memory region, and the grown brain still keeps its regions", () => {
  const { graph, food } = fresh();
  food.step(seeing({ [AHEAD]: 2, [AHEAD + 1]: 2 }), at(), 0, 1);
  const born = graph.nodes.filter((n) => n.type === "memory");
  assert.ok(born.length === 2 && born.every((n) => /^mem\.food\.\d+$/.test(n.id)));
  assert.doesNotThrow(() => checkPathways(graph));
});

test("bad growth parameters are refused", () => {
  const bad: [string, Partial<GrowthParams>][] = [
    ["negative vigilance", { vigilance: -1 }], ["NaN floor", { floor: Number.NaN }],
    ["birth below the floor", { birthStrength: 0.05 }], ["birth above 1", { birthStrength: 1.5 }],
    ["confirm rate above 1", { confirmRate: 2 }], ["fractional cap", { cap: 2.5 }], ["no sightings", { maxSightings: 0 }],
  ];
  for (const [why, p] of bad) assert.throws(() => fresh(p), RangeError, why);
});

// --- in a living subject (agent.ts) ------------------------------------------------------------------------------------

const K1N = CONDITIONS.K1n!;
const ROOM = K1N.world ?? ROOM3;

/** One subject living `rooms` rooms from birth, with or without the growing memory. */
function lifeOf(memory: AgentSpec["memory"], frozen = false, rooms = 2) {
  const spec = K1N.spec(ROOM);
  const ledger = new Ledger("DNK-0001", bornGraph(ROOM, { seed: 3, group: "reflexless" }));
  const agent = createAgent({ ...spec, cfg: ROOM, ledger, noiseSeed: 11, memory, learning: { ...spec.learning, frozen } });
  const hashes: string[] = [];
  let mostAlive = 0;
  for (let ep = 1; ep <= rooms; ep++) {
    agent.startEpisode(ep);
    const policy = (obs: Observation, t: number) => {
      const a = agent.policy(obs, t);
      mostAlive = Math.max(mostAlive, agent.memory?.food.live.length ?? 0);
      return a;
    };
    hashes.push(runEpisode(new Room(100 + ep, ROOM), policy, 3000, false, agent.hooks).finalHash);
    agent.finishEpisode(0);
  }
  return { ledger, agent, hashes, mostAlive };
}
const GROWTH = new Set(["node+", "node-", "memory"]);
const learningEntries = (l: Ledger) => l.entries.filter((e) => !GROWTH.has(e.kind)).map(({ id: _id, ...rest }) => rest);

test("a subject with the growing memory lives exactly the same life (it grows, it does not act)", () => {
  assert.deepEqual(lifeOf({}).hashes, lifeOf(null).hashes);
});

test("a subject with the growing memory learns exactly the same weights (growth adds entries, changes none)", () => {
  assert.deepEqual(learningEntries(lifeOf({}).ledger), learningEntries(lifeOf(null).ledger));
});

test("a subject with the growing memory grows memories, and its ledger replays to its live brain, memories included", () => {
  const { ledger, agent, mostAlive } = lifeOf({});
  assert.ok(ledger.entries.some((e) => e.kind === "node+"), "memories were born");
  assert.ok(mostAlive > 0, "and lived");
  assert.ok(ledger.matches(agent.graph));
  assert.equal(new Ledger("DNK-0001", bornGraph(ROOM, { seed: 3, group: "reflexless" }), ledger.entries).hash(), ledger.hash());
});

test("a subject whose learning is frozen still forms memories (memory is the core's job, not reflex learning)", () => {
  const { ledger } = lifeOf({}, true);
  assert.ok(ledger.entries.some((e) => e.kind === "node+"));
  assert.ok(!ledger.entries.some((e) => e.kind === "weight"), "and learns no weights");
});

test("a subject starts every room with no place memories, and switched off it grows none", () => {
  const { agent } = lifeOf({}, false, 1);
  agent.startEpisode(2);
  assert.equal(agent.memory!.food.live.length, 0);
  assert.equal(lifeOf(null, false, 1).agent.memory, null);
});
