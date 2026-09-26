// brain-lab/experiments/recall-measures.test.ts — the A3.0 measures of memory use (recall-a3.ts): a recall episode is
// reached only by a meal at its target within the window, failed when the window passes or the body dies, left out
// when the room ends alive; the shares are pooled sums; the fixture is labelled and replays. Every case is fresh.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ledger } from "../registry/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { pathwayOf } from "../regions/index.ts";
import { Room } from "../world/index.ts";
import { condition } from "./conditions.ts";
import { TEST_SEED_FLOOR, birth, evalWorld } from "./harness.ts";
import { REACH_RADIUS, REACH_WINDOW, RecallEpisodes, aggregateRecall, countRecallTurn, fixtureLedger, gradeRecall, referenceRecallLives, type RecallLife } from "./recall-a3.ts";
import { FoodMemory } from "../learning/index.ts";
import { MemoryCore, PoseModule } from "../memory/index.ts";
import { sensorimotorScaffold } from "../sensorimotor/index.ts";
import { seekerPolicy } from "../baselines/index.ts";

const WORLD = condition("K1n").world!;

// --- the episode bookkeeping -----------------------------------------------------------------------------------------

test("a food eaten at the target within the window reaches the episode", () => {
  const e = new RecallEpisodes();
  e.start(10, { x: 2, y: 3 });
  e.eaten(50, 2.1, 3);
  e.tick(50);
  e.end(false);
  assert.deepEqual(e.counts, { episodes: 1, reached: 1, failed: 0, censored: 0 });
});

test("a meal exactly REACH_WINDOW ticks after the start still reaches it", () => {
  const e = new RecallEpisodes();
  e.start(10, { x: 2, y: 3 });
  e.tick(10 + REACH_WINDOW);
  e.eaten(10 + REACH_WINDOW, 2, 3);
  assert.equal(e.counts.reached, 1);
});

test("one tick past the window without a meal, the episode has failed, and a later meal changes nothing", () => {
  const e = new RecallEpisodes();
  e.start(10, { x: 2, y: 3 });
  e.tick(11 + REACH_WINDOW);
  e.eaten(12 + REACH_WINDOW, 2, 3);
  assert.deepEqual(e.counts, { episodes: 1, reached: 0, failed: 1, censored: 0 });
});

test("a food eaten farther than REACH_RADIUS from the target reaches nothing", () => {
  const e = new RecallEpisodes();
  e.start(10, { x: 2, y: 3 });
  e.eaten(20, 2 + REACH_RADIUS + 0.01, 3);
  e.end(false);
  assert.deepEqual(e.counts, { episodes: 1, reached: 0, failed: 0, censored: 1 });
});

test("the room ends with an episode open: alive, it is left out; dead, it failed", () => {
  const alive = new RecallEpisodes();
  alive.start(10, { x: 2, y: 3 });
  alive.end(false);
  assert.deepEqual(alive.counts, { episodes: 1, reached: 0, failed: 0, censored: 1 });
  const dead = new RecallEpisodes();
  dead.start(10, { x: 2, y: 3 });
  dead.end(true);
  assert.deepEqual(dead.counts, { episodes: 1, reached: 0, failed: 1, censored: 0 });
});

test("a meal one tick past the window is no reach, even before that tick's expiry is counted", () => {
  const e = new RecallEpisodes();
  e.start(10, { x: 2, y: 3 });
  e.eaten(11 + REACH_WINDOW, 2, 3);
  e.tick(11 + REACH_WINDOW);
  assert.deepEqual(e.counts, { episodes: 1, reached: 0, failed: 1, censored: 0 });
});

test("one meal reaches every open episode that aimed at the same food", () => {
  const e = new RecallEpisodes();
  e.start(10, { x: 2, y: 3 });
  e.start(30, { x: 2.2, y: 3 });
  e.eaten(40, 2.1, 3);
  assert.equal(e.counts.reached, 2);
});

// --- in a room ---------------------------------------------------------------------------------------------------------

