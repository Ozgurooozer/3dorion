// brain-lab/learning/recall.test.ts — the gate and the one-step recall (TASARIM-008 §16, A3): the gate opens only when
// hungry and blind to food, the strongest-and-nearest memory is recalled onto the ray angle nearest its bearing, and in a
// living subject the recalled senses reach selection only through rule synapses. Every case starts from fresh state.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { MemoryRecord } from "../brain-ir/ir.ts";
import { bornGraph } from "../development/index.ts";
import { CONDITIONS, ROOM3 } from "../experiments/conditions.ts";
import type { Pose } from "../memory/index.ts";
import { Ledger } from "../registry/index.ts";
import { DEFAULT_CONFIG as C, Room, runEpisode, type Observation, type Ray } from "../world/index.ts";
import {
  DEFAULT_RECALL, createAgent, gateOpen, nearestRay, recallFood, recallNodeIds, recalledSenses, signedAngle,
  type AgentSpec, type LiveMemory,
} from "./index.ts";

const DEG = Math.PI / 180;
const at = (x = 0, y = 0, heading = 0): Pose => ({ x, y, heading, side: 0, sigma: 0 });
const memory = (id: string, x: number, y: number, strength: number): LiveMemory => ({
  id, memory: { what: "food", x, y, strength, updated: 0, sightings: 1, born: 0, confirmed: 0 },
});
const asStored = (m: MemoryRecord) => m.strength;
const view = (energy: number, food: boolean): Observation => ({
  rays: C.rayAngles.map((_, i): Ray => (food && i === 2 ? { distance: 1, hit: "food" } : { distance: C.rayRange, hit: "none" })),
  bump: false, energy, health: 1, motion: { forward: 0, turn: 0 },
});

// --- the gate --------------------------------------------------------------------------------------------------------

test("the gate's hunger threshold is the meeting's choice: 0.2", () => {
  assert.equal(DEFAULT_RECALL.hunger, 0.2);
});

test("the gate opens exactly when hunger reaches the threshold and no ray sees food (grid, exact binary values)", () => {
  // 1 − 0.75 and 1 − 0.5 are exact in binary, so the edge (hunger equal to the threshold) is tested as written.
  for (const energy of [1, 0.75, 0.5]) {
    for (const threshold of [0, 0.25, 0.5]) {
      for (const food of [false, true]) {
        const expected = 1 - energy >= threshold && !food;
        assert.equal(gateOpen(view(energy, food), threshold), expected, `energy ${energy}, threshold ${threshold}, food ${food}`);
      }
    }
  }
});

// --- angles ----------------------------------------------------------------------------------------------------------

test("a signed angle is in [−π, π) and differs from the given one by whole turns (grid)", () => {
  for (const a of [-3 * Math.PI, -Math.PI - 0.1, -Math.PI, -1, 0, 1, Math.PI - 1e-9, Math.PI, 3 * Math.PI, 7, -7]) {
    const s = signedAngle(a);
    assert.ok(s >= -Math.PI && s < Math.PI, `${a} → ${s}`);
    const turns = (a - s) / (2 * Math.PI);
    assert.ok(Math.abs(turns - Math.round(turns)) < 1e-12, `${a} − ${s} is ${turns} turns`);
  }
});

test("a bearing falls on the nearest ray angle; past the outer rays, on the outer ray of its side", () => {
  const cases: [number, number][] = [[0, 2], [30, 3], [60, 4], [90, 4], [179, 4], [-30, 1], [-60, 0], [-90, 0], [-179, 0], [10, 2], [-20, 1]];
  for (const [deg, ray] of cases) assert.equal(nearestRay(deg * DEG, C), ray, `${deg}°`);
});

test("a bearing exactly between two rays goes to the first of them", () => {
  assert.equal(nearestRay(C.rayAngles[3]! / 2, C), 2, "halfway between the middle ray and the first left ray");
});

// --- the recall ------------------------------------------------------------------------------------------------------

test("no memory, nothing recalled", () => {
  assert.equal(recallFood([], at(), asStored, C), null);
});

test("a memory at a ray's full reach or beyond is not recalled; just inside it is", () => {
  assert.equal(recallFood([memory("mem.food.1", C.rayRange, 0, 1)], at(), asStored, C), null);
  assert.equal(recallFood([memory("mem.food.1", C.rayRange + 1, 0, 1)], at(), asStored, C), null);
  assert.equal(recallFood([memory("mem.food.1", C.rayRange - 0.01, 0, 1)], at(), asStored, C)?.id, "mem.food.1");
});

