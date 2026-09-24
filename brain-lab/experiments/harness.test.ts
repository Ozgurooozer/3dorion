// brain-lab/experiments/harness.test.ts — the homeostasis measures of measureEpisodes must mean
// what they say: a dead body keeps counting, a resting fed body is not punished.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { oraclePolicy } from "../baselines/index.ts";
import { drive } from "../neuromodulation/index.ts";
import { Room, makeConfig, runEpisode } from "../world/index.ts";
import { MAX_TICKS, evalWorld, measureEpisodes } from "./harness.ts";

const HUNGRY = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
const still = { policy: () => ({ thrust: 0, turn: 0 }) };

test("survival: a body that never moves starves in every episode", () => {
  assert.equal(measureEpisodes(still, HUNGRY, 1, 3, 0).survival, 0);
});

test("survival: the oracle is alive at the end of at least one episode", () => {
  assert.ok(measureEpisodes({ policy: oraclePolicy(HUNGRY) }, HUNGRY, 1, 3, 0).survival > 0);
});

test("mean drive: a dead body keeps its final drive until the episode would have ended", () => {
  const e = measureEpisodes(still, HUNGRY, 1, 1, 0);
  const room = new Room(evalWorld(1, 1), HUNGRY);
  const { records } = runEpisode(room, still.policy, MAX_TICKS, true);
  let sum = 0;
  for (const r of records) sum += drive(r.result.observation);
  sum += drive(records.at(-1)!.result.observation) * (MAX_TICKS - records.length);
  assert.ok(Math.abs(e.meanDrive - sum / MAX_TICKS) < 1e-12, `${e.meanDrive} vs ${sum / MAX_TICKS}`);
});

test("mean drive: the oracle stays closer to its setpoint than a body that never moves", () => {
  const oracle = measureEpisodes({ policy: oraclePolicy(HUNGRY) }, HUNGRY, 1, 3, 0).meanDrive;
  const idle = measureEpisodes(still, HUNGRY, 1, 3, 0).meanDrive;
  assert.ok(oracle < idle, `oracle ${oracle} vs idle ${idle}`);
});
