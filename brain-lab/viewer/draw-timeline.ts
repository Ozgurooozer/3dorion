// brain-lab/viewer/draw-timeline.ts — energy/health curves and a motor-spike raster over recent ticks.
"use strict";

import { MOTOR_NODE_IDS } from "../sensorimotor/index.ts";
import { COLOR, alpha, nodeLabel } from "./theme.ts";

export interface Sample { readonly energy: number; readonly health: number; readonly motors: readonly number[] }

export const TIMELINE_LENGTH = 400;

export function drawTimeline(ctx: CanvasRenderingContext2D, samples: readonly Sample[]): void {
  const { width: cw, height: ch } = ctx.canvas;
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, cw, ch);
  const left = 44;
  const plotW = cw - left - 8;
  const curveH = ch * 0.55;
  const rowH = (ch - curveH - 14) / MOTOR_NODE_IDS.length;
  const x = (i: number) => left + (i / (TIMELINE_LENGTH - 1)) * plotW;
  const offset = TIMELINE_LENGTH - samples.length;

  ctx.font = "10px ui-monospace, Consolas, monospace";
  ctx.strokeStyle = COLOR.grid;
  ctx.lineWidth = 1;
  for (const f of [0, 0.5, 1]) {
    const y = 6 + (1 - f) * (curveH - 12);
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(cw - 8, y); ctx.stroke();
    ctx.fillStyle = COLOR.dim;
    ctx.fillText(f.toFixed(1), 8, y + 3);
  }
  for (const [key, color] of [["energy", COLOR.energy], ["health", COLOR.health]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    samples.forEach((s, i) => {
      const y = 6 + (1 - s[key]) * (curveH - 12);
      if (i === 0) ctx.moveTo(x(i + offset), y); else ctx.lineTo(x(i + offset), y);
    });
    ctx.stroke();
  }

  MOTOR_NODE_IDS.forEach((id, row) => {
    const y = curveH + 8 + row * rowH;
    ctx.fillStyle = COLOR.dim;
    ctx.fillText(nodeLabel(id), 8, y + rowH * 0.7);
    ctx.fillStyle = alpha(COLOR.motor, 0.9);
    samples.forEach((s, i) => {
      if (s.motors[row] === 1) ctx.fillRect(x(i + offset), y + 2, Math.max(1, plotW / TIMELINE_LENGTH), rowH - 4);
    });
  });
}
