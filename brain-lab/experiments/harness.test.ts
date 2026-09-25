// brain-lab/experiments/harness.test.ts — the homeostasis measures of measureEpisodes must mean
// what they say: a dead body keeps counting, a resting fed body is not punished.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { oraclePolicy, seekerPolicy } from "../baselines/index.ts";
import { drive } from "../neuromodulation/index.ts";
import { Room, makeConfig, runEpisode } from "../world/index.ts";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bornGraph } from "../development/index.ts";
import { Ledger } from "../registry/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { diagnoseLedger } from "./diagnose.ts";
import { MAX_TICKS, TEST_SEED_FLOOR, assertSeedAllowed, birth, crossDopamine, evalWorld, lesionClone, localDopamine, measureEpisodes } from "./harness.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

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

// --- test-seed guard ---------------------------------------------------------------------------

const preregFile = (status: string) => {
  const dir = mkdtempSync(join(tmpdir(), "brainlab-prereg-"));
  const p = join(dir, "preregistration.md");
  writeFileSync(p, `# Ön-kayıt\n\n**Durum: ${status}**\n`);
  return p;
};

test("seed guard: tuning seeds need nothing", () => {
  assert.doesNotThrow(() => assertSeedAllowed(TEST_SEED_FLOOR - 1));
});

test("seed guard: a test seed without a pre-registration is refused", () => {
  assert.throws(() => assertSeedAllowed(TEST_SEED_FLOOR), /needs a frozen pre-registration/);
});

test("seed guard: a test seed under a draft pre-registration is refused", () => {
  assert.throws(() => assertSeedAllowed(1005, preregFile("TASLAK — Ozyn onayı bekleniyor")), /not frozen/);
});

test("seed guard: a draft that only mentions the word elsewhere is still a draft", () => {
  const p = preregFile("TASLAK");
  writeFileSync(p, `${readFileSync(p, "utf8")}\nOnaylanınca durum DONDURULDU yapılır.\n`);
  assert.throws(() => assertSeedAllowed(1005, p), /not frozen/);
});

test("seed guard: a test seed under a frozen pre-registration is allowed", () => {
  assert.doesNotThrow(() => assertSeedAllowed(1005, preregFile("DONDURULDU (commit abc1234)")));
});

test("seed guard: the real pre-registration 002 is a draft, so it cannot release test seeds", () => {
  assert.throws(() => assertSeedAllowed(1001, join(HERE, "../data/preregistration-002.md")), /not frozen/);
});

test("seed guard: birth itself refuses a test seed, before any subject is written", () => {
  const root = mkdtempSync(join(tmpdir(), "brainlab-guard-"));
  const store = new RegistryStore(root);
  assert.throws(() => birth(store, HUNGRY, TEST_SEED_FLOOR, "reflexless", "test"), /test seed/);
  assert.equal(store.list().length, 0);
});

// --- diagnosis ---------------------------------------------------------------------------------

test("diagnose: learned side changes and critic values are read back from the ledger", () => {
  const ledger = new Ledger("DNK-0001", bornGraph(HUNGRY, { seed: 1, group: "reflexless" }));
  const w = (from: string, to: string) => ledger.graph.connections.find((e) => e.from === from && e.to === to)!.weight;
  const move = (from: string, to: string, by: number) =>
    ledger.record({ kind: "weight", tick: 1, episode: 1, cause: ["test"], edge: { from, to }, before: w(from, to), after: w(from, to) + by });
  move("ray4.food", "bg.go.left", 0.4);   // left ray (+π/3): toward = left
  move("ray4.food", "bg.go.right", 0.1);
  move("ray0.food", "bg.go.right", 0.2);  // right ray (−π/3): toward = right
  ledger.record({ kind: "critic", tick: 1, episode: 1, cause: ["td"], feature: "ray2.food", before: 0, after: 0.05 });
  const d = diagnoseLedger(ledger, HUNGRY);
  // side rays are 0, 1 (right) and 3, 4 (left): own = mean(0.2, 0, 0, 0.4), other = mean(0, 0, 0, 0.1)
  assert.ok(Math.abs(d.ownSideGo - 0.15) < 1e-12, `own ${d.ownSideGo}`);
  assert.ok(Math.abs(d.otherSideGo - 0.025) < 1e-12, `other ${d.otherSideGo}`);
  assert.ok(Math.abs(d.criticFood - 0.01) < 1e-12, `critic food ${d.criticFood} (0.05 over 5 rays)`);
  assert.equal(d.forwardGo, 0);
});

// --- LOCAL control and lesion --------------------------------------------------------------------

test("LOCAL: dopamine comes back `delay` ticks later within the episode, zero until then", () => {
  const local = localDopamine(2);
  assert.deepEqual([5, 6, 7, 8].map((d, t) => local(d, t, "global")), [0, 0, 5, 6]);
});

test("LOCAL: a new episode (tick 0) empties the delay line — nothing crosses episodes", () => {
  const local = localDopamine(2);
  [1, 2, 3].forEach((d, t) => local(d, t, "global"));
  assert.deepEqual([9, 9, 9].map((d, t) => local(d, t, "global")), [0, 0, 9]);
});

test("lesion: the clone's matching learned weights are back at birth, the rest untouched, all on its ledger", () => {
  const root = mkdtempSync(join(tmpdir(), "brainlab-lesion-"));
  const store = new RegistryStore(root);
  const parent = birth(store, HUNGRY, 1, "reflexless", "test");
  const ledger = store.openLedger(parent.id);
  const w = (l: Ledger, from: string, to: string) => l.graph.connections.find((e) => e.from === from && e.to === to)!.weight;
  const move = (from: string, to: string, by: number) =>
    ledger.record({ kind: "weight", tick: 1, episode: 1, cause: ["test"], edge: { from, to }, before: w(ledger, from, to), after: w(ledger, from, to) + by });
  move("ray4.food", "bg.go.left", 0.5);
  move("ray4.wall", "bg.go.right", 0.3);
  store.saveLedger(ledger);
  const clone = lesionClone(store, parent.id, /\.food$/, "test");
  const lesioned = store.openLedger(clone.id);
  const born = store.openLedger(parent.id).birthGraph;
  const birthW = (from: string, to: string) => born.connections.find((e) => e.from === from && e.to === to)!.weight;
  assert.equal(w(lesioned, "ray4.food", "bg.go.left"), birthW("ray4.food", "bg.go.left"), "food edge back at birth");
  assert.equal(w(lesioned, "ray4.wall", "bg.go.right"), w(store.openLedger(parent.id), "ray4.wall", "bg.go.right"), "wall edge keeps what it learned");
  assert.ok(lesioned.entries.some((e) => e.kind === "weight" && e.cause.includes("lesion")), "the reset is on the clone's ledger");
  assert.equal(store.loadSubject(clone.id).lineage.parent, parent.id);
  assert.equal(w(store.openLedger(parent.id), "ray4.food", "bg.go.left"), birthW("ray4.food", "bg.go.left") + 0.5, "the parent is untouched");
});
