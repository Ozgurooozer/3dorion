// brain-lab/experiments/kredi-teshis.ts — where does the credit for a turn come from? (Themis §1.2; Ozyn 2026-09-30:
// "önce kredi teşhisi")
//
// Kart 1–3: side habits grow on whatever sense is on (hunger, then the centre food ray, then with the midline rule the
// side food rays), and the side of the food does not decide the side of the turn. Two readings from the literature:
//   - contiguity ("superstition", Skinner 1948): the turn in progress when the food arrives is reinforced, whatever it
//     was; a critic that does not value seeing food (critic food weight ≈ 0.01, Kart 1) gives no earlier, side-specific
//     signal, so almost all credit is written at the meal;
//   - contingency: a critic that values food ahead makes δ positive while the body turns toward food, before the meal.
// This reads a learner's ledger and its training run (meal ticks) and splits the learned change of the turn synapses
// by where it was written (at a meal: the meal tick to two ticks after it, or elsewhere) and by what it rewarded (the
// turn toward the side the food ray sees, or away). "Net for an action": a Go change counts as is, a NoGo change with
// its sign flipped. Weights move in quanta, so a change is written on the tick its pending sum crosses a quantum: a meal's
// large δ crosses at once, a slow build-up is written wherever it happens to cross. Read-only.
//
//   node --experimental-strip-types brain-lab/experiments/kredi-teshis.ts <trainEpisodes|auto|patient> KOD [KOD…]
"use strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { actionOfAngle } from "../development/index.ts";
import { Critic, type CriticParams } from "../learning/critic.ts";
import type { Ledger, LedgerEntry } from "../registry/index.ts";
import { RegistryStore } from "../registry/store.ts";
import type { Observation, WorldConfig } from "../world/index.ts";
import { condition } from "./conditions.ts";
import { recordedRows } from "./harness.ts";
import { linesOfLength } from "./kural-olcum.ts";

type Weight = Extract<LedgerEntry, { kind: "weight" }>;
/** Which turn synapse a change is on: food seen on a side ray → turn toward it / away; centre food ray; anything else. */
export type TurnClass = "sideToward" | "sideAway" | "centreFood" | "other";
export interface Split { up: number; down: number; upAtMeal: number; downAtMeal: number }
export type Credit = Record<TurnClass, Split>;

/** Ticks after a meal that still count as "at the meal". */
export const MEAL_WINDOW = 2;

export function turnClass(from: string, to: string, cfg: WorldConfig): TurnClass | null {
  const t = /^bg\.(go|nogo)\.(left|right)$/.exec(to);
  if (!t) return null; // not a turn synapse
  const ray = /^ray(\d+)\.food$/.exec(from);
  if (!ray) return "other";
  const side = actionOfAngle(cfg.rayAngles[Number(ray[1])]!);
  if (side === "forward") return "centreFood";
  return side === t[2] ? "sideToward" : "sideAway";
}

/** The learned change of every turn synapse, net for its action, split by class and by whether a meal had just happened. */
export function creditSplit(entries: readonly LedgerEntry[], meals: ReadonlyMap<number, readonly number[]>, cfg: WorldConfig): Credit {
  const zero = (): Split => ({ up: 0, down: 0, upAtMeal: 0, downAtMeal: 0 });
  const out: Credit = { sideToward: zero(), sideAway: zero(), centreFood: zero(), other: zero() };
  for (const e of entries) {
    if (e.kind !== "weight" || !e.cause.includes("dopamine")) continue;
    const c = turnClass(e.edge.from, e.edge.to, cfg);
    if (!c) continue;
    const net = (e.after - e.before) * (e.edge.to.startsWith("bg.nogo.") ? -1 : 1);
    const atMeal = (meals.get(e.episode) ?? []).some((m) => e.tick >= m && e.tick <= m + MEAL_WINDOW);
    const s = out[c];
    if (net > 0) { s.up += net; if (atMeal) s.upAtMeal += net; } else { s.down -= net; if (atMeal) s.downAtMeal -= net; }
  }
  return out;
}