test("the recalled memory has the largest strength × proximity, not the strongest nor the nearest alone", () => {
  // strong and far: 1 × (1 − 4/5) = 0.2 · weak and near: 0.5 × (1 − 1/5) = 0.4 · middling: 0.9 × (1 − 0.5/5) = 0.81
  const strongFar = memory("mem.food.1", 4, 0, 1);
  const weakNear = memory("mem.food.2", 0, 1, 0.5);
  assert.equal(recallFood([strongFar, weakNear], at(), asStored, C)!.id, "mem.food.2");
  const r = recallFood([strongFar, weakNear, memory("mem.food.3", 0, -0.5, 0.9)], at(), asStored, C)!;
  assert.equal(r.id, "mem.food.3");
  assert.ok(Math.abs(r.value - 0.81) < 1e-12, `value ${r.value}`);
});

test("of two memories with the same value, the first in birth order is recalled", () => {
  const r = recallFood([memory("mem.food.1", 2, 0, 0.5), memory("mem.food.2", 0, 2, 0.5)], at(), asStored, C)!;
  assert.equal(r.id, "mem.food.1");
});

test("where a memory lies from the pose: ahead, left, right, behind (behind is −π: the outer right ray)", () => {
  const where = (x: number, y: number) => recallFood([memory("mem.food.1", x, y, 1)], at(), asStored, C)!;
  assert.deepEqual([where(2, 0).ray, where(0, 2).ray, where(0, -2).ray, where(-2, 0).ray], [2, 4, 0, 0]);
  assert.ok(Math.abs(where(0, 2).bearing - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(where(-2, 0).bearing + Math.PI) < 1e-12, `behind: ${where(-2, 0).bearing}`);
  assert.ok(Math.abs(where(0, 2).distance - 2) < 1e-12);
});

test("the pose's heading turns the frame: facing left, a memory to the left is straight ahead", () => {
  const r = recallFood([memory("mem.food.1", 0, 2, 1)], at(0, 0, Math.PI / 2), asStored, C)!;
  assert.equal(r.ray, 2);
  assert.ok(Math.abs(r.bearing) < 1e-12, `bearing ${r.bearing}`);
});

test("the pose's place moves the frame: a memory 1 m ahead of the pose is 1 m away", () => {
  const r = recallFood([memory("mem.food.1", 4, 3, 1)], at(3, 3, 0), asStored, C)!;
  assert.ok(Math.abs(r.distance - 1) < 1e-12);
  assert.equal(r.ray, 2);
});

test("the strength used is the one given for now (time fading), not the stored one", () => {
  const halved = (m: MemoryRecord) => m.strength / 2;
  const full = recallFood([memory("mem.food.1", 1, 0, 0.8)], at(), asStored, C)!.value;
  const faded = recallFood([memory("mem.food.1", 1, 0, 0.8)], at(), halved, C)!.value;
  assert.ok(Math.abs(faded - full / 2) < 1e-12, `${faded} vs ${full}`);
});

test("the recalled senses: nothing recalled, every rec node 0; recalled, only its ray's node carries its value", () => {
  const ids = recallNodeIds(C);
  assert.deepEqual(ids, ["rec0.food", "rec1.food", "rec2.food", "rec3.food", "rec4.food"]);
  assert.deepEqual(recalledSenses(null, C), Object.fromEntries(ids.map((id) => [id, 0])));
  const left = recallFood([memory("mem.food.1", 0, 2, 1)], at(), asStored, C)!;
  assert.deepEqual(recalledSenses(left, C), { ...Object.fromEntries(ids.map((id) => [id, 0])), "rec4.food": left.value }, "the outer left ray");
  const ahead = recallFood([memory("mem.food.1", 2, 0, 1)], at(), asStored, C)!;
  assert.deepEqual(recalledSenses(ahead, C), { ...Object.fromEntries(ids.map((id) => [id, 0])), "rec2.food": ahead.value }, "the middle ray");
});

// --- in a living subject (agent.ts) ----------------------------------------------------------------------------------

const K1N = CONDITIONS.K1n!;
const ROOM = K1N.world ?? ROOM3;

/** One subject of the scarce room living `rooms` rooms from birth; `edit` may change its birth graph (a labelled fixture). */
function lifeOf(opts: { memory: AgentSpec["memory"]; recall?: "grown" | "innate0" | null; frozen?: boolean; rooms?: number; edit?: (g: ReturnType<typeof bornGraph>) => void; watch?: (agent: ReturnType<typeof createAgent>, obs: Observation) => void }) {
  const spec = K1N.spec(ROOM);
  const recall = opts.recall === "grown" ? { rules: "grown" as const } : opts.recall === "innate0" ? { rules: "innate" as const, maxInitial: 0 } : null;
  const birth = bornGraph(ROOM, { seed: 3, group: "reflexless", recall });
  opts.edit?.(birth);
  const ledger = new Ledger("DNK-0001", birth);
  const agent = createAgent({ ...spec, cfg: ROOM, ledger, noiseSeed: 11, memory: opts.memory, learning: { ...spec.learning, frozen: opts.frozen ?? false } });
  const hashes: string[] = [];
  for (let ep = 1; ep <= (opts.rooms ?? 2); ep++) {
    agent.startEpisode(ep);
    const policy = (obs: Observation, t: number) => { const a = agent.policy(obs, t); opts.watch?.(agent, obs); return a; };
    hashes.push(runEpisode(new Room(100 + ep, ROOM), policy, 3000, false, agent.hooks).finalHash);
    agent.finishEpisode(0);
  }
  return { ledger, agent, hashes };
}
const withoutIds = (l: Ledger) => l.entries.map(({ id: _id, ...rest }) => rest);

test("recall on, no rule synapse: the subject lives exactly the life it lived without recall", () => {
  assert.deepEqual(lifeOf({ memory: { recall: {} }, recall: "grown" }).hashes, lifeOf({ memory: {} }).hashes);
});

test("recall on, no rule synapse: the subject learns and grows exactly what it did without recall", () => {
  assert.deepEqual(withoutIds(lifeOf({ memory: { recall: {} }, recall: "grown" }).ledger), withoutIds(lifeOf({ memory: {} }).ledger));
});

test("recall on, frozen innate rule synapses of weight 0: the same life as without recall", () => {
  assert.deepEqual(lifeOf({ memory: { recall: {} }, recall: "innate0", frozen: true }).hashes, lifeOf({ memory: {}, frozen: true }).hashes);
});

test("the subject's recall is the core's: on every tick the gate and the recalled memory are what recall.ts gives", () => {
  let ticks = 0, recalled = 0;
  lifeOf({
    memory: { recall: {} }, recall: "grown", rooms: 1,
    watch: (agent, obs) => {
      ticks++;
      const open = gateOpen(obs, DEFAULT_RECALL.hunger);
      assert.equal(agent.lastRecall!.open, open);
      const food = agent.memory!.food;
      const expected = open ? recallFood(food.live, agent.memory!.pose.pose, (m) => food.strengthAt(m, ticks - 1), ROOM) : null;
      assert.deepEqual(agent.lastRecall!.recalled, expected);
      if (expected) recalled++;
    },
  });
  assert.ok(recalled > 0, "the life recalled at least once (the check is not empty)");
});

test("a recalled sense reaches selection through its rule synapse: a strong rec4 → left makes every unexplored turn a left turn", () => {
  // Labelled fixture: rec4 (the outer left ray) → Go left at 5; every other rule synapse 0; learning frozen.
  let checked = 0;
  lifeOf({
    memory: { recall: {} }, recall: "innate0", frozen: true, rooms: 2,
    edit: (g) => { g.connections.find((e) => e.from === "rec4.food" && e.to === "bg.go.left")!.weight = 5; },
    watch: (agent) => {
      const r = agent.lastRecall!.recalled;
      const choice = agent.lastChoice!;
      if (!r || r.ray !== 4 || r.value < 0.2 || choice.explored[1]) return;
      checked++;
      assert.equal(choice.selected.left, 1, `recalled ${r.value.toFixed(3)} on the left, turned ${choice.selected.right ? "right" : "not at all"}`);
    },
  });
  assert.ok(checked > 0, "the fixture met a left recall at least once (the check is not empty)");
});

test("recall needs competitive selection and a gate threshold in [0, 1]", () => {
  const spec = K1N.spec(ROOM);
  const ledger = () => new Ledger("DNK-0001", bornGraph(ROOM, { seed: 3, group: "reflexless", recall: { rules: "grown" } }));
  assert.throws(() => createAgent({ ...spec, selection: null, cfg: ROOM, ledger: ledger(), noiseSeed: 11, memory: { recall: {} } }), /competitive selection/);
  for (const hunger of [-0.1, 1.1, Number.NaN]) {
    assert.throws(() => createAgent({ ...spec, cfg: ROOM, ledger: ledger(), noiseSeed: 11, memory: { recall: { hunger } } }), /gate hunger/, `hunger ${hunger}`);
  }
});

test("a new room: no recall before its first tick", () => {
  const { agent } = lifeOf({ memory: { recall: {} }, recall: "grown", rooms: 1 });
  assert.notEqual(agent.lastRecall, null);
  agent.startEpisode(2);
  assert.equal(agent.lastRecall, null);
});
