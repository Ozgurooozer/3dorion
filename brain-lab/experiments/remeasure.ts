// brain-lab/experiments/remeasure.ts — re-evaluate earlier subjects with the current measures.
//
// Run: node --experimental-strip-types brain-lab/experiments/remeasure.ts summary.json [summary.json ...]
//   (file names inside brain-lab/data/)
//
// Evaluation is deterministic: the brain on the record, the same evaluation worlds, the same noise.
// So every re-measured meals/1000 ticks must equal the recorded one exactly; if not, the script stops.
// Behaviour does not depend on the critic, compartments or a teacher (they only change learning), so
// every subject is evaluated as its brain alone. Writes data/remeasure-<file>.json.
"use strict";

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RegistryStore } from "../registry/store.ts";
import { evaluate, type Eval } from "./harness.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const store = new RegistryStore(DATA);
const codeCommit = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim();

interface RowLike { learner: { id: string }; twin: { id: string }; l: Eval; t: Eval }

/** Every row with a learner and twin, wherever it sits in a summary file. */
function rowsIn(node: unknown, found: RowLike[] = []): RowLike[] {
  if (Array.isArray(node)) { for (const x of node) rowsIn(x, found); return found; }
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (o.learner && o.twin && o.l && o.t) found.push(o as unknown as RowLike);
    else for (const v of Object.values(o)) rowsIn(v, found);
  }
  return found;
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const cache = new Map<string, Eval>();
function remeasure(id: string, recordedPerK: number): Eval {
  if (!cache.has(id)) {
    const s = store.loadSubject(id);
    cache.set(id, evaluate(store, s, s.birth.worldConfig, 10, codeCommit, "remeasure"));
  }
  const e = cache.get(id)!;
  if (e.perK !== recordedPerK) throw new Error(`${id}: re-measured ${e.perK} ≠ recorded ${recordedPerK}`);
  return e;
}

for (const file of process.argv.slice(2)) {
  const rows = rowsIn(JSON.parse(readFileSync(join(DATA, file), "utf8")));
  const out = rows.map((r) => ({ learner: r.learner.id, twin: r.twin.id, l: remeasure(r.learner.id, r.l.perK), t: remeasure(r.twin.id, r.t.perK) }));
  const st = (f: (x: (typeof out)[number]) => number | null) => mean(out.map((x) => f(x) ?? 0));
  console.log(`${file}: ${out.length} rows, meals identical | steering learner ${st((x) => x.l.steering).toFixed(3)} vs twin ${st((x) => x.t.steering).toFixed(3)} | learner above 0: ${out.filter((x) => (x.l.steering ?? 0) > 0).length}/${out.length}`);
  writeFileSync(join(DATA, `remeasure-${file}`), JSON.stringify({ file, codeCommit, rows: out }, null, 2) + "\n");
}
