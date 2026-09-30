// brain-lab/experiments/yon-teshis.ts — why is the side of the food not learned? (Themis §1.2, diagnose before treating)
//
// Kart 1 (2026-09-30): food → Go grew on both turn sides (own 1.07 / other 0.84 in MU1), steering stayed near 0.1. Before a
// new architecture (stage 3, lat cells) this asks the turn axis of the finished brain directly, with the selector's own
// values(): food seen on one side ray only, at a fixed proximity and hunger, how much more does the turn toward it weigh
// than the turn away (the food margin), and how often does that margin survive the selector's noise? And the same
// while the body is already turning away at full rate (proprio of the other side on): can the food overcome the turn it
// is in? Read-only; birth graph for comparison (the twin's brain).
//
//   node --experimental-strip-types brain-lab/experiments/yon-teshis.ts <trainEpisodes|auto|patient> KOD [KOD…]
"use strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrainGrafi } from "../brain-ir/ir.ts";
import { NOISE_IDS, NoiseGenerator, actionOfAngle } from "../development/index.ts";
import { CompetitiveSelector, DEFAULT_SELECTION } from "../learning/selection.ts";
import { ACTIONS, OPPOSITE, regionOf, type ActionName } from "../regions/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { rayNodeId } from "../sensorimotor/encode.ts";
import type { WorldConfig } from "../world/index.ts";
import { condition } from "./conditions.ts";
import { recordedRows } from "./harness.ts";
import { linesOfLength } from "./kural-olcum.ts";

export interface TurnProbe {
  /** Mean over side rays of value(turn toward) − value(turn away), food on that ray only. */
  readonly foodMargin: number;
  /** Share of (side ray × noise sample) where the toward-turn beats the away-turn, noise included. */
  readonly foodWins: number;
  /** The same share while the body turns away at full rate (proprio of the away side = 1). */
  readonly foodWinsAgainstTurn: number;
  /** Mean of value(keep turning) − value(turn back) for proprio left / right = 1 alone: the pull of the turn already made. */
  readonly persevere: number;
  /** value(left) − value(right) for hunger alone: a side habit. */
  readonly hungerSide: number;
  /** foodWins for the side rays opposite the hunger habit only (all side rays when there is no habit). */
  readonly foodWinsAgainstHabit: number;
  /** value(forward) with food on the centre ray: the "food ahead → go" the brain did learn. */
  readonly forwardFood: number;
}

export interface ProbeOptions { readonly proximity: number; readonly hunger: number; readonly noiseGain: number; readonly samples: number; readonly seed: number }
export const PROBE: ProbeOptions = Object.freeze({ proximity: 0.6, hunger: 0.5, noiseGain: DEFAULT_SELECTION.noiseGain, samples: 2000, seed: 7 });

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** The turn axis of `graph` under fixed senses; the selector's own values(), its own noise generator for the noise. */
export function turnProbe(graph: BrainGrafi, cfg: WorldConfig, o: ProbeOptions = PROBE): TurnProbe {
  const sel = new CompetitiveSelector(graph, o.seed);
  const value = (senses: Record<string, number>) => sel.values(senses);
  const noise = new NoiseGenerator(o.seed);
  const draws: Record<ActionName, number>[] = [];
  for (let i = 0; i < o.samples; i++) {
    const n = noise.next();
    draws.push(Object.fromEntries(ACTIONS.map((a, k) => [a, o.noiseGain * ((n[NOISE_IDS[k]!] as number) - 0.5)])) as Record<ActionName, number>);
  }
  const sides = cfg.rayAngles.flatMap((angle, i) => { const s = actionOfAngle(angle); return s === "forward" ? [] : [[i, s] as const]; });
  const centre = cfg.rayAngles.findIndex((a) => actionOfAngle(a) === "forward");
  const margins: number[] = [], winsByRay: number[] = [];
  let winsAgainst = 0;
  for (const [i, own] of sides) {
    const away = OPPOSITE[own];
    const base = { [rayNodeId(i, "food")]: o.proximity, "intero.hunger": o.hunger };
    const v = value(base);
    const va = value({ ...base, [`proprio.${away}`]: 1 });
    margins.push(v[own] - v[away]);
    let w = 0;
    for (const d of draws) {
      if (v[own] + d[own] > v[away] + d[away]) w++;
      if (va[own] + d[own] > va[away] + d[away]) winsAgainst++;
    }
    winsByRay.push(w / draws.length);
  }
  const keep = (["left", "right"] as const).map((s) => { const v = value({ [`proprio.${s}`]: 1 }); return v[s] - v[OPPOSITE[s]]; });
  const h = value({ "intero.hunger": 1 });
  const hungerSide = h.left - h.right;
  const habit = hungerSide > 0 ? "left" : hungerSide < 0 ? "right" : null;
  const against = winsByRay.filter((_, k) => habit === null || sides[k]![1] !== habit);
  return {
    foodMargin: mean(margins),
    foodWins: mean(winsByRay),
    foodWinsAgainstTurn: winsAgainst / (sides.length * draws.length),
    persevere: mean(keep),
    hungerSide,
    foodWinsAgainstHabit: mean(against),
    forwardFood: centre < 0 ? 0 : value({ [rayNodeId(centre, "food")]: o.proximity }).forward,
  };
}

