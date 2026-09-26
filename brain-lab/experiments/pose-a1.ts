// brain-lab/experiments/pose-a1.ts — A1 and A1b (TASARIM-007, TASARIM-008): does the memory know where the body is?
// The pose module (H1, memory/pose.ts) listens to living bodies and is graded against the true pose. Read-only: no
// subject is created or changed and nothing is written to the registry.
//   Step 1, reference bodies (blind, centre, seeker; the condition's room, seeds 1–10, 10 rooms each, as
//           calibrate-005b): choose the contact rule by the mean end-of-life error, and measure the contact noise q.
//   Step 2, the gate: the condition's recorded learners in their recorded evaluation rooms, their frozen brains
//           evaluated exactly as the experiment did; every room is checked against its recorded final world hash.
// The variants listen to the same life at once (the memory does not act): V0 without the sideways slide (TASARIM-007
// as first written), V1 keeping the slide at contact, V2 zeroing it, V3 (A1b) finding the touched wall with the rays
// and letting the velocity run along it. For V3 every found wall is checked against the walls the body truly touches.
// A1 ran V0–V2 (commit 3ffffbf; data/pose-a1-*); A1b adds V3 (data/pose-a1b-*) and re-checks that V0–V2 reproduce.
// Predictions and gates: LAB-DEFTERI.md, 2026-09-26, "A1 (H1 konum)" and "A1b (temas hesabı)", both before running.
//
// The condition is an argument (2026-09-26, falsification of the memory results): K1n is the default and writes
// data/pose-a1b-*, the recorded A1b outputs; another condition writes data/pose-a1b-<code>-*. The grading pieces are
// exported so a falsification script can put other bodies, rooms and seeds through the same grader.
//
//   node --experimental-strip-types brain-lab/experiments/pose-a1.ts [KOD]
"use strict";

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { burstPolicy, centrePolicy, seekerPolicy } from "../baselines/index.ts";
import { createAgent } from "../learning/index.ts";
import { MemoryCore, PoseModule, inRoom, type PoseParams } from "../memory/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { Room, runEpisode, type EpisodeHooks, type Policy, type WorldConfig } from "../world/index.ts";
import { ROOM1, condition } from "./conditions.ts";
import { MAX_TICKS, assertSeedAllowed, evalNoise, evalWorld, recordedEvaluation, recordedLearners } from "./harness.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");

