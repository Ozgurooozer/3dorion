// brain-lab/regions/pathways.ts — the pathway table: every connection a brain may have.
// Nature gives the structure (which pathways exist), experience gives the weights (which
// strengthen). A connection not in this table is refused — region borders are code borders.
// Each row carries its reason; a row chosen "to reach a goal" is not allowed (design §2, §11).
"use strict";

import type { BrainBaglantisi, BrainGrafi } from "../brain-ir/ir.ts";
import { OPPOSITE, REGION_TYPE, regionOf, type NodeRegion, type Region } from "./regions.ts";

export type Sign = "positive" | "negative" | "any";

export interface Pathway {
  readonly id: string;
  readonly from: Region;
  readonly to: Region;
  /** How the actions of the two ends must relate, for per-action regions. */
  readonly actions: "any" | "same" | "opposite";
  readonly learns: boolean;
  readonly sign: Sign;
  readonly why: string;
  /** Extra constraint on the exact pair, when region and action are not enough. */
  readonly pairs?: Readonly<Record<string, string>>;
}

const ROWS: Pathway[] = [
  {
    id: "P1", from: "sense", to: "bg.go", actions: "any", learns: true, sign: "positive",
    why: "Striatal input: any sense may come to favour any action. The only learning pathway (Frank 2005: Go).",
  },
  {
    id: "P2", from: "sense", to: "bg.nogo", actions: "any", learns: true, sign: "positive",
    why: "Striatal input to the indirect pathway: any sense may come to suppress any action (Frank 2005: NoGo).",
  },
  {
    id: "P3", from: "sense", to: "hyp", actions: "any", learns: false, sign: "positive",
    pairs: { "intero.hunger": "hyp.hunger", "intero.injury": "hyp.pain" },
    why: "Interoception becomes drive: an energy deficit is felt as hunger, damage as pain (innate).",
  },
  {
    id: "P4", from: "hyp", to: "cpg", actions: "any", learns: false, sign: "positive",
    pairs: { "hyp.hunger": "*" },
    why: "Drive says 'do something' without saying what: hunger makes pattern generators fire more (tonic, Niv 2007).",
  },
  {
    id: "P5", from: "hyp", to: "bg.go", actions: "any", learns: false, sign: "positive",
    pairs: { "hyp.hunger": "*" },
    why: "Tonic dopamine-like facilitation: a hungry brain passes actions more readily, of any kind.",
  },
  {
    id: "P6", from: "noise", to: "cpg", actions: "same", learns: false, sign: "positive",
    why: "Spontaneous activity: each generator has its own noise source (babbling).",
  },
  {
    id: "P7", from: "cpg", to: "bg.go", actions: "same", learns: false, sign: "positive",
    why: "A generator proposes its own action; selection decides whether it passes.",
  },
  {
    id: "P8", from: "bg.go", to: "bg.out", actions: "same", learns: false, sign: "positive",
    why: "Direct pathway: Go releases the action.",
  },
  {
    id: "P9", from: "bg.nogo", to: "bg.out", actions: "same", learns: false, sign: "negative",
    why: "Indirect pathway: NoGo holds the action back.",
  },
  {
    id: "P10", from: "bg.go", to: "bg.go", actions: "opposite", learns: false, sign: "negative",
    why: "Antagonist actions (forward/back, left/right) suppress each other so only one passes.",
  },
  {
    id: "P11", from: "bg.out", to: "motor", actions: "same", learns: false, sign: "positive",
    why: "The selected action reaches its muscle.",
  },
];

export const PATHWAYS: readonly Pathway[] = Object.freeze(ROWS);

function actionsFit(p: Pathway, a: NodeRegion, b: NodeRegion): boolean {
  if (p.actions === "any") return true;
  if (!a.action || !b.action) return false;
  return p.actions === "same" ? a.action === b.action : OPPOSITE[a.action] === b.action;
}

function signFits(s: Sign, w: number): boolean {
  return s === "any" || (s === "positive" ? w >= 0 : w <= 0);
}

/** The pathway an edge travels on, or null if the table has none for it. */
export function pathwayOf(e: Pick<BrainBaglantisi, "from" | "to">): Pathway | null {
  const a = regionOf(e.from);
  const b = regionOf(e.to);
  if (!a || !b) return null;
  for (const p of PATHWAYS) {
    if (p.from !== a.region || p.to !== b.region || !actionsFit(p, a, b)) continue;
    if (p.pairs) {
      const target = p.pairs[e.from];
      if (target === undefined || (target !== "*" && target !== e.to)) continue;
    }
    return p;
  }
  return null;
}

export const isPlastic = (e: Pick<BrainBaglantisi, "from" | "to">): boolean => pathwayOf(e)?.learns ?? false;

/** Throws, naming every problem: unknown nodes, wrong node types, edges outside the table, wrong signs. */
export function checkPathways(g: BrainGrafi): void {
  const problems: string[] = [];
  for (const n of g.nodes) {
    const r = regionOf(n.id);
    if (!r) problems.push(`node ${n.id} belongs to no region`);
    else if (n.type !== REGION_TYPE[r.region]) problems.push(`node ${n.id} is ${n.type}, region ${r.region} needs ${REGION_TYPE[r.region]}`);
  }
  for (const e of g.connections) {
    const p = pathwayOf(e);
    if (!p) problems.push(`edge ${e.from}->${e.to} is not in the pathway table`);
    else if (!signFits(p.sign, e.weight)) problems.push(`edge ${e.from}->${e.to} has weight ${e.weight}, pathway ${p.id} must be ${p.sign}`);
  }
  if (problems.length > 0) throw new Error(`brain breaks its regions: ${problems.join("; ")}`);
}