test("a body that only turns in place sees and recalls food but never reaches it: every judged episode failed (5 rooms)", () => {
  let judged = 0, reached = 0;
  for (let ep = 1; ep <= 5; ep++) {
    const ledger = new Ledger("REF-still", sensorimotorScaffold(WORLD, "REF-still"));
    const pose = new PoseModule(WORLD);
    const core = new MemoryCore([pose]);
    const food = new FoodMemory(ledger, structuredClone(ledger.graph), WORLD);
    food.newRoom(0, ep);
    const { grade } = gradeRecall(new Room(evalWorld(1, ep), WORLD), (obs, t) => {
      core.observe(obs, t);
      food.step(obs, pose.pose, t, ep);
      return { action: { thrust: 0, turn: 1 }, live: food.live, pose: pose.pose, strength: (m) => food.strengthAt(m, t) };
    });
    assert.equal(grade.meals, 0, "it never eats");
    judged += grade.reached + grade.failed;
    reached += grade.reached;
  }
  assert.ok(judged > 0, "it recalled something (the check is not empty)");
  assert.equal(reached, 0);
});

test("a run of ticks with a memory recalled is one episode: two runs, two episodes", () => {
  // A still body in a room whose first view holds no food: the gate opens once hunger reaches 0.2 (after the first
  // tick) and stays open. The memory is scripted: one memory on ticks 10–19 and 30–39, none otherwise.
  const room = [...Array(20).keys()].map((i) => new Room(evalWorld(1, i + 1), WORLD)).find((r) => !r.observe().rays.some((ray) => ray.hit === "food"))!;
  const m = { id: "mem.food.1", memory: { what: "food" as const, x: 1, y: 0, strength: 1, updated: 0, sightings: 1, born: 0, confirmed: 0 } };
  const shown = (t: number) => (t >= 10 && t < 20) || (t >= 30 && t < 40);
  const { grade } = gradeRecall(room, (_obs, t) => ({
    action: { thrust: 0, turn: 0 }, live: shown(t) ? [m] : [], pose: { x: 0, y: 0, heading: 0, side: 0, sigma: 0 }, strength: (r) => r.strength,
  }));
  assert.equal(grade.recallTicks, 20);
  assert.equal(grade.episodes, 2);
  // Tick 0 is not hungry: 1 − 0.8 is 0.19999999999999996 in floating point. Every later tick is hungry and blind.
  assert.equal(grade.gateTicks, grade.ticks - 1);
});

test("the target is placed in the true room: a body that turns and walks to the food it recalls reaches it", () => {
  // Every room starts the body in its middle facing +x. A room with no food in view and one food on the line straight
  // behind: the memory is scripted there in the body's start frame, recalled on tick 5 only (the gate is open: hungry
  // after tick 0, nothing seen). The body stands until then, turns half a circle (20 ticks of π rad/s × 0.05 s), then
  // walks: it passes over the food, so the meal lands on the target only if the target was put in the true room.
  const found = [...Array(300).keys()].map((i) => new Room(evalWorld(1, i + 1), WORLD)).map((room) => {
    const b = room.state().body;
    const food = room.state().entities.find((e) => {
      if (e.kind !== "food") return false;
      const ahead = (e.x - b.x) * Math.cos(b.heading) + (e.y - b.y) * Math.sin(b.heading);
      const side = -(e.x - b.x) * Math.sin(b.heading) + (e.y - b.y) * Math.cos(b.heading);
      return ahead < -1 && Math.abs(side) < 0.4; // behind, and within the body's reach sideways (0.3 + 0.25 m)
    });
    return food && !room.observe().rays.some((r) => r.hit === "food") ? { room, b, food } : null;
  }).find((x) => x !== null);
  assert.ok(found, "a room with such a food exists among the first 300");
  const { room, b, food } = found!;
  const m = { id: "mem.food.1", memory: { what: "food" as const, x: food.x - b.x, y: food.y - b.y, strength: 1, updated: 0, sightings: 1, born: 0, confirmed: 0 } };
  assert.equal(b.heading, 0, "the start frame is the room's, shifted: heading 0");
  const { grade } = gradeRecall(room, (_obs, t) => ({
    action: t <= 5 ? { thrust: 0, turn: 0 } : t <= 25 ? { thrust: 0, turn: 1 } : { thrust: 1, turn: 0 },
    live: t === 5 ? [m] : [], pose: { x: 0, y: 0, heading: 0, side: 0, sigma: 0 }, strength: (r) => r.strength,
  }));
  assert.equal(grade.episodes, 1);
  assert.equal(grade.reached, 1);
});

