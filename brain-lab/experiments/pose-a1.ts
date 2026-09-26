// brain-lab/experiments/pose-a1.ts — A1 and A1b (TASARIM-007, TASARIM-008): does the memory know where the body is?
// The pose module (H1, memory/pose.ts) listens to living bodies and is graded against the true pose. Read-only: no
// subject is created or changed and nothing is written to the registry.
//   Step 1, reference bodies (blind, centre, seeker; scarce room, seeds 1–10, 10 rooms each, as calibrate-005b):
//           choose the contact rule by the mean end-of-life error, and measure the contact noise q.
//   Step 2, the gate: the ten K1n learners' recorded evaluation rooms, their frozen brains evaluated exactly as the
//           experiment did; every room is checked against its recorded final world hash.
// The variants listen to the same life at once (the memory does not act): V0 without the sideways slide (TASARIM-007
// as first written), V1 keeping the slide at contact, V2 zeroing it, V3 (A1b) finding the touched wall with the rays
// and letting the velocity run along it. For V3 every found wall is checked against the walls the body truly touches.
// A1 ran V0–V2 (commit 3ffffbf; data/pose-a1-*); A1b adds V3 (data/pose-a1b-*) and re-checks that V0–V2 reproduce.
// Predictions and gates: LAB-DEFTERI.md, 2026-09-26, "A1 (H1 konum)" and "A1b (temas hesabı)", both before running.
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
  V3: { sideslip: true, contact: "wall", contactNoise: 1 },
} as const satisfies Record<string, Partial<PoseParams>>;
type Variant = keyof typeof VARIANTS;
const NAMES = Object.keys(VARIANTS) as Variant[];
/** The contact rules the reference bodies choose between (V0 has no slide model at all). */
type Rule = "V1" | "V2" | "V3";
const RULES: Rule[] = ["V1", "V2", "V3"];
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

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
  /** V3's wall finding: contact ticks with a wall found, and found walls the body was not touching (should be 0). */
  walls: { found: number; wrong: number };
}

/** Lives one room with the three pose variants listening; grades each tick against the true body. */
function liveGraded(cfg: WorldConfig, worldSeed: number, policy: Policy, hooks?: EpisodeHooks) {
  const room = new Room(worldSeed, cfg);
  const start = room.state().body;
  const modules = Object.fromEntries(NAMES.map((n) => [n, new PoseModule(cfg, VARIANTS[n])])) as Record<Variant, PoseModule>;
  const cores = NAMES.map((n) => new MemoryCore([modules[n]]));
  const g = Object.fromEntries(NAMES.map((n) => [n, { end: 0, at1000: null, at3000: null, max: 0, sigma1: 0, headingMax: 0 }])) as Record<Variant, Graded>;
  let contacts = 0;
  const walls = { found: 0, wrong: 0 };
  const r = cfg.bodyRadius;
  const summary = runEpisode(room, (obs, t) => {
    for (const c of cores) c.observe(obs, t);
    const body = room.state().body;
    if (obs.bump) {
      contacts++;
      // The walls the body truly touches, as normals relative to its heading (the grader knows the room).
      const touched = [
        ...(body.x === r ? [Math.PI] : []), ...(body.x === cfg.width - r ? [0] : []),
        ...(body.y === r ? [-Math.PI / 2] : []), ...(body.y === cfg.height - r ? [Math.PI / 2] : []),
      ].map((w) => wrapPi(w - body.heading));
      const found = modules.V3.walls ?? [];
      if (found.length > 0) walls.found++;
      for (const w of found) if (!touched.some((x) => Math.abs(wrapPi(x - w)) < 1e-9)) walls.wrong++;
    }
    for (const n of NAMES) {
      const pose = modules[n].pose;
      const p = inRoom(pose, start);
      const e = Math.hypot(p.x - body.x, p.y - body.y);
      const h = Math.abs(pose.heading - body.heading); // both frames face the same way at the start (heading 0)
      const gn = g[n];
      gn.end = e;
      gn.max = Math.max(gn.max, e);
      gn.headingMax = Math.max(gn.headingMax, h);
      gn.sigma1 = pose.sigma;
      if (t === 999) gn.at1000 = e;
      if (t === MAX_TICKS - 1) gn.at3000 = e;
    }
    return policy(obs, t);
  }, MAX_TICKS, false, hooks);
  if (start.heading !== 0) throw new Error("the grading assumes bodies start facing 0");
  return { summary, graded: g, contacts, walls };
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
      const { summary, graded, contacts, walls } = liveGraded(WORLD, evalWorld(seed, ep), policy);
      lives.push({ body, subject: null, seed, room: ep, ticks: summary.ticks, died: summary.doneCause !== null, contacts, matches: null, v: graded, walls });
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
    const { summary, graded, contacts, walls } = liveGraded(WORLD, evalWorld(subject.birth.seed, ep.episode), agent.policy, agent.hooks);
    if (ep.worldSeed !== evalWorld(subject.birth.seed, ep.episode)) throw new Error(`${row.learner} room ${ep.episode}: recorded world seed differs`);
    lives.push({
      body: `K1n ${row.group === "reflexless" ? "reflekssiz" : "refleksli"}`, subject: row.learner, seed: subject.birth.seed, room: ep.episode,
      ticks: summary.ticks, died: summary.doneCause !== null, contacts, matches: summary.finalHash === ep.summary.finalHash, v: graded, walls,
    });
  }
  process.stdout.write(`${row.learner} `);
}
process.stdout.write("\n");

