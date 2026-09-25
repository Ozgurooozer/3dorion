// brain-lab/viewer/dashboard.test.ts — the experiment dashboard shows the lab's records, so what it
// shows must be exactly what was recorded: which rows count, how they are grouped and averaged, what a
// brain learned, and what the read-only API answers (including when files are missing or broken).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BrainGrafi } from "../brain-ir/ir.ts";
import { bornGraph } from "../development/birth.ts";
import { ACTIONS } from "../regions/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { sensorimotorScaffold } from "../sensorimotor/index.ts";
import { DEFAULT_CONFIG } from "../world/index.ts";
import { createHandler } from "./api.ts";
import { learnedMatrix, learningCurve, standardRows, summarize, type EvalView, type ResultRow } from "./dashboard-data.ts";

// Values below are binary fractions (0.25, 0.125 …) so means and differences are exact and the tests
// can compare with assert.equal instead of a tolerance.

const evalView = (meanDrive: number, over: Partial<EvalView> = {}): EvalView => ({
  meanDrive, survival: 1, steering: 0, sideInfo: 0, perK: 0, harmPerK: 0, orientation: 0, ...over,
});

const row = (over: Partial<ResultRow> = {}): ResultRow => ({
  date: "2026-09-24T10:00:00Z", codeCommit: "abc", command: "tara", code: "S1n", control: "none", food: 10, threats: 0,
  trainEpisodes: 40, evalEpisodes: 10, seed: 1, group: "reflexless", learner: "DNK-0001", twin: "DNK-0002",
  l: evalView(0.25), t: evalView(0.75), trainPerK: [], ...over,
});

// --- standardRows -------------------------------------------------------------------------------

test("standardRows keeps a 40-training, 10-evaluation row", () => {
  assert.equal(standardRows([row()]).length, 1);
});

test("standardRows keeps a row that predates the episode fields (it was a standard run)", () => {
  const old = row({ trainEpisodes: undefined, evalEpisodes: undefined });
  assert.equal(standardRows([old]).length, 1);
});

test("standardRows drops a quick run with fewer training episodes", () => {
  assert.equal(standardRows([row({ trainEpisodes: 1 })]).length, 0);
});

test("standardRows drops a quick run with fewer evaluation episodes", () => {
  assert.equal(standardRows([row({ evalEpisodes: 2 })]).length, 0);
});

test("standardRows drops a repeated run of the same learner and keeps the first", () => {
  const first = row({ learner: "DNK-0001" });
  const repeat = row({ learner: "DNK-0101" });
  const kept = standardRows([first, repeat]);
  assert.equal(kept.length, 1, "the repeat must be dropped");
  assert.equal(kept[0]!.learner, "DNK-0001", "the first copy must be the one kept");
});

// One field differs at a time: each of them makes a different learner, so both rows stay.
const IDENTITY_FIELDS: readonly [string, Partial<ResultRow>][] = [
  ["command", { command: "curut" }], ["code", { code: "E7" }], ["control", { control: "CROSS" }], ["food", { food: 5 }],
  ["threats", { threats: 3 }], ["seed", { seed: 2 }], ["group", { group: "reflexive" }],
];
for (const [field, change] of IDENTITY_FIELDS) {
  test(`standardRows keeps two rows that differ only in ${field}`, () => {
    assert.equal(standardRows([row(), row(change)]).length, 2);
  });
}

// --- summarize ----------------------------------------------------------------------------------

test("summarize puts subjects of one condition (different seeds) in one group", () => {
  const groups = summarize([row({ seed: 1 }), row({ seed: 2 })]);
  assert.equal(groups.length, 1, "one group");
  assert.equal(groups[0]!.n, 2, "with both subjects");
});

test("summarize separates the same condition under a different control", () => {
  assert.equal(summarize([row(), row({ control: "CROSS" })]).length, 2);
});

test("summarize averages the learner and the twin separately", () => {
  const [g] = summarize([row({ seed: 1, l: evalView(0.25), t: evalView(0.5) }), row({ seed: 2, l: evalView(0.75), t: evalView(1) })]);
  assert.equal(g!.learner.meanDrive, 0.5, "learner mean");
  assert.equal(g!.twin.meanDrive, 0.75, "twin mean");
});

