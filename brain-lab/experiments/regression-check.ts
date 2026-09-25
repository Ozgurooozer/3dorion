// brain-lab/experiments/regression-check.ts — does today's code still grow the same brains? (Themis §1.4)
// Takes recorded learners of a condition, lets the same subjects be born again in a temporary registry
// (same seed, group, room, spec), trains and evaluates them with the current code, and compares with the
// record exactly. Any difference stops the script with the subject and the numbers. Leaves no records.
//
//   node --experimental-strip-types brain-lab/experiments/regression-check.ts K1n 2
"use strict";

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { InnateGroup } from "../development/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { ROOM1, condition } from "./conditions.ts";
import { runCondition, type Eval } from "./harness.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const [code = "K1n", countArg = "2"] = process.argv.slice(2);

interface Recorded { code: string; command: string; control: string; seed: number; group: InnateGroup; trainEpisodes?: number; evalEpisodes?: number; l: Eval; t: Eval }
const recorded = readFileSync(join(DATA, "results.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Recorded)
  .filter((r) => r.code === code && r.command === "tara" && r.control === "none" && (r.trainEpisodes ?? 40) === 40 && (r.evalEpisodes ?? 10) === 10)
  .slice(0, Number(countArg));
if (!recorded.length) throw new Error(`no recorded standard runs of ${code}`);

const def = condition(code);
const world = def.world ?? ROOM1;
const root = mkdtempSync(join(tmpdir(), "brainlab-regression-"));
let failures = 0;
try {
  const store = new RegistryStore(root);
  for (const r of recorded) {
    const [row] = runCondition(store, {
      condition: { code, what: def.what, spec: def.spec(world) }, world, seeds: [r.seed], groups: [r.group],
      trainEpisodes: 40, evalEpisodes: 10, codeCommit: "regression", label: "regression", born: def.born,
    }).rows;
    const pairs: [string, number, number][] = [
      ["learner meanDrive", row!.l.meanDrive, r.l.meanDrive], ["learner perK", row!.l.perK, r.l.perK],
      ["twin meanDrive", row!.t.meanDrive, r.t.meanDrive], ["learner steering", row!.l.steering ?? 0, r.l.steering ?? 0],
    ];
    const bad = pairs.filter(([, now, then]) => now !== then);
    console.log(`${code} seed ${r.seed} ${r.group}: ${bad.length ? "DIFFERENT " + bad.map(([k, a, b]) => `${k} ${a} vs recorded ${b}`).join("; ") : "identical to the record"}`);
    failures += bad.length ? 1 : 0;
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
if (failures) {
  console.error(`${failures} subject(s) differ from the record`);
  process.exit(1);
}
