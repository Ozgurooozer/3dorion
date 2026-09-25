// brain-lab/registry/registry.test.ts — the records must be trustworthy before any brain
// learns: numbers never reused, every change on the ledger, tampering detected.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrainGrafi } from "../brain-ir/ir.ts";
import { sensorimotorScaffold } from "../sensorimotor/index.ts";
import { DEFAULT_CONFIG as C, Room, runEpisode } from "../world/index.ts";
import {
  Ledger, NAMES, describe, episodeEvents, graphHash, ledgerId, nameFor, parseId, subjectId, type LedgerInput,
} from "./index.ts";
import { RegistryStore, WRITER_LOCK } from "./store.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

function tempStore(): { store: RegistryStore; root: string; done: () => void } {
  const root = mkdtempSync(join(tmpdir(), "brainlab-registry-"));
  return { store: new RegistryStore(root), root, done: () => rmSync(root, { recursive: true, force: true }) };
}

const birthGraph = (): BrainGrafi => ({
  ...sensorimotorScaffold(C, "test-birth"),
  connections: [
    { from: "ray2.food", to: "motor.forward", weight: 0.1 },
    { from: "touch.bump", to: "motor.left", weight: 0.05 },
  ],
});

const newSubject = (store: RegistryStore, seed = 1) =>
  store.createSubject({ category: "learner.3f", group: "reflexless", seed, worldConfig: C, birthGraph: birthGraph(), date: "2026-09-24" });

const w = (before: number, after: number, tick = 1): LedgerInput => ({
  kind: "weight", tick, episode: 1, cause: ["EVT-00000001"], edge: { from: "ray2.food", to: "motor.forward" }, before, after,
});

// --- structure ---------------------------------------------------------------

