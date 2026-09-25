// brain-lab/viewer/plain.test.ts — the sentences the pages show must say what the numbers say: the verdict
// follows the paired test, controls are read the other way round, rays are named by where they look, and
// the guide has an entry for every term the pages link to.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CONFIG } from "../world/index.ts";
import { GUIDE, TERMS } from "./guide.ts";
import { MIN_PAIRS, learnedSentences, rayName, senseWhen, verdict } from "./plain.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// Gains are twin drive − learner drive: positive = the learner lived better.
const allBetter = (n: number) => Array.from({ length: n }, (_, i) => 0.1 + i / 100);
const allWorse = (n: number) => allBetter(n).map((g) => -g);
const mixed = [0.1, -0.11, 0.12, -0.13, 0.14, -0.15, 0.16, -0.17, 0.18, -0.19];

// --- verdict --------------------------------------------------------------------------------------

test("verdict says a condition learned when every learner beat its twin", () => {
  assert.equal(verdict(allBetter(10), "none").kind, "learned");
});

test("verdict says no difference when learners beat and lose to their twins in turn", () => {
  assert.equal(verdict(mixed, "none").kind, "no-difference");
});

test("verdict does not call a gain that is positive on average but not significant 'learned'", () => {
  const gains = [0.3, -0.1, 0.2, -0.15, 0.1, -0.2, 0.25, -0.1];
  assert.equal(verdict(gains, "none").kind, "no-difference");
});

test("verdict does not call a condition worse when the average gain is exactly zero", () => {
  // 19 small gains and one loss of the same total (binary fractions: the mean is exactly 0), yet the
  // ranks are lopsided enough for Wilcoxon to be significant.
  const gains = [...Array.from({ length: 19 }, () => 0.0625), -1.1875];
  assert.equal(verdict(gains, "none").kind, "no-difference");
});

test("the zero-mean case above is significant, so it really exercises the sign rule", async () => {
  const { wilcoxon } = await import("../experiments/stats.ts");
  assert.ok(wilcoxon([...Array.from({ length: 19 }, () => 0.0625), -1.1875]).p < 0.05);
});

test("verdict says worse when every learner lost to its twin", () => {
  assert.equal(verdict(allWorse(10), "none").kind, "worse");
});

test("verdict refuses to judge fewer pairs than the smallest that can reach significance", () => {
  assert.equal(verdict(allBetter(MIN_PAIRS - 1), "none").kind, "too-few");
});

test("the smallest number of pairs verdict judges can reach significance", () => {
  assert.equal(verdict(allBetter(MIN_PAIRS), "none").kind, "learned");
});

test("one pair fewer than the minimum could not have reached significance anyway", async () => {
  const { wilcoxon } = await import("../experiments/stats.ts");
  assert.ok(wilcoxon(allBetter(MIN_PAIRS - 1)).p >= 0.05);
});

test("verdict reads a control without a gain as the expected result", () => {
  assert.equal(verdict(mixed, "CROSS").title, "Kontrol: kazanç yok (beklenen)");
});

test("verdict reads a control that kept the gain as a warning", () => {
  assert.equal(verdict(allBetter(10), "CROSS").title, "Kontrol kazancı silmedi");
});

test("verdict text counts the learners that beat their twins", () => {
  assert.match(verdict([...allBetter(7), ...allWorse(3)], "none").text, /10 denekten 7'inde/);
});

test("verdict carries the p value of the paired test", () => {
  assert.ok(verdict(allBetter(10), "none").p! < 0.01);
});

// --- ray names --------------------------------------------------------------------------------------

const EXPECTED_RAYS = ["ışın 0 (60° sağ)", "ışın 1 (30° sağ)", "ışın 2 (tam önü)", "ışın 3 (30° sol)", "ışın 4 (60° sol)"];
DEFAULT_CONFIG.rayAngles.forEach((angle, i) => {
  test(`ray ${i} of the default body is named ${EXPECTED_RAYS[i]}`, () => {
    assert.equal(rayName(i, angle), EXPECTED_RAYS[i]);
  });
});

test("senseWhen names a food ray by where it looks", () => {
  assert.equal(senseWhen("ray4.food", DEFAULT_CONFIG.rayAngles), "ışın 4 (60° sol) yemek görünce");
});

test("senseWhen names the bump sense in words", () => {
  assert.equal(senseWhen("touch.bump", DEFAULT_CONFIG.rayAngles), "bir şeye çarpınca");
});

test("senseWhen leaves an unknown sense as it is", () => {
  assert.equal(senseWhen("kc.3", DEFAULT_CONFIG.rayAngles), "kc.3");
});

// --- learned sentences ----------------------------------------------------------------------------

const matrix = {
  senses: ["ray2.food", "touch.bump", "ray0.wall"],
  actions: ["forward", "back", "left", "right"],
  values: [[0.5, 0, 0, 0], [0, 0, -1, 0], [0, 0.01, 0, 0.25]],
};

test("learnedSentences puts the strongest change first, whatever its sign", () => {
  assert.equal(learnedSentences(matrix, DEFAULT_CONFIG.rayAngles, 3)[0]!.sense, "touch.bump");
});

test("learnedSentences leaves out changes smaller than the minimum", () => {
  assert.equal(learnedSentences(matrix, DEFAULT_CONFIG.rayAngles, 10).length, 3);
});

test("learnedSentences returns at most the number asked for", () => {
  assert.equal(learnedSentences(matrix, DEFAULT_CONFIG.rayAngles, 1).length, 1);
});

test("learnedSentences says a strengthened Go as 'isteği arttı'", () => {
  const s = learnedSentences(matrix, DEFAULT_CONFIG.rayAngles, 3).find((x) => x.sense === "ray2.food")!;
  assert.equal(s.text, "ışın 2 (tam önü) yemek görünce → ileri gitme isteği arttı");
});

test("learnedSentences says a strengthened NoGo as 'frenlendi'", () => {
  const s = learnedSentences(matrix, DEFAULT_CONFIG.rayAngles, 3).find((x) => x.sense === "touch.bump")!;
  assert.equal(s.text, "bir şeye çarpınca → sola dönme frenlendi");
});

// --- the guide --------------------------------------------------------------------------------------

test("guide term ids are unique", () => {
  const ids = GUIDE.flatMap((s) => s.terms.map((t) => t.id));
  assert.equal(new Set(ids).size, ids.length);
});

test("guide section ids do not clash with term ids (both are page anchors)", () => {
  const clash = GUIDE.map((s) => s.id).filter((id) => TERMS.has(id));
  assert.deepEqual(clash, []);
});

test("every term the lab pages link to exists in the guide", () => {
  const pages = ["deney-odasi.ts", "deney-odasi.html", "deneyler.ts", "deneyler.html"];
  const used = new Set(pages.flatMap((f) => [...readFileSync(join(HERE, f), "utf8").matchAll(/(?:tip|guideLink)\("([^"]+)"|data-tip="([^"]+)"/g)].map((m) => (m[1] ?? m[2])!)));
  const missing = [...used].filter((id) => !TERMS.has(id));
  assert.deepEqual(missing, []);
});

test("the pages link to the guide's terms at all (the check above is not vacuous)", () => {
  const text = readFileSync(join(HERE, "deney-odasi.ts"), "utf8");
  assert.ok(/tip\("durtu"/.test(text));
});
