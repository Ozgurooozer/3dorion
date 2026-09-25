// brain-lab/viewer/dashboard-data.ts — the numbers behind the experiment dashboard (deneyler.html).
// Pure functions over records the lab already writes (results.jsonl rows, ledgers, run episodes);
// the dev-server API (api.ts) reads the files, this module shapes them. Nothing here measures anew.
"use strict";

import type { BrainGrafi } from "../brain-ir/ir.ts";
import { ACTIONS } from "../regions/index.ts";

/** The part of an evaluation the dashboard shows (a subset of experiments/harness.ts Eval). */
export interface EvalView {
  readonly meanDrive: number;
  readonly survival: number;
  readonly steering: number | null;
  readonly sideInfo: number | null;
  readonly perK: number;
  readonly harmPerK: number;
}

/** One line of data/results.jsonl. */
export interface ResultRow {
  readonly date: string;
  readonly codeCommit: string;
  readonly command: string;
  readonly code: string;
  readonly control: string;
  readonly food: number;
  readonly threats: number;
  readonly trainEpisodes?: number;
  readonly evalEpisodes?: number;
  readonly seed: number;
  readonly group: string;
  readonly learner: string;
  readonly twin: string;
  readonly l: EvalView;
  readonly t: EvalView;
  readonly trainPerK: readonly number[];
}

export interface GroupSummary {
  readonly key: string;
  readonly command: string;
  readonly code: string;
  readonly control: string;
  readonly food: number;
  readonly threats: number;
  readonly n: number;
  readonly learner: EvalView;
  readonly twin: EvalView;
  /** Subjects whose mean drive is below their twin's (the learner lives closer to its setpoint). */
  readonly driveBetter: number;
  readonly lastDate: string;
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const meanEval = (es: readonly EvalView[]): EvalView => ({
  meanDrive: mean(es.map((e) => e.meanDrive)),
  survival: mean(es.map((e) => e.survival)),
  steering: mean(es.map((e) => e.steering ?? 0)),
  sideInfo: mean(es.map((e) => e.sideInfo ?? 0)),
  perK: mean(es.map((e) => e.perK)),
  harmPerK: mean(es.map((e) => e.harmPerK ?? 0)),
});

/**
 * Standard runs only (40 training + 10 evaluation episodes; quick test runs are left out), one row per
 * learner — a condition run twice with the same seeds is deterministic, so the later copy is dropped.
 */
export function standardRows(rows: readonly ResultRow[]): ResultRow[] {
  const seen = new Set<string>();
  const out: ResultRow[] = [];
  for (const r of rows) {
    if ((r.trainEpisodes ?? 40) !== 40 || (r.evalEpisodes ?? 10) !== 10) continue;
    const k = `${r.command}|${r.code}|${r.control}|${r.food}|${r.threats}|${r.seed}|${r.group}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** Rows grouped by command, condition, control and room, with mean measures. */
export function summarize(rows: readonly ResultRow[]): GroupSummary[] {
  const groups = new Map<string, ResultRow[]>();
  for (const r of standardRows(rows)) {
    const key = `${r.command}|${r.code}|${r.control}|${r.food}|${r.threats}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()].map(([key, rs]) => ({
    key, command: rs[0]!.command, code: rs[0]!.code, control: rs[0]!.control, food: rs[0]!.food, threats: rs[0]!.threats,
    n: rs.length, learner: meanEval(rs.map((r) => r.l)), twin: meanEval(rs.map((r) => r.t)),
    driveBetter: rs.filter((r) => r.l.meanDrive < r.t.meanDrive).length,
    lastDate: rs.map((r) => r.date).sort().at(-1)!,
  }));
}

/**
 * What a brain learned, as a matrix: for each sense (rows) and action (columns), the change since birth of
 * Go minus the change of NoGo — positive = this sense now pushes toward this action.
 */
export interface LearnedMatrix {
  readonly senses: readonly string[];
  readonly actions: readonly string[];
  /** values[sense][action] */
  readonly values: readonly (readonly number[])[];
}

const SENSE = /^(ray\d+\.|touch\.|intero\.|proprio\.)/;
const edgeKey = (from: string, to: string) => `${from}->${to}`;

export function learnedMatrix(birth: BrainGrafi, now: BrainGrafi): LearnedMatrix {
  const birthW = new Map(birth.connections.map((e) => [edgeKey(e.from, e.to), e.weight]));
  const nowW = new Map(now.connections.map((e) => [edgeKey(e.from, e.to), e.weight]));
  const change = (from: string, to: string) => (nowW.get(edgeKey(from, to)) ?? 0) - (birthW.get(edgeKey(from, to)) ?? 0);
  const senses = [...new Set(birth.connections.filter((e) => e.to.startsWith("bg.go.") && SENSE.test(e.from)).map((e) => e.from))];
  const actions = [...ACTIONS];
  const values = senses.map((s) => actions.map((a) => change(s, `bg.go.${a}`) - change(s, `bg.nogo.${a}`)));
  return { senses, actions, values };
}

/** Meals per 1000 ticks for each training episode (the learning curve), from a run's episode lines. */
export function learningCurve(episodes: readonly { summary: { ticks: number; foodEaten: number } }[]): number[] {
  return episodes.map((e) => (e.summary.ticks > 0 ? (1000 * e.summary.foodEaten) / e.summary.ticks : 0));
}
