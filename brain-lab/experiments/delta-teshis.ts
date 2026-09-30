// brain-lab/experiments/delta-teshis.ts — what does the teaching signal (δ) say about a turn? (Ozyn 2026-09-30, the KL
// puzzle: KL's critic gives food no value, yet KL steers most)
//
// Replays a trained learner's recorded evaluation rooms with learning frozen (the evaluation's own spec, its own noise)
// and reads the δ the learner would hear on every tick. δ on tick t+1 judges the move made on tick t (a selector acts on
// the tick it senses). Two readings:
//   turn advantage — on the ticks where food is seen on one side only (side rays, centre ray empty): mean δ after a turn
//     toward that side, after a turn away, and after no turn. A critic that teaches direction makes toward > away.
//   before the meal — mean δ over the 20 ticks before each meal, against the mean over all ticks: does value arrive
//     before the food is eaten (anticipation), or only at the meal (contiguity)?
// Read-only: the registry is opened read-only; nothing a replay writes reaches disk.
//
//   node --experimental-strip-types brain-lab/experiments/delta-teshis.ts <trainEpisodes|auto|patient> KOD [KOD…]
"use strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { actionOfAngle } from "../development/index.ts";
import { createAgent } from "../learning/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { Room, runEpisode, type Observation, type WorldConfig } from "../world/index.ts";
import { condition } from "./conditions.ts";
import { MAX_TICKS, evalNoise, evalWorld, evaluationSpec, recordedEvaluation, recordedRows } from "./harness.ts";
import { linesOfLength } from "./kural-olcum.ts";

/** One lived tick: what was seen, the turn chosen on it, and the δ heard on it (judging the previous tick's move). */
export interface Tick { readonly foodSide: "left" | "right" | null; readonly turn: number; readonly delta: number; readonly ate: boolean }

export const BEFORE_MEAL = 20;

/** Food on side rays of one side only, the centre ray not on food: the one case where a turn has a right answer. */
export function foodSide(obs: Observation, cfg: WorldConfig): "left" | "right" | null {
  let left = false, right = false;
  for (const [i, r] of obs.rays.entries()) {
    if (r.hit !== "food") continue;
    const side = actionOfAngle(cfg.rayAngles[i]!);
    if (side === "forward") return null;
    if (side === "left") left = true; else right = true;
  }
  return left === right ? null : left ? "left" : "right";
}

export interface Advantage { toward: number; away: number; straight: number; nToward: number; nAway: number; nStraight: number }

/** Mean δ on the tick after each move made with food on one side, by the move: toward, away, or no turn. */
export function turnAdvantage(ticks: readonly Tick[]): Advantage {
  const sum = { toward: 0, away: 0, straight: 0 }, n = { toward: 0, away: 0, straight: 0 };
  for (let t = 0; t + 1 < ticks.length; t++) {
    const side = ticks[t]!.foodSide;
    if (!side) continue;
    const turn = ticks[t]!.turn, k = turn === 0 ? "straight" : (turn > 0) === (side === "left") ? "toward" : "away";
    sum[k] += ticks[t + 1]!.delta; n[k]++;
  }
  const m = (k: keyof typeof n) => (n[k] ? sum[k] / n[k] : 0);
  return { toward: m("toward"), away: m("away"), straight: m("straight"), nToward: n.toward, nAway: n.away, nStraight: n.straight };
}

/** Mean δ over the BEFORE_MEAL ticks before each meal (the meal tick excluded), and over all ticks. */
export function beforeMeal(ticks: readonly Tick[]): { before: number; all: number; meals: number } {
  let s = 0, k = 0;
  const meals = ticks.flatMap((x, i) => (x.ate ? [i] : []));
  for (const m of meals) for (let t = Math.max(0, m - BEFORE_MEAL); t < m; t++) { s += ticks[t]!.delta; k++; }
  return { before: k ? s / k : 0, all: ticks.length ? ticks.reduce((a, x) => a + x.delta, 0) / ticks.length : 0, meals: meals.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const DATA = join(dirname(fileURLToPath(import.meta.url)), "../data");
  const [train, ...codes] = process.argv.slice(2);
  if (!train || codes.length === 0) throw new Error("usage: delta-teshis.ts <trainEpisodes|auto|patient> KOD [KOD…]");
  const store = new RegistryStore(DATA, { readOnly: true });
  const lines = linesOfLength(readFileSync(join(DATA, "results.jsonl"), "utf8").split("\n"), train === "auto" || train === "patient" ? train : Number(train));
  const f = (x: number) => x.toFixed(4);
  const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
  for (const code of codes) {
    const c = condition(code), world = c.world!;
    const rows = recordedRows(lines, code, world, "tara");
    if (rows.length === 0) { console.log(`${code}: no ${train}-episode rows`); continue; }
    const per = rows.map((r) => {
      const ledger = store.openLedger(r.learner);
      const heard: number[] = [];
      const spec = evaluationSpec(c.spec(world));
      const agent = createAgent({ ...spec, cfg: world, ledger, noiseSeed: evalNoise(r.seed), learning: { frozen: true }, deltaTransform: (d) => { heard.push(d); return d; } });
      const ticks: Tick[] = [];
      const recorded = recordedEvaluation(store, r.learner);
      if (!recorded) throw new Error(`${r.learner}: no recorded evaluation`);
      for (let ep = 1; ep <= 10; ep++) {
        agent.startEpisode(ep);
        heard.length = 0;
        const room = new Room(evalWorld(r.seed, ep), world);
        const seen: Observation[] = [];
        const turns: number[] = [];
        const policy = (obs: Observation, t: number) => { seen.push(obs); const a = agent.policy(obs, t); turns.push(a.turn); return a; };
        const lived = runEpisode(room, policy, MAX_TICKS, false, agent.hooks);
        // The replay must be the recorded life, room for room, or its δ says nothing about the recorded behaviour.
        const want = recorded.episodes.find((e) => e.episode === ep)?.summary.finalHash;
        if (lived.finalHash !== want) throw new Error(`${r.learner} room ${ep}: replay ${lived.finalHash} ≠ recorded ${want}`);
        seen.forEach((obs, i) => ticks.push({ foodSide: foodSide(obs, world), turn: turns[i]!, delta: heard[i] ?? 0, ate: i > 0 && obs.energy > seen[i - 1]!.energy }));
      }
      return { adv: turnAdvantage(ticks), meal: beforeMeal(ticks) };
    });
    const a = per.map((p) => p.adv), b = per.map((p) => p.meal);
    console.log(`${code} @${train} n ${rows.length}`);
    console.log(`  δ after a move with food on one side: toward ${f(mean(a.map((x) => x.toward)))} · away ${f(mean(a.map((x) => x.away)))} · no turn ${f(mean(a.map((x) => x.straight)))} | toward > away ${a.filter((x) => x.toward > x.away).length}/${a.length} | moves ${Math.round(mean(a.map((x) => x.nToward)))} / ${Math.round(mean(a.map((x) => x.nAway)))} / ${Math.round(mean(a.map((x) => x.nStraight)))}`);
    console.log(`  δ in the ${BEFORE_MEAL} ticks before a meal ${f(mean(b.map((x) => x.before)))} vs all ticks ${f(mean(b.map((x) => x.all)))} | before > all ${b.filter((x) => x.before > x.all).length}/${b.length} | meals ${Math.round(mean(b.map((x) => x.meals)))}`);
  }
}
