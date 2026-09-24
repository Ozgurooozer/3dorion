// brain-lab/viewer/draw-brain.ts — the brain map: region columns, nodes lit by their current
// output, edges by weight and sign, the selected node ringed.
"use strict";

import type { BrainAdimi, BrainGrafi } from "../brain-ir/ir.ts";
import type { Column, NodePos } from "./brain-layout.ts";
import { COLOR, alpha, clamp01, nodeLabel } from "./theme.ts";

export const NODE_R = 9;
const SENSOR_LABEL_LANE = 140;

const COLUMN_COLOR: Record<Column, string> = {
  sense: COLOR.sensor,
  hyp: COLOR.threat,
  kc: COLOR.spont,
  noise: COLOR.none,
  cpg: COLOR.spont,
  "bg.go": COLOR.excite,
  "bg.nogo": COLOR.inhibit,
  "bg.out": COLOR.inner,
  motor: COLOR.motor,
  inner: COLOR.inner,
};

const COLUMN_TITLE: Partial<Record<Column, string>> = {
  kc: "ARA KATMAN", hyp: "DÜRTÜ", noise: "GÜRÜLTÜ", cpg: "ÜRETEÇ", "bg.go": "GİT", "bg.nogo": "GİTME", "bg.out": "SEÇİM",
};

export function drawBrain(
  ctx: CanvasRenderingContext2D,
  graph: BrainGrafi,
  layout: ReadonlyMap<string, NodePos>,
  step: BrainAdimi | null,
  selected: string | null,
): void {
  const { width: cw, height: ch } = ctx.canvas;
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, cw, ch);
  const out = (id: string) => step?.outputs[id] ?? 0;

  ctx.font = "10px ui-monospace, Consolas, monospace";
  ctx.fillStyle = COLOR.dim;
  ctx.textAlign = "left";
  ctx.fillText("DUYU", 8, 12);
  ctx.textAlign = "right";
  ctx.fillText("MOTOR", cw - 8, 12);
  ctx.textAlign = "center";
  const titled = new Set<Column>();
  for (const p of layout.values()) {
    const t = COLUMN_TITLE[p.column];
    if (t && !titled.has(p.column)) { titled.add(p.column); ctx.fillText(t, p.x, 12); }
  }

  for (const e of graph.connections) {
    const a = layout.get(e.from);
    const b = layout.get(e.to);
    if (!a || !b) continue;
    const live = clamp01(Math.abs(out(e.from)));
    const strength = Math.min(1, Math.abs(e.weight));
    // Weak learning edges stay faint until they grow; live edges light up.
    const color = alpha(e.weight >= 0 ? COLOR.excite : COLOR.inhibit, (0.06 + 0.6 * strength) * (0.35 + 0.65 * live));
    const x0 = a.x + (a.column === "sense" ? SENSOR_LABEL_LANE : NODE_R);
    const x1 = b.x - NODE_R;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.6 + 2 * strength;
    ctx.beginPath();
    if (a.column === b.column) {
      // Same column (antagonist suppression): an arc to the side.
      ctx.moveTo(a.x + NODE_R, a.y);
      ctx.quadraticCurveTo(a.x + 34, (a.y + b.y) / 2, b.x + NODE_R, b.y);
    } else {
      ctx.moveTo(x0, a.y);
      ctx.bezierCurveTo((x0 + x1) / 2, a.y, (x0 + x1) / 2, b.y, x1, b.y);
    }
    ctx.stroke();
  }

  for (const n of graph.nodes) {
    const p = layout.get(n.id);
    if (!p) continue;
    const base = COLUMN_COLOR[p.column];
    const v = clamp01(Math.abs(out(n.id)));
    ctx.beginPath();
    ctx.arc(p.x, p.y, NODE_R, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.floor;
    ctx.fill();
    ctx.fillStyle = alpha(base, 0.12 + 0.88 * v);
    ctx.fill();
    ctx.strokeStyle = n.id === selected ? COLOR.text : alpha(base, 0.7);
    ctx.lineWidth = n.id === selected ? 2.5 : 1;
    ctx.stroke();

    ctx.fillStyle = v > 0 ? COLOR.text : COLOR.dim;
    if (p.column === "sense") {
      ctx.textAlign = "left";
      ctx.fillText(nodeLabel(n.id), p.x + NODE_R + 6, p.y + 3.5);
      if (v > 0) { ctx.fillStyle = COLOR.dim; ctx.fillText(v.toFixed(2), p.x + NODE_R + 98, p.y + 3.5); }
    } else if (p.column === "motor") {
      ctx.textAlign = "right";
      ctx.fillText(nodeLabel(n.id), p.x - NODE_R - 6, p.y - NODE_R - 4);
    } else {
      ctx.textAlign = "center";
      const short = nodeLabel(n.id).split(" ").slice(-1)[0]!;
      ctx.fillText(p.column === "hyp" ? nodeLabel(n.id) : short, p.x, p.y + NODE_R + 12);
    }
  }
  ctx.textAlign = "left";
}

/** The node under a canvas point, if any. */
export function nodeAt(layout: ReadonlyMap<string, NodePos>, x: number, y: number): string | null {
  for (const [id, p] of layout) if (Math.hypot(p.x - x, p.y - y) <= NODE_R + 4) return id;
  return null;
}
