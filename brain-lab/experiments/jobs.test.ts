// brain-lab/experiments/jobs.test.ts — the parallel runner must change nothing but the speed:
// parallel results equal sequential ones, in job order; failures surface; the catalogue is sound.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONDITIONS, E7, ROOM1 } from "./conditions.ts";
import { runJobs, type Job, type SubjectJob } from "./jobs.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const tiny = (code: string, seed: number, control: SubjectJob["control"] = null): SubjectJob =>
  ({ kind: "subject", code, control, seed, group: "reflexless", trainEpisodes: 2, evalEpisodes: 1, label: "jobs test" });
const ctx = () => ({ dataRoot: mkdtempSync(join(tmpdir(), "brainlab-jobs-")), codeCommit: "test" });
const behaviour = (r: { row: { l: unknown; t: unknown; trainPerK: unknown; weightEntries: unknown } }) =>
  JSON.stringify([r.row.l, r.row.t, r.row.trainPerK, r.row.weightEntries]);

const JOBS: Job[] = [tiny("S1n", 1), tiny("S1n", 2), tiny("A0", 3), tiny("S1n", 4, "CROSS")];

test("parallel equals sequential: same learners, same twins, same numbers", async () => {
  const sequential = await runJobs(JOBS, ctx(), 1);
  const parallel = await runJobs(JOBS, ctx(), 3);
  assert.equal(parallel.length, JOBS.length);
  parallel.forEach((r, i) => {
    assert.equal(r.kind, "subject");
    if (r.kind === "subject" && sequential[i]!.kind === "subject") assert.equal(behaviour(r), behaviour(sequential[i] as never), `job ${i}`);
  });
});

test("results come back in job order, whatever finishes first", async () => {
  const results = await runJobs(JOBS, ctx(), 3);
  results.forEach((r, i) => {
    if (r.kind === "subject") assert.equal(r.row.seed, (JOBS[i] as SubjectJob).seed, `job ${i}`);
  });
});

test("a failing job surfaces with its message; nothing is swallowed", async () => {
  await assert.rejects(runJobs([tiny("NO-SUCH-CODE", 1)], ctx(), 2), /unknown condition NO-SUCH-CODE/);
});

test("a lesion job returns the clone's evaluation", async () => {
  const c = ctx();
  const [trained] = await runJobs([tiny("S1n", 5)], c, 1);
  if (trained?.kind !== "subject") throw new Error("training job did not return a subject");
  const [lesioned] = await runJobs([{ kind: "lesion", code: "S1n", learner: trained.row.learner.id, pattern: "^ray\\d+\\.food$", evalEpisodes: 1, label: "jobs test" }], c, 2);
  assert.equal(lesioned!.kind, "lesion");
  if (lesioned!.kind === "lesion") assert.ok(Number.isFinite(lesioned!.eval.meanDrive));
});

test("catalogue: every condition builds its spec for its room", () => {
  for (const [code, c] of Object.entries(CONDITIONS)) {
    assert.doesNotThrow(() => c.spec(c.world ?? ROOM1), code);
  }
});

test("catalogue: E7 as written in code equals the spec recorded in series 002b (when that record exists)", (t) => {
  const recorded = join(HERE, "../data/series-002b-E7-summary.json");
  if (!existsSync(recorded)) { t.skip("no recorded data on this machine"); return; }
  const spec = JSON.parse(readFileSync(recorded, "utf8")).variants.find((v: { code: string }) => v.code === "E7/lambda 0.9").spec;
  assert.deepEqual(JSON.parse(JSON.stringify(E7)), spec);
});