/**
 * Every learning source alone at 1: value(left) − value(right). A side habit may ride on any sense (Kart 3, 2026-09-30: in
 * H3B97 the centre food ray carried more of it than hunger did), so a claim about one carrier needs this sweep first.
 */
export function sideSweep(graph: BrainGrafi): Map<string, number> {
  const sel = new CompetitiveSelector(graph, PROBE.seed);
  const sources = new Set(graph.connections.filter((e) => /^bg\.(go|nogo)\.(left|right)$/.test(e.to) && ["sense", "rec"].includes(regionOf(e.from)?.region ?? "")).map((e) => e.from));
  const out = new Map<string, number>();
  for (const s of [...sources].sort()) { const v = sel.values({ [s]: 1 }); out.set(s, v.left - v.right); }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const DATA = join(dirname(fileURLToPath(import.meta.url)), "../data");
  const [train, ...codes] = process.argv.slice(2);
  if (!train || codes.length === 0) throw new Error("usage: yon-teshis.ts <trainEpisodes|auto|patient> KOD [KOD…]");
  const store = new RegistryStore(DATA, { readOnly: true });
  const lines = linesOfLength(readFileSync(join(DATA, "results.jsonl"), "utf8").split("\n"), train === "auto" || train === "patient" ? train : Number(train));
  const f = (x: number) => x.toFixed(3);
  const line = (label: string, ps: TurnProbe[]) =>
    `${label} margin ${f(mean(ps.map((p) => p.foodMargin)))} (>0 ${ps.filter((p) => p.foodMargin > 0).length}/${ps.length}) | wins ${f(mean(ps.map((p) => p.foodWins)))} | wins vs habit ${f(mean(ps.map((p) => p.foodWinsAgainstHabit)))} | wins vs turn ${f(mean(ps.map((p) => p.foodWinsAgainstTurn)))} | persevere ${f(mean(ps.map((p) => p.persevere)))} | hunger L−R ${f(mean(ps.map((p) => Math.abs(p.hungerSide))))} (abs) | food ahead → forward ${f(mean(ps.map((p) => p.forwardFood)))}`;
  for (const code of codes) {
    const world = condition(code).world!;
    const rows = recordedRows(lines, code, world, "tara");
    if (rows.length === 0) { console.log(`${code}: no ${train}-episode rows`); continue; }
    const ledgers = rows.map((r) => store.openLedger(r.learner));
    console.log(`${code} @${train} n ${rows.length}`);
    console.log(line("  learned", ledgers.map((l) => turnProbe(l.graph, world))));
    console.log(line("  birth  ", ledgers.map((l) => turnProbe(l.birthGraph, world))));
    const sweeps = ledgers.map((l) => sideSweep(l.graph));
    const top = [...sweeps[0]!.keys()].map((s) => [s, mean(sweeps.map((m) => Math.abs(m.get(s) ?? 0)))] as const).sort((a, b) => b[1] - a[1]).slice(0, 6);
    console.log(`  side sweep (mean |L−R|, each sense alone at 1): ${top.map(([s, v]) => `${s} ${f(v)}`).join(" · ")}`);
  }
}