// --- analysis --------------------------------------------------------------------------------------------------------

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const rms = (xs: number[]) => Math.sqrt(mean(xs.map((x) => x * x)));
const f = (x: number | null, d = 2) => (x === null || Number.isNaN(x) ? "—" : x.toFixed(d).replace(".", ","));

const ref = lives.filter((l) => l.subject === null);
const k1n = lives.filter((l) => l.subject !== null);

// Choose the contact rule on the reference bodies (never on K1n): lower mean end-of-life error.
const refEnd = (n: Variant) => mean(ref.map((l) => l.v[n].end));
const chosen: Rule = RULES.reduce((best, n) => (refEnd(n) < refEnd(best) ? n : best), RULES[0]!);
// q: match the RMS of σ to the RMS of the error at the end of life, reference lives with any contact.
const refContact = ref.filter((l) => l.v[chosen].sigma1 > 0);
const q = rms(refContact.map((l) => l.v[chosen].end)) / rms(refContact.map((l) => l.v[chosen].sigma1));
const cols = NAMES.map((n) => n.padStart(7)).join("");

console.log("\n=== Adım 1: referans bedenler (kıt oda, seed 1–10 × 10 oda) ===");
console.log(`beden     hayat  ort. yaşam  temas/hayat | son hata (m):${cols} | 3000 tikte (yaşayanlar):${cols}`);
for (const body of Object.keys(REFERENCE)) {
  const ls = ref.filter((l) => l.body === body);
  const s3 = ls.filter((l) => l.v.V1.at3000 !== null);
  console.log(`${body.padEnd(8)} ${String(ls.length).padStart(5)}  ${f(mean(ls.map((l) => l.ticks)), 0).padStart(10)}  ${f(mean(ls.map((l) => l.contacts)), 0).padStart(11)} |`
    + "              " + NAMES.map((n) => f(mean(ls.map((l) => l.v[n].end))).padStart(7)).join("") + ` | ${String(s3.length).padStart(3)} hayat`
    + "                 " + NAMES.map((n) => f(mean(s3.map((l) => l.v[n].at3000!))).padStart(7)).join(""));
}
console.log(`seçilen temas kuralı: ${chosen} (${VARIANTS[chosen].contact}); ortalama son hata ${RULES.map((n) => `${n} ${f(refEnd(n), 3)}`).join(" · ")} m`);
console.log(`ölçülen temas gürültüsü q = ${f(q, 3)} (${refContact.length} temaslı hayat)`);

console.log("\n=== V3: duvarı ışınlarla bulma (her temas tikinde, gerçek duvarla karşılaştırıldı) ===");
const wallStats = (ls: Life[]) => {
  const contacts = ls.reduce((s, l) => s + l.contacts, 0);
  const found = ls.reduce((s, l) => s + l.walls.found, 0);
  const wrong = ls.reduce((s, l) => s + l.walls.wrong, 0);
  return { contacts, found, wrong, share: contacts ? found / contacts : NaN };
};
for (const group of [...Object.keys(REFERENCE), "K1n"]) {
  const w = wallStats(group === "K1n" ? k1n : ref.filter((l) => l.body === group));
  console.log(`${group.padEnd(8)} temas tiki ${String(w.contacts).padStart(6)} · duvar bulundu %${f(100 * w.share, 0)} · yanlış duvar ${w.wrong}`);
}

