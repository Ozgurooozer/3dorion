// brain-lab/experiments/critic-diagnosis.ts — why does the critic not value seeing food? (2026-09-26, A3b: the root cause
// behind three credit failures). Read-only; predictions in LAB-DEFTERI.md, 2026-09-26, "Ara rapor ve karar … koşmadan önce".
//
// K1n's recorded learners (screened seeds 1–5 and the falsification run's fresh seeds 11–20), their recorded evaluation
// rooms relived frozen (every room must end as recorded):
//   1. churn   per critic feature, the total movement Σ|Δw| written on the ledger against the net weight it ended at
//   2. ideal   the least-squares linear critic on the critic's own features (encoded senses + bias), fitted to the true
//              discounted return G_j = Σ_k γ^k r_(j+1+k), γ 0.99, r = the drive drop (dopamine's outcome); the death
//              outcome is left out (with teachAtDeath off the critic never hears it) and G is cut at the room's end.
//              R² with and without food × hunger interactions (the value of food depends on hunger; a linear critic
//              cannot say so)
//   3. offline TD on the same experience, per subject: its rooms passed 4 times (40 rooms, as training), from zero, no
//              quanta — TD(0) α 0.05 (the critic as it is), normalised TD(0) α 0.03, TD(λ 0.9) α 0.05, normalised TD(λ)
//
//   node --experimental-strip-types brain-lab/experiments/critic-diagnosis.ts
"use strict";

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAgent } from "../learning/index.ts";
import { drive } from "../neuromodulation/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { encodeObservation } from "../sensorimotor/index.ts";
import { Room, runEpisode, type Observation, type WorldConfig } from "../world/index.ts";
import { condition } from "./conditions.ts";
import { MAX_TICKS, assertBornInto, assertReplayed, evalNoise, evalWorld, recordedEvaluation, recordedLearners } from "./harness.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const GAMMA = 0.99;
const FOOD = [0, 1, 2, 3, 4].map((i) => `ray${i}.food`);

/** The critic's features of an observation, as critic.ts builds them: the encoded senses and a bias of 1. */
export function criticFeatures(obs: Observation, cfg: WorldConfig): Record<string, number> {
  return { ...(encodeObservation(obs, cfg) as Record<string, number>), bias: 1 };
}

/** One room's experience: the feature vectors of the states the critic saw, and the reward on each transition. */
export interface Room_ { readonly x: readonly number[][]; readonly r: readonly number[] }

/** Discounted returns G_j = r_(j+1) + γ G_(j+1), cut at the room's end (G of the last state 0). */
export function returns(r: readonly number[], gamma = GAMMA): number[] {
  const g = new Array<number>(r.length + 1).fill(0);
  for (let j = r.length - 1; j >= 0; j--) g[j] = r[j]! + gamma * g[j + 1]!;
  return g;
}

/** Least squares with a tiny ridge (normal equations, Gauss-Jordan); returns the weights and R². */
export function leastSquares(rows: readonly number[][], y: readonly number[]): { w: number[]; r2: number } {
  const n = rows[0]!.length;
  const a = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0));
  for (let k = 0; k < rows.length; k++) {
    const x = rows[k]!;
    for (let i = 0; i < n; i++) {
      if (x[i] === 0) continue;
      for (let j = 0; j < n; j++) a[i]![j]! += x[i]! * x[j]!;
      a[i]![n]! += x[i]! * y[k]!;
    }
  }
  for (let i = 0; i < n; i++) a[i]![i]! += 1e-9;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r]![c]!) > Math.abs(a[p]![c]!)) p = r;
    [a[c], a[p]] = [a[p]!, a[c]!];
    const d = a[c]![c]!;
    for (let j = c; j <= n; j++) a[c]![j]! /= d;
    for (let r = 0; r < n; r++) {
      if (r === c || a[r]![c] === 0) continue;
      const f = a[r]![c]!;
      for (let j = c; j <= n; j++) a[r]![j]! -= f * a[c]![j]!;
    }
  }
  const w = a.map((row) => row[n]!);
  const mean = y.reduce((s, v) => s + v, 0) / y.length;
  let sse = 0, sst = 0;
  rows.forEach((x, k) => { const p = x.reduce((s, v, i) => s + v * w[i]!, 0); sse += (y[k]! - p) ** 2; sst += (y[k]! - mean) ** 2; });
  return { w, r2: 1 - sse / sst };
}