test("dependencies: only store.ts touches the disk; nothing below imports the registry", () => {
  for (const f of readdirSync(HERE).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
    const src = readFileSync(join(HERE, f), "utf8");
    if (f !== "store.ts") assert.doesNotMatch(src, /from "node:/, `${f} must stay pure (browser-safe)`);
  }
  for (const dir of ["../world", "../sensorimotor", "../neuromodulation", "../brain-ir"]) {
    for (const f of readdirSync(join(HERE, dir)).filter((n) => n.endsWith(".ts"))) {
      assert.doesNotMatch(readFileSync(join(HERE, dir, f), "utf8"), /registry\//, `${dir}/${f} imports the registry`);
    }
  }
});

// --- identity ----------------------------------------------------------------

test("ids: fixed formats, parse back, reject malformed or zero", () => {
  assert.equal(subjectId(7), "DNK-0007");
  assert.equal(ledgerId(123), "LRN-00000123");
  assert.equal(parseId("DNK", "DNK-0007"), 7);
  assert.equal(parseId("DNK", "DNK-12345"), 12345, "numbers may outgrow the padding");
  for (const bad of ["DNK-007", "DNK-0000", "LRN-0001", "dnk-0001", "DNK-00a1"]) assert.throws(() => parseId("DNK", bad), RangeError, bad);
  assert.throws(() => subjectId(0), RangeError);
});

test("names: deterministic, all distinct in the first cycle, then numbered", () => {
  assert.equal(nameFor(1), "Kıvılcım");
  assert.equal(new Set(NAMES).size, NAMES.length, "duplicate name in the list");
  assert.equal(nameFor(NAMES.length + 1), "Kıvılcım 2");
  assert.equal(nameFor(2 * NAMES.length + 2), `${NAMES[1]} 3`);
});

test("numbers are never reused, even after reopening the registry", () => {
  const { store, root, done } = tempStore();
  try {
    const a = newSubject(store);
    const b = newSubject(store);
    const again = new RegistryStore(root);
    const c = newSubject(again, 3);
    assert.deepEqual([a.id, b.id, c.id], ["DNK-0001", "DNK-0002", "DNK-0003"]);
    assert.deepEqual([a.name, b.name, c.name], [nameFor(1), nameFor(2), nameFor(3)]);
    assert.equal(again.list().length, 3);
    assert.equal(describe(c), "DNK-0003 «Poyraz» · learner.3f · reflexless · E0 doğum");
  } finally { done(); }
});

test("birth is recorded: seed, date, world config, and the birth graph's hash", () => {
  const { store, done } = tempStore();
  try {
    const s = newSubject(store, 41);
    assert.equal(s.birth.seed, 41);
    assert.equal(s.birth.date, "2026-09-24");
    assert.equal(s.birth.graphHash, graphHash(birthGraph()));
    assert.deepEqual(s.birth.worldConfig, C);
    assert.equal(s.stage, "E0");
    assert.deepEqual(s.lineage, { parent: null, how: "birth" });
    const doubled = birthGraph();
    doubled.connections.push({ from: "ray2.food", to: "motor.forward", weight: 0.3 });
    assert.throws(() => store.createSubject({ category: "learner.3f", group: "none", seed: 1, worldConfig: C, birthGraph: doubled }), /duplicate edge ray2\.food->motor\.forward/);
    assert.equal(store.list().length, 1, "a refused birth must not take a number");
  } finally { done(); }
});

// --- the ledger ---------------------------------------------------------------

test("ledger: birth + entries replays to exactly the live brain", () => {
  const l = new Ledger("DNK-0001", birthGraph());
  l.record(w(0.1, 0.15));
  l.record(w(0.15, 0.12, 2));
  l.record({ kind: "node+", tick: 3, episode: 1, cause: ["growth"], node: { id: "n1", type: "neuron" } });
  l.record({ kind: "edge+", tick: 3, episode: 1, cause: ["growth"], edge: { from: "ray2.food", to: "n1", weight: 0.01 } });
  l.record({ kind: "param", tick: 4, episode: 1, cause: ["tune"], node: "motor.forward", param: "threshold", before: null, after: 0.4 });
  l.record({ kind: "edge-", tick: 5, episode: 1, cause: ["prune"], edge: { from: "touch.bump", to: "motor.left" }, before: 0.05 });
  assert.deepEqual(l.entries.map((e) => e.id), [1, 2, 3, 4, 5, 6].map(ledgerId));
  const replayed = new Ledger("DNK-0001", birthGraph(), l.entries);
  assert.equal(replayed.hash(), l.hash());
  const fwd = l.graph.connections.find((c) => c.to === "motor.forward")!;
  assert.equal(fwd.weight, 0.12);
  assert.equal(l.graph.nodes.find((n) => n.id === "motor.forward")!.threshold, 0.4);
  assert.ok(!l.graph.connections.some((c) => c.from === "touch.bump"));
});

test("ledger: an entry that does not fit the brain is refused, and nothing changes", () => {
  const l = new Ledger("DNK-0001", birthGraph());
  const h = l.hash();
  assert.throws(() => l.record(w(0.2, 0.3)), /is 0.1, entry says before=0.2/);
  assert.throws(() => l.record({ kind: "weight", tick: 1, episode: 1, cause: [], edge: { from: "ray0.food", to: "motor.back" }, before: 0, after: 1 }), /no edge/);
  assert.throws(() => l.record(w(0.1, Number.NaN)), /after=NaN/);
  assert.throws(() => l.record({ kind: "node+", tick: 1, episode: 1, cause: [], node: { id: "motor.left", type: "neuron" } }), /already exists/);
  assert.throws(() => l.record({ kind: "edge+", tick: 1, episode: 1, cause: [], edge: { from: "ray2.food", to: "ghost", weight: 1 } }), /unknown node/);
  assert.equal(l.hash(), h);
  assert.equal(l.entries.length, 0, "a refused entry must not take a number");
});

test("off-the-record learning is caught: a brain changed outside the ledger no longer matches", () => {
  const l = new Ledger("DNK-0001", birthGraph());
  l.record(w(0.1, 0.2));
  const live = structuredClone(l.graph);
  assert.equal(l.matches(live), true);
  live.connections.find((c) => c.to === "motor.forward")!.weight = 0.21;
  assert.equal(l.matches(live), false);
});

test("stages advance one milestone at a time, never backwards, and live in the ledger", () => {
  const l = new Ledger("DNK-0001", birthGraph());
  const stage = (from: "E0" | "E1" | "E2", to: "E0" | "E1" | "E2" | "E3") =>
    l.record({ kind: "stage", tick: 0, episode: 1, cause: [], from, to, reason: "test" });
  assert.throws(() => stage("E0", "E2"), /one at a time/);
  stage("E0", "E1");
  assert.throws(() => stage("E0", "E1"), /subject is at E1/);
  assert.throws(() => stage("E1", "E0" as never), /one at a time/);
  stage("E1", "E2");
  assert.equal(l.stage, "E2");
});

// --- the store ----------------------------------------------------------------

test("store round trip: ledger saved, reopened, and replayed to the same brain and stage", () => {
  const { store, done } = tempStore();
  try {
    const s = newSubject(store);
    const l = store.openLedger(s.id);
    l.record({ kind: "stage", tick: 0, episode: 1, cause: [], from: "E0", to: "E1", reason: "first tick" });
    l.record(w(0.1, 0.13));
    l.record({ kind: "stage", tick: 1, episode: 1, cause: [], from: "E1", to: "E2", reason: "first weight change" });
    assert.equal(store.saveLedger(l), 3);
    assert.equal(store.saveLedger(l), 0, "saving twice must not duplicate lines");
    const back = store.openLedger(s.id);
    assert.equal(back.hash(), l.hash());
    assert.equal(back.stage, "E2");
    assert.equal(store.loadSubject(s.id).stage, "E2");
    assert.equal(store.list()[0]!.stage, "E2");
  } finally { done(); }
});

test("tampering on disk is detected: edited value, deleted line, or edited birth graph", () => {
  const { store, root, done } = tempStore();
  try {
    const s = newSubject(store);
    const l = store.openLedger(s.id);
    l.record(w(0.1, 0.2));
    l.record(w(0.2, 0.3));
    store.saveLedger(l);
    const ledgerPath = join(root, "subjects", s.id, "ledger.jsonl");
    const original = readFileSync(ledgerPath, "utf8");

    writeFileSync(ledgerPath, original.replace('"after":0.2', '"after":0.25'));
    assert.throws(() => store.openLedger(s.id), /does not fit the brain/);

    writeFileSync(ledgerPath, original.split("\n").slice(1).join("\n"));
    assert.throws(() => store.openLedger(s.id), /gap or reorder/);

    writeFileSync(ledgerPath, original);
    const subjectPath = join(root, "subjects", s.id, "subject.json");
    const subjectJson = readFileSync(subjectPath, "utf8");
    writeFileSync(subjectPath, subjectJson.replace('"stage": "E0"', '"stage": "E3"'));
    assert.throws(() => store.openLedger(s.id), /subject.json says E3, ledger says E0/);
    writeFileSync(subjectPath, subjectJson);

    const birthPath = join(root, "subjects", s.id, "birth-graph.json");
    writeFileSync(birthPath, readFileSync(birthPath, "utf8").replace('"weight": 0.1', '"weight": 0.11'));
    assert.throws(() => store.openLedger(s.id), /birth graph does not match/);
  } finally { done(); }
});

test("a stale ledger object cannot overwrite newer entries on disk", () => {
  const { store, done } = tempStore();
  try {
    const s = newSubject(store);
    const stale = store.openLedger(s.id);
    const fresh = store.openLedger(s.id);
    fresh.record(w(0.1, 0.2));
    fresh.record(w(0.2, 0.3));
    store.saveLedger(fresh);
    stale.record(w(0.1, 0.9));
    assert.throws(() => store.saveLedger(stale), /more entries/);
    stale.record(w(0.9, 0.5)); // same length as disk now, different history
    assert.throws(() => store.saveLedger(stale), /diverges from disk at LRN-00000001/);
  } finally { done(); }
});

test("lineage: a clone is born with the parent's current brain; the parent is untouched", () => {
  const { store, done } = tempStore();
  try {
    const parent = newSubject(store);
    const l = store.openLedger(parent.id);
    l.record(w(0.1, 0.4));
    store.saveLedger(l);
    const child = store.clone(parent.id, { date: "2026-09-25" });
    assert.deepEqual(child.lineage, { parent: parent.id, how: "clone" });
    assert.equal(child.birth.graphHash, l.hash());
    assert.equal(store.openLedger(child.id).entries.length, 0, "the child starts its own ledger");
    assert.equal(store.openLedger(parent.id).hash(), l.hash());
    assert.throws(() => store.createSubject({ category: "learner.3f", group: "none", seed: 1, worldConfig: C, birthGraph: birthGraph(), lineage: { parent: "DNK-0999", how: "clone" } }), /not in the registry/);
  } finally { done(); }
});

// --- runs and events ------------------------------------------------------------

test("runs: numbered across subjects, header then one line per episode, with world events", () => {
  const { store, done } = tempStore();
  try {
    const a = newSubject(store);
    const b = newSubject(store);
    const r1 = store.startRun(a.id, "smoke", { seeds: [1] }, { date: "2026-09-24" });
    const r2 = store.startRun(b.id, "smoke", {}, { date: "2026-09-24" });
    assert.deepEqual([r1.id, r2.id], ["RUN-000001", "RUN-000002"]);
    const ep = runEpisode(new Room(7), () => ({ thrust: 0, turn: 0 }), 5000, true);
    const { records, ...summary } = ep;
    const events = episodeEvents(records);
    store.appendEpisode(r1.id, { episode: 1, worldSeed: 7, summary, events });
    const back = store.readRun(r1.id);
    assert.equal(back.header.subject, a.id);
    assert.equal(back.episodes.length, 1);
    assert.equal(back.episodes[0]!.summary.doneCause, "starved");
    assert.deepEqual(back.episodes[0]!.events.map((e) => e.kind), ["death"]);
    assert.throws(() => store.appendEpisode("RUN-999999", { episode: 1, worldSeed: 1, summary, events: [] }), /no run/);
    assert.throws(() => store.startRun("DNK-0099", "x"), /no subject/);
  } finally { done(); }
});

test("events: meals, injuries, bumps and death are numbered in tick order, continuing across episodes", () => {
  const room = new Room(1, { foodCount: 0 });
  const base = room.state();
  const hurt = Room.fromState({
    ...base,
    body: { ...base.body, x: C.width - C.bodyRadius - 0.01, heading: 0, health: 0.02 },
    entities: [
      { id: "food-0", kind: "food", x: C.width - C.bodyRadius - 0.01, y: base.body.y, r: C.foodRadius },
      { id: "threat-0", kind: "threat", x: C.width - 1, y: base.body.y, r: 1.2 },
    ],
  });
  const ep = runEpisode(hurt, () => ({ thrust: 1, turn: 0 }), 10, true);
  const events = episodeEvents(ep.records, 41);
  assert.equal(events[0]!.id, "EVT-00000041");
  const kinds = events.map((e) => e.kind);
  for (const k of ["meal", "injury", "bump", "death"] as const) assert.ok(kinds.includes(k), `missing ${k}: ${kinds.join(",")}`);
  assert.ok(events.every((e, i) => i === 0 || e.tick >= events[i - 1]!.tick));
  assert.equal(events.at(-1)!.kind, "death");
});

test("the real data folder is ignored by git (records stay out of the repo)", () => {
  const gi = readFileSync(join(HERE, "../../.gitignore"), "utf8");
  assert.match(gi, /^brain-lab\/data\/\*$/m);
  assert.match(gi, /^!brain-lab\/data\/preregistration-\*\.md$/m);
});

test("critic entries chain like weights, start at 0, and never touch the graph", () => {
  const l = new Ledger("DNK-0001", birthGraph());
  const h = l.hash();
  l.record({ kind: "critic", tick: 1, episode: 1, cause: ["td"], feature: "ray2.food", before: 0, after: 0.01 });
  l.record({ kind: "critic", tick: 2, episode: 1, cause: ["td"], feature: "ray2.food", before: 0.01, after: 0.02 });
  assert.equal(l.criticWeight("ray2.food"), 0.02);
  assert.equal(l.criticWeight("bias"), 0);
  assert.equal(l.hash(), h, "critic learning changed the brain graph");
  assert.throws(() => l.record({ kind: "critic", tick: 3, episode: 1, cause: [], feature: "ray2.food", before: 0.5, after: 1 }), /is 0.02, entry says before=0.5/);
  const replayed = new Ledger("DNK-0001", birthGraph(), l.entries);
  assert.equal(replayed.criticWeight("ray2.food"), 0.02);
});

// --- writer lock and read-only access ----------------------------------------------------------

test("lock: a registry held by another live process is refused to a second writer", () => {
  const { root, done } = tempStore();
  writeFileSync(join(root, WRITER_LOCK), JSON.stringify({ pid: process.ppid }));
  assert.throws(() => new RegistryStore(root), /being written by process/);
  done();
});

test("lock: a lock left by a dead process is taken over", () => {
  const { root, done } = tempStore();
  writeFileSync(join(root, WRITER_LOCK), JSON.stringify({ pid: 2_000_000_000 }));
  assert.doesNotThrow(() => new RegistryStore(root));
  assert.equal(JSON.parse(readFileSync(join(root, WRITER_LOCK), "utf8")).pid, process.pid);
  done();
});

test("lock: the same process may open its registry more than once", () => {
  const { root, done } = tempStore();
  assert.doesNotThrow(() => new RegistryStore(root));
  done();
});

test("read-only: opens while another process holds the lock, and reads", () => {
  const { store, root, done } = tempStore();
  const s = newSubject(store);
  writeFileSync(join(root, WRITER_LOCK), JSON.stringify({ pid: process.ppid }));
  const reader = new RegistryStore(root, { readOnly: true });
  assert.equal(reader.loadSubject(s.id).id, s.id);
  assert.ok(reader.openLedger(s.id).matches(store.openLedger(s.id).graph));
  done();
});

test("read-only: every write is refused", () => {
  const { store, root, done } = tempStore();
  const s = newSubject(store);
  const reader = new RegistryStore(root, { readOnly: true });
  assert.throws(() => newSubject(reader, 2), /read-only/);
  assert.throws(() => reader.startRun(s.id, "x"), /read-only/);
  assert.throws(() => reader.saveLedger(store.openLedger(s.id)), /read-only/);
  const run = store.startRun(s.id, "y");
  assert.throws(() => reader.appendEpisode(run.id, { episode: 1, worldSeed: 1, summary: { ticks: 0, doneCause: null, foodEaten: 0, damage: 0, bumps: 0, finalHash: "" }, events: [] }), /read-only/);
  done();
});

test("read-only: a folder without a registry is refused, not created", () => {
  const root = mkdtempSync(join(tmpdir(), "brainlab-empty-"));
  assert.throws(() => new RegistryStore(root, { readOnly: true }), /no registry/);
  assert.deepEqual(readdirSync(root), []);
  rmSync(root, { recursive: true, force: true });
});
