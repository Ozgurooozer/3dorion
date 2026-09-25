// brain-lab/experiments/series-005a-yoked.ts — series 005a: do the existing learners beat their yoked bodies?
// Read-only: the registry is opened read-only and nothing is recorded; each learner's frozen brain lives its
// 10 evaluation rooms again (checked equal to the recorded measurement), then its yoked body (yoked.ts) lives
// them with the learner's own movements, blind. Predictions: LAB-DEFTERI.md, 2026-09-25, series 005a.
//
//   node --experimental-strip-types brain-lab/experiments/series-005a-yoked.ts
"use strict";

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAgent } from "../learning/index.ts";
import { senseToMotorDelay } from "../regions/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { CONDITIONS } from "./conditions.ts";
import { measureEpisodes, type Eval } from "./harness.ts";
import { evalNoise } from "./seeds.ts";
import { signTest, wilcoxon } from "./stats.ts";
import { recordingActor, yokedActor } from "./yoked.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const ROOMS = 10;

/** The conditions re-measured: every standard run in room 1 (10 food, no threats), no control. */
const SETS: readonly { readonly code: string; readonly command: string }[] = [
  { code: "S1n", command: "tara" }, { code: "S1n", command: "curut" }, { code: "T1only", command: "tara" }, { code: "T1add", command: "tara" },
];

interface ResultRow { code: string; command: string; control: string; food: number; threats: number; trainEpisodes?: number; evalEpisodes?: number; seed: number; group: string; learner: string; twin: string; l: Eval; t: Eval }
interface Measured { seed: number; group: string; learner: string; l: Eval; y: Eval; t: Eval; sameAsRecorded: boolean }