test("summarize counts a subject as better only when its drive is strictly below its twin's", () => {
  const rows = [
    row({ seed: 1, l: evalView(0.25), t: evalView(0.5) }), // better
    row({ seed: 2, l: evalView(0.5), t: evalView(0.5) }), // tie: not better
    row({ seed: 3, l: evalView(0.75), t: evalView(0.5) }), // worse
  ];
  assert.equal(summarize(rows)[0]!.driveBetter, 1);
});

test("summarize reports the newest date of the group", () => {
  const rows = [row({ seed: 1, date: "2026-09-24T12:00:00Z" }), row({ seed: 2, date: "2026-09-25T08:00:00Z" }), row({ seed: 3, date: "2026-09-23T00:00:00Z" })];
  assert.equal(summarize(rows)[0]!.lastDate, "2026-09-25T08:00:00Z");
});

test("summarize counts a missing steering (older records) as zero in the mean", () => {
  const [g] = summarize([row({ seed: 1, l: evalView(0.5, { steering: null }) }), row({ seed: 2, l: evalView(0.5, { steering: 0.5 }) })]);
  assert.equal(g!.learner.steering, 0.25);
});

test("summarize leaves quick runs out of the means", () => {
  const [g] = summarize([row({ seed: 1, l: evalView(0.25) }), row({ seed: 2, l: evalView(1), trainEpisodes: 1 })]);
  assert.equal(g!.n, 1, "only the standard run counts");
  assert.equal(g!.learner.meanDrive, 0.25, "and only its value is averaged");
});

// --- learnedMatrix ------------------------------------------------------------------------------

const graphWith = (connections: BrainGrafi["connections"]): BrainGrafi => ({ ...sensorimotorScaffold(DEFAULT_CONFIG, "test"), connections });
const edge = (from: string, to: string, weight: number) => ({ from, to, weight });

test("learnedMatrix has one column per action, in the regions' order", () => {
  const m = learnedMatrix(graphWith([edge("ray0.food", "bg.go.forward", 0)]), graphWith([edge("ray0.food", "bg.go.forward", 0)]));
  assert.deepEqual(m.actions, [...ACTIONS]);
});

test("learnedMatrix value is the Go change minus the NoGo change since birth", () => {
  const birth = graphWith([edge("ray0.food", "bg.go.left", 0.25), edge("ray0.food", "bg.nogo.left", 0.25)]);
  const now = graphWith([edge("ray0.food", "bg.go.left", 0.5), edge("ray0.food", "bg.nogo.left", 0.375)]);
  const m = learnedMatrix(birth, now);
  assert.equal(m.values[m.senses.indexOf("ray0.food")]![m.actions.indexOf("left")], 0.125);
});

test("learnedMatrix shows a strengthened NoGo as a negative value", () => {
  const birth = graphWith([edge("touch.bump", "bg.go.back", 0.25), edge("touch.bump", "bg.nogo.back", 0.25)]);
  const now = graphWith([edge("touch.bump", "bg.go.back", 0.25), edge("touch.bump", "bg.nogo.back", 0.5)]);
  const m = learnedMatrix(birth, now);
  assert.equal(m.values[m.senses.indexOf("touch.bump")]![m.actions.indexOf("back")], -0.25);
});

test("learnedMatrix is zero everywhere for a brain that never learned", () => {
  const g = bornGraph(DEFAULT_CONFIG, { seed: 1, group: "reflexless" });
  const m = learnedMatrix(g, g);
  assert.ok(m.values.flat().every((v) => v === 0), "no cell may be non-zero");
});

test("learnedMatrix has a row for every sense that reaches Go in a newborn brain", () => {
  const g = bornGraph(DEFAULT_CONFIG, { seed: 1, group: "reflexless" });
  const expected = new Set(g.connections.filter((e) => e.to.startsWith("bg.go.") && /^(ray\d+\.|touch\.|intero\.|proprio\.)/.test(e.from)).map((e) => e.from));
  assert.deepEqual(new Set(learnedMatrix(g, g).senses), expected);
});

test("learnedMatrix leaves non-sense sources (generators) out of the rows", () => {
  const g = graphWith([edge("cpg.forward", "bg.go.forward", 0.5), edge("ray1.wall", "bg.go.forward", 0)]);
  assert.deepEqual(learnedMatrix(g, g).senses, ["ray1.wall"]);
});

// --- learningCurve ------------------------------------------------------------------------------

const episode = (ticks: number, foodEaten: number) => ({ summary: { ticks, foodEaten } });

test("learningCurve is meals per 1000 ticks, one point per episode", () => {
  assert.deepEqual(learningCurve([episode(2000, 4), episode(500, 1)]), [2, 2]);
});

