// brain-lab/experiments/pose-a1.ts — A1 (TASARIM-007): does the memory know where the body is? The pose module
// (H1, memory/pose.ts) listens to living bodies and is graded against the true pose. Read-only: no subject is
// created or changed and nothing is written to the registry.
//   Step 1, reference bodies (blind, centre, seeker; scarce room, seeds 1–10, 10 rooms each, as calibrate-005b):
//           choose the contact rule (keep / zero) by the mean end-of-life error, and measure the contact noise q.
//   Step 2, the gate: the ten K1n learners' recorded evaluation rooms, their frozen brains evaluated exactly as the
//           experiment did; every room is checked against its recorded final world hash.
// Three variants listen to the same life at once (the memory does not act): V0 without the sideways slide
// (TASARIM-007 as first written), V1 with it keeping the slide at contact, V2 with it zeroing the slide at contact.
// Predictions and gate: LAB-DEFTERI.md, 2026-09-26 "A1 (H1 konum) — koşmadan önce".
//
//   node --experimental-strip-types brain-lab/experiments/pose-a1.ts
"use strict";

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { burstPolicy, centrePolicy, seekerPolicy } from "../baselines/index.ts";
import { createAgent } from "../learning/index.ts";
import { MemoryCore, PoseModule, inRoom, type PoseParams } from "../memory/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { Room, runEpisode, type EpisodeHooks, type Policy, type WorldConfig } from "../world/index.ts";
import { CONDITIONS } from "./conditions.ts";
import { MAX_TICKS, evalNoise, evalWorld, recordedEvaluation } from "./harness.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");

const VARIANTS = {
  V0: { sideslip: false, contactNoise: 1 },
  V1: { sideslip: true, contact: "keep", contactNoise: 1 },
  V2: { sideslip: true, contact: "zero", contactNoise: 1 },
} as const satisfies Record<string, Partial<PoseParams>>;
type Variant = keyof typeof VARIANTS;
const NAMES = Object.keys(VARIANTS) as Variant[];

interface Graded {
  /** Error (m) at the end of the life: after the last tick the body lived and sensed. */
  end: number;
  /** Error at tick 999 / 2999 (the observation after 999 / 2999 steps), null if the body died before. */
  at1000: number | null;
  at3000: number | null;
  max: number;
  /** σ at the end with contactNoise 1; σ scales linearly with the noise, so σ = q · sigma1. */
  sigma1: number;
  headingMax: number;
}

interface Life {
  body: string;
  subject: string | null;
  seed: number;
  room: number;
  ticks: number;
  died: boolean;
  contacts: number;
  /** K1n only: the replayed room ended in the recorded final world hash. */
  matches: boolean | null;
  v: Record<Variant, Graded>;
}

/** Lives one room with the three pose variants listening; grades each tick against the true body. */
function liveGraded(cfg: WorldConfig, worldSeed: number, policy: Policy, hooks?: EpisodeHooks) {
  const room = new Room(worldSeed, cfg);
  const start = room.state().body;
  const modules = Object.fromEntries(NAMES.map((n) => [n, new PoseModule(cfg, VARIANTS[n])])) as Record<Variant, PoseModule>;
  const cores = NAMES.map((n) => new MemoryCore([modules[n]]));
  const g = Object.fromEntries(NAMES.map((n) => [n, { end: 0, at1000: null, at3000: null, max: 0, sigma1: 0, headingMax: 0 }])) as Record<Variant, Graded>;
  let contacts = 0;
  const summary = runEpisode(room, (obs, t) => {
    for (const c of cores) c.observe(obs, t);
    if (obs.bump) contacts++;
    const body = room.state().body;
    for (const n of NAMES) {
      const pose = modules[n].pose;
      const p = inRoom(pose, start);
      const e = Math.hypot(p.x - body.x, p.y - body.y);
      const h = Math.abs(pose.heading - body.heading); // both frames face the same way at the start (heading 0)
      const r = g[n];
      r.end = e;
      r.max = Math.max(r.max, e);
      r.headingMax = Math.max(r.headingMax, h);
      r.sigma1 = pose.sigma;
      if (t === 999) r.at1000 = e;
      if (t === MAX_TICKS - 1) r.at3000 = e;
    }
    return policy(obs, t);
  }, MAX_TICKS, false, hooks);
  if (start.heading !== 0) throw new Error("the grading assumes bodies start facing 0");
  return { summary, graded: g, contacts };
}

// --- step 1: reference bodies ----------------------------------------------------------------------------------------

const K1N = CONDITIONS.K1n!;
const WORLD = K1N.world!;
const REFERENCE: Record<string, (seed: number) => Policy> = {
  blind: (seed) => burstPolicy(seed),
  centre: (seed) => centrePolicy(WORLD, seed),
  seeker: (seed) => seekerPolicy(WORLD, seed),
};
const lives: Life[] = [];
for (const [body, make] of Object.entries(REFERENCE)) {
  for (let seed = 1; seed <= 10; seed++) {
    const policy = make(seed * 7 + 3); // the policy seeds calibrate-005b used
    for (let ep = 1; ep <= 10; ep++) {
      const { summary, graded, contacts } = liveGraded(WORLD, evalWorld(seed, ep), policy);
      lives.push({ body, subject: null, seed, room: ep, ticks: summary.ticks, died: summary.doneCause !== null, contacts, matches: null, v: graded });
    }
  }
}