test("the meals counted are the room's own: a seeker's meals equal the food it ate", () => {
  const ledger = new Ledger("REF-seeker", sensorimotorScaffold(WORLD, "REF-seeker"));
  const pose = new PoseModule(WORLD);
  const core = new MemoryCore([pose]);
  const food = new FoodMemory(ledger, structuredClone(ledger.graph), WORLD);
  food.newRoom(0, 1);
  const seeker = seekerPolicy(WORLD, 10);
  const { summary, grade } = gradeRecall(new Room(evalWorld(1, 1), WORLD), (obs, t) => {
    core.observe(obs, t);
    food.step(obs, pose.pose, t, 1);
    return { action: seeker(obs, t), live: food.live, pose: pose.pose, strength: (r) => food.strengthAt(r, t) };
  });
  assert.ok(summary.foodEaten > 0, "the seeker ate (the check is not empty)");
  assert.equal(grade.meals, summary.foodEaten);
});

test("the recall measurement refuses a test seed for its reference bodies", () => {
  assert.throws(() => referenceRecallLives({ still: () => () => ({ thrust: 0, turn: 0 }) }, WORLD, [TEST_SEED_FLOOR]), /test seed/);
});

test("the shares are pooled sums, not means of per-room shares", () => {
  const steer = { leftSeen: 0, rightSeen: 0, leftTurnWhenLeft: 0, rightTurnWhenLeft: 0, leftTurnWhenRight: 0, rightTurnWhenRight: 0 };
  const life = (ticks: number, gateTicks: number, recallTicks: number, reached: number, failed: number): RecallLife => ({
    ticks, gateTicks, recallTicks, episodes: reached + failed + 1, reached, failed, censored: 1, meals: 2, died: false, steer, body: "x", subject: null, seed: 1, room: 1,
  });
  const a = aggregateRecall([life(100, 50, 25, 1, 0), life(300, 50, 50, 1, 3)]);
  assert.equal(a.gateShare, 100 / 400);
  assert.equal(a.recallShare, 75 / 100);
  assert.equal(a.reachShare, 2 / 5);
  assert.equal(a.judged, 5);
  assert.equal(a.censored, 2);
  assert.equal(a.episodesPerK, (1000 * 7) / 400);
  assert.equal(a.mealsPerK, (1000 * 4) / 400);
});

// --- recall steering (G6m) ---------------------------------------------------------------------------------------------

test("a recall tick counts its side and turn: left and right sides with every turn, the middle ray never (grid)", () => {
  for (const side of ["left", "right", "forward"] as const) {
    for (const turn of [-1, 0, 1]) {
      const c = { leftSeen: 0, rightSeen: 0, leftTurnWhenLeft: 0, rightTurnWhenLeft: 0, leftTurnWhenRight: 0, rightTurnWhenRight: 0 };
      countRecallTurn(c, side, turn);
      const expected = {
        leftSeen: side === "left" ? 1 : 0, rightSeen: side === "right" ? 1 : 0,
        leftTurnWhenLeft: side === "left" && turn > 0 ? 1 : 0, rightTurnWhenLeft: side === "left" && turn < 0 ? 1 : 0,
        leftTurnWhenRight: side === "right" && turn > 0 ? 1 : 0, rightTurnWhenRight: side === "right" && turn < 0 ? 1 : 0,
      };
      assert.deepEqual(c, expected, `${side}, turn ${turn}`);
    }
  }
});

/**
 * A body that only moves on the scripted ticks, with a scripted memory: left of the pose on ticks 10–11, right on 30–31.
 * Its turns there (9° a tick) keep it within 36° of where it started, so the room is one where no food lies within a
 * ray's reach within 100° of the start heading: no food comes into view and the gate stays open.
 */
