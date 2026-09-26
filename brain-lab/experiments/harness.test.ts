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
import { MAX_TICKS, TEST_SEED_FLOOR, assertBornInto, assertReplayed, assertSeedAllowed, birth, crossDopamine, evalWorld, lesionClone, localDopamine, measureEpisodes, recordedLearners, recordedRows, shuffledClone } from "./harness.ts";

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

test("shuffle: the clone carries the same learned changes as the parent, dealt to other edges", () => {
  const root = mkdtempSync(join(tmpdir(), "brainlab-shuffle-"));
  const store = new RegistryStore(root);
  const parent = birth(store, HUNGRY, 1, "reflexless", "test");
  const ledger = store.openLedger(parent.id);
  const w = (l: Ledger, from: string, to: string) => l.graph.connections.find((e) => e.from === from && e.to === to)!.weight;
  const moves: [string, string, number][] = [["ray4.food", "bg.go.left", 0.5], ["ray0.food", "bg.go.right", 0.3], ["intero.hunger", "bg.nogo.back", 0.2]];
  for (const [from, to, by] of moves) ledger.record({ kind: "weight", tick: 1, episode: 1, cause: ["test"], edge: { from, to }, before: w(ledger, from, to), after: w(ledger, from, to) + by });
  store.saveLedger(ledger);
  const clone = store.openLedger(shuffledClone(store, parent.id, 7, "test").id);
  const born = clone.birthGraph; // the clone is born with the parent's learned brain
  const parentBirth = store.openLedger(parent.id).birthGraph;
  const change = (l: Ledger) => l.graph.connections
    .filter((e) => /^bg\.(go|nogo)\./.test(e.to) && /^(ray|touch|intero|proprio)/.test(e.from))
    .map((e) => e.weight - parentBirth.connections.find((c) => c.from === e.from && c.to === e.to)!.weight);
  const sorted = (xs: number[]) => xs.map((x) => Math.round(x * 1e9) / 1e9).sort((a, b) => a - b);
  assert.deepEqual(sorted(change(clone)), sorted(change(store.openLedger(parent.id))), "same multiset of changes");
  assert.notEqual(w(clone, "ray4.food", "bg.go.left"), w(store.openLedger(parent.id), "ray4.food", "bg.go.left"), "the big change moved elsewhere");
  assert.ok(clone.entries.every((e) => e.kind !== "weight" || e.cause[0] === "shuffle"));
  assert.ok(born.connections.length > 0);
});

test("shuffle: same seed, same clone; different seed, different clone", () => {
  const root = mkdtempSync(join(tmpdir(), "brainlab-shuffle2-"));
  const store = new RegistryStore(root);
  const parent = birth(store, HUNGRY, 2, "reflexless", "test");
  const ledger = store.openLedger(parent.id);
  const e0 = ledger.graph.connections.find((e) => e.from === "ray4.food" && e.to === "bg.go.left")!;
  ledger.record({ kind: "weight", tick: 1, episode: 1, cause: ["test"], edge: { from: e0.from, to: e0.to }, before: e0.weight, after: e0.weight + 0.9 });
  store.saveLedger(ledger);
  const weights = (id: string) => JSON.stringify(store.openLedger(id).graph.connections.map((e) => e.weight));
  assert.equal(weights(shuffledClone(store, parent.id, 3, "t").id), weights(shuffledClone(store, parent.id, 3, "t").id));
  assert.notEqual(weights(shuffledClone(store, parent.id, 3, "t").id), weights(shuffledClone(store, parent.id, 4, "t").id));
});

// --- recordedLearners: which recorded subjects the memory measurements replay -------------------------------------------

/** A results-table line; every field a standard screened learner of the hungry room has, then the overrides. */
const resultLine = (over: Record<string, unknown>) => JSON.stringify({
  code: "S1n", command: "tara", control: "none", food: 10, threats: 0, trainEpisodes: 40, evalEpisodes: 10, seed: 1, group: "reflexless", learner: "DNK-0001", ...over,
});

test("recorded learners: a standard screened learner of the condition's room is chosen", () => {
  assert.deepEqual(recordedLearners([resultLine({})], "S1n", HUNGRY), [{ seed: 1, group: "reflexless", learner: "DNK-0001" }]);
});

test("recorded learners: another condition, a falsification run, a control, a short run or another room are not", () => {
  const others = [
    resultLine({ code: "S1" }), resultLine({ command: "curut" }), resultLine({ control: "CROSS" }),
    resultLine({ trainEpisodes: 20 }), resultLine({ evalEpisodes: 2 }), resultLine({ food: 5 }), resultLine({ threats: 2 }),
  ];
  for (const line of others) assert.deepEqual(recordedLearners([line], "S1n", HUNGRY), [], line);
});