// --- step 2: the K1n learners, as evaluated -------------------------------------------------------------------------

interface ResultLine { code: string; seed: number; group: string; learner: string; evalEpisodes: number }
const rows = readFileSync(join(DATA, "results.jsonl"), "utf8").split("\n").filter((l) => l.trim() !== "")
  .map((l) => JSON.parse(l) as ResultLine).filter((r) => r.code === "K1n");
const store = new RegistryStore(DATA, { readOnly: true });
const learners = [...new Map(rows.map((r) => [r.learner, r])).values()];
for (const row of learners) {
  const subject = store.loadSubject(row.learner);
  const recorded = recordedEvaluation(store, row.learner);
  if (!recorded) throw new Error(`${row.learner} has no recorded evaluation`);
  const spec = K1N.spec(WORLD);
  const agent = createAgent({ ...spec, cfg: WORLD, ledger: store.openLedger(row.learner), noiseSeed: evalNoise(subject.birth.seed), learning: { ...spec.learning, frozen: true } });
  for (const ep of recorded.episodes) {
    agent.startEpisode(ep.episode);
    const { summary, graded, contacts } = liveGraded(WORLD, evalWorld(subject.birth.seed, ep.episode), agent.policy, agent.hooks);
    if (ep.worldSeed !== evalWorld(subject.birth.seed, ep.episode)) throw new Error(`${row.learner} room ${ep.episode}: recorded world seed differs`);
    lives.push({
      body: `K1n ${row.group === "reflexless" ? "reflekssiz" : "refleksli"}`, subject: row.learner, seed: subject.birth.seed, room: ep.episode,
      ticks: summary.ticks, died: summary.doneCause !== null, contacts, matches: summary.finalHash === ep.summary.finalHash, v: graded,
    });
  }
  process.stdout.write(`${row.learner} `);
}
process.stdout.write("\n");

// --- analysis --------------------------------------------------------------------------------------------------------

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const rms = (xs: number[]) => Math.sqrt(mean(xs.map((x) => x * x)));
const ranks = (xs: number[]) => {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]![0] === order[i]![0]) j++;
    for (let k = i; k <= j; k++) r[order[k]![1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
};
const spearman = (xs: number[], ys: number[]) => {
  const rx = ranks(xs), ry = ranks(ys);
  const mx = mean(rx), my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) { num += (rx[i]! - mx) * (ry[i]! - my); dx += (rx[i]! - mx) ** 2; dy += (ry[i]! - my) ** 2; }
  return num / Math.sqrt(dx * dy);
};
const f = (x: number | null, d = 2) => (x === null || Number.isNaN(x) ? "—" : x.toFixed(d).replace(".", ","));

const ref = lives.filter((l) => l.subject === null);
const k1n = lives.filter((l) => l.subject !== null);

// Choose the contact rule on the reference bodies (never on K1n): lower mean end-of-life error.
const refEnd = (n: Variant) => mean(ref.map((l) => l.v[n].end));
const chosen: Variant = refEnd("V1") <= refEnd("V2") ? "V1" : "V2";
// q: match the RMS of σ to the RMS of the error at the end of life, reference lives with any contact.
const refContact = ref.filter((l) => l.v[chosen].sigma1 > 0);
const q = rms(refContact.map((l) => l.v[chosen].end)) / rms(refContact.map((l) => l.v[chosen].sigma1));

console.log("\n=== Adım 1: referans bedenler (kıt oda, seed 1–10 × 10 oda) ===");
console.log("beden     hayat  ort. yaşam  temas/hayat | son hata (m): V0     V1     V2 | 3000 tikte (yaşayanlar): V0     V1     V2");
for (const body of Object.keys(REFERENCE)) {
  const ls = ref.filter((l) => l.body === body);
  const s3 = ls.filter((l) => l.v.V1.at3000 !== null);
  console.log(`${body.padEnd(8)} ${String(ls.length).padStart(5)}  ${f(mean(ls.map((l) => l.ticks)), 0).padStart(10)}  ${f(mean(ls.map((l) => l.contacts)), 0).padStart(11)} |`
    + NAMES.map((n) => f(mean(ls.map((l) => l.v[n].end))).padStart(7)).join("") + ` | ${String(s3.length).padStart(3)} hayat`
    + NAMES.map((n) => f(mean(s3.map((l) => l.v[n].at3000!))).padStart(7)).join(""));
}
console.log(`seçilen temas kuralı: ${chosen} (${VARIANTS[chosen].contact}); ortalama son hata V1 ${f(refEnd("V1"), 3)} m, V2 ${f(refEnd("V2"), 3)} m`);
console.log(`ölçülen temas gürültüsü q = ${f(q, 3)} (${refContact.length} temaslı hayat)`);