export const VARIANTS = {
  // Every variant names its contact rule: none may follow DEFAULT_POSE, which moves as rules are measured. Without the
  // slide model the sideways speed is always 0, so "keep" is the TASARIM-007 formula exactly (as A1 measured it).
  V0: { sideslip: false, contact: "keep", contactNoise: 1 },
  V1: { sideslip: true, contact: "keep", contactNoise: 1 },
  V2: { sideslip: true, contact: "zero", contactNoise: 1 },
  V3: { sideslip: true, contact: "wall", contactNoise: 1 },
} as const satisfies Record<string, Partial<PoseParams>>;
export type Variant = keyof typeof VARIANTS;
const NAMES = Object.keys(VARIANTS) as Variant[];
/** The contact rules the reference bodies choose between (V0 has no slide model at all). */
type Rule = "V1" | "V2" | "V3";
const RULES: Rule[] = ["V1", "V2", "V3"];
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export interface Graded {
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

export interface Life {
  body: string;
  subject: string | null;
  seed: number;
  room: number;
  ticks: number;
  died: boolean;
  contacts: number;
  /** Recorded learners only: the replayed room ended in the recorded final world hash. */
  matches: boolean | null;
  v: Record<Variant, Graded>;
  /** V3's wall finding: contact ticks with a wall found, and found walls the body was not touching (should be 0). */
  walls: { found: number; wrong: number };
}

/** Lives one room with the pose variants listening; grades each tick against the true body. */
export function liveGraded(cfg: WorldConfig, worldSeed: number, policy: Policy, hooks?: EpisodeHooks) {
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
      // The walls the body truly touches, as normals relative to its heading (the grader knows the room). Touching =
      // within 1e-9 m: a body resting in a corner can sit 1e-13 m off one wall after rounding (found 2026-09-26: exact
      // equality here counted 141 corner walls as "wrong").
      const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9;
      const touched = [
        ...(near(body.x, r) ? [Math.PI] : []), ...(near(body.x, cfg.width - r) ? [0] : []),
        ...(near(body.y, r) ? [-Math.PI / 2] : []), ...(near(body.y, cfg.height - r) ? [Math.PI / 2] : []),
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

/** The reference bodies of step 1 (baselines/bursts.ts, baselines/oracle.ts), each made from its policy seed. */
export function referenceBodies(world: WorldConfig): Record<string, (seed: number) => Policy> {
  return {
    blind: (seed) => burstPolicy(seed),
    centre: (seed) => centrePolicy(world, seed),
    seeker: (seed) => seekerPolicy(world, seed),
  };
}

/** Each body lives the 10 evaluation rooms of every seed, its policy seeded seed·7 + 3 (the seeds calibrate-005b used). */
export function referenceLives(bodies: Record<string, (seed: number) => Policy>, world: WorldConfig, seeds: readonly number[]): Life[] {
  const lives: Life[] = [];
  for (const [body, make] of Object.entries(bodies)) {
    for (const seed of seeds) {
      assertSeedAllowed(seed); // no test seed without a frozen pre-registration
      const policy = make(seed * 7 + 3);
      for (let ep = 1; ep <= 10; ep++) {
        const { summary, graded, contacts, walls } = liveGraded(world, evalWorld(seed, ep), policy);
        lives.push({ body, subject: null, seed, room: ep, ticks: summary.ticks, died: summary.doneCause !== null, contacts, matches: null, v: graded, walls });
      }
    }
  }
  return lives;
}

/**
 * A condition's recorded learners (harness.recordedLearners) in their recorded evaluation rooms, their frozen brains
 * evaluated as the experiment did. Each life says whether the room ended in its recorded final world hash.
 */
export function learnerLives(code: string, store: RegistryStore, resultLines: readonly string[]): Life[] {
  const def = condition(code);
  const world = def.world ?? ROOM1;
  const spec = def.spec(world);
  const lives: Life[] = [];
  for (const row of recordedLearners(resultLines, code, world)) {
    const subject = store.loadSubject(row.learner);
    const recorded = recordedEvaluation(store, row.learner);
    if (!recorded) throw new Error(`${row.learner} has no recorded evaluation`);
    const agent = createAgent({ ...spec, cfg: world, ledger: store.openLedger(row.learner), noiseSeed: evalNoise(subject.birth.seed), learning: { ...spec.learning, frozen: true } });
    for (const ep of recorded.episodes) {
      agent.startEpisode(ep.episode);
      const { summary, graded, contacts, walls } = liveGraded(world, evalWorld(subject.birth.seed, ep.episode), agent.policy, agent.hooks);
      if (ep.worldSeed !== evalWorld(subject.birth.seed, ep.episode)) throw new Error(`${row.learner} room ${ep.episode}: recorded world seed differs`);
      lives.push({
        body: `${code} ${row.group === "reflexless" ? "reflekssiz" : "refleksli"}`, subject: row.learner, seed: subject.birth.seed, room: ep.episode,
        ticks: summary.ticks, died: summary.doneCause !== null, contacts, matches: summary.finalHash === ep.summary.finalHash, v: graded, walls,
      });
    }
    process.stdout.write(`${row.learner} `);
  }
  process.stdout.write("\n");
  return lives;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const code = process.argv[2] ?? "K1n";
  const WORLD = condition(code).world ?? ROOM1;
  const REFERENCE = referenceBodies(WORLD);
  const resultLines = readFileSync(join(DATA, "results.jsonl"), "utf8").split("\n");
  const store = new RegistryStore(DATA, { readOnly: true });
  const lives: Life[] = [...referenceLives(REFERENCE, WORLD, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), ...learnerLives(code, store, resultLines)];

  // --- analysis --------------------------------------------------------------------------------------------------------

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const rms = (xs: number[]) => Math.sqrt(mean(xs.map((x) => x * x)));
  const f = (x: number | null, d = 2) => (x === null || Number.isNaN(x) ? "—" : x.toFixed(d).replace(".", ","));

  const ref = lives.filter((l) => l.subject === null);
  const learners = lives.filter((l) => l.subject !== null);

  // Choose the contact rule on the reference bodies (never on the learners): lower mean end-of-life error.
  const refEnd = (n: Variant) => mean(ref.map((l) => l.v[n].end));
  const chosen: Rule = RULES.reduce((best, n) => (refEnd(n) < refEnd(best) ? n : best), RULES[0]!);
  // q: match the RMS of σ to the RMS of the error at the end of life, reference lives with any contact.
  const refContact = ref.filter((l) => l.v[chosen].sigma1 > 0);
  const q = rms(refContact.map((l) => l.v[chosen].end)) / rms(refContact.map((l) => l.v[chosen].sigma1));
  const cols = NAMES.map((n) => n.padStart(7)).join("");

  console.log(`\n=== Adım 1: referans bedenler (${code} odası: ${WORLD.foodCount} yemek, ${WORLD.threatCount} tehlike, doğum enerjisi ${WORLD.initialEnergy}; seed 1–10 × 10 oda) ===`);
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
  for (const group of [...Object.keys(REFERENCE), code]) {
    const w = wallStats(group === code ? learners : ref.filter((l) => l.body === group));
    console.log(`${group.padEnd(8)} temas tiki ${String(w.contacts).padStart(6)} · duvar bulundu %${f(100 * w.share, 0)} · yanlış duvar ${w.wrong}`);
  }

  console.log(`\n=== Adım 2: ${code} öğrenenleri (kayıtlı değerlendirme odaları) ===`);
  const matched = learners.filter((l) => l.matches).length;
  console.log(`kayıtla aynı hayat: ${matched}/${learners.length}`);
  console.log(`denek      grup         hayat  3000'e ulaşan  temas/hayat | 3000 tikte hata:${cols} | son hata:${cols}`);
  for (const id of [...new Set(learners.map((l) => l.subject!))]) {
    const ls = learners.filter((l) => l.subject === id);
    const s3 = ls.filter((l) => l.v.V1.at3000 !== null);
    console.log(`${id}  ${ls[0]!.body.padEnd(15)} ${String(ls.length).padStart(3)}  ${String(s3.length).padStart(13)}  ${f(mean(ls.map((l) => l.contacts)), 0).padStart(11)} |`
      + "                " + NAMES.map((n) => f(s3.length ? mean(s3.map((l) => l.v[n].at3000!)) : NaN).padStart(7)).join("") + " |"
      + "         " + NAMES.map((n) => f(mean(ls.map((l) => l.v[n].end))).padStart(7)).join(""));
  }
  const k3 = learners.filter((l) => l.v.V1.at3000 !== null);
  const gate = (n: Variant) => mean(k3.map((l) => l.v[n].at3000!));
  console.log(`\nKAPI (3000 tiki yaşayan ${k3.length} hayat, ortalama konum hatası < 0,5 m): ${NAMES.map((n) => `${n} ${f(gate(n), 3)}`).join(" · ")} m; seçilen ${chosen}: ${gate(chosen) < 0.5 ? "GEÇTİ" : "KALDI"}`);

  // The A1 numbers must reproduce: V0–V2 did not change (A1b only added a rule). A1 measured K1n only.
  let reproduced: boolean | null = null;
  if (code === "K1n") {
    const a1 = JSON.parse(readFileSync(join(DATA, "pose-a1-summary.json"), "utf8")) as { gate: Record<string, number> };
    reproduced = (["V0", "V1", "V2"] as const).every((n) => a1.gate[n] === gate(n));
    console.log(`A1 kaydı yeniden üretildi mi (V0–V2 kapı değerleri birebir): ${reproduced ? "evet" : "HAYIR"}`);
  }

  // A1b prediction checks (LAB-DEFTERI 2026-09-26, "A1b (temas hesabı) — koşmadan önce").
  const allWalls = wallStats(lives);
  const moving = (body: string, n: Variant) => mean(ref.filter((l) => l.body === body && l.v[n].at3000 !== null).map((l) => l.v[n].at3000!));
  const headingMax = Math.max(...lives.flatMap((l) => NAMES.map((n) => l.v[n].headingMax)));
  const noContact = lives.filter((l) => l.contacts === 0);
  const sameWithoutContact = noContact.every((l) => l.v.V3.end === l.v.V2.end && l.v.V3.end === l.v.V1.end);
  const ratio = rms(learners.map((l) => l.v[chosen].end)) / rms(learners.map((l) => q * l.v[chosen].sigma1));
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
    matched: `${matched}/${learners.length}`,
  };
  console.log("\nöngörü denetimi (A1b):");
  console.log(`(a) yanlış bulunan duvar: ${allWalls.wrong} (bulunan duvarlı temas tiki ${allWalls.found})`);
  console.log(`(b) temas tiklerinde duvar bulunma payı: %${f(100 * allWalls.share, 0)}`);
  console.log(`(c) referans bedenlerde V3 son hata: merkez ${f(checks.c_refEndV3.centre, 3)} · arayıcı ${f(checks.c_refEndV3.seeker, 3)} m`);
  console.log(`(d) ${code} kapısında V3: ${f(gate("V3"), 3)} m`);
  console.log(`(e) çok hareket eden bedenler, 3000 tikte (seçilen ${chosen}): merkez ${f(checks.e_moving3000.centre, 3)} · arayıcı ${f(checks.e_moving3000.seeker, 3)} m`);
  console.log(`(f) en büyük yön hatası ${headingMax}; temassız ${noContact.length} hayatta V1 = V2 = V3: ${sameWithoutContact ? "evet" : "HAYIR"}`);
  console.log(`(g) seçilen ${chosen}; ${code}'de gerçek hata / σ (RMS, q ${f(q, 2)}): ${f(ratio, 2)}`);

  const out = code === "K1n" ? "pose-a1b" : `pose-a1b-${code}`;
  writeFileSync(join(DATA, `${out}-lives.jsonl`), lives.map((l) => JSON.stringify(l)).join("\n") + "\n");
  writeFileSync(join(DATA, `${out}-summary.json`), JSON.stringify({ chosen, q, gate: Object.fromEntries(NAMES.map((n) => [n, gate(n)])), lives3000: k3.length, checks }, null, 2) + "\n");
  console.log(`\nyazıldı: data/${out}-summary.json, data/${out}-lives.jsonl`);
}