/**
 * What the learned critic says seeing food ahead (centre ray, 2 m) is worth, hungry (energy 0.4) and sated (0.9): V(food) −
 * V(nothing seen), everything else equal. Read from the ledger's critic weights with the subject's own critic features.
 * 2026-09-26 ideal (least squares on real returns, with hunger × food): ~0.077 hungry, ~0 sated.
 */
export function foodWorth(ledger: Ledger, cfg: WorldConfig, critic: Partial<CriticParams>): { hungry: number; sated: number } {
  const c = new Critic(ledger, cfg, critic);
  const centre = cfg.rayAngles.findIndex((a) => actionOfAngle(a) === "forward");
  const none = { distance: cfg.rayRange, hit: "none" as const };
  const at = (energy: number, food: boolean): Observation => ({
    rays: cfg.rayAngles.map((_, i) => (food && i === centre ? { distance: 2, hit: "food" as const } : none)),
    bump: false, energy, health: 1, motion: { forward: 0, turn: 0 },
  });
  const worth = (energy: number) => c.value(at(energy, true)) - c.value(at(energy, false));
  return { hungry: worth(0.4), sated: worth(0.9) };
}

/** Meal ticks by episode, from a subject's training run. */
export function mealTicks(runs: readonly { header: { purpose: string }; episodes: readonly { episode: number; events: readonly { tick: number; kind: string }[] }[] }[]): Map<number, number[]> {
  const train = runs.find((r) => r.header.purpose.endsWith(" train"));
  if (!train) throw new Error("no training run");
  return new Map(train.episodes.map((ep) => [ep.episode, ep.events.filter((ev) => ev.kind === "meal").map((ev) => ev.tick)]));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const DATA = join(dirname(fileURLToPath(import.meta.url)), "../data");
  const [train, ...codes] = process.argv.slice(2);
  if (!train || codes.length === 0) throw new Error("usage: kredi-teshis.ts <trainEpisodes|auto|patient> KOD [KOD…]");
  const store = new RegistryStore(DATA, { readOnly: true });
  const lines = linesOfLength(readFileSync(join(DATA, "results.jsonl"), "utf8").split("\n"), train === "auto" || train === "patient" ? train : Number(train));
  const f = (x: number) => x.toFixed(3);
  const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
  for (const code of codes) {
    const world = condition(code).world!;
    const rows = recordedRows(lines, code, world, "tara");
    if (rows.length === 0) { console.log(`${code}: no ${train}-episode rows`); continue; }
    const credits = rows.map((r) => creditSplit(store.openLedger(r.learner).entries, mealTicks(store.listRuns(r.learner)), world));
    console.log(`${code} @${train} n ${rows.length}`);
    for (const c of ["sideToward", "sideAway", "centreFood", "other"] as const) {
      const s = credits.map((k) => k[c]);
      const up = mean(s.map((x) => x.up)), down = mean(s.map((x) => x.down));
      console.log(`  ${c.padEnd(10)} up ${f(up)} (at meal ${f(mean(s.map((x) => (x.up ? x.upAtMeal / x.up : 0))))}) | down ${f(down)} (at meal ${f(mean(s.map((x) => (x.down ? x.downAtMeal / x.down : 0))))}) | net ${f(up - down)}`);
    }
    const all = credits.map((k) => Object.values(k).reduce((a, s) => ({ up: a.up + s.up, upAtMeal: a.upAtMeal + s.upAtMeal }), { up: 0, upAtMeal: 0 }));
    const towardOverAway = credits.map((k) => (k.sideAway.up ? k.sideToward.up / k.sideAway.up : Infinity));
    const criticParams = condition(code).spec(world).critic ?? {};
    const worths = rows.map((r) => foodWorth(store.openLedger(r.learner), world, criticParams));
    console.log(`  critic: food ahead (2 m) worth hungry ${f(mean(worths.map((w) => w.hungry)))} · sated ${f(mean(worths.map((w) => w.sated)))} · hungry > sated ${worths.filter((w) => w.hungry > w.sated).length}/${rows.length}`);
    console.log(`  all turn synapses: share of positive change at meals ${f(mean(all.map((a) => (a.up ? a.upAtMeal / a.up : 0))))} | side toward/away positive ${f(mean(towardOverAway.filter(Number.isFinite)))} (${towardOverAway.filter((x) => x >= 2).length}/${rows.length} ≥ 2)`);
  }
}
