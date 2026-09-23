// brain-lab/viewer/draw-brain.ts — the brain map: nodes lit by their current output,
// edges by weight and sign, the selected node ringed.
"use strict";

import type { BrainAdimi, BrainGrafi } from "../brain-ir/ir.ts";
import type { NodePos } from "./brain-layout.ts";
import { COLOR, alpha, clamp01, nodeLabel } from "./theme.ts";

export const NODE_R = 9;
const SENSOR_LABEL_LANE = 140;
const MOTOR_LABEL_LANE = 52;

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
  ctx.fillText("SENSÖRLER", 8, 12);
  ctx.textAlign = "right";
  ctx.fillText("MOTORLAR", cw - 8, 12);
  ctx.textAlign = "center";
  if (graph.nodes.some((n) => layout.get(n.id)?.column === "inner")) ctx.fillText("ARA NÖRONLAR", cw / 2, 12);
  if (graph.nodes.some((n) => layout.get(n.id)?.column === "spont")) ctx.fillText("KENDİLİĞİNDEN", cw * 0.66, 12);

  for (const e of graph.connections) {
    const a = layout.get(e.from);
    const b = layout.get(e.to);
    if (!a || !b) continue;
    const live = clamp01(Math.abs(out(e.from)));
    const color = alpha(e.weight >= 0 ? COLOR.excite : COLOR.inhibit, 0.25 + 0.75 * live);
    // Leave the label lanes clear: leave sensors after their label, reach motors before theirs.
    const x0 = a.x + (a.column === "sensor" ? SENSOR_LABEL_LANE : NODE_R);
    const x1 = b.x - (b.column === "motor" ? MOTOR_LABEL_LANE : NODE_R);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1 + 2.5 * Math.min(1, Math.abs(e.weight));
    ctx.beginPath();
    ctx.moveTo(x0, a.y);
    ctx.bezierCurveTo((x0 + x1) / 2, a.y, (x0 + x1) / 2, b.y, x1, b.y);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, b.y);
    ctx.lineTo(x1 - 7, b.y - 4);
    ctx.lineTo(x1 - 7, b.y + 4);
    ctx.fill();
  }

  for (const n of graph.nodes) {
    const p = layout.get(n.id);
    if (!p) continue;
    const base = p.column === "sensor" ? COLOR.sensor : p.column === "motor" ? COLOR.motor : p.column === "spont" ? COLOR.spont : COLOR.inner;
    const v = clamp01(Math.abs(out(n.id)));
    ctx.beginPath();
    ctx.arc(p.x, p.y, NODE_R, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.floor;
    ctx.fill();
    ctx.fillStyle = alpha(base, 0.12 + 0.88 * v);
    ctx.fill();
    ctx.strokeStyle = n.id === selected ? COLOR.text : alpha(base, 0.6);
    ctx.lineWidth = n.id === selected ? 2.5 : 1;
    ctx.stroke();

    ctx.fillStyle = v > 0 ? COLOR.text : COLOR.dim;
    const labelLeft = p.column === "motor" || p.column === "spont";
    ctx.textAlign = labelLeft ? "right" : "left";
    const lx = labelLeft ? p.x - NODE_R - 6 : p.x + NODE_R + 6;
    ctx.fillText(nodeLabel(n.id), lx, p.y + 3.5);
    if (p.column === "sensor" && v > 0) {
      ctx.fillStyle = COLOR.dim;
      ctx.fillText(v.toFixed(2), lx + 92, p.y + 3.5);
    }
  }
  ctx.textAlign = "left";
}

/** The node under a canvas point, if any. */
export function nodeAt(layout: ReadonlyMap<string, NodePos>, x: number, y: number): string | null {
  for (const [id, p] of layout) if (Math.hypot(p.x - x, p.y - y) <= NODE_R + 4) return id;
  return null;
}
