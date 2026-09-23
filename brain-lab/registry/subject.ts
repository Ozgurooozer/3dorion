// brain-lab/registry/subject.ts — who a subject is: identity, kind, lineage, birth, stage.
"use strict";

import type { WorldConfig } from "../world/index.ts";

export type Category = "baseline.empty" | "baseline.random" | "baseline.td" | "learner.3f";

/** Innate wiring condition (Ozyn, 2026-09-23: compare both). "none" for baselines where it does not apply. */
export type Group = "reflexless" | "reflexive" | "none";

/**
 * Development stages are milestones that can be measured, never elapsed time:
 * E0 birth · E1 first experience (first tick lived) · E2 first learning (first weight change)
 * · E3 first success (learned policy eats with babbling off) · E4 stable (passed a pre-registered criterion).
 */
export const STAGES = Object.freeze([
  { code: "E0", label: "doğum" },
  { code: "E1", label: "ilk deneyim" },
  { code: "E2", label: "ilk öğrenme" },
  { code: "E3", label: "ilk başarı" },
  { code: "E4", label: "kararlı" },
] as const);
export type Stage = (typeof STAGES)[number]["code"];

export const stageIndex = (s: Stage): number => STAGES.findIndex((x) => x.code === s);
export const stageLabel = (s: Stage): string => STAGES[stageIndex(s)]!.label;

export interface Lineage {
  readonly parent: string | null;
  readonly how: "birth" | "clone" | "mutation";
}

export interface Birth {
  readonly seed: number;
  readonly date: string; // YYYY-MM-DD
  readonly worldConfig: WorldConfig;
  readonly graphHash: string; // hash of the birth graph (registry/graph.ts)
  readonly codeCommit: string | null;
}

export interface Subject {
  readonly id: string;
  readonly name: string;
  readonly category: Category;
  readonly group: Group;
  readonly lineage: Lineage;
  readonly birth: Birth;
  readonly stage: Stage;
}

/** One-line human label: "DNK-0007 «Kıvılcım» · learner.3f · reflexless · E2 ilk öğrenme". */
export function describe(s: Subject): string {
  return `${s.id} «${s.name}» · ${s.category} · ${s.group} · ${s.stage} ${stageLabel(s.stage)}`;
}
