// brain-lab/experiments/harness.test.ts — the homeostasis measures of measureEpisodes must mean
// what they say: a dead body keeps counting, a resting fed body is not punished.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { oraclePolicy, seekerPolicy } from "../baselines/index.ts";
import { drive } from "../neuromodulation/index.ts";
import { Room, makeConfig, runEpisode } from "../world/index.ts";
import { MAX_TICKS, crossDopamine, evalWorld, measureEpisodes } from "./harness.ts";

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

test("harm: health lost per 1000 ticks, equal to the episodes' own damage counts", () => {
  const dangerous = makeConfig({ initialEnergy: 1, threatCount: 4, foodCount: 2 });
  // A wanderer that ignores danger (fresh, same seed, for both runs).
  const e = measureEpisodes({ policy: seekerPolicy(dangerous, 5) }, dangerous, 1, 3, 0);
  let damage = 0, ticks = 0;
  const wanderer = seekerPolicy(dangerous, 5);
  for (let ep = 1; ep <= 3; ep++) {
    const s = runEpisode(new Room(evalWorld(1, ep), dangerous), wanderer, MAX_TICKS);
    damage += s.damage; ticks += s.ticks;
  }
  assert.ok(damage > 0, "the test room must actually hurt the body");
  assert.ok(Math.abs(e.harmPerK - (1000 * damage) / ticks) < 1e-12, `${e.harmPerK} vs ${(1000 * damage) / ticks}`);
});

test("harm: a room without threats never harms", () => {
  assert.equal(measureEpisodes({ policy: () => ({ thrust: 1, turn: 1 }) }, HUNGRY, 1, 3, 0).harmPerK, 0);
});

test("CROSS: each channel's dopamine comes back exactly `delay` ticks later, and zero until then", () => {
  const cross = crossDopamine(3);
  const out = [1, 2, 3, 4, 5].map((d, t) => cross(d, t, "left"));
  assert.deepEqual(out, [0, 0, 0, 1, 2]);
});

test("CROSS: channels have separate delay lines", () => {
  const cross = crossDopamine(1);
  assert.equal(cross(7, 0, "pos"), 0);
  assert.equal(cross(9, 0, "neg"), 0, "neg must not receive pos's value");
  assert.equal(cross(0, 1, "pos"), 7);
  assert.equal(cross(0, 1, "neg"), 9);
});