test("recorded learners: asked for a falsification run, its fresh-seed learners are chosen, not its controls or other rooms", () => {
  const lines = [
    resultLine({ command: "curut", seed: 11, learner: "DNK-0011" }), resultLine({ command: "curut", seed: 11, control: "CROSS", learner: "DNK-0012" }),
    resultLine({ command: "curut", seed: 12, control: "LOCAL", learner: "DNK-0013" }), resultLine({ command: "curut", seed: 12, food: 15, learner: "DNK-0014" }),
    resultLine({ learner: "DNK-0001" }),
  ];
  assert.deepEqual(recordedLearners(lines, "S1n", HUNGRY, "curut").map((r) => r.learner), ["DNK-0011"]);
  assert.deepEqual(recordedLearners(lines, "S1n", HUNGRY).map((r) => r.learner), ["DNK-0001"], "the default is still the screened learners");
});

test("recorded learners: a re-run of the same seed and group replaces the earlier row, keeping its place in the order", () => {
  const lines = [resultLine({ learner: "DNK-0001" }), resultLine({ seed: 2, group: "reflexive", learner: "DNK-0002" }), resultLine({ learner: "DNK-0003" }), ""];
  assert.deepEqual(recordedLearners(lines, "S1n", HUNGRY).map((r) => r.learner), ["DNK-0003", "DNK-0002"]);
});

// The mix-up of 2026-09-26: K1n's falsification run also trained learners in an "other room" of 5 food, born hungry
// (0.4), written after its fresh learners; the scarce room has 5 food too, born at 0.8.
const SCARCE = makeConfig({ initialEnergy: 0.8, threatCount: 0, foodCount: 5 });

test("recorded learners: an other room with the condition's food and threats but another birth energy does not replace its learner", () => {
  const lines = [
    resultLine({ code: "K1n", command: "curut", food: 5, energy: 0.8, seed: 11, learner: "DNK-2945" }),
    resultLine({ code: "K1n", command: "curut", food: 5, energy: 0.4, seed: 11, learner: "DNK-3185" }),
  ];
  assert.deepEqual(recordedLearners(lines, "K1n", SCARCE, "curut").map((r) => r.learner), ["DNK-2945"]);
});

test("recorded rows: the rows recorded learners are chosen from, whole", () => {
  const lines = [resultLine({ learner: "DNK-0001", twin: "DNK-0002", l: { meanDrive: 0.3 } }), resultLine({ learner: "DNK-0003", twin: "DNK-0004", l: { meanDrive: 0.2 } })];
  const rows = recordedRows(lines, "S1n", HUNGRY);
  assert.deepEqual(rows.map((r) => [r.learner, r.twin, r.l.meanDrive]), [["DNK-0003", "DNK-0004", 0.2]], "the later row of the same seed and group");
  assert.deepEqual(recordedLearners(lines, "S1n", HUNGRY), [{ seed: 1, group: "reflexless", learner: "DNK-0003" }]);
});

test("recorded learners: a row written before the energy field existed is still chosen on food and threats", () => {
  assert.deepEqual(recordedLearners([resultLine({ code: "K1n", food: 5, learner: "DNK-2778" })], "K1n", SCARCE).map((r) => r.learner), ["DNK-2778"]);
});

// --- assertBornInto, assertReplayed: the memory measurements replay only the recorded lives -----------------------------

test("born into: a subject is replayed in the world it was born into", () => {
  const store = new RegistryStore(mkdtempSync(join(tmpdir(), "brainlab-born-")));
  const s = birth(store, SCARCE, 2, "reflexless", "test");
  assert.doesNotThrow(() => assertBornInto(s, SCARCE));
});

test("born into: a world that differs only in birth energy is refused, naming the setting and both values", () => {
  const store = new RegistryStore(mkdtempSync(join(tmpdir(), "brainlab-born-")));
  const s = birth(store, makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 5 }), 2, "reflexless", "test");
  assert.throws(() => assertBornInto(s, SCARCE), new RegExp(`^Error: ${s.id} was born into another world \\(initialEnergy 0\\.4, not 0\\.8\\)`));
});

test("born into: a world that differs only in food count is refused, naming the setting", () => {
  const store = new RegistryStore(mkdtempSync(join(tmpdir(), "brainlab-born-")));
  const s = birth(store, makeConfig({ initialEnergy: 0.8, threatCount: 0, foodCount: 15 }), 2, "reflexless", "test");
  assert.throws(() => assertBornInto(s, SCARCE), /\(foodCount 15, not 5\)/);
});

test("replayed: every room ending in its recorded final hash is measured", () => {
  assert.doesNotThrow(() => assertReplayed("DNK-0001", [{ room: 1, matches: true }, { room: 2, matches: true }]));
});

test("replayed: one room that ended elsewhere stops the measurement, naming the subject and the room", () => {
  assert.throws(() => assertReplayed("DNK-0001", [{ room: 1, matches: true }, { room: 2, matches: false }]), /^Error: DNK-0001: room 2 did not end/);
});

test("replayed: a room never compared (no record) counts as not replayed", () => {
  assert.throws(() => assertReplayed("DNK-0001", [{ room: 3, matches: null }]), /DNK-0001: room 3 did not end/);
});
