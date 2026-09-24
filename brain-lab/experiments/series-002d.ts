// brain-lab/experiments/series-002d.ts — EXPLORATORY: where does each candidate's advantage come from?
//
// Run: node --experimental-strip-types brain-lab/experiments/series-002d.ts
//
// 002c found that dopamine delayed 100 ticks removes most of E5's advantage but none of E10's.
// Two stronger controls, seeds 4–10 × both groups, 40 training + 10 evaluation episodes:
//   SIGN  — each tick's δ gets a random sign (seeded): magnitudes and timing kept, every
//           contingency between action and outcome destroyed.
//   CROSS — δ delayed 3000 ticks: it comes from a different episode, so even slow variables
//           (hunger level, being in a food-rich area) no longer line up.
// Predictions (written before running): E5 under SIGN and CROSS ≈ twin. E10 — if its advantage is
// learning on slow variables, SIGN ≈ twin but CROSS may keep some; if it is a side effect of its
// machinery (scaling, critic), both keep the advantage.
// Also: mean weight change per sense kind (Go − NoGo) for each variant, to see what moved.
"use strict";

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { InnateGroup } from "../development/index.ts";
import type { AgentSpec } from "../learning/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { isPlastic } from "../regions/index.ts";
import { Rng, makeConfig } from "../world/index.ts";
import { median, runCondition, type Row } from "./harness.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const store = new RegistryStore(DATA);
const codeCommit = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim();
const WORLD = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
const SEEDS = [4, 5, 6, 7, 8, 9, 10];
const GROUPS: InnateGroup[] = ["reflexless", "reflexive"];
type Spec = Omit<AgentSpec, "cfg" | "ledger" | "noiseSeed">;
const a = JSON.parse(readFileSync(join(DATA, "series-002a-summary.json"), "utf8")) as { conditions: { code: string; what: string; spec: Spec; rows: Row[] }[] };

const sign = (seed: number): AgentSpec["deltaTransform"] => {
  const rng = new Rng(seed * 7717 + 1);
  return (d) => (rng.next() < 0.5 ? -d : d);
};
const cross = (): AgentSpec["deltaTransform"] => {
  const buf: number[] = [];
  return (d) => { buf.push(d); return buf.length > 3000 ? buf.shift()! : 0; };
};
const kind = (s: string) => (/^ray\d+\.(\w+)$/.exec(s)?.[1] ? `ray·${/^ray\d+\.(\w+)$/.exec(s)![1]}` : s.split(".")[0]!);
function movedByKind(rows: Row[]) {
  const acc: Record<string, number[]> = {};
  for (const r of rows) {
    const l = store.openLedger(r.learner.id);
    for (const c of l.graph.connections.filter((x) => isPlastic(x))) {
      const b = l.birthGraph.connections.find((x) => x.from === c.from && x.to === c.to)!.weight;
      const k = `${kind(c.from)} → ${c.to.startsWith("bg.go.") ? "Go" : "NoGo"}`;
      (acc[k] ??= []).push(c.weight - b);
    }
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(4)]));
}

const started = Date.now();
const out: Record<string, unknown> = {};
for (const code of ["E5", "E10"]) {
  const base = a.conditions.find((c) => c.code === code)!;
  out[`${code}/original`] = { moved: movedByKind(base.rows) };
  for (const variant of ["SIGN", "CROSS"] as const) {
    const rows: Row[] = [];
    const twins = new Map();
    for (const group of GROUPS) for (const seed of SEEDS) {
      const deltaTransform = variant === "SIGN" ? sign(seed + (group === "reflexive" ? 100 : 0)) : cross();
      const r = runCondition(store, {
        condition: { code: `${code}-${variant}`, what: `${base.what}, ${variant}`, spec: { ...base.spec, deltaTransform } },
        world: WORLD, seeds: [seed], groups: [group], trainEpisodes: 40, evalEpisodes: 10, codeCommit, label: "series-002d", twins,
      });
      rows.push(...r.rows);
    }
    const ahead = rows.filter((r) => r.l.perK > r.t.perK).length;
    const m = (f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
    out[`${code}/${variant}`] = { ahead, of: rows.length, medianPerKDiff: median(rows.map((r) => r.l.perK - r.t.perK)), perK: m((r) => r.l.perK), twinPerK: m((r) => r.t.perK), approach: m((r) => r.l.approach), life: m((r) => r.l.ticks), moved: movedByKind(rows), rows };
    console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${code} ${variant}: ahead ${ahead}/${rows.length}, meals/1000t ${m((r) => r.l.perK).toFixed(2)} vs twin ${m((r) => r.t.perK).toFixed(2)}, approach ${m((r) => r.l.approach).toFixed(3)}, life ${m((r) => r.l.ticks).toFixed(0)}`);
  }
}
writeFileSync(join(DATA, "series-002d-summary.json"), JSON.stringify({ series: "002d", exploratory: true, codeCommit, results: out }, null, 2) + "\n");
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify((v as { moved: unknown }).moved));