console.log("\n=== Adım 2: K1n öğrenenleri (kayıtlı değerlendirme odaları) ===");
const matched = k1n.filter((l) => l.matches).length;
console.log(`kayıtla aynı hayat: ${matched}/${k1n.length}`);
console.log(`denek      grup         hayat  3000'e ulaşan  temas/hayat | 3000 tikte hata:${cols} | son hata:${cols}`);
for (const id of [...new Set(k1n.map((l) => l.subject!))]) {
  const ls = k1n.filter((l) => l.subject === id);
  const s3 = ls.filter((l) => l.v.V1.at3000 !== null);
  console.log(`${id}  ${ls[0]!.body.padEnd(15)} ${String(ls.length).padStart(3)}  ${String(s3.length).padStart(13)}  ${f(mean(ls.map((l) => l.contacts)), 0).padStart(11)} |`
    + "                " + NAMES.map((n) => f(s3.length ? mean(s3.map((l) => l.v[n].at3000!)) : NaN).padStart(7)).join("") + " |"
    + "         " + NAMES.map((n) => f(mean(ls.map((l) => l.v[n].end))).padStart(7)).join(""));
}
const k3 = k1n.filter((l) => l.v.V1.at3000 !== null);
const gate = (n: Variant) => mean(k3.map((l) => l.v[n].at3000!));
console.log(`\nKAPI (3000 tiki yaşayan ${k3.length} hayat, ortalama konum hatası < 0,5 m): ${NAMES.map((n) => `${n} ${f(gate(n), 3)}`).join(" · ")} m; seçilen ${chosen}: ${gate(chosen) < 0.5 ? "GEÇTİ" : "KALDI"}`);

// The A1 numbers must reproduce: V0–V2 did not change (A1b only added a rule).
const a1 = JSON.parse(readFileSync(join(DATA, "pose-a1-summary.json"), "utf8")) as { gate: Record<string, number> };
const reproduced = (["V0", "V1", "V2"] as const).every((n) => a1.gate[n] === gate(n));
console.log(`A1 kaydı yeniden üretildi mi (V0–V2 kapı değerleri birebir): ${reproduced ? "evet" : "HAYIR"}`);

// A1b prediction checks (LAB-DEFTERI 2026-09-26, "A1b (temas hesabı) — koşmadan önce").
const allWalls = wallStats(lives);
const moving = (body: string, n: Variant) => mean(ref.filter((l) => l.body === body && l.v[n].at3000 !== null).map((l) => l.v[n].at3000!));
const headingMax = Math.max(...lives.flatMap((l) => NAMES.map((n) => l.v[n].headingMax)));
const noContact = lives.filter((l) => l.contacts === 0);
const sameWithoutContact = noContact.every((l) => l.v.V3.end === l.v.V2.end && l.v.V3.end === l.v.V1.end);
const ratio = rms(k1n.map((l) => l.v[chosen].end)) / rms(k1n.map((l) => q * l.v[chosen].sigma1));
const checks = {
  a_wrongWalls: allWalls.wrong,
  b_foundShare: allWalls.share,
  c_refEndV3: { centre: mean(ref.filter((l) => l.body === "centre").map((l) => l.v.V3.end)), seeker: mean(ref.filter((l) => l.body === "seeker").map((l) => l.v.V3.end)) },
  d_gateV3: gate("V3"),
  e_moving3000: { centre: moving("centre", chosen), seeker: moving("seeker", chosen) },
  f_headingMax: headingMax,
  f_noContactSame: sameWithoutContact,
  g_chosen: chosen,
  g_errorOverSigma: ratio,
  a1Reproduced: reproduced,
  matched: `${matched}/${k1n.length}`,
};
console.log("\nöngörü denetimi (A1b):");
console.log(`(a) yanlış bulunan duvar: ${allWalls.wrong} (bulunan duvarlı temas tiki ${allWalls.found})`);
console.log(`(b) temas tiklerinde duvar bulunma payı: %${f(100 * allWalls.share, 0)}`);
console.log(`(c) referans bedenlerde V3 son hata: merkez ${f(checks.c_refEndV3.centre, 3)} · arayıcı ${f(checks.c_refEndV3.seeker, 3)} m`);
console.log(`(d) K1n kapısında V3: ${f(gate("V3"), 3)} m`);
console.log(`(e) çok hareket eden bedenler, 3000 tikte (seçilen ${chosen}): merkez ${f(checks.e_moving3000.centre, 3)} · arayıcı ${f(checks.e_moving3000.seeker, 3)} m`);
console.log(`(f) en büyük yön hatası ${headingMax}; temassız ${noContact.length} hayatta V1 = V2 = V3: ${sameWithoutContact ? "evet" : "HAYIR"}`);
console.log(`(g) seçilen ${chosen}; K1n'de gerçek hata / σ (RMS, q ${f(q, 2)}): ${f(ratio, 2)}`);

writeFileSync(join(DATA, "pose-a1b-lives.jsonl"), lives.map((l) => JSON.stringify(l)).join("\n") + "\n");
writeFileSync(join(DATA, "pose-a1b-summary.json"), JSON.stringify({ chosen, q, gate: Object.fromEntries(NAMES.map((n) => [n, gate(n)])), lives3000: k3.length, checks }, null, 2) + "\n");
console.log("\nyazıldı: data/pose-a1b-summary.json, data/pose-a1b-lives.jsonl");
