// brain-lab/experiments/memory-measures.test.ts — the memory measurements (pose-a1.ts, memory-a2.ts) can put any body
// through their graders on any seeds since the falsification of 2026-09-26; the test-seed guard must still hold there.
// They measure recorded learners only in the lives those learners recorded: a learner born into another room, or a room
// that does not end in its recorded final world hash, stops them (the K1n mix-up of 2026-09-26).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeConfig } from "../world/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { condition } from "./conditions.ts";
import { EVAL_PURPOSE, TEST_SEED_FLOOR, birth, evaluate, recordedEvaluation } from "./harness.ts";
import { learnerMemoryLives, referenceMemoryLives } from "./memory-a2.ts";
import { learnerLives, referenceBodies, referenceLives } from "./pose-a1.ts";

const ROOM = makeConfig({ initialEnergy: 0.8, threatCount: 0, foodCount: 5 });

test("the pose measurement refuses a test seed for its reference bodies", () => {
  assert.throws(() => referenceLives(referenceBodies(ROOM), ROOM, [TEST_SEED_FLOOR]), /test seed/);
});

test("the food memory measurement refuses a test seed for its reference bodies", () => {
  assert.throws(() => referenceMemoryLives(referenceBodies(ROOM), ROOM, [TEST_SEED_FLOOR]), /test seed/);
});

// --- recorded learners: only their recorded lives ----------------------------------------------------------------------

/** A K1n results-table line naming `learner`; without an energy field, like the rows written before commit 67974b7. */
const k1nLine = (learner: string, command: "tara" | "curut", seed: number) =>
  JSON.stringify({ code: "K1n", command, control: "none", food: 5, threats: 0, trainEpisodes: 40, evalEpisodes: 10, seed, group: "reflexless", learner });

/** A fresh store with one learner born into the scarce room (the other room of 5 food, born hungry, when `hungry`). */
function bornLearner(hungry: boolean) {
  const store = new RegistryStore(mkdtempSync(join(tmpdir(), "brainlab-memlives-")));
  const world = hungry ? makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 5 }) : condition("K1n").world!;
  return { store, subject: birth(store, world, 11, "reflexless", "test") };
}

/** A fresh store with one K1n learner and its recorded frozen evaluation of one room. */
function recordedLearner() {
  const { store, subject } = bornLearner(false);
  const world = condition("K1n").world!;
  evaluate(store, subject, world, 1, "test", "test", condition("K1n").spec(world));
  return { store, subject, lines: [k1nLine(subject.id, "tara", 11)] };
}

/** Appends a later evaluation record of the learner's room whose final world hash differs from the true one. */
function forgeRecord(store: RegistryStore, id: string) {
  const ep = recordedEvaluation(store, id)!.episodes[0]!;
  const run = store.startRun(id, `forged ${EVAL_PURPOSE}`);
  store.appendEpisode(run.id, { episode: ep.episode, worldSeed: ep.worldSeed, summary: { ...ep.summary, finalHash: "00000000" }, events: [] });
}

test("the pose measurement refuses a learner born into another room than its condition's", () => {
  const { store, subject } = bornLearner(true);
  assert.throws(() => learnerLives("K1n", store, [k1nLine(subject.id, "curut", 11)], "curut"), /born into another world \(initialEnergy 0\.4, not 0\.8\)/);
});

test("the food memory measurement refuses a learner born into another room than its condition's", () => {
  const { store, subject } = bornLearner(true);
  assert.throws(() => learnerMemoryLives("K1n", store, [k1nLine(subject.id, "curut", 11)], "curut"), /born into another world \(initialEnergy 0\.4, not 0\.8\)/);
});

test("the pose measurement replays a learner's recorded room", () => {
  const { store, lines } = recordedLearner();
  assert.equal(learnerLives("K1n", store, lines).length, 1);
});

test("the food memory measurement replays a learner's recorded room", () => {
  const { store, lines } = recordedLearner();
  assert.equal(learnerMemoryLives("K1n", store, lines).lives.length, 1);
});

test("the pose measurement refuses a room whose recorded final world hash it does not reach", () => {
  const { store, subject, lines } = recordedLearner();
  forgeRecord(store, subject.id);
  assert.throws(() => learnerLives("K1n", store, lines), new RegExp(`${subject.id}: room 1 did not end in the recorded final world hash`));
});

test("the food memory measurement refuses a room whose recorded final world hash it does not reach", () => {
  const { store, subject, lines } = recordedLearner();
  forgeRecord(store, subject.id);
  assert.throws(() => learnerMemoryLives("K1n", store, lines), new RegExp(`${subject.id}: room 1 did not end in the recorded final world hash`));
});
