// brain-lab/experiments/memory-measures.test.ts — the memory measurements (pose-a1.ts, memory-a2.ts) can put any body
// through their graders on any seeds since the falsification of 2026-09-26; the test-seed guard must still hold there.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeConfig } from "../world/index.ts";
import { TEST_SEED_FLOOR } from "./harness.ts";
import { referenceMemoryLives } from "./memory-a2.ts";
import { referenceBodies, referenceLives } from "./pose-a1.ts";

const ROOM = makeConfig({ initialEnergy: 0.8, threatCount: 0, foodCount: 5 });

test("the pose measurement refuses a test seed for its reference bodies", () => {
  assert.throws(() => referenceLives(referenceBodies(ROOM), ROOM, [TEST_SEED_FLOOR]), /test seed/);
});

test("the food memory measurement refuses a test seed for its reference bodies", () => {
  assert.throws(() => referenceMemoryLives(referenceBodies(ROOM), ROOM, [TEST_SEED_FLOOR]), /test seed/);
});
