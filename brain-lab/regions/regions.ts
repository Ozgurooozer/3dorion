// brain-lab/regions/regions.ts — which region a node belongs to (TASARIM-BOLGELI-BEYIN.md §4).
// Regions are prefixes inside one Brain IR graph, so trace, ledger and replay stay whole.
"use strict";

import type { DugumTuru } from "../brain-ir/ir.ts";

export const ACTIONS = Object.freeze(["forward", "back", "left", "right"] as const);
export type ActionName = (typeof ACTIONS)[number];

export const OPPOSITE: Readonly<Record<ActionName, ActionName>> = Object.freeze({
  forward: "back", back: "forward", left: "right", right: "left",
});

export type Region = "sense" | "hyp" | "kc" | "lat" | "noise" | "cpg" | "bg.go" | "bg.nogo" | "bg.out" | "motor" | "mem" | "rec";

export interface NodeRegion {
  readonly region: Region;
  /** Set for regions that come one per action (noise, cpg, bg.*, motor). */
  readonly action?: ActionName;
}

/** The node type each region must use: the region decides the arithmetic, not the caller. */
export const REGION_TYPE: Readonly<Record<Region, DugumTuru>> = Object.freeze({
  sense: "sensor",
  hyp: "neuron",
  kc: "decision",
  lat: "neuron",
  noise: "input",
  cpg: "decision",
  "bg.go": "neuron",
  "bg.nogo": "neuron",
  "bg.out": "decision",
  motor: "motor",
  mem: "memory",
  rec: "sensor",
});

export const HYP_NODES = Object.freeze(["hyp.hunger", "hyp.pain"] as const);

const SENSE = /^(ray\d+\.\w+|touch\.\w+|intero\.\w+|proprio\.\w+)$/;
/** Expansion layer (TASARIM-004 M2): Kenyon-like cells, numbered, not per action. */
const KC = /^kc\.\d+$/;
export const kcId = (i: number): string => `kc.${i}`;
/** Bilateral comparison (TASARIM-004 M3): one cell per kind of thing seen and per side. */
const LAT = /^lat\.\w+\.(left|right)$/;
export const latId = (kind: string, side: "left" | "right"): string => `lat.${kind}.${side}`;
/**
 * Memory neurons (TASARIM-008 §5): grown in life, never at birth, numbered in birth order within the subject. Only
 * food is remembered so far; a new kind of memory is a new pattern here, a design decision like any region.
 */
const MEM = /^mem\.food\.\d+$/;
export const memId = (n: number): string => `mem.food.${n}`;
/**
 * Recalled senses (TASARIM-008 §16, A3): one node per ray angle, carrying the recalled food like a ray carries a seen one.
 * The core writes them each tick from the memory neurons and the pose (working memory, never on the ledger); the brain
 * learns what to do with them.
 */
const REC = /^rec\d+\.food$/;
export const recId = (ray: number): string => `rec${ray}.food`;
const isAction = (s: string): s is ActionName => (ACTIONS as readonly string[]).includes(s);

/** Region of a node id, or null if the id fits no region (such a node is not allowed). */
export function regionOf(id: string): NodeRegion | null {
  if (SENSE.test(id)) return { region: "sense" };
  if ((HYP_NODES as readonly string[]).includes(id)) return { region: "hyp" };
  if (KC.test(id)) return { region: "kc" };
  if (LAT.test(id)) return { region: "lat" };
  if (MEM.test(id)) return { region: "mem" };
  if (REC.test(id)) return { region: "rec" };
  const perAction: [RegExp, Region][] = [
    [/^cpg\.noise\.(\w+)$/, "noise"],
    [/^cpg\.(\w+)$/, "cpg"],
    [/^bg\.go\.(\w+)$/, "bg.go"],
    [/^bg\.nogo\.(\w+)$/, "bg.nogo"],
    [/^bg\.out\.(\w+)$/, "bg.out"],
    [/^motor\.(\w+)$/, "motor"],
  ];
  for (const [re, region] of perAction) {
    const m = re.exec(id);
    if (m && isAction(m[1]!)) return { region, action: m[1] };
  }
  return null;
}

/** Node id for a per-action region: nodeId("bg.go", "left") → "bg.go.left". */
export function nodeId(region: Exclude<Region, "sense" | "hyp" | "kc" | "lat" | "mem" | "rec">, action: ActionName): string {
  return region === "noise" ? `cpg.noise.${action}` : `${region}.${action}`;
}