/** Offline TD over rooms (passes × rooms, in order), from zero; normalised steps divide α by max(1, ‖x‖²) as critic.ts. */
export function offlineTD(rooms: readonly Room_[], n: number, o: { alpha: number; lambda: number; normalize: boolean; passes: number }): number[] {
  const w = new Array<number>(n).fill(0);
  const v = (x: readonly number[]) => x.reduce((s, xi, i) => s + xi * w[i]!, 0);
  for (let pass = 0; pass < o.passes; pass++) {
    for (const room of rooms) {
      const e = new Array<number>(n).fill(0);
      for (let j = 0; j + 1 < room.x.length; j++) {
        const x = room.x[j]!;
        const delta = room.r[j]! + GAMMA * v(room.x[j + 1]!) - v(x);
        const step = o.normalize ? o.alpha / Math.max(1, x.reduce((s, xi) => s + xi * xi, 0)) : o.alpha;
        for (let i = 0; i < n; i++) {
          e[i] = GAMMA * o.lambda * e[i]! + x[i]!;
          w[i]! += step * delta * e[i]!;
        }
      }
    }
  }
  return w;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const def = condition("K1n");
  const world = def.world!;
  const spec = def.spec(world);
  const store = new RegistryStore(DATA, { readOnly: true });
  const lines = readFileSync(join(DATA, "results.jsonl"), "utf8").split("\n");
  const subjects = [...recordedLearners(lines, "K1n", world, "tara"), ...recordedLearners(lines, "K1n", world, "curut")];
  let names: string[] | null = null;
  const perSubject: { id: string; rooms: Room_[]; learned: Record<string, number>; churn: Record<string, number> }[] = [];
  for (const row of subjects) {
    const subject = store.loadSubject(row.learner);
    assertBornInto(subject, world);
    const ledger = store.openLedger(row.learner);
    const churn: Record<string, number> = {};
    for (const e of ledger.entries) if (e.kind === "critic") churn[e.feature] = (churn[e.feature] ?? 0) + Math.abs(e.after - e.before);
    const agent = createAgent({ ...spec, cfg: world, ledger, noiseSeed: evalNoise(subject.birth.seed), learning: { ...spec.learning, frozen: true } });
    const rooms: Room_[] = [];
    const replayed: { room: number; matches: boolean }[] = [];
    for (const ep of recordedEvaluation(store, row.learner)!.episodes) {
      agent.startEpisode(ep.episode);
      const seen: Observation[] = [];
      const summary = runEpisode(new Room(evalWorld(subject.birth.seed, ep.episode), world), (obs, t) => { seen.push(obs); return agent.policy(obs, t); }, MAX_TICKS, false, agent.hooks);
      replayed.push({ room: ep.episode, matches: summary.finalHash === ep.summary.finalHash });
      const feats = seen.map((o) => criticFeatures(o, world));
      names ??= Object.keys(feats[0]!);
      rooms.push({ x: feats.map((f) => names!.map((k) => f[k] ?? 0)), r: seen.slice(1).map((o, j) => drive(seen[j]!) - drive(o)) });
    }
    assertReplayed(row.learner, replayed);
    perSubject.push({ id: row.learner, rooms, learned: Object.fromEntries(names!.map((k) => [k, ledger.criticWeight(k)])), churn });
    process.stdout.write(".");
  }
  const cols = names!;
  const n = cols.length;
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const foodOf = (w: Record<string, number> | number[]) => mean(FOOD.map((f) => (Array.isArray(w) ? w[cols.indexOf(f)]! : w[f] ?? 0)));

  // 1. churn
  const learnedFood = mean(perSubject.map((s) => foodOf(s.learned)));
  const moved = mean(perSubject.map((s) => mean(FOOD.map((f) => s.churn[f] ?? 0))));
  const net = mean(perSubject.map((s) => mean(FOOD.map((f) => Math.abs(s.learned[f] ?? 0)))));

  // 2. ideal linear critic (pooled), with and without food × hunger interactions
  const X: number[][] = [], XI: number[][] = [], Y: number[] = [];
  const hunger = cols.indexOf("intero.hunger");
  for (const s of perSubject) for (const room of s.rooms) {
    const g = returns(room.r);
    room.x.forEach((x, j) => { if (j >= room.r.length) return; X.push(x); XI.push([...x, ...FOOD.map((f) => x[cols.indexOf(f)]! * x[hunger]!)]); Y.push(g[j]!); });
  }
  const lin = leastSquares(X, Y);
  const inter = leastSquares(XI, Y);
  // Model-free: mean return when food is seen (any ray) against when it is not.
  let gSeen = 0, nSeen = 0, gNot = 0, nNot = 0;
  X.forEach((x, k) => { if (FOOD.some((f) => x[cols.indexOf(f)]! > 0)) { gSeen += Y[k]!; nSeen++; } else { gNot += Y[k]!; nNot++; } });

  // 3. offline TD per subject
  const algos = {
    "TD(0) α 0,05 (bugünkü)": { alpha: 0.05, lambda: 0, normalize: false, passes: 4 },
    "TD(0) normalize α 0,03": { alpha: 0.03, lambda: 0, normalize: true, passes: 4 },
    "TD(λ 0,9) α 0,05": { alpha: 0.05, lambda: 0.9, normalize: false, passes: 4 },
    "TD(λ 0,9) normalize α 0,03": { alpha: 0.03, lambda: 0.9, normalize: true, passes: 4 },
  };
  const offline = Object.fromEntries(Object.entries(algos).map(([name, o]) => {
    const ws = perSubject.map((s) => offlineTD(s.rooms, n, o));
    return [name, { food: mean(ws.map((w) => foodOf(w))), hunger: mean(ws.map((w) => w[hunger]!)), bias: mean(ws.map((w) => w[cols.indexOf("bias")]!)) }];
  }));

  const f = (x: number, d = 4) => x.toFixed(d).replace(".", ",");
  console.log(`\n=== Eleştirmen teşhisi: K1n'in ${perSubject.length} öğreneni, ${X.length} tik ===`);
  console.log(`1. dalgalanma (yemek ışınları, denek ortalaması): toplam hareket ${f(moved)} · net |ağırlık| ${f(net)} · oran ${f(moved / Math.max(net, 1e-12), 1)}`);
  console.log(`   öğrenilen yemek ağırlığı (ortalama) ${f(learnedFood)} · açlık ${f(mean(perSubject.map((s) => s.learned["intero.hunger"] ?? 0)))} · sabit ${f(mean(perSubject.map((s) => s.learned.bias ?? 0)))}`);
  console.log(`2. ideal doğrusal eleştirmen: yemek ışınları ${FOOD.map((k) => f(lin.w[cols.indexOf(k)]!)).join(" / ")} (ort. ${f(foodOf(lin.w))}) · açlık ${f(lin.w[hunger]!)} · sabit ${f(lin.w[cols.indexOf("bias")]!)} · R² ${f(lin.r2, 3)}`);
  console.log(`   açlık × yemek eklenince R² ${f(inter.r2, 3)} (+${f(inter.r2 - lin.r2, 3)}); etkileşim ağırlıkları ${FOOD.map((_, i) => f(inter.w[n + i]!)).join(" / ")}`);
  console.log(`   ortalama getiri: yemek görülürken ${f(gSeen / nSeen)} (${nSeen} tik) · görülmezken ${f(gNot / nNot)} (${nNot} tik)`);
  console.log("3. aynı deneyimde çevrimdışı TD (denek başına 40 oda, sıfırdan):");
  for (const [name, r] of Object.entries(offline)) console.log(`   ${name.padEnd(28)} yemek ${f(r.food)} · açlık ${f(r.hunger)} · sabit ${f(r.bias)}`);
  writeFileSync(join(DATA, "critic-diagnosis.json"), JSON.stringify({ subjects: perSubject.length, ticks: X.length, features: cols, churn: { moved, net }, learnedFood, ideal: { w: lin.w, r2: lin.r2 }, interaction: { w: inter.w, r2: inter.r2 }, meanReturn: { seen: gSeen / nSeen, notSeen: gNot / nNot }, offline }, null, 2) + "\n");
  console.log("\nyazıldı: data/critic-diagnosis.json");
}
