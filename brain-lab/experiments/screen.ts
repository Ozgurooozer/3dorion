// brain-lab/experiments/screen.ts — FAST SCREENING (meeting 2026-09-24, K4): seeds 1–5 × both
// groups, 40 training + 10 evaluation episodes, with the calibrated measures. Only conditions that
// look promising here go on to a 20-subject confirmation with CROSS controls.
//
// Run: node --experimental-strip-types brain-lab/experiments/screen.ts CODE [CODE ...]
//
// Math audit (Ozyn, 2026-09-24): A1 normalised critic step, A2 no dip floor, A3 longer eligibility
// (λ 0.97 ≈ 1.6 s at 20 Hz), A4 all three, A5 A4 + weaker generators (0.3).
"use strict";

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { InnateGroup } from "../development/index.ts";
import type { AgentSpec } from "../learning/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { makeConfig } from "../world/index.ts";
import { runCondition, type BirthOptions, type Row } from "./harness.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const store = new RegistryStore(DATA);
const codeCommit = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim();
const WORLD = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 10 });
const SEEDS = [1, 2, 3, 4, 5];
const GROUPS: InnateGroup[] = ["reflexless", "reflexive"];
type Spec = Omit<AgentSpec, "cfg" | "ledger" | "noiseSeed">;
const e7 = JSON.parse(readFileSync(join(DATA, "series-002b-E7-summary.json"), "utf8")) as { variants: { code: string; spec: Spec }[] };
const E7 = e7.variants.find((v) => v.code === "E7/lambda 0.9")!.spec;
const learn = (patch: object): Spec["learning"] => ({ ...E7.learning, ...patch });
const NORM = { alpha: 0.03, normalize: true };
const ALL: Spec = { ...E7, critic: NORM, learning: learn({ dipFloor: null, lambda: 0.97 }) };

export const SCREEN: Record<string, { what: string; spec: Spec; born?: BirthOptions }> = {
  A0: { what: "E7 λ0.9 (reference)", spec: E7 },
  A1: { what: "E7 + normalised critic (α 0.03/‖x‖²)", spec: { ...E7, critic: NORM } },
  A2: { what: "E7 without dip floor", spec: { ...E7, learning: learn({ dipFloor: null }) } },
  A3: { what: "E7 with λ 0.97", spec: { ...E7, learning: learn({ lambda: 0.97 }) } },
  A4: { what: "E7 + all three (A1+A2+A3)", spec: ALL },
  A5: { what: "A4 + generators → Go 0.3", spec: ALL, born: { generatorToGo: 0.3 } },
};

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const started = Date.now();
for (const code of process.argv.slice(2)) {
  const c = SCREEN[code];
  if (!c) throw new Error(`unknown condition ${code}; known: ${Object.keys(SCREEN).join(", ")}`);
  const r = runCondition(store, {
    condition: { code: `screen/${code}`, what: c.what, spec: c.spec },
    world: WORLD, seeds: SEEDS, groups: GROUPS, trainEpisodes: 40, evalEpisodes: 10, codeCommit, label: "screen", born: c.born,
  });
  const rows: Row[] = r.rows;
  const f = (g: (x: Row) => number | null) => mean(rows.map((x) => g(x) ?? 0));
  console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${code} ${c.what}`);
  console.log(`    steering ${f((x) => x.l.steering).toFixed(3)} (twin ${f((x) => x.t.steering).toFixed(3)}, above 0: ${rows.filter((x) => (x.l.steering ?? 0) > 0).length}/${rows.length}) | side info ${f((x) => x.l.sideInfo).toFixed(4)} bits (twin ${f((x) => x.t.sideInfo).toFixed(4)}) | mean drive ${f((x) => x.l.meanDrive).toFixed(3)} (twin ${f((x) => x.t.meanDrive).toFixed(3)}) | survival ${f((x) => x.l.survival).toFixed(2)} (twin ${f((x) => x.t.survival).toFixed(2)}) | meals/1000t ${f((x) => x.l.perK).toFixed(2)} (twin ${f((x) => x.t.perK).toFixed(2)}) | still ${(100 * f((x) => x.l.still)).toFixed(0)}%`);
  writeFileSync(join(DATA, `screen-${code}-summary.json`), JSON.stringify({ screen: code, exploratory: true, codeCommit, what: c.what, born: c.born ?? null, spec: c.spec, rows }, null, 2) + "\n");
}
console.log("done");
