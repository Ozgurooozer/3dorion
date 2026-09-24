// brain-lab/viewer/brain-layout.ts — where each node sits on the brain map.
// Columns are regions, left to right in the order a signal travels:
//   senses | expansion layer, side comparison (if any) | hunger/pain drive | noise | generator | Go | NoGo | selection | motor
// and each action (forward, back, left, right) has its own row, so one movement's whole chain
// reads left to right on a single line.
"use strict";

import type { BrainGrafi } from "../brain-ir/ir.ts";
import { ACTIONS, regionOf, type Region } from "../regions/index.ts";
import { RAY_KINDS, sensorNodeIds } from "../sensorimotor/index.ts";
import type { WorldConfig } from "../world/index.ts";

export type Column = Region | "inner";

export interface NodePos { readonly x: number; readonly y: number; readonly column: Column }

const GROUP_GAP = 0.6; // extra row-heights between sensor groups

/** Horizontal position of each per-action region, as a fraction of the width. */
const COLUMN_X: Partial<Record<Region, number>> = {
  kc: 0.23, lat: 0.29, hyp: 0.36, noise: 0.46, cpg: 0.56, "bg.go": 0.66, "bg.nogo": 0.76, "bg.out": 0.86,
};

/** Positions in [0,w]×[0,h] with `pad` margin. Deterministic: same graph → same map. */
export function layoutBrain(graph: BrainGrafi, cfg: WorldConfig, w: number, h: number, pad = 28): Map<string, NodePos> {
  const out = new Map<string, NodePos>();
  const ids = new Set(graph.nodes.map((n) => n.id));

  const sensors = sensorNodeIds(cfg).filter((id) => ids.has(id));
  const perGroup = RAY_KINDS.length;
  const groups = Math.ceil(sensors.length / perGroup);
  const rows = sensors.length + (groups - 1) * GROUP_GAP;
  const step = rows > 1 ? (h - 2 * pad) / (rows - 1) : 0;
  sensors.forEach((id, i) => out.set(id, { x: pad, y: pad + (i + Math.floor(i / perGroup) * GROUP_GAP) * step, column: "sense" }));

  const actionY = (i: number) => pad + ((i + 1) * (h - 2 * pad)) / (ACTIONS.length + 1);
  const inner: string[] = [];
  const hyp: string[] = [];
  const kc: string[] = [];
  const lat: string[] = [];
  for (const n of graph.nodes) {
    if (out.has(n.id)) continue;
    const r = regionOf(n.id);
    if (!r) { inner.push(n.id); continue; }
    if (r.region === "hyp") { hyp.push(n.id); continue; }
    if (r.region === "kc") { kc.push(n.id); continue; }
    if (r.region === "lat") { lat.push(n.id); continue; }
    if (r.region === "sense") { inner.push(n.id); continue; }
    const row = ACTIONS.indexOf(r.action!);
    const x = r.region === "motor" ? w - pad : (COLUMN_X[r.region] ?? 0.5) * w;
    out.set(n.id, { x, y: actionY(row), column: r.region });
  }
  // Drive nodes between the rows, near the top: they reach every action.
  hyp.forEach((id, i) => out.set(id, { x: COLUMN_X.hyp! * w, y: pad + ((i + 0.5) * (h - 2 * pad)) / (ACTIONS.length + 1), column: "hyp" }));
  // Expansion cells in one tall column: they are not per action.
  kc.forEach((id, i) => out.set(id, { x: COLUMN_X.kc! * w, y: pad + (kc.length > 1 ? (i * (h - 2 * pad)) / (kc.length - 1) : (h - 2 * pad) / 2), column: "kc" }));
  lat.forEach((id, i) => out.set(id, { x: COLUMN_X.lat! * w, y: pad + ((i + 0.5) * (h - 2 * pad)) / lat.length, column: "lat" }));
  inner.forEach((id, i) => out.set(id, { x: w / 2, y: h - pad - i * 22, column: "inner" }));
  return out;
}
