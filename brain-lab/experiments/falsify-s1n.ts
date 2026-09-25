// brain-lab/experiments/falsify-s1n.ts — try to refute "S1n learns" (Ozyn, 2026-09-25: "önce bu
// testleri çürütmeye çalışalım"). Predictions are in LAB-DEFTERI.md, written before this ran.
//
// Run: node --experimental-strip-types brain-lab/experiments/falsify-s1n.ts
//
//   F1 fresh seeds 11–20 × both groups (S1n was chosen on seeds 1–5 and confirmed on 1–10: winner's curse)
//   F2 LOCAL control — dopamine from the same episode, 200 ticks late (slow variables kept, contingency gone)
//   F3 is CROSS a fair control? — plasticity activity (ledger weight entries) under each control
//   F4 lesions — learned food edges back to birth (should fall to the twin); wall edges (should not)
//   F5 paired statistics — sign test and Wilcoxon, learner vs twin / CROSS / LOCAL / food lesion
//   F6 other rooms — 5 and 15 food
//   F7 learning curve — training meals per 10-episode block
//   F8 by innate group
"use strict";

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { InnateGroup } from "../development/index.ts";
import type { AgentSpec } from "../learning/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { makeConfig, type WorldConfig } from "../world/index.ts";
import { crossDopamine, evaluate, lesionClone, localDopamine, runCondition, type Eval, type Row } from "./harness.ts";
import { signTest, wilcoxon } from "./stats.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const store = new RegistryStore(DATA);
const codeCommit = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim();
type Spec = Omit<AgentSpec, "cfg" | "ledger" | "noiseSeed">;
const e7 = JSON.parse(readFileSync(join(DATA, "series-002b-E7-summary.json"), "utf8")) as { variants: { code: string; spec: Spec }[] };
const E7 = e7.variants.find((v) => v.code === "E7/lambda 0.9")!.spec;
const S1N: Spec = { ...E7, selection: {}, learning: { ...E7.learning, dipFloor: null } };
const ROOM = (food: number) => makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: food });
const GROUPS: InnateGroup[] = ["reflexless", "reflexive"];
const FRESH = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const started = Date.now();
const log = (s: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${s}`);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const f3 = (x: number) => x.toFixed(3);

function run(what: string, world: WorldConfig, seeds: number[], transform?: () => NonNullable<AgentSpec["deltaTransform"]>): Row[] {
  const rows: Row[] = [];
  const twins = new Map();
  for (const group of GROUPS) for (const seed of seeds) {
    const spec = transform ? { ...S1N, deltaTransform: transform() } : S1N;
    rows.push(...runCondition(store, {
      condition: { code: `falsify/${what}`, what, spec }, world, seeds: [seed], groups: [group],
      trainEpisodes: 40, evalEpisodes: 10, codeCommit, label: "falsify-s1n", twins,
    }).rows);
  }
  return rows;
}
const summary = (label: string, evals: Eval[]) =>
  `${label}: drive ${f3(mean(evals.map((e) => e.meanDrive)))} | survival ${mean(evals.map((e) => e.survival)).toFixed(2)} | steering ${f3(mean(evals.map((e) => e.steering ?? 0)))} | side info ${mean(evals.map((e) => e.sideInfo ?? 0)).toFixed(4)} | meals/1000t ${mean(evals.map((e) => e.perK)).toFixed(2)}`;
const tests = (label: string, diffs: number[]) => {
  const s = signTest(diffs), w = wilcoxon(diffs);
  return `${label}: positive ${s.statistic}/${s.n} | sign p ${s.p.toPrecision(3)} | Wilcoxon W+ ${w.statistic} p ${w.p.toPrecision(3)}${w.exact ? "" : " (normal approx.)"}`;
};
const out: Record<string, unknown> = {};

// F1 + F2 + F3: fresh seeds — learner/twin, CROSS, LOCAL.
const main = run("S1n fresh seeds", ROOM(10), FRESH);
log(summary("F1 learner", main.map((r) => r.l)));
log(summary("F1 twin   ", main.map((r) => r.t)));
const cross = run("S1n fresh seeds CROSS", ROOM(10), FRESH, () => crossDopamine());
log(summary("F1 CROSS  ", cross.map((r) => r.l)));
const local = run("S1n fresh seeds LOCAL", ROOM(10), FRESH, () => localDopamine(200));
log(summary("F2 LOCAL  ", local.map((r) => r.l)));
log(`F3 ledger weight entries per subject: learner ${mean(main.map((r) => r.weightEntries)).toFixed(0)} | CROSS ${mean(cross.map((r) => r.weightEntries)).toFixed(0)} | LOCAL ${mean(local.map((r) => r.weightEntries)).toFixed(0)}`);

// F4: lesions of the fresh learners.
const lesion = (pattern: RegExp) => main.map((r) => {
  const clone = lesionClone(store, r.learner.id, pattern, codeCommit);
  return evaluate(store, clone, ROOM(10), 10, codeCommit, `falsify-s1n lesion ${pattern.source}`, { selection: S1N.selection });
});
const foodLesion = lesion(/^ray\d+\.food$/);
log(summary("F4 food lesion", foodLesion));
const wallLesion = lesion(/^ray\d+\.wall$/);
log(summary("F4 wall lesion", wallLesion));

// F5: paired statistics (positive = the learner is better).
log(tests("F5 drive, twin − learner      ", main.map((r) => r.t.meanDrive - r.l.meanDrive)));
log(tests("F5 steering, learner − twin   ", main.map((r) => (r.l.steering ?? 0) - (r.t.steering ?? 0))));
log(tests("F5 drive, CROSS − learner     ", main.map((r, i) => cross[i]!.l.meanDrive - r.l.meanDrive)));
log(tests("F5 drive, LOCAL − learner     ", main.map((r, i) => local[i]!.l.meanDrive - r.l.meanDrive)));
log(tests("F5 drive, food lesion − learner", main.map((r, i) => foodLesion[i]!.meanDrive - r.l.meanDrive)));
log(tests("F5 drive, wall lesion − learner", main.map((r, i) => wallLesion[i]!.meanDrive - r.l.meanDrive)));

// F6: other rooms (fresh seeds 11–15).
for (const food of [5, 15]) {
  const rows = run(`S1n food ${food}`, ROOM(food), FRESH.slice(0, 5));
  log(summary(`F6 food ${food} learner`, rows.map((r) => r.l)) + " || " + summary("twin", rows.map((r) => r.t)));
  log(tests(`F6 food ${food} drive, twin − learner`, rows.map((r) => r.t.meanDrive - r.l.meanDrive)));
  out[`F6-food${food}`] = rows;
}

// F7: learning curve. F8: by group.
log(`F7 training meals/1000t per 10-episode block: ${[0, 1, 2, 3].map((b) => mean(main.map((r) => r.trainPerK[b]!)).toFixed(2)).join(" → ")}`);
for (const g of GROUPS) {
  const rows = main.filter((r) => r.group === g);
  log(`F8 ${g}: drive learner ${f3(mean(rows.map((r) => r.l.meanDrive)))} vs twin ${f3(mean(rows.map((r) => r.t.meanDrive)))} (learner lower ${rows.filter((r) => r.l.meanDrive < r.t.meanDrive).length}/${rows.length}) | steering ${f3(mean(rows.map((r) => r.l.steering ?? 0)))}`);
}

Object.assign(out, { main, cross, local, foodLesion, wallLesion });
writeFileSync(join(DATA, "falsify-s1n-summary.json"), JSON.stringify({ exploratory: true, codeCommit, spec: S1N, results: out }, null, 2) + "\n");
log("done");
console.log("done");
