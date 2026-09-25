// brain-lab/viewer/arena.test.ts — what a person watches in the arena must be what the experiment measured:
// a subject and its twin, rebuilt from the records, replay their evaluation rooms bit-for-bit, and the films
// the API sends the page are those rooms, tick by tick.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOM1, condition } from "../experiments/conditions.ts";
import { runCondition } from "../experiments/harness.ts";
import { MAX_TICKS } from "../experiments/seeds.ts";
import { drive } from "../neuromodulation/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { createHandler, loadArena, type ArenaMeta, type Handler } from "./api.ts";
import { Contestant, filmRoom, matchesRecord, type BrainRecord, type Film, type RecordedEpisode } from "./arena.ts";

function ask<T>(handler: Handler, url: string): { status: number; body: T } {
  let status = 0;
  let text = "";
  const res = { set statusCode(s: number) { status = s; }, setHeader: () => undefined, end: (t: string) => { text = t; } } as unknown as ServerResponse;
  handler({ url } as IncomingMessage, res, () => undefined);
  return { status, body: JSON.parse(text) as T };
}

// One real experiment, shared by the replay tests below: S1n, one subject, 2 training + 2 evaluation rooms.
// It is expensive (a few seconds), and the tests only read it.
const EVAL_ROOMS = 2;
const root = mkdtempSync(join(tmpdir(), "brainlab-arena-"));
const store = new RegistryStore(root);
const def = condition("S1n");
const [experiment] = runCondition(store, {
  condition: { code: "S1n", what: def.what, spec: def.spec(ROOM1) }, world: ROOM1, seeds: [3], groups: ["reflexless"],
  trainEpisodes: 2, evalEpisodes: EVAL_ROOMS, codeCommit: "test", label: "arena-test",
}).rows;
writeFileSync(join(root, "results.jsonl"), JSON.stringify({
  date: "2026-09-25T00:00:00Z", codeCommit: "test", command: "tara", code: "S1n", control: "none", food: 10, threats: 0,
  trainEpisodes: 2, evalEpisodes: EVAL_ROOMS, seed: 3, group: "reflexless", learner: experiment!.learner.id, twin: experiment!.twin.id,
  l: experiment!.l, t: experiment!.t, trainPerK: [],
}) + "\n");
const loaded = loadArena(root, experiment!.learner.id)!;
const view = { ...loaded.meta, learner: loaded.learner, twin: loaded.twin };
const handler = createHandler(root);
const metaAnswer = ask<ArenaMeta>(handler, `/api/arena/${experiment!.learner.id}`);
test.after(() => rmSync(root, { recursive: true, force: true }));

/** Lives every recorded room in order and says, room by room, whether it matched the record. */
function replay(brain: BrainRecord): (boolean | null)[] {
  const c = new Contestant(brain, view.world, view.seed);
  const out: (boolean | null)[] = [];
  for (let ep = 1; ep <= EVAL_ROOMS; ep++) {
    if (ep > 1) c.nextRoom();
    out.push(matchesRecord(c.finishRoom(), c.recorded));
  }
  return out;
}

test("the learner's records include every recorded evaluation room", () => {
  assert.equal(view.learner.recorded.length, EVAL_ROOMS);
});

test("the twin's records include every recorded evaluation room", () => {
  assert.equal(view.twin.recorded.length, EVAL_ROOMS);
});

test("arena API answers for a learner that has an experiment result", () => {
  assert.equal(metaAnswer.status, 200);
});

test("arena API names the twin the experiment compared against", () => {
  assert.equal(metaAnswer.body.twin.id, experiment!.twin.id);
});

test("arena API reports how many rooms the learner trained in", () => {
  assert.equal(metaAnswer.body.trainEpisodes, 2);
});

test("arena API offers exactly the measured rooms", () => {
  assert.equal(metaAnswer.body.rooms, EVAL_ROOMS);
});

// Room 2 first: the server must live room 1 before it, as the measurement did.
for (const n of [2, 1]) {
  test(`arena API room ${n}: the learner's film matches the experiment's record`, () => {
    assert.equal(ask<{ learner: Film }>(handler, `/api/arena/${experiment!.learner.id}/room/${n}`).body.learner.matches, true);
  });
  test(`arena API room ${n}: the twin's film matches the experiment's record`, () => {
    assert.equal(ask<{ twin: Film }>(handler, `/api/arena/${experiment!.learner.id}/room/${n}`).body.twin.matches, true);
  });
}

test("arena API refuses a room beyond the measured ones", () => {
  assert.equal(ask(handler, `/api/arena/${experiment!.learner.id}/room/${EVAL_ROOMS + 1}`).status, 404);
});

test("arena API refuses room 0", () => {
  assert.equal(ask(handler, `/api/arena/${experiment!.learner.id}/room/0`).status, 404);
});

test("the learner replays every recorded evaluation room exactly (world hash, meals, ticks)", () => {
  assert.deepEqual(replay(view.learner), [true, true]);
});

test("the twin replays every recorded evaluation room exactly (world hash, meals, ticks)", () => {
  assert.deepEqual(replay(view.twin), [true, true]);
});

test("a learner rebuilt without its learned critic still replays exactly (a frozen critic does not act)", () => {
  assert.deepEqual(replay({ ...view.learner, critic: {} }), [true, true]);
});