function scriptedSides(turn: (memorySide: "left" | "right" | null) => number) {
  const reach = WORLD.rayRange + WORLD.foodRadius;
  const room = [...Array(300).keys()].map((i) => new Room(evalWorld(1, i + 1), WORLD)).find((r) => {
    const b = r.state().body;
    return r.state().entities.filter((e) => e.kind === "food").every((e) => {
      const bearing = Math.atan2(e.y - b.y, e.x - b.x) - b.heading;
      return Math.hypot(e.x - b.x, e.y - b.y) > reach || Math.abs(Math.atan2(Math.sin(bearing), Math.cos(bearing))) > (100 * Math.PI) / 180;
    });
  });
  assert.ok(room, "a room with no food within reach within 100° of the start heading exists among the first 300");
  const at = (y: number) => ({ id: "mem.food.1", memory: { what: "food" as const, x: 0, y, strength: 1, updated: 0, sightings: 1, born: 0, confirmed: 0 } });
  const side = (t: number) => (t >= 10 && t < 12 ? "left" : t >= 30 && t < 32 ? "right" : null);
  return gradeRecall(room!, (_obs, t) => {
    const s = side(t);
    return { action: { thrust: 0, turn: turn(s) }, live: s === "left" ? [at(1)] : s === "right" ? [at(-1)] : [], pose: { x: 0, y: 0, heading: 0, side: 0, sigma: 0 }, strength: (r) => r.strength };
  }).grade;
}

test("recall steering: turning toward the recalled side every time scores exactly 1", () => {
  const g = scriptedSides((s) => (s === "left" ? 1 : s === "right" ? -1 : 0));
  assert.equal(g.steer.leftSeen, 2);
  assert.equal(g.steer.rightSeen, 2);
  assert.equal(aggregateRecall([{ ...g, body: "x", subject: null, seed: 1, room: 1 }]).steering, 1);
});

test("recall steering: a habit of turning left whatever is recalled scores exactly 0", () => {
  const g = scriptedSides((s) => (s === null ? 0 : 1));
  assert.equal(g.steer.leftSeen + g.steer.rightSeen, 4, "every scripted recall was counted");
  assert.equal(aggregateRecall([{ ...g, body: "x", subject: null, seed: 1, room: 1 }]).steering, 0);
});

test("recall steering: turning away from the recalled side every time scores exactly −1", () => {
  const g = scriptedSides((s) => (s === "left" ? -1 : s === "right" ? 1 : 0));
  assert.equal(aggregateRecall([{ ...g, body: "x", subject: null, seed: 1, room: 1 }]).steering, -1);
});

test("recall steering pools counts over lives: one life's left recalls and another's right ones make one index", () => {
  const leftOnly = { leftSeen: 4, rightSeen: 0, leftTurnWhenLeft: 4, rightTurnWhenLeft: 0, leftTurnWhenRight: 0, rightTurnWhenRight: 0 };
  const rightOnly = { leftSeen: 0, rightSeen: 4, leftTurnWhenLeft: 0, rightTurnWhenLeft: 0, leftTurnWhenRight: 0, rightTurnWhenRight: 4 };
  const life = (steer: typeof leftOnly): RecallLife => ({ ticks: 10, gateTicks: 5, recallTicks: 4, episodes: 1, reached: 0, failed: 0, censored: 1, meals: 0, died: false, steer, body: "x", subject: null, seed: 1, room: 1 });
  assert.equal(aggregateRecall([life(leftOnly)]).steering, null, "one side alone has no index");
  assert.equal(aggregateRecall([life(leftOnly), life(rightOnly)]).steering, 1);
});

// --- the labelled fixture --------------------------------------------------------------------------------------------

test("the fixture adds the recalled senses and one rule synapse per ray toward its own direction, on the ledger, and replays", () => {
  const store = new RegistryStore(mkdtempSync(join(tmpdir(), "brainlab-recall-")));
  const s = birth(store, WORLD, 3, "reflexless", "test");
  const ledger = fixtureLedger(store, s.id, WORLD, 0.7);
  const rules = ledger.graph.connections.filter((e) => e.from.startsWith("rec"));
  assert.deepEqual(rules.map((e) => `${e.from}->${e.to}:${e.weight}`), ["rec0.food->bg.go.right:0.7", "rec1.food->bg.go.right:0.7", "rec2.food->bg.go.forward:0.7", "rec3.food->bg.go.left:0.7", "rec4.food->bg.go.left:0.7"]);
  assert.ok(rules.every((e) => pathwayOf(e)?.id === "P18"), "on the rule pathway");
  assert.ok(ledger.entries.every((e) => e.cause.includes("fixture")), "every fixture entry says so");
  assert.equal(new Ledger(s.id, ledger.birthGraph, ledger.entries).hash(), ledger.hash());
  assert.equal(store.openLedger(s.id).entries.length, 0, "the saved ledger is untouched");
});
