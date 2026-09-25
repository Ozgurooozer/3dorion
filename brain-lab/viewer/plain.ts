// brain-lab/viewer/plain.ts — turning the lab's numbers into plain Turkish sentences for the pages: a verdict
// for a condition, the names of the rays, and what a brain learned as "when it sees X, it does more Y".
// Pure functions; the thresholds are the ones the guide (guide.ts) explains.
"use strict";

import { wilcoxon } from "../experiments/stats.ts";
import type { LearnedMatrix } from "./dashboard-data.ts";

/** The significance threshold the guide explains (term "p"). */
export const SIGNIFICANT = 0.05;

export type VerdictKind = "learned" | "no-difference" | "worse" | "too-few";

export interface Verdict {
  readonly kind: VerdictKind;
  readonly title: string;
  readonly text: string;
  readonly p: number | null;
}

/** Fewer paired subjects than this cannot reach p < 0.05 with Wilcoxon at all. */
export const MIN_PAIRS = 6;

/**
 * Did learners live better than their twins? `gains` are twin drive − learner drive per subject
 * (positive = the learner lived closer to its setpoint). `control` names a control condition, where the
 * expected outcome is that the gain disappears, and the text says so.
 */
export function verdict(gains: readonly number[], control: string): Verdict {
  const isControl = control !== "none";
  if (gains.length < MIN_PAIRS) {
    return { kind: "too-few", title: "Az denek", text: `${gains.length} denekle anlamlı bir karar verilemez (en az ${MIN_PAIRS} gerekir).`, p: null };
  }
  const p = wilcoxon(gains).p;
  const mean = gains.reduce((s, x) => s + x, 0) / gains.length;
  const better = gains.filter((g) => g > 0).length;
  const count = `${gains.length} denekten ${better}'inde öğrenen ikizinden iyi yaşadı (p = ${p < 0.001 ? p.toExponential(1) : p.toFixed(3)}).`;
  if (p < SIGNIFICANT && mean > 0) {
    return {
      kind: "learned", p, title: isControl ? "Kontrol kazancı silmedi" : "Öğrendi",
      text: isControl ? `${count} Bu bir kontrol: burada kazancın kaybolması beklenirdi, kaybolmadı.` : count,
    };
  }
  if (p < SIGNIFICANT && mean < 0) {
    return { kind: "worse", p, title: "İkizinden kötü", text: `${count} Öğrenme bu koşulda bedene zarar veriyor.` };
  }
  return {
    kind: "no-difference", p, title: isControl ? "Kontrol: kazanç yok (beklenen)" : "Fark gösterilemedi",
    text: isControl ? `${count} Bu bir kontrol: öğrenme bozulunca kazancın kaybolması beklenir — öyle oldu.` : count,
  };
}

/** Where each ray looks, by index, for the default five rays (−60°, −30°, 0°, 30°, 60°; negative = right). */
export function rayName(index: number, angle: number): string {
  const deg = Math.round((angle * 180) / Math.PI);
  if (deg === 0) return `ışın ${index} (tam önü)`;
  return `ışın ${index} (${Math.abs(deg)}° ${deg < 0 ? "sağ" : "sol"})`;
}

const KIND_TR: Readonly<Record<string, string>> = { food: "yemek", wall: "duvar", threat: "tehlike" };
const ACTION_TR: Readonly<Record<string, string>> = { forward: "ileri gitme", back: "geri gitme", left: "sola dönme", right: "sağa dönme" };
const FIXED_TR: Readonly<Record<string, string>> = {
  "touch.bump": "bir şeye çarpınca", "intero.hunger": "acıkınca", "intero.injury": "yaralanınca",
  "proprio.forward": "ileri giderken", "proprio.backward": "geri giderken", "proprio.left": "sola dönerken", "proprio.right": "sağa dönerken",
};

/** "when …" for a sense node id, with the ray's direction when it is a ray. */
export function senseWhen(sense: string, rayAngles: readonly number[]): string {
  const fixed = FIXED_TR[sense];
  if (fixed) return fixed;
  const m = /^ray(\d+)\.(\w+)$/.exec(sense);
  if (!m) return sense;
  const i = Number(m[1]);
  return `${rayName(i, rayAngles[i] ?? 0)} ${KIND_TR[m[2]!] ?? m[2]} görünce`;
}

export interface LearnedSentence {
  readonly sense: string;
  readonly action: string;
  readonly value: number;
  readonly text: string;
}

/** The `top` strongest learned changes as sentences, strongest first; changes smaller than `min` are left out. */
export function learnedSentences(m: LearnedMatrix, rayAngles: readonly number[], top: number, min = 0.05): LearnedSentence[] {
  const all = m.senses.flatMap((sense, i) => m.actions.map((action, j) => ({ sense, action, value: m.values[i]![j]! })));
  return all
    .filter((c) => Math.abs(c.value) >= min)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || (a.sense + a.action).localeCompare(b.sense + b.action))
    .slice(0, top)
    .map((c) => ({
      ...c,
      text: `${senseWhen(c.sense, rayAngles)} → ${ACTION_TR[c.action] ?? c.action} ${c.value > 0 ? "isteği arttı" : "frenlendi"}`,
    }));
}