test("a learner given the twin's brain does not replay the learner's record", () => {
  const swapped = { ...view.learner, graph: view.twin.graph };
  assert.notDeepEqual(replay(swapped), [true, true]);
});

test("arena API answers 404 for a subject with no experiment result (a twin is not a learner)", () => {
  assert.equal(ask(handler, `/api/arena/${experiment!.twin.id}`).status, 404);
});

test("arena API answers 404 for a subject that does not exist", () => {
  assert.equal(ask(handler, "/api/arena/DNK-9999").status, 404);
});

test("an experiment row carries the learner's yoked body", () => {
  assert.notEqual(experiment!.y, null);
});

// --- films ------------------------------------------------------------------------------------------

const film1 = filmRoom(new Contestant(view.learner, view.world, view.seed));

test("a film has one frame for the room's start and one per tick lived", () => {
  assert.equal(film1.frames.length, film1.result.ticks + 1);
});

test("a film's frames are numbered by tick from 0", () => {
  assert.ok(film1.frames.every((f, i) => f.tick === i));
});

test("a film's last frame shows every meal of the room", () => {
  assert.equal(film1.frames.at(-1)!.meals, film1.result.foodEaten);
});

test("a film records a new scene on every tick that food was eaten (food reappears elsewhere)", () => {
  // Two meals can fall on one tick, so count ticks with a meal, not meals.
  const mealTicks = film1.frames.filter((f, i) => i > 0 && f.meals > film1.frames[i - 1]!.meals).length;
  assert.equal(film1.scenes.length, mealTicks + 1);
});

test("a film's scene index changes exactly on the ticks a meal was eaten", () => {
  const moved = film1.frames.filter((f, i) => i > 0 && f.scene !== film1.frames[i - 1]!.scene).map((f) => f.tick);
  const ate = film1.frames.filter((f, i) => i > 0 && f.meals > film1.frames[i - 1]!.meals).map((f) => f.tick);
  assert.deepEqual(moved, ate);
});

test("a film refuses a room that was already partly lived", () => {
  const c = new Contestant(view.twin, view.world, view.seed);
  c.step();
  assert.throws(() => filmRoom(c), /tick 0/);
});

test("the learner's mean drive over the rooms is the experiment's mean drive", () => {
  const c = new Contestant(view.learner, view.world, view.seed);
  const drives: number[] = [];
  for (let ep = 1; ep <= EVAL_ROOMS; ep++) {
    if (ep > 1) c.nextRoom();
    drives.push(c.finishRoom().meanDrive);
  }
  // Same numbers, summed in a different order (per room, then across rooms): the difference is rounding
  // only, bounded by ~(ticks summed) × machine epsilon ≈ 6000 × 1.1e-16 < 1e-12.
  assert.ok(Math.abs(drives.reduce((s, d) => s + d, 0) / EVAL_ROOMS - experiment!.l.meanDrive) < 1e-12);
});

test("a contestant that died is counted at its last drive until the end of the room", () => {
  const c = new Contestant(view.twin, view.world, view.seed);
  const r = c.finishRoom();
  assert.ok(r.doneCause === null || r.meanDrive >= drive(c.observation) * (MAX_TICKS - r.ticks) / MAX_TICKS);
});

// --- Contestant on its own ------------------------------------------------------------------------

test("a contestant stops stepping once its room is over", () => {
  const c = new Contestant(view.twin, view.world, view.seed);
  const r = c.finishRoom();
  c.step();
  assert.equal(c.ticks, r.ticks);
});

test("a contestant never lives longer than an episode", () => {
  const c = new Contestant(view.learner, view.world, view.seed);
  assert.ok(c.finishRoom().ticks <= MAX_TICKS);
});

test("nextRoom finishes the current room before entering the next", () => {
  const whole = new Contestant(view.learner, view.world, view.seed);
  whole.finishRoom();
  whole.nextRoom();
  const cut = new Contestant(view.learner, view.world, view.seed);
  for (let i = 0; i < 10; i++) cut.step();
  cut.nextRoom(); // leaving room 1 early must not change what room 2 is
  assert.equal(cut.finishRoom().finalHash, whole.finishRoom().finalHash);
});

test("nextRoom counts rooms from 1", () => {
  const c = new Contestant(view.twin, view.world, view.seed);
  c.nextRoom();
  assert.equal(c.episode, 2);
});

// --- matchesRecord --------------------------------------------------------------------------------

const rec: RecordedEpisode = { episode: 1, worldSeed: 1, foodEaten: 4, ticks: 3000, doneCause: null, finalHash: "abc" };
const res = { episode: 1, meanDrive: 0.5, foodEaten: 4, ticks: 3000, doneCause: null, finalHash: "abc" };

test("matchesRecord is null for a room the experiment did not measure", () => {
  assert.equal(matchesRecord(res, undefined), null);
});

test("matchesRecord is true when hash, meals and ticks are all equal", () => {
  assert.equal(matchesRecord(res, rec), true);
});

for (const [field, change] of [["finalHash", { finalHash: "abd" }], ["foodEaten", { foodEaten: 5 }], ["ticks", { ticks: 2999 }]] as const) {
  test(`matchesRecord is false when only ${field} differs`, () => {
    assert.equal(matchesRecord({ ...res, ...change }, rec), false);
  });
}
