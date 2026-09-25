// brain-lab/viewer/plain.ts — turning the lab's numbers into plain Turkish sentences for the pages: a verdict
// for a condition, the names of the rays, and what a brain learned as "when it sees X, it does more Y".
// Pure functions; the thresholds are the ones the guide (guide.ts) explains.
"use strict";

import { wilcoxon } from "../experiments/stats.ts";
import type { LearnedMatrix } from "./dashboard-data.ts";

/** The significance threshold the guide explains (term "p"). */
export const SIGNIFICANT = 0.05;

export type VerdictKind = "learned" | "no-difference" | "worse" | "too-few" | "twin-only";

export interface Verdict {
  readonly kind: VerdictKind;
  readonly title: string;
  readonly text: string;
  readonly p: number | null;
}

/** Fewer paired subjects than this cannot reach p < 0.05 with Wilcoxon at all. */
export const MIN_PAIRS = 6;

/**
 * What a learner is compared with. The yoked body (its own movements, blind) is the real test since
 * series 005a; the frozen twin barely moves, so beating it can mean no more than "learned to move".
 */
export type Baseline = "yoked" | "twin";
const AGAINST: Readonly<Record<Baseline, string>> = { yoked: "bağlı bedeninden", twin: "ikizinden" };
const pText = (p: number) => (p < 0.001 ? "< 0,001" : p.toFixed(3).replace(".", ","));
const decimal = (x: number) => x.toFixed(2).replace(".", ",");

/**
 * "k" with the Turkish possessive + locative suffix it takes after "n denekten": 1'inde, 2'sinde, 3'ünde,
 * 6'sında, 9'unda, 10'unda … The suffix follows the last spoken word of the number (its last non-zero digit,
 * or its tens word, or yüz), with vowel harmony and a buffer "s" after a vowel.
 */
export function ofThem(k: number): string {
  const ones = ["", "inde", "sinde", "ünde", "ünde", "inde", "sında", "sinde", "inde", "unda"];
  const tens = ["", "unda", "sinde", "unda", "ında", "sinde", "ında", "inde", "inde", "ında"];
  const suffix = k === 0 ? "ında" : k % 100 === 0 ? "ünde" : k % 10 !== 0 ? ones[k % 10] : tens[(k % 100) / 10];
  return `${k}'${suffix}`;
}

/**
 * Did learners live better than their baseline? `gains` are baseline drive − learner drive per subject
 * (positive = the learner lived closer to its setpoint). `control` names a control condition, where the
 * expected outcome is that the gain disappears, and the text says so.
 */
export function verdict(gains: readonly number[], control: string, against: Baseline): Verdict {
  const isControl = control !== "none";
  if (gains.length < MIN_PAIRS) {
    return { kind: "too-few", title: "Az denek", text: `${gains.length} denekle anlamlı bir karar verilemez (en az ${MIN_PAIRS} gerekir).`, p: null };
  }
  const p = wilcoxon(gains).p;
  const mean = gains.reduce((s, x) => s + x, 0) / gains.length;
  const better = gains.filter((g) => g > 0).length;
  const count = `${gains.length} denekten ${ofThem(better)} öğrenen ${AGAINST[against]} tok yaşadı (p = ${pText(p)}).`;
  if (p < SIGNIFICANT && mean > 0) {
    if (isControl) return { kind: "learned", p, title: "Kontrol kazancı silmedi", text: `${count} Bu bir kontrol: burada kazancın kaybolması beklenirdi, kaybolmadı.` };
    if (against === "twin") {
      return {
        kind: "twin-only", p, title: "Yalnız ikizden iyi",
        text: `${count} Bu deney bağlı kontrolden önce koşuldu. Hareketsiz ikizi geçmek yalnızca "hareket etmeyi öğrendi" demek olabilir.`,
      };
    }
    return { kind: "learned", p, title: "Duyusunu kullanıyor", text: `${count} Aynı hareketleri kör yapan beden kadar şanslı değil, daha iyi: gördüğünü ya da hissettiğini kullanıyor.` };
  }
  if (p < SIGNIFICANT && mean < 0) {
    return { kind: "worse", p, title: "Kontrolünden kötü", text: `${count} Öğrenme bu koşulda bedene zarar veriyor.` };
  }
  return {
    kind: "no-difference", p, title: isControl ? "Kontrol: kazanç yok (beklenen)" : "Fark gösterilemedi",
    text: isControl ? `${count} Bu bir kontrol: öğrenme bozulunca kazancın kaybolması beklenir — öyle oldu.` : count,
  };
}

interface Member {
  readonly l: { readonly meanDrive: number; readonly steering: number | null };
  readonly t: { readonly meanDrive: number };
  readonly y?: { readonly meanDrive: number; readonly steering: number | null } | null;
}

/**
 * The verdict for a condition's subjects: against their yoked bodies when every subject has one, else
 * against their twins (and saying so). With yoked bodies it also says whether the learners turn toward
 * food, the thing Ozyn watches for, from steering learner vs yoked.
 */
export function judge(members: readonly Member[], control: string): Verdict {
  if (!members.length || !members.every((m) => m.y)) return verdict(members.map((m) => m.t.meanDrive - m.l.meanDrive), control, "twin");
  const v = verdict(members.map((m) => m.y!.meanDrive - m.l.meanDrive), control, "yoked");
  if (control !== "none" || v.kind === "too-few") return v;
  const diffs = members.map((m) => (m.l.steering ?? 0) - (m.y!.steering ?? 0));
  const p = wilcoxon(diffs).p;
  const turns = p < SIGNIFICANT && diffs.reduce((s, x) => s + x, 0) > 0;
  const l = members.reduce((s, m) => s + (m.l.steering ?? 0), 0) / members.length;
  const y = members.reduce((s, m) => s + (m.y!.steering ?? 0), 0) / members.length;
  const direction = turns
    ? ` Yemeğe doğru da dönüyor: yönlendirme ${decimal(l)}, bağlı bedende ${decimal(y)} (p = ${pText(p)}).`
    : ` Ama yana dönüşleri yemeğe göre rastgele: yönlendirmesi (${decimal(l)}) bağlı bedeninkinden (${decimal(y)}) anlamlı farklı değil.`;
  return { ...v, text: v.text + direction };
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
