// brain-lab/experiments/series-003b.ts — EXPLORATORY: does an innate orienting bias let the brain
// learn WHICH WAY to turn?
//
// Run: node --experimental-strip-types brain-lab/experiments/series-003b.ts
//
// E7 with λ 0.9 (the best of series 002b), seeds 1–10 × both groups, 40 training + 10 evaluation
// episodes, food 10. Learner and twin are born with the same bias:
//   O1 — orienting "toward", MAX_ORIENTING (each ray slightly favours the Go of its own direction)
//   O2 — orienting "away",   MAX_ORIENTING (mirror control)
// O0 (no bias) is series 003a's re-measurement of E7 λ 0.9. Predictions are in LAB-DEFTERI.md.
"use strict";

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_ORIENTING, type InnateGroup, type Orienting } from "../development/index.ts";
import type { AgentSpec } from "../learning/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { makeConfig } from "../world/index.ts";
import { median, runCondition, type Row } from "./harness.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const store = new RegistryStore(DATA);
const codeCommit = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim();
const WORLD = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const GROUPS: InnateGroup[] = ["reflexless", "reflexive"];
type Spec = Omit<AgentSpec, "cfg" | "ledger" | "noiseSeed">;
const e7 = JSON.parse(readFileSync(join(DATA, "series-002b-E7-summary.json"), "utf8")) as { variants: { code: string; spec: Spec }[] };
const spec = e7.variants.find((v) => v.code === "E7/lambda 0.9")!.spec;

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const started = Date.now();
const out: Record<string, unknown> = {};
const conditions: { code: string; orienting: Orienting }[] = [
  { code: "O1", orienting: { strength: MAX_ORIENTING, direction: "toward" } },
  { code: "O2", orienting: { strength: MAX_ORIENTING, direction: "away" } },
];
for (const c of conditions) {
  const r = runCondition(store, {
    condition: { code: c.code, what: `E7 λ0.9, orienting ${c.orienting.direction} ${c.orienting.strength}`, spec },
    world: WORLD, seeds: SEEDS, groups: GROUPS, trainEpisodes: 40, evalEpisodes: 10, codeCommit, label: "series-003b", born: { orienting: c.orienting },
  });
  const rows: Row[] = r.rows;
  const turn = (f: (x: Row) => number) => mean(rows.map(f)).toFixed(3);
  console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${r.line}`);
  console.log(`    turnToward learner ${turn((x) => x.l.turnToward)} vs twin ${turn((x) => x.t.turnToward)} | median diff ${median(rows.map((x) => x.l.turnToward - x.t.turnToward)).toFixed(3)} | learner above 0.5: ${rows.filter((x) => x.l.turnToward > 0.5).length}/${rows.length}`);
  const { twins: _t, ...rest } = r;
  out[c.code] = { orienting: c.orienting, ...rest };
}
writeFileSync(join(DATA, "series-003b-summary.json"), JSON.stringify({ series: "003b", exploratory: true, codeCommit, world: WORLD, results: out }, null, 2) + "\n");
console.log("done");
