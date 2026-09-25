// brain-lab/experiments/diagnose.ts — what did the subjects actually learn? (Themis §1.2)
//
// Run (read-only, safe while an experiment is running):
//   node --experimental-strip-types brain-lab/experiments/diagnose.ts <summary.json> [...]
//   (file names inside brain-lab/data/; any summary whose rows carry learner ids)
//
// Per subject, from its ledger:
//   criticFood  — mean critic weight on the food rays: does seeing food predict value? (E7: 0.004)
//   criticBias  — the critic's constant term
//   ownSideGo   — mean learned change of side food rays → Go of the turn toward that side
//   otherSideGo — … → Go of the turn away from it     (own > other = side is being learned)
//   forwardGo   — … → Go forward
"use strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { actionOfAngle } from "../development/index.ts";
import type { Ledger } from "../registry/index.ts";
import { RegistryStore } from "../registry/store.ts";
import type { WorldConfig } from "../world/index.ts";

export interface Diagnosis {
  readonly criticFood: number;
  readonly criticBias: number;
  readonly ownSideGo: number;
  readonly otherSideGo: number;
  readonly forwardGo: number;
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export function diagnoseLedger(ledger: Ledger, cfg: WorldConfig): Diagnosis {
  const birth = new Map(ledger.birthGraph.connections.map((e) => [`${e.from}->${e.to}`, e.weight]));
  const now = new Map(ledger.graph.connections.map((e) => [`${e.from}->${e.to}`, e.weight]));
  const change = (from: string, to: string) => (now.get(`${from}->${to}`) ?? 0) - (birth.get(`${from}->${to}`) ?? 0);
  const own: number[] = [], other: number[] = [], forward: number[] = [];
  cfg.rayAngles.forEach((angle, i) => {
    const side = actionOfAngle(angle);
    const ray = `ray${i}.food`;
    forward.push(change(ray, "bg.go.forward"));
    if (side === "forward") return;
    own.push(change(ray, `bg.go.${side}`));
    other.push(change(ray, `bg.go.${side === "left" ? "right" : "left"}`));
  });
  return {
    criticFood: mean(cfg.rayAngles.map((_, i) => ledger.criticWeight(`ray${i}.food`))),
    criticBias: ledger.criticWeight("bias"),
    ownSideGo: mean(own),
    otherSideGo: mean(other),
    forwardGo: mean(forward),
  };
}

export function meanDiagnosis(ds: readonly Diagnosis[]): Diagnosis {
  const keys = ["criticFood", "criticBias", "ownSideGo", "otherSideGo", "forwardGo"] as const;
  return Object.fromEntries(keys.map((k) => [k, mean(ds.map((d) => d[k]))])) as unknown as Diagnosis;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const DATA = join(dirname(fileURLToPath(import.meta.url)), "../data");
  const store = new RegistryStore(DATA, { readOnly: true });
  for (const file of process.argv.slice(2)) {
    const rows = JSON.parse(readFileSync(join(DATA, file), "utf8")).rows as { learner: { id: string } }[];
    const ds = rows.map((r) => {
      const s = store.loadSubject(r.learner.id);
      return diagnoseLedger(store.openLedger(r.learner.id), s.birth.worldConfig);
    });
    const m = meanDiagnosis(ds);
    console.log(`${file} (${ds.length} learners): critic food ${m.criticFood.toFixed(4)} | critic bias ${m.criticBias.toFixed(4)} | food → Go own side ${m.ownSideGo.toFixed(3)} vs other side ${m.otherSideGo.toFixed(3)} (own > other in ${ds.filter((d) => d.ownSideGo > d.otherSideGo).length}/${ds.length}) | → forward ${m.forwardGo.toFixed(3)}`);
  }
}
