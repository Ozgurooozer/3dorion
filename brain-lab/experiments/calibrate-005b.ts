// brain-lab/experiments/calibrate-005b.ts — series 005b, step 1: which room can blind movement not win?
// (Ozyn, 2026-09-25: "even a random motor eats if it runs long enough — it must not be like this".)
// Hand-written reference bodies, no brains, measured on the evaluation rooms of seeds 1–10:
//   blind      random 10-tick bursts of any command, blind to everything (what movement alone gets)
//   centre     the blind bursts, but "food straight ahead → forward" (what S1n learned, series 005a)
//   seeker     steers to any food it sees, bursts otherwise (the directed ceiling, baselines/oracle.ts)
//   oracle     steers to food, otherwise straight ahead and turns at walls
// Rooms: food 10 / 5 / 3 / 2 / 1, no threats, born at energy 0.4 (the lab's) and 0.8 (Ozyn's suggestion).
//
//   node --experimental-strip-types brain-lab/experiments/calibrate-005b.ts
"use strict";

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { oraclePolicy, seekerPolicy } from "../baselines/index.ts";
import { Rng, makeConfig, type Action, type Policy, type WorldConfig } from "../world/index.ts";
import { measureEpisodes, type Eval } from "./harness.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ROOMS = 10;
const BURST = 10;

/** Random bursts of BURST ticks of any command; `sees` may override a tick (the body's only use of sight). */
function bursts(seed: number, sees: (obs: Parameters<Policy>[0]) => Action | null = () => null): Policy {
  const rng = new Rng(seed);
  let burst: Action = { thrust: 0, turn: 0 };
  let left = 0;
  return (obs) => {
    const seen = sees(obs);
    if (seen) return seen;
    if (left-- <= 0) {
      left = BURST - 1;
      burst = { thrust: Math.floor(rng.next() * 3) - 1, turn: Math.floor(rng.next() * 3) - 1 };
    }
    return burst;
  };
}

const CENTRE_RAY = 2;
const BODIES: Record<string, (cfg: WorldConfig, seed: number) => Policy> = {
  blind: (_cfg, seed) => bursts(seed),
  centre: (_cfg, seed) => bursts(seed, (obs) => (obs.rays[CENTRE_RAY]!.hit === "food" ? { thrust: 1, turn: 0 } : null)),
  seeker: (cfg, seed) => seekerPolicy(cfg, seed),
  oracle: (cfg) => oraclePolicy(cfg),
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const out: { food: number; energy: number; body: string; perK: number; survival: number; meanDrive: number }[] = [];
for (const energy of [0.4, 0.8]) {
  console.log(`\n=== doğum enerjisi ${energy} ===`);
  console.log("yemek  gövde     yemek/1000t  hayatta  dürtü");
  for (const food of [10, 5, 3, 2, 1]) {
    const cfg = makeConfig({ initialEnergy: energy, threatCount: 0, foodCount: food });
    for (const [name, make] of Object.entries(BODIES)) {
      const evals: Eval[] = SEEDS.map((seed) => measureEpisodes({ policy: make(cfg, seed * 7 + 3) }, cfg, seed, ROOMS, 0));
      const row = { food, energy, body: name, perK: mean(evals.map((e) => e.perK)), survival: mean(evals.map((e) => e.survival)), meanDrive: mean(evals.map((e) => e.meanDrive)) };
      out.push(row);
      console.log(`${String(food).padStart(4)}   ${name.padEnd(8)}  ${row.perK.toFixed(2).padStart(10)}  ${(100 * row.survival).toFixed(0).padStart(6)}%  ${row.meanDrive.toFixed(3)}`);
    }
  }
}
writeFileSync(join(HERE, "../data/calibrate-005b-summary.json"), JSON.stringify(out, null, 2));
