// brain-lab/experiments/lab.ts — one command for the lab (Themis §1.5–1.6), parallel on worker threads.
//
//   npm run exp -- tara <KOD...>        screen: seeds 1–5 × both groups, 40 + 10 episodes
//   npm run exp -- dogrula <KOD...>     confirm: seeds 1–10 × both groups, with the CROSS control
//   npm run exp -- curut <KOD>          falsify: fresh seeds 11–20, CROSS, LOCAL, lesions, rooms, groups, stats
//   npm run exp -- teshis <dosya...>    what was learned (diagnose.ts), read-only
//   npm run exp -- liste                the condition catalogue
// Options: --isci N (worker threads; default cores − 2), --egitim N, --degerlendirme N.
//
// Every subject row is also appended to data/results.jsonl (one line per learner, with its twin), so
// every result of every command can be queried in one place (e.g. with DuckDB).
"use strict";

import { execSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { InnateGroup } from "../development/index.ts";
import { CONDITIONS, ROOM1, condition, room } from "./conditions.ts";
import type { Eval, Row } from "./harness.ts";
import { runJobs, type Control, type Job, type JobResult, type SubjectJob } from "./jobs.ts";
import { signTest, wilcoxon } from "./stats.ts";
import type { WorldConfig } from "../world/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const GROUPS: InnateGroup[] = ["reflexless", "reflexive"];

interface Options { workers: number; train: number; evaluate: number }

function parse(argv: string[]): { command: string; args: string[]; opts: Options } {
  const opts: Options = { workers: Math.max(1, availableParallelism() - 2), train: 40, evaluate: 10 };
  const args: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const value = () => { const v = Number(argv[++i]); if (!Number.isInteger(v) || v < 1) throw new Error(`${a} needs a positive integer`); return v; };
    if (a === "--isci") opts.workers = value();
    else if (a === "--egitim") opts.train = value();
    else if (a === "--degerlendirme") opts.evaluate = value();
    else args.push(a);
  }
  const [command = "yardim", ...rest] = args;
  return { command, args: rest, opts };
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const f3 = (x: number) => x.toFixed(3);
const evalLine = (evals: Eval[]) =>
  `dürtü ${f3(mean(evals.map((e) => e.meanDrive)))} | hayatta ${mean(evals.map((e) => e.survival)).toFixed(2)} | yönlendirme ${f3(mean(evals.map((e) => e.steering ?? 0)))} | bilgi ${mean(evals.map((e) => e.sideInfo ?? 0)).toFixed(4)} bit | yemek/1000t ${mean(evals.map((e) => e.perK)).toFixed(2)} | zarar/1000t ${mean(evals.map((e) => e.harmPerK)).toFixed(2)}`;
const pairLine = (label: string, diffs: number[]) => {
  const s = signTest(diffs), w = wilcoxon(diffs);
  return `${label}: ${s.statistic}/${s.n} lehte | işaret p ${s.p.toPrecision(3)} | Wilcoxon p ${w.p.toPrecision(3)}${w.exact ? "" : " (yaklaşık)"}`;
};

const subjects = (code: string, seeds: number[], control: Control, o: Options, label: string, world?: WorldConfig): SubjectJob[] =>
  GROUPS.flatMap((group) => seeds.map((seed) => ({ kind: "subject" as const, code, control, seed, group, world, trainEpisodes: o.train, evalEpisodes: o.evaluate, label })));
/**
 * Summary file name. A run with non-standard episode counts (a quick test) gets its own name, so it can
 * never overwrite the standard summary of the same condition (it did once: 2026-09-25).
 */
const summaryName = (stem: string, o: Options) =>
  `${stem}${o.train === 40 && o.evaluate === 10 ? "" : `-e${o.train}x${o.evaluate}`}-summary.json`;
const rowsOf = (results: JobResult[]) => results.map((r) => { if (r.kind !== "subject") throw new Error("expected a subject result"); return r.row; });

function record(command: string, code: string, control: Control, world: WorldConfig, rows: Row[], codeCommit: string, o: Options) {
  const date = new Date().toISOString();
  const lines = rows.map((r) => JSON.stringify({
    date, codeCommit, command, code, control: control ?? "none", food: world.foodCount, threats: world.threatCount,
    trainEpisodes: o.train, evalEpisodes: o.evaluate,
    seed: r.seed, group: r.group, learner: r.learner.id, twin: r.twin.id, l: r.l, t: r.t, y: r.y,
    weightEntries: r.weightEntries, criticEntries: r.criticEntries, trainPerK: r.trainPerK,
  }));
  appendFileSync(join(DATA, "results.jsonl"), lines.join("\n") + "\n");
}

async function run(jobs: Job[], o: Options, codeCommit: string): Promise<JobResult[]> {
  const started = Date.now();
  let last = 0;
  const results = await runJobs(jobs, { dataRoot: DATA, codeCommit }, o.workers, (done, total) => {
    if (Date.now() - last > 15_000 || done === total) { last = Date.now(); process.stderr.write(`  ${done}/${total} iş, ${((Date.now() - started) / 1000).toFixed(0)} sn\n`); }
  });
  return results;
}

/**
 * The yoked comparison (yoked.ts, series 005a): the learner against its own movements replayed blind. Beating
 * the twin only shows the learner moves; beating the yoked body shows it uses what it senses. Per group too.
 */
function reportYoked(rows: Row[]): void {
  for (const [label, rs] of [["hepsi", rows], ["reflekssiz", rows.filter((r) => r.group === "reflexless")], ["refleksli", rows.filter((r) => r.group === "reflexive")]] as const) {
    const withY = rs.filter((r) => r.y !== null);
    if (withY.length < 2) continue;
    console.log(`  [${label}] bağlı    ${evalLine(withY.map((r) => r.y!))}`);
    console.log(`  [${label}] ${pairLine("dürtü (bağlı − öğrenen)", withY.map((r) => r.y!.meanDrive - r.l.meanDrive))}`);
    console.log(`  [${label}] ${pairLine("yönelme (öğrenen − bağlı)", withY.map((r) => r.l.orientation - r.y!.orientation))}`);
    console.log(`  [${label}] ${pairLine("yönlendirme (öğrenen − bağlı)", withY.map((r) => (r.l.steering ?? 0) - (r.y!.steering ?? 0)))}`);
  }
}

async function screenOrConfirm(command: "tara" | "dogrula", codes: string[], o: Options, codeCommit: string) {
  const seeds = command === "tara" ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  for (const code of codes) {
    const def = condition(code);
    const world = def.world ?? ROOM1;
    const controls: Control[] = command === "tara" ? [null] : [null, "CROSS"];
    const jobs = controls.flatMap((c) => subjects(code, seeds, c, o, `lab ${command}`));
    const results = rowsOf(await run(jobs, o, codeCommit));
    const byControl = controls.map((c, i) => results.slice(i * seeds.length * 2, (i + 1) * seeds.length * 2));
    console.log(`\n${code} — ${def.what} (${command}, ${seeds.length * 2} denek)`);
    console.log(`  öğrenen   ${evalLine(byControl[0]!.map((r) => r.l))}`);
    console.log(`  ikiz      ${evalLine(byControl[0]!.map((r) => r.t))}`);
    console.log(`  ${pairLine("dürtü (ikiz − öğrenen)", byControl[0]!.map((r) => r.t.meanDrive - r.l.meanDrive))}`);
    console.log(`  ${pairLine("yönlendirme (öğrenen − ikiz)", byControl[0]!.map((r) => (r.l.steering ?? 0) - (r.t.steering ?? 0)))}`);
    reportYoked(byControl[0]!);
    if (byControl[1]) {
      console.log(`  CROSS     ${evalLine(byControl[1].map((r) => r.l))}`);
      console.log(`  ${pairLine("dürtü (CROSS − öğrenen)", byControl[0]!.map((r, i) => byControl[1]![i]!.l.meanDrive - r.l.meanDrive))}`);
    }
    controls.forEach((c, i) => record(command, code, c, world, byControl[i]!, codeCommit, o));
    const file = summaryName(`${command === "tara" ? "screen" : "confirm"}-${code}`, o);
    writeFileSync(join(DATA, file), JSON.stringify({ command, code, what: def.what, codeCommit, controls, rows: byControl[0], control: byControl[1] ?? null }, null, 2) + "\n");
    console.log(`  → data/${file}`);
  }
}

async function falsify(code: string, o: Options, codeCommit: string) {
  const def = condition(code);
  const world = def.world ?? ROOM1;
  const fresh = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const n = fresh.length * 2;
  console.log(`\nÇÜRÜTME ${code} — ${def.what} (taze seed'ler 11–20, ${n} denek)`);
  const firstWave = [...subjects(code, fresh, null, o, "lab curut"), ...subjects(code, fresh, "CROSS", o, "lab curut"), ...subjects(code, fresh, "LOCAL", o, "lab curut")];
  const wave = rowsOf(await run(firstWave, o, codeCommit));
  const [main, cross, local] = [wave.slice(0, n), wave.slice(n, 2 * n), wave.slice(2 * n)];
  record("curut", code, null, world, main, codeCommit, o);
  record("curut", code, "CROSS", world, cross, codeCommit, o);
  record("curut", code, "LOCAL", world, local, codeCommit, o);
  const lesions: [string, string][] = [["yemek ışınları", "^ray\\d+\\.food$"], ["duvar ışınları", "^ray\\d+\\.wall$"], ["tüm ışınlar", "^ray\\d+\\."], ["beden duyusu", "^proprio\\."], ["öğrenilen her şey", "."], ["karıştırılmış öğrenme (aynı değişimler, yanlış bağlantılar)", "shuffle"]];
  const lesionJobs: Job[] = lesions.flatMap(([, pattern]) => main.map((r) => ({ kind: "lesion" as const, code, learner: r.learner.id, pattern, evalEpisodes: o.evaluate, label: "lab curut lesion" })));
  const lesionEvals = (await run(lesionJobs, o, codeCommit)).map((r) => { if (r.kind !== "lesion") throw new Error("expected a lesion result"); return r.eval; });
  const rooms = [5, 15].map((food) => room(food, world.threatCount));
  const roomRows = rowsOf(await run(rooms.flatMap((w) => subjects(code, fresh.slice(0, 5), null, o, "lab curut room", w)), o, codeCommit));
  rooms.forEach((w, i) => record("curut", code, null, w, roomRows.slice(i * 10, (i + 1) * 10), codeCommit, o));

  console.log(`  öğrenen   ${evalLine(main.map((r) => r.l))}`);
  console.log(`  ikiz      ${evalLine(main.map((r) => r.t))}`);
  console.log(`  CROSS     ${evalLine(cross.map((r) => r.l))}`);
  console.log(`  LOCAL     ${evalLine(local.map((r) => r.l))}`);
  console.log(`  ${pairLine("dürtü (ikiz − öğrenen)", main.map((r) => r.t.meanDrive - r.l.meanDrive))}`);
  console.log(`  ${pairLine("yönlendirme (öğrenen − ikiz)", main.map((r) => (r.l.steering ?? 0) - (r.t.steering ?? 0)))}`);
  console.log(`  ${pairLine("dürtü (CROSS − öğrenen)", main.map((r, i) => cross[i]!.l.meanDrive - r.l.meanDrive))}`);
  console.log(`  ${pairLine("dürtü (LOCAL − öğrenen)", main.map((r, i) => local[i]!.l.meanDrive - r.l.meanDrive))}`);
  console.log(`  plastisite (defter kaydı/denek): öğrenen ${mean(main.map((r) => r.weightEntries)).toFixed(0)} | CROSS ${mean(cross.map((r) => r.weightEntries)).toFixed(0)} | LOCAL ${mean(local.map((r) => r.weightEntries)).toFixed(0)}`);
  lesions.forEach(([label], k) => {
    const ev = lesionEvals.slice(k * n, (k + 1) * n);
    console.log(`  lezyon ${label.padEnd(18)} ${evalLine(ev)}`);
    console.log(`    ${pairLine("dürtü (lezyon − öğrenen)", main.map((r, i) => ev[i]!.meanDrive - r.l.meanDrive))}`);
  });
  rooms.forEach((w, i) => {
    const rows = roomRows.slice(i * 10, (i + 1) * 10);
    console.log(`  oda ${w.foodCount} yemek: öğrenen ${evalLine(rows.map((r) => r.l))}`);
    console.log(`    ${pairLine("dürtü (ikiz − öğrenen)", rows.map((r) => r.t.meanDrive - r.l.meanDrive))}`);
  });
  for (const g of GROUPS) {
    const rows = main.filter((r) => r.group === g);
    console.log(`  grup ${g}: ${pairLine("dürtü (ikiz − öğrenen)", rows.map((r) => r.t.meanDrive - r.l.meanDrive))} | yönlendirme ${f3(mean(rows.map((r) => r.l.steering ?? 0)))}`);
  }
  const file = summaryName(`falsify-${code}`, o);
  writeFileSync(join(DATA, file), JSON.stringify({ code, what: def.what, codeCommit, main, cross, local, lesions: lesions.map(([label, pattern], k) => ({ label, pattern, evals: lesionEvals.slice(k * n, (k + 1) * n) })), rooms: roomRows }, null, 2) + "\n");
  console.log(`  → data/${file}`);
}

async function main() {
  const { command, args, opts } = parse(process.argv.slice(2));
  const codeCommit = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim();
  if (command === "tara" || command === "dogrula") await screenOrConfirm(command, args, opts, codeCommit);
  else if (command === "curut") { for (const code of args) await falsify(code, opts, codeCommit); }
  else if (command === "teshis") execSync(`node --experimental-strip-types ${JSON.stringify(join(HERE, "diagnose.ts"))} ${args.map((a) => JSON.stringify(a)).join(" ")}`, { stdio: "inherit" });
  else if (command === "liste") for (const [code, c] of Object.entries(CONDITIONS)) console.log(`${code.padEnd(8)} ${c.what}`);
  else console.log("komutlar: tara <KOD...> | dogrula <KOD...> | curut <KOD> | teshis <dosya...> | liste   (--isci N, --egitim N, --degerlendirme N)");
  console.log("done");
}

await main();
