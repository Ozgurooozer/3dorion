// brain-lab/regions/regions.ts — which region a node belongs to (TASARIM-BOLGELI-BEYIN.md §4).
// Regions are prefixes inside one Brain IR graph, so trace, ledger and replay stay whole.
"use strict";

import type { DugumTuru } from "../brain-ir/ir.ts";

export const ACTIONS = Object.freeze(["forward", "back", "left", "right"] as const);
export type ActionName = (typeof ACTIONS)[number];

export const OPPOSITE: Readonly<Record<ActionName, ActionName>> = Object.freeze({
  forward: "back", back: "forward", left: "right", right: "left",
});

export type Region = "sense" | "hyp" | "noise" | "cpg" | "bg.go" | "bg.nogo" | "bg.out" | "motor";

export interface NodeRegion {
  readonly region: Region;
  /** Set for regions that come one per action (noise, cpg, bg.*, motor). */
  readonly action?: ActionName;
}

/** The node type each region must use: the region decides the arithmetic, not the caller. */
export const REGION_TYPE: Readonly<Record<Region, DugumTuru>> = Object.freeze({
  sense: "sensor",
  hyp: "neuron",
  noise: "input",
  cpg: "decision",
  "bg.go": "neuron",
  "bg.nogo": "neuron",
  "bg.out": "decision",
  motor: "motor",
});

export const HYP_NODES = Object.freeze(["hyp.hunger", "hyp.pain"] as const);

const SENSE = /^(ray\d+\.\w+|touch\.\w+|intero\.\w+|proprio\.\w+)$/;
const isAction = (s: string): s is ActionName => (ACTIONS as readonly string[]).includes(s);

/** Region of a node id, or null if the id fits no region (such a node is not allowed). */
export function regionOf(id: string): NodeRegion | null {
  if (SENSE.test(id)) return { region: "sense" };
  if ((HYP_NODES as readonly string[]).includes(id)) return { region: "hyp" };
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
export function nodeId(region: Exclude<Region, "sense" | "hyp">, action: ActionName): string {
  return region === "noise" ? `cpg.noise.${action}` : `${region}.${action}`;
}
