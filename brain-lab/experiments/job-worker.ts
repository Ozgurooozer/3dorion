// brain-lab/experiments/job-worker.ts — a worker thread of the job pool (jobs.ts): runs each job it is
// sent and posts the result back. Errors are reported, never swallowed.
"use strict";

import { parentPort, workerData } from "node:worker_threads";
import { runJob, type Job, type JobContext } from "./jobs.ts";

const ctx = workerData as JobContext;
parentPort!.on("message", (job: Job) => {
  try {
    parentPort!.postMessage({ ok: true, result: runJob(job, ctx) });
  } catch (e) {
    parentPort!.postMessage({ ok: false, error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) });
  }
});
