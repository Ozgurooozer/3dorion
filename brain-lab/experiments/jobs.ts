// brain-lab/experiments/jobs.ts — one unit of experimental work, and a pool that runs many in parallel.
//
// A job is plain data (it crosses a thread boundary): which condition, which control, which subject.
//   kind "subject": birth + training + evaluation of one learner and its twin → a Row
//   kind "lesion":  a lesioned clone of a trained learner, evaluated → an Eval
// runJobs(jobs, workers) runs them on worker threads and returns results in job order. Each subject
// has its own seeds, so results do not depend on scheduling; the registry is safe for parallel writers
// (index lock). workers = 1 runs everything in this thread through the very same code path.
"use strict";

import { Worker } from "node:worker_threads";
import type { InnateGroup } from "../development/index.ts";
import { RegistryStore } from "../registry/store.ts";
import type { WorldConfig } from "../world/index.ts";
import { ROOM1, condition } from "./conditions.ts";
import { crossDopamine, evaluate, lesionClone, localDopamine, runCondition, shuffledClone, type Eval, type Row } from "./harness.ts";

export type Control = "CROSS" | "LOCAL" | null;

export interface SubjectJob {
  readonly kind: "subject";
  readonly code: string;
  readonly control: Control;
  readonly seed: number;
  readonly group: InnateGroup;
  /** Room override (e.g. other food counts); default the condition's room. */
  readonly world?: WorldConfig;
  readonly trainEpisodes: number;
  readonly evalEpisodes: number;
  readonly label: string;
}

export interface LesionJob {
  readonly kind: "lesion";
  readonly code: string;
  readonly learner: string;
  /** Source pattern of the learned edges to reset, as a RegExp source ("shuffle": deal all learned changes out at random instead). */
  readonly pattern: string;
  readonly world?: WorldConfig;
  readonly evalEpisodes: number;
  readonly label: string;
}

export type Job = SubjectJob | LesionJob;
export type JobResult = { readonly kind: "subject"; readonly row: Row } | { readonly kind: "lesion"; readonly eval: Eval; readonly clone: string };

export interface JobContext { readonly dataRoot: string; readonly codeCommit: string }

/** Runs one job in this thread. */
export function runJob(job: Job, ctx: JobContext): JobResult {
  const store = new RegistryStore(ctx.dataRoot);
  const def = condition(job.code);
  const world = job.world ?? def.world ?? ROOM1;
  const spec = def.spec(world);
  if (job.kind === "lesion") {
    const clone = job.pattern === "shuffle"
      ? shuffledClone(store, job.learner, 1, ctx.codeCommit)
      : lesionClone(store, job.learner, new RegExp(job.pattern), ctx.codeCommit);
    return { kind: "lesion", clone: clone.id, eval: evaluate(store, clone, world, job.evalEpisodes, ctx.codeCommit, job.label, { selection: spec.selection ?? null, critic: spec.critic ?? null }) };
  }
  const transform = job.control === "CROSS" ? crossDopamine() : job.control === "LOCAL" ? localDopamine() : undefined;
  const r = runCondition(store, {
    condition: { code: `${job.code}${job.control ? `:${job.control}` : ""}`, what: def.what, spec: transform ? { ...spec, deltaTransform: transform } : spec },
    world, seeds: [job.seed], groups: [job.group], trainEpisodes: job.trainEpisodes, evalEpisodes: job.evalEpisodes,
    codeCommit: ctx.codeCommit, label: job.label, born: def.born,
  });
  return { kind: "subject", row: r.rows[0]! };
}

/** Runs jobs on `workers` threads (1 = this thread); results come back in job order. */
export async function runJobs(jobs: readonly Job[], ctx: JobContext, workers: number, onDone?: (done: number, total: number) => void): Promise<JobResult[]> {
  const results = new Array<JobResult>(jobs.length);
  if (workers <= 1) {
    jobs.forEach((j, i) => { results[i] = runJob(j, ctx); onDone?.(i + 1, jobs.length); });
    return results;
  }
  let next = 0, done = 0;
  const pool = Array.from({ length: Math.min(workers, jobs.length) }, () => new Worker(new URL("./job-worker.ts", import.meta.url), { workerData: ctx }));
  try {
    await Promise.all(pool.map((w) => new Promise<void>((resolve, reject) => {
      const feed = () => {
        if (next >= jobs.length) { resolve(); return; }
        const i = next++;
        w.once("message", (m: { ok: true; result: JobResult } | { ok: false; error: string }) => {
          if (!m.ok) { reject(new Error(`job ${i} (${JSON.stringify(jobs[i])}) failed: ${m.error}`)); return; }
          results[i] = m.result;
          onDone?.(++done, jobs.length);
          feed();
        });
        w.postMessage(jobs[i]);
      };
      w.once("error", reject);
      feed();
    })));
  } finally {
    await Promise.all(pool.map((w) => w.terminate()));
  }
  return results;
}