const rows = readFileSync(join(DATA, "results.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as ResultRow);
const store = new RegistryStore(DATA, { readOnly: true });

function measure(r: ResultRow): Measured {
  const s = store.loadSubject(r.learner);
  const world = s.birth.worldConfig;
  const spec = CONDITIONS[r.code]!.spec(world);
  const ledger = store.openLedger(r.learner);
  const agent = createAgent({ cfg: world, ledger, noiseSeed: evalNoise(s.birth.seed), learning: { frozen: true }, critic: spec.critic ?? null, selection: spec.selection ?? null });
  const lag = spec.selection ? 0 : senseToMotorDelay(ledger.graph);
  const rec = recordingActor(agent);
  const l = measureEpisodes(rec.actor, world, s.birth.seed, ROOMS, lag);
  const y = measureEpisodes(yokedActor(rec.actions), world, s.birth.seed, ROOMS, lag);
  return { seed: r.seed, group: r.group, learner: r.learner, l, y, t: r.t, sameAsRecorded: l.perK === r.l.perK && l.meanDrive === r.l.meanDrive };
}

/** Meals per 1000 moving ticks (ticks with any thrust or turn), pooled over the rooms. */
const perMoving = (e: Eval) => (1000 * e.meals) / Math.max(1, e.ticks * (1 - e.still));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const f = (x: number, d = 3) => x.toFixed(d);
/** "k/n · p": subjects where the learner is better, and the paired Wilcoxon p. */
function paired(diffs: number[]): string {
  return `${signTest(diffs).statistic}/${diffs.length} · p ${wilcoxon(diffs).p.toPrecision(2)}`;
}

function report(label: string, ms: Measured[]) {
  const col = (k: keyof Eval, who: "l" | "y" | "t") => mean(ms.map((m) => (m[who][k] as number | null) ?? 0));
  const line = {
    label, n: ms.length, sameAsRecorded: ms.filter((m) => m.sameAsRecorded).length,
    // Meals per 1000 ticks spent moving: equal for learner and yoked body means the learner's gain comes
    // from when it moves (hunger), not from where it goes.
    mealsPerMoving: { l: mean(ms.map((m) => perMoving(m.l))), y: mean(ms.map((m) => perMoving(m.y))), lBeatsY: paired(ms.map((m) => perMoving(m.l) - perMoving(m.y))) },
    meals: { l: col("perK", "l"), y: col("perK", "y"), t: col("perK", "t"), lBeatsY: paired(ms.map((m) => m.l.perK - m.y.perK)) },
    drive: { l: col("meanDrive", "l"), y: col("meanDrive", "y"), t: col("meanDrive", "t"), lBeatsY: paired(ms.map((m) => m.y.meanDrive - m.l.meanDrive)) },
    steering: { l: col("steering", "l"), y: col("steering", "y"), lBeatsY: paired(ms.map((m) => (m.l.steering ?? 0) - (m.y.steering ?? 0))) },
    orientation: { l: col("orientation", "l"), y: col("orientation", "y"), lBeatsY: paired(ms.map((m) => m.l.orientation - m.y.orientation)) },
    bumps: { l: col("bumpsPerK", "l"), y: col("bumpsPerK", "y"), lBeatsY: paired(ms.map((m) => m.y.bumpsPerK - m.l.bumpsPerK)) },
    approach: { l: col("approach", "l"), y: col("approach", "y"), lBeatsY: paired(ms.map((m) => m.l.approach - m.y.approach)) },
    survival: { l: col("survival", "l"), y: col("survival", "y"), t: col("survival", "t") },
  };
  console.log(`\n${label}  (n ${line.n}; yeniden ölçüm kayıtla aynı: ${line.sameAsRecorded}/${line.n})`);
  console.log(`  yemek/1000t   öğrenen ${f(line.meals.l, 2)} · bağlı ${f(line.meals.y, 2)} · ikiz ${f(line.meals.t, 2)}   öğrenen>bağlı ${line.meals.lBeatsY}`);
  console.log(`  yemek/1000 hareketli tik   öğrenen ${f(line.mealsPerMoving.l, 2)} · bağlı ${f(line.mealsPerMoving.y, 2)}   öğrenen>bağlı ${line.mealsPerMoving.lBeatsY}`);
  console.log(`  dürtü         öğrenen ${f(line.drive.l)} · bağlı ${f(line.drive.y)} · ikiz ${f(line.drive.t)}   öğrenen<bağlı ${line.drive.lBeatsY}`);
  console.log(`  yönlendirme   öğrenen ${f(line.steering.l)} · bağlı ${f(line.steering.y)}   öğrenen>bağlı ${line.steering.lBeatsY}`);
  console.log(`  yaklaşma      öğrenen ${f(line.approach.l)} · bağlı ${f(line.approach.y)}   öğrenen>bağlı ${line.approach.lBeatsY}`);
  console.log(`  yemeğe yönelme ${f(line.orientation.l)} · bağlı ${f(line.orientation.y)}   öğrenen>bağlı ${line.orientation.lBeatsY}`);
  console.log(`  çarpma/1000t  öğrenen ${f(line.bumps.l, 1)} · bağlı ${f(line.bumps.y, 1)}   öğrenen<bağlı ${line.bumps.lBeatsY}`);
  console.log(`  hayatta       öğrenen ${f(line.survival.l, 2)} · bağlı ${f(line.survival.y, 2)} · ikiz ${f(line.survival.t, 2)}`);
  return line;
}

const summary: unknown[] = [];
for (const set of SETS) {
  // One subject per seed and group: a condition run twice with the same seeds gives identical brains
  // (deterministic), and counting both would double n (S1n tara was run twice).
  const seen = new Set<string>();
  const chosen = rows.filter((r) => r.code === set.code && r.command === set.command && r.control === "none" && r.food === 10 && r.threats === 0
    && (r.trainEpisodes ?? 40) === 40 && (r.evalEpisodes ?? 10) === ROOMS && !seen.has(`${r.seed}/${r.group}`) && seen.add(`${r.seed}/${r.group}`));
  const measured = chosen.map(measure);
  summary.push(report(`${set.code} ${set.command}`, measured));
  for (const group of ["reflexless", "reflexive"]) summary.push(report(`${set.code} ${set.command} · ${group}`, measured.filter((m) => m.group === group)));
}
writeFileSync(join(DATA, "series-005a-summary.json"), JSON.stringify(summary, null, 2));
