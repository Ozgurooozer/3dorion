// brain-lab/experiments/curriculum.test.ts — training as long as it takes and training through rooms (TASARIM-009 §0.1,
// §0.2): the stop rule on a grid, a fixed stage is the old train(), an auto stage stops where the rule says, a curriculum
// lives its stages in order, and a control's episode counts are the ones it is given. Every case has its own registry.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RegistryStore } from "../registry/store.ts";
import { makeConfig } from "../world/index.ts";
import { ROOM1, ROOM_S, condition } from "./conditions.ts";
import { AUTO, birth, plateaued, trainStages } from "./harness.ts";
import { runJob } from "./jobs.ts";
import { trainWorld } from "./seeds.ts";

const fresh = () => {
  const root = mkdtempSync(join(tmpdir(), "brainlab-curric-"));
  return { root, store: new RegistryStore(root), done: () => rmSync(root, { recursive: true, force: true }) };
};
const S1N = condition("S1n").spec(ROOM1);

test("plateaued: fewer than patience + 1 blocks is never a plateau", () => {
  for (let n = 0; n <= AUTO.patience; n++) assert.equal(plateaued(Array(n).fill(0.5)), false, `${n} blocks`);
});

test("plateaued: flat drives stop, steadily improving drives do not", () => {
  assert.equal(plateaued([0.5, 0.5, 0.5, 0.5]), true, "flat");
  assert.equal(plateaued([0.8, 0.7, 0.6, 0.5]), false, "improving by 0.1 per block");
});

test("plateaued: the edge — recent best must beat the earlier best by more than minGain", () => {
  // Earlier best 0.5; recent best 0.5 − minGain is not "more than minGain" better only by float noise, so step inside it.
  assert.equal(plateaued([0.5, 0.6, 0.6, 0.5 - AUTO.minGain * 0.9]), true, "gain 0.9·minGain: plateau");
  assert.equal(plateaued([0.5, 0.6, 0.6, 0.5 - AUTO.minGain * 1.1]), false, "gain 1.1·minGain: still learning");
  // Earlier best 0.5 (block 2), first block 0.9: recent 0.6 has not beaten 0.5 → plateau; judged against block 1 it would not be.
  assert.equal(plateaued([0.9, 0.5, 0.6, 0.6, 0.6]), true, "the best earlier block counts, not the first");
});

test("a fixed stage lives exactly its episodes: counts, curve lengths, training run", () => {
  const { store, done } = fresh();
  try {
    const s = birth(store, ROOM1, 1, "reflexless", "test");
    const t = trainStages(store, s, [{ world: ROOM1, episodes: 20 }], S1N, "test", "fixed");
    assert.deepEqual(t.episodes, [20]);
    assert.equal(t.perK.length, 2, "one meals/1000 value per 10 episodes");
    assert.equal(t.drive.length, 1, "one drive value per 20 episodes");
    const run = store.listRuns(s.id).find((r) => r.header.purpose === "fixed train")!;
    assert.deepEqual(run.episodes.map((e) => e.episode), Array.from({ length: 20 }, (_, i) => i + 1));
  } finally { done(); }
});

test("an auto stage stops at a block boundary, on a plateau of its own drives (or at the cap)", () => {
  const { store, done } = fresh();
  try {
    const s = birth(store, ROOM1, 2, "reflexless", "test");
    // A frozen learner cannot improve: its drives wander, so the rule must stop it early, never at the cap.
    const t = trainStages(store, s, [{ world: ROOM1, episodes: "auto" }], { ...S1N, learning: { ...S1N.learning, frozen: true } }, "test", "auto");
    const n = t.episodes[0]!;
    assert.equal(n % AUTO.block, 0, `stopped at ${n}`);
    assert.ok(n < AUTO.cap, `a frozen learner ran to the cap (${n})`);
    assert.equal(plateaued(t.drive), true, "stopped on a plateau");
    assert.equal(plateaued(t.drive.slice(0, -1)), false, "not one block later than the rule allows");
  } finally { done(); }
});

test("a curriculum lives its stages in order, episode numbers and training worlds running on across stages", () => {
  const { store, done } = fresh();
  try {
    const s = birth(store, ROOM_S, 3, "reflexless", "test");
    const t = trainStages(store, s, [{ world: ROOM1, episodes: 10 }, { world: ROOM_S, episodes: 10 }], S1N, "test", "curriculum");
    assert.deepEqual(t.episodes, [10, 10]);
    const run = store.listRuns(s.id).find((r) => r.header.purpose === "curriculum train")!;
    assert.deepEqual(run.episodes.map((e) => e.worldSeed), Array.from({ length: 20 }, (_, i) => trainWorld(3, i + 1)));
    assert.equal((run.header.meta.stages as unknown[]).length, 2, "the stages are on the run record");
  } finally { done(); }
});

test("the second stage really is lived in its own room: same subject, same episodes 1–10, different 11–20", () => {
  const { store, done } = fresh();
  try {
    const hashes = (stages: Parameters<typeof trainStages>[2], purpose: string) => {
      const s = birth(store, ROOM_S, 6, "reflexless", "test");
      trainStages(store, s, stages, S1N, "test", purpose);
      return store.listRuns(s.id).find((r) => r.header.purpose === `${purpose} train`)!.episodes.map((e) => e.summary.finalHash);
    };
    const curriculum = hashes([{ world: ROOM1, episodes: 10 }, { world: ROOM_S, episodes: 10 }], "c");
    const plain = hashes([{ world: ROOM1, episodes: 20 }], "p");
    assert.deepEqual(curriculum.slice(0, 10), plain.slice(0, 10), "first stage = the plain room");
    assert.ok(curriculum.slice(10).every((h, i) => h !== plain[10 + i]), "second stage lived in the side room");
  } finally { done(); }
});

test("stages with different rays or room size are refused (one brain, one body)", () => {
  const { store, done } = fresh();
  try {
    const s = birth(store, ROOM1, 4, "reflexless", "test");
    const narrow = makeConfig({ ...ROOM1, rayAngles: [-0.5, 0, 0.5] });
    const big = makeConfig({ ...ROOM1, width: 12 });
    // The message matters: other rays also make the senses fail later, which must not be what stops it.
    assert.throws(() => trainStages(store, s, [{ world: ROOM1, episodes: 1 }, { world: narrow, episodes: 1 }], S1N, "test", "x"), /same rays and room size/);
    assert.throws(() => trainStages(store, s, [{ world: ROOM1, episodes: 1 }, { world: big, episodes: 1 }], S1N, "test", "y"), /same rays and room size/);
    assert.throws(() => trainStages(store, s, [], S1N, "test", "z"));
  } finally { done(); }
});

test("a job's stageEpisodes decide how long each stage lives, and a wrong count of them is refused", () => {
  const { root, done } = fresh();
  try {
    const job = { kind: "subject" as const, code: "S1n", control: "CROSS" as const, seed: 5, group: "reflexless" as const, trainEpisodes: "auto" as const, evalEpisodes: 1, label: "t" };
    const r = runJob({ ...job, stageEpisodes: [7] }, { dataRoot: root, codeCommit: "test" });
    assert.equal(r.kind, "subject");
    if (r.kind === "subject") assert.deepEqual(r.row.trained, [7], "the control lived the learner's 7 episodes, not auto");
    assert.throws(() => runJob({ ...job, stageEpisodes: [7, 7] }, { dataRoot: root, codeCommit: "test" }), /2 stage lengths for 1 stages/);
  } finally { done(); }
});
