// brain-lab/experiments/yoked.test.ts — the yoked body must make exactly the subject's movements, only in
// another room: same actions in the same order, never the room's own actions, and it never runs dry.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Action, Observation } from "../world/index.ts";
import { recordingActor, yokedActor } from "./yoked.ts";

const act = (thrust: number, turn: number): Action => ({ thrust, turn });
const OBS = {} as Observation;
const A = act(1, 0), B = act(0, 1), C = act(-1, 0), D = act(0, -1), E = act(1, 1);

/** The first n actions the yoked body makes in room `episode`. */
function play(actions: Action[][], episode: number, n: number): Action[] {
  const y = yokedActor(actions);
  y.startEpisode!(episode);
  return Array.from({ length: n }, (_, t) => y.policy(OBS, t));
}

test("the yoked body in room 1 replays room 2's actions", () => {
  assert.deepEqual(play([[A, A], [B, C]], 1, 2), [B, C]);
});

test("the yoked body in the last room replays room 1's actions (wraps around)", () => {
  assert.deepEqual(play([[A, B], [C, D], [E]], 3, 2), [A, B]);
});

test("the yoked body never replays the room's own actions first", () => {
  const rooms = [[A], [B], [C]];
  for (let ep = 1; ep <= 3; ep++) assert.notDeepEqual(play(rooms, ep, 1), rooms[ep - 1], `room ${ep}`);
});

test("the yoked body continues with the next room's actions when it outlives the replayed room", () => {
  assert.deepEqual(play([[A], [B], [C, D]], 1, 3), [B, C, D]);
});

test("the yoked body skips a room in which the subject made no move (it died at once)", () => {
  assert.deepEqual(play([[A], [], [C]], 1, 2), [C, A]);
});

test("the yoked body of a subject that never acted stands still", () => {
  assert.deepEqual(play([[], []], 1, 2), [act(0, 0), act(0, 0)]);
});

test("the yoked body starts each room afresh, not where the last room stopped", () => {
  const y = yokedActor([[A, B], [C, D]]);
  y.startEpisode!(1);
  y.policy(OBS, 0);
  y.startEpisode!(1);
  assert.deepEqual(y.policy(OBS, 0), C);
});

test("a yoked control refuses a single recorded room (it could only replay that room itself)", () => {
  assert.throws(() => yokedActor([[A]]), /at least 2/);
});

test("the recording actor passes the subject's action through unchanged", () => {
  const rec = recordingActor({ policy: () => E });
  rec.actor.startEpisode!(1);
  assert.deepEqual(rec.actor.policy(OBS, 0), E);
});

test("the recording actor keeps every action, room by room", () => {
  let n = 0;
  const seq = [A, B, C];
  const rec = recordingActor({ policy: () => seq[n++]! });
  rec.actor.startEpisode!(1);
  rec.actor.policy(OBS, 0);
  rec.actor.policy(OBS, 1);
  rec.actor.startEpisode!(2);
  rec.actor.policy(OBS, 0);
  assert.deepEqual(rec.actions, [[A, B], [C]]);
});

test("the recording actor still starts the subject's episodes", () => {
  const started: number[] = [];
  const rec = recordingActor({ policy: () => A, startEpisode: (e) => started.push(e) });
  rec.actor.startEpisode!(1);
  rec.actor.startEpisode!(2);
  assert.deepEqual(started, [1, 2]);
});