console.log("\n=== Adım 2: K1n öğrenenleri (kayıtlı değerlendirme odaları) ===");
const matched = k1n.filter((l) => l.matches).length;
console.log(`kayıtla aynı hayat: ${matched}/${k1n.length}`);
console.log("denek      grup         hayat  3000'e ulaşan  temas/hayat | 3000 tikte hata: V0     V1     V2 | son hata: V0     V1     V2");
for (const id of [...new Set(k1n.map((l) => l.subject!))]) {
  const ls = k1n.filter((l) => l.subject === id);
  const s3 = ls.filter((l) => l.v.V1.at3000 !== null);
  console.log(`${id}  ${ls[0]!.body.padEnd(15)} ${String(ls.length).padStart(3)}  ${String(s3.length).padStart(13)}  ${f(mean(ls.map((l) => l.contacts)), 0).padStart(11)} |`
    + NAMES.map((n) => f(s3.length ? mean(s3.map((l) => l.v[n].at3000!)) : NaN).padStart(7)).join("") + " |"
    + NAMES.map((n) => f(mean(ls.map((l) => l.v[n].end))).padStart(7)).join(""));
}
const k3 = k1n.filter((l) => l.v.V1.at3000 !== null);
const gate = (n: Variant) => mean(k3.map((l) => l.v[n].at3000!));
console.log(`\nKAPI (3000 tiki yaşayan ${k3.length} hayat, ortalama konum hatası < 0,5 m): V0 ${f(gate("V0"), 3)} · V1 ${f(gate("V1"), 3)} · V2 ${f(gate("V2"), 3)} m; seçilen ${chosen}: ${gate(chosen) < 0.5 ? "GEÇTİ" : "KALDI"}`);

// Prediction checks.
const headingMax = Math.max(...lives.flatMap((l) => NAMES.map((n) => l.v[n].headingMax)));
const noContact = lives.filter((l) => l.contacts === 0);
const withContact = k1n.filter((l) => l.contacts > 0);
const k1nEnd = (n: Variant) => k1n.map((l) => l.v[n].end);
const ratio = rms(k1n.map((l) => l.v[chosen].end)) / rms(k1n.map((l) => q * l.v[chosen].sigma1));
const diff13 = Math.abs(gate("V1") - gate("V2")) / Math.max(gate("V1"), gate("V2"));
const checks = {
  a_headingMax: headingMax,
  b_noContactLives: noContact.length,
  b_noContactV1Max: noContact.length ? Math.max(...noContact.map((l) => l.v.V1.max)) : null,
  b_noContactV0Max: noContact.length ? Math.max(...noContact.map((l) => l.v.V0.max)) : null,
  c_V0gate: gate("V0"),
  d_spearmanContactsEndV1: withContact.length > 2 ? spearman(withContact.map((l) => l.contacts), withContact.map((l) => l.v.V1.end)) : null,
  e_V1gate: gate("V1"),
  f_relativeDiffV1V2: diff13,
  g_matched: `${matched}/${k1n.length}`,
  h_errorOverSigma: ratio,
};
console.log("\nöngörü denetimi:");
console.log(`(a) en büyük yön hatası: ${headingMax}`);
console.log(`(b) temassız ${noContact.length} hayat: V1 en büyük hata ${checks.b_noContactV1Max?.toExponential(2)} m, V0 ${f(checks.b_noContactV0Max, 3)} m`);
console.log(`(c) V0 kapıda ${f(gate("V0"), 3)} m`);
console.log(`(d) K1n temaslı hayatlarda temas sayısı ile V1 son hatası: Spearman ${f(checks.d_spearmanContactsEndV1, 2)}`);
console.log(`(e) V1 kapıda ${f(gate("V1"), 3)} m`);
console.log(`(f) V1–V2 göreli fark (kapıda): %${f(100 * diff13, 0)}`);
console.log(`(g) kayıtla aynı hayat: ${matched}/${k1n.length}`);
console.log(`(h) K1n: gerçek hata / σ (RMS, q ${f(q, 2)}): ${f(ratio, 2)}`);
console.log(`K1n son hata ortalaması: V0 ${f(mean(k1nEnd("V0")), 3)} · V1 ${f(mean(k1nEnd("V1")), 3)} · V2 ${f(mean(k1nEnd("V2")), 3)} m`);

writeFileSync(join(DATA, "pose-a1-lives.jsonl"), lives.map((l) => JSON.stringify(l)).join("\n") + "\n");
writeFileSync(join(DATA, "pose-a1-summary.json"), JSON.stringify({ chosen, q, gate: { V0: gate("V0"), V1: gate("V1"), V2: gate("V2") }, lives3000: k3.length, checks }, null, 2) + "\n");
console.log("\nyazıldı: data/pose-a1-summary.json, data/pose-a1-lives.jsonl");