test("learningCurve gives zero for an episode with no ticks instead of dividing by zero", () => {
  assert.deepEqual(learningCurve([episode(0, 0)]), [0]);
});

// --- API ----------------------------------------------------------------------------------------

interface Answer { readonly status: number | null; readonly body: unknown; readonly passedOn: boolean }

/** Calls the handler the way the dev server would, and collects what it answered. */
function ask(dataRoot: string, url: string): Answer {
  let status: number | null = null;
  let text: string | null = null;
  let passedOn = false;
  const res = {
    set statusCode(s: number) { status = s; },
    setHeader: () => undefined,
    end: (t: string) => { text = t; },
  } as unknown as ServerResponse;
  createHandler(dataRoot)({ url } as IncomingMessage, res, () => { passedOn = true; });
  return { status, body: text === null ? null : JSON.parse(text), passedOn };
}

function withDataDir(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "brainlab-dashboard-"));
  try { run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test("api passes a non-API request on to the page server", () => {
  withDataDir((root) => {
    const a = ask(root, "/deneyler.html");
    assert.equal(a.passedOn, true, "next() must be called");
    assert.equal(a.status, null, "and nothing answered");
  });
});

test("api answers an unknown endpoint with 404", () => {
  withDataDir((root) => assert.equal(ask(root, "/api/nothing").status, 404));
});

test("api results are empty when no experiment has been recorded yet", () => {
  withDataDir((root) => {
    const a = ask(root, "/api/results");
    assert.equal(a.status, 200, "status");
    assert.deepEqual(a.body, { groups: [], rows: [] }, "body");
  });
});

test("api results read every line of results.jsonl and skip blank lines", () => {
  withDataDir((root) => {
    writeFileSync(join(root, "results.jsonl"), `${JSON.stringify(row({ seed: 1 }))}\n\n${JSON.stringify(row({ seed: 2 }))}\n`);
    const body = ask(root, "/api/results").body as { rows: ResultRow[]; groups: unknown[] };
    assert.equal(body.rows.length, 2, "both rows");
    assert.equal(body.groups.length, 1, "in one group");
  });
});

test("api answers a broken results file with 500 and an error message, not a crash", () => {
  withDataDir((root) => {
    writeFileSync(join(root, "results.jsonl"), "{not json\n");
    const a = ask(root, "/api/results");
    assert.equal(a.status, 500, "status");
    assert.equal(typeof (a.body as { error: unknown }).error, "string", "error message");
  });
});

test("api lists only files named like a falsification summary", () => {
  withDataDir((root) => {
    writeFileSync(join(root, "falsify-S1n-summary.json"), "{}");
    writeFileSync(join(root, "screen-S1n-summary.json"), "{}");
    writeFileSync(join(root, "falsify-S1n-summary.json.bak"), "{}");
    assert.deepEqual(ask(root, "/api/falsify").body, ["S1n"]);
  });
});

test("api returns a falsification summary as written", () => {
  withDataDir((root) => {
    writeFileSync(join(root, "falsify-T1-summary.json"), JSON.stringify({ code: "T1", main: [] }));
    const a = ask(root, "/api/falsify/T1");
    assert.equal(a.status, 200, "status");
    assert.deepEqual(a.body, { code: "T1", main: [] }, "body");
  });
});

test("api answers 404 for a falsification code that has no summary", () => {
  withDataDir((root) => assert.equal(ask(root, "/api/falsify/X9").status, 404));
});

test("api refuses a falsification code that could leave the data folder", () => {
  withDataDir((root) => assert.equal(ask(root, "/api/falsify/..%2Fsecret").status, 404));
});

test("api answers 404 for a subject that is not in the registry", () => {
  withDataDir((root) => {
    new RegistryStore(root); // an empty registry exists
    assert.equal(ask(root, "/api/subject/DNK-0042").status, 404);
  });
});

test("api shows what a subject learned, its critic values and its training curve from the records", () => {
  withDataDir((root) => {
    const store = new RegistryStore(root);
    const s = store.createSubject({ category: "learner.3f", group: "reflexless", seed: 1, worldConfig: DEFAULT_CONFIG, birthGraph: bornGraph(DEFAULT_CONFIG, { seed: 1, group: "reflexless" }), date: "2026-09-25" });
    const ledger = store.openLedger(s.id);
    const goEdge = ledger.graph.connections.find((e) => e.from === "ray2.food" && e.to === "bg.go.forward")!;
    ledger.record({ kind: "weight", tick: 1, episode: 1, cause: ["test"], edge: { from: goEdge.from, to: goEdge.to }, before: goEdge.weight, after: 0.5 });
    ledger.record({ kind: "critic", tick: 1, episode: 1, cause: ["test"], feature: "ray2.food", before: 0, after: 0.125 });
    store.saveLedger(ledger);
    store.startRun(s.id, "S1n eval"); // older, and not a training run: must not become the curve
    const run = store.startRun(s.id, "S1n train");
    const summary = { ticks: 1000, doneCause: null, foodEaten: 3, damage: 0, bumps: 0, finalHash: "h" };
    store.appendEpisode(run.id, { episode: 1, worldSeed: 1, summary, events: [] });

    const a = ask(root, `/api/subject/${s.id}`);
    assert.equal(a.status, 200, "status");
    const v = a.body as { matrix: ReturnType<typeof learnedMatrix>; criticFood: number[]; curve: number[]; ledgerEntries: number };
    const cell = v.matrix.values[v.matrix.senses.indexOf("ray2.food")]![v.matrix.actions.indexOf("forward")];
    assert.equal(cell, 0.5 - goEdge.weight, "learned Go change of ray2.food → forward (birth weight is random)");
    assert.equal(v.criticFood[2], 0.125, "critic value of ray 2 seeing food");
    assert.deepEqual(v.curve, [3], "curve from the training run only");
    assert.equal(v.ledgerEntries, 2, "ledger entries");
  });
});

// --- yoked bodies and birth energy (series 005a/005b) ----------------------------------------------------

test("rows that differ only in birth energy are different rooms, so different groups", () => {
  assert.equal(summarize([row({ energy: 0.4 }), row({ energy: 0.8 })]).length, 2);
});

test("a row without recorded energy groups with rows born at the old default energy", () => {
  assert.equal(summarize([row({ seed: 1, energy: undefined }), row({ seed: 2, energy: 0.4 })]).length, 1);
});

test("a group's yoked mean is present when every subject has a yoked body", () => {
  const [g] = summarize([row({ seed: 1, y: evalView(0.5) }), row({ seed: 2, y: evalView(0.75) })]);
  assert.equal(g!.yoked!.meanDrive, 0.625);
});

test("a group's yoked mean is absent when a subject lacks a yoked body", () => {
  const [g] = summarize([row({ seed: 1, y: evalView(0.5) }), row({ seed: 2 })]);
  assert.equal(g!.yoked, null);
});

test("api results merge a yoked re-measurement into an older row that has none", () => {
  withDataDir((root) => {
    writeFileSync(join(root, "results.jsonl"), JSON.stringify(row({ learner: "DNK-0007" })) + "\n");
    writeFileSync(join(root, "yoked-005a.jsonl"), JSON.stringify({ learner: "DNK-0007", y: evalView(0.625) }) + "\n");
    const body = ask(root, "/api/results").body as { rows: ResultRow[] };
    assert.equal(body.rows[0]!.y!.meanDrive, 0.625);
  });
});

test("api results keep a row's own yoked body over a re-measurement file", () => {
  withDataDir((root) => {
    writeFileSync(join(root, "results.jsonl"), JSON.stringify(row({ learner: "DNK-0007", y: evalView(0.25) })) + "\n");
    writeFileSync(join(root, "yoked-005a.jsonl"), JSON.stringify({ learner: "DNK-0007", y: evalView(0.625) }) + "\n");
    const body = ask(root, "/api/results").body as { rows: ResultRow[] };
    assert.equal(body.rows[0]!.y!.meanDrive, 0.25);
  });
});

test("api results fill an older row's birth energy from its condition's room (K1n: the scarce room)", () => {
  withDataDir((root) => {
    writeFileSync(join(root, "results.jsonl"), JSON.stringify(row({ code: "K1n", food: 5 })) + "\n");
    assert.equal((ask(root, "/api/results").body as { rows: ResultRow[] }).rows[0]!.energy, 0.8);
  });
});

test("api results fill an older row's birth energy with the old default when its condition has no room", () => {
  withDataDir((root) => {
    writeFileSync(join(root, "results.jsonl"), JSON.stringify(row({ code: "S1n", food: 5 })) + "\n");
    assert.equal((ask(root, "/api/results").body as { rows: ResultRow[] }).rows[0]!.energy, 0.4);
  });
});
