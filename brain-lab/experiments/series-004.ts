// brain-lab/experiments/series-004.ts — EXPLORATORY: structural modules (TASARIM-004-MODULLER.md).
//
// Run: node --experimental-strip-types brain-lab/experiments/series-004.ts CODE [CODE ...]
//   CODE is a condition (M1a, M1b, ...) or CODE:CROSS for its delayed-dopamine control.
//
// Every condition is E7 λ 0.9 (series 002b) plus one module; seeds 1–10 × both groups, 40 training +
// 10 evaluation episodes, food 10. Each condition writes data/series-004-<CODE>-summary.json.
// Reference numbers (series 003a): E7 λ 0.9 3.16 meals/1000 ticks, turn direction 0.506; TD 8.38; oracle 12.57.
"use strict";

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { oraclePolicy } from "../baselines/index.ts";
import type { Expansion, InnateGroup } from "../development/index.ts";
import type { AgentSpec } from "../learning/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { makeConfig } from "../world/index.ts";
import { median, runCondition, type BirthOptions, type Row } from "./harness.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const store = new RegistryStore(DATA);
const codeCommit = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim();
const WORLD = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const GROUPS: InnateGroup[] = ["reflexless", "reflexive"];
type Spec = Omit<AgentSpec, "cfg" | "ledger" | "noiseSeed">;
const e7 = JSON.parse(readFileSync(join(DATA, "series-002b-E7-summary.json"), "utf8")) as { variants: { code: string; spec: Spec }[] };
const BASE = e7.variants.find((v) => v.code === "E7/lambda 0.9")!.spec;

/** The expansion layer of M2: 64 cells × 4 senses, threshold 1 (measured: ~14% of cells active per tick). */
const KC: Expansion = { cells: 64, inputs: 4, threshold: 1 };

const CONDITIONS: Record<string, { what: string; spec: Spec; born?: BirthOptions }> = {
  M1a: { what: "E7 λ0.9 + action compartments", spec: { ...BASE, compartments: { mode: "action" } } },
  M1b: { what: "E7 λ0.9 + valence compartments", spec: { ...BASE, compartments: { mode: "valence" } } },
  // T0 — diagnostic: can the brain learn "which way" from a perfect (hand-coded) teacher at all?
  T0a: { what: "E7 λ0.9, oracle teacher only (gain 0.3)", spec: { ...BASE, teacher: { policy: oraclePolicy(WORLD), gain: 0.3, mix: "only" } } },
  T0b: { what: "E7 λ0.9 + oracle teacher added to reward (gain 0.3)", spec: { ...BASE, teacher: { policy: oraclePolicy(WORLD), gain: 0.3, mix: "add" } } },
  T0c: { what: "E7 λ0.9, oracle teacher only (gain 1)", spec: { ...BASE, teacher: { policy: oraclePolicy(WORLD), gain: 1, mix: "only" } } },
  M2: { what: "E7 λ0.9 + expansion layer 64×4 t1", spec: BASE, born: { expansion: KC } },
  M2T: { what: "E7 λ0.9 + expansion layer, oracle teacher only (gain 0.3)", spec: { ...BASE, teacher: { policy: oraclePolicy(WORLD), gain: 0.3, mix: "only" } }, born: { expansion: KC } },
  M2a: { what: "E7 λ0.9 + expansion layer + action compartments", spec: { ...BASE, compartments: { mode: "action" } }, born: { expansion: KC } },
};

/** Delayed dopamine: every channel's δ comes 3000 ticks late, from another life. */
const cross = (): NonNullable<AgentSpec["deltaTransform"]> => {
  const buffers = new Map<string, number[]>();
  return (d, _tick, channel = "global") => {
    const buf = buffers.get(channel) ?? [];
    buffers.set(channel, buf);
    buf.push(d);
    return buf.length > 3000 ? buf.shift()! : 0;
  };
};

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const started = Date.now();
const jobs = process.argv.slice(2);
if (jobs.length === 0) throw new Error(`name conditions to run: ${Object.keys(CONDITIONS).join(", ")} (append :CROSS for the control)`);
for (const job of jobs) {
  const [code, control] = job.split(":") as [string, string | undefined];
  const c = CONDITIONS[code];
  if (!c) throw new Error(`unknown condition ${code}`);
  if (control !== undefined && control !== "CROSS") throw new Error(`unknown control ${control}`);
  const rows: Row[] = [];
  let line = "";
  const twins = new Map();
  // One agent per subject, so the CROSS buffer must be fresh per subject: run subjects one by one.
  for (const group of GROUPS) for (const seed of SEEDS) {
    const spec = control ? { ...c.spec, deltaTransform: cross() } : c.spec;
    const r = runCondition(store, {
      condition: { code: job, what: control ? `${c.what}, CROSS` : c.what, spec },
      world: WORLD, seeds: [seed], groups: [group], trainEpisodes: 40, evalEpisodes: 10, codeCommit, label: "series-004", twins, born: c.born,
    });
    rows.push(...r.rows);
    line = r.what;
  }
  const f = (g: (r: Row) => number) => mean(rows.map(g));
  const ahead = rows.filter((r) => r.l.perK > r.t.perK).length;
  console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${job} ${line}: ahead ${ahead}/${rows.length} | meals/1000t ${f((r) => r.l.perK).toFixed(2)} vs twin ${f((r) => r.t.perK).toFixed(2)} (median diff ${median(rows.map((r) => r.l.perK - r.t.perK)).toFixed(2)}) | life ${f((r) => r.l.ticks).toFixed(0)} | approach ${f((r) => r.l.approach).toFixed(3)} | still ${(100 * f((r) => r.l.still)).toFixed(0)}%`);
  console.log(`    turnToward learner ${f((r) => r.l.turnToward).toFixed(3)} vs twin ${f((r) => r.t.turnToward).toFixed(3)} | learner above 0.5: ${rows.filter((r) => r.l.turnToward > 0.5).length}/${rows.length} | train blocks ${[0, 1, 2, 3].map((b) => f((r) => r.trainPerK[b]!).toFixed(2)).join(" → ")}`);
  writeFileSync(join(DATA, `series-004-${job.replace(":", "-")}-summary.json`), JSON.stringify({ series: "004", exploratory: true, codeCommit, job, what: c.what, born: c.born ?? null, spec: { ...c.spec, deltaTransform: control ?? null, teacher: c.spec.teacher ? { gain: c.spec.teacher.gain, mix: c.spec.teacher.mix, policy: "oracle" } : null }, rows }, null, 2) + "\n");
}
console.log("done");
