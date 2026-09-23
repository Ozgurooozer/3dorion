// brain-lab/viewer/draw-timeline.ts — energy/health curves, the dopamine signal, and a
// motor-spike raster over recent ticks.
"use strict";

import { MOTOR_NODE_IDS } from "../sensorimotor/index.ts";
import { COLOR, alpha, nodeLabel } from "./theme.ts";

export interface Sample {
  readonly energy: number;
  readonly health: number;
  readonly dopamine: number;
  readonly motors: readonly number[];
}

export const TIMELINE_LENGTH = 400;

// δ spans ~−0.01 (pain) to ~+0.3 (a meal); a square-root scale keeps both visible.
const DOPAMINE_FULL_SCALE = 0.3;
const squash = (d: number) => Math.sign(d) * Math.sqrt(Math.min(1, Math.abs(d) / DOPAMINE_FULL_SCALE));

export function drawTimeline(ctx: CanvasRenderingContext2D, samples: readonly Sample[]): void {
  const { width: cw, height: ch } = ctx.canvas;
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, cw, ch);
  const left = 64;
  const plotW = cw - left - 8;
  const curveH = ch * 0.4;
  const dopTop = curveH + 6;
  const dopH = ch * 0.3;
  const rasterTop = dopTop + dopH + 6;
  const rowH = (ch - rasterTop - 4) / MOTOR_NODE_IDS.length;
  const x = (i: number) => left + (i / (TIMELINE_LENGTH - 1)) * plotW;
  const offset = TIMELINE_LENGTH - samples.length;

  ctx.font = "10px ui-monospace, Consolas, monospace";
  ctx.lineWidth = 1;
  for (const f of [0, 0.5, 1]) {
    const y = 6 + (1 - f) * (curveH - 12);
    ctx.strokeStyle = COLOR.grid;
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

  // Dopamine band: zero line in the middle, bars up (better than expected) and down (worse).
  const mid = dopTop + dopH / 2;
  ctx.strokeStyle = COLOR.grid;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(left, mid); ctx.lineTo(cw - 8, mid); ctx.stroke();
  ctx.fillStyle = COLOR.dim;
  ctx.fillText("dopamin", 8, mid - 4);
  ctx.fillText("δ (√)", 8, mid + 10);
  const barW = Math.max(1, plotW / TIMELINE_LENGTH);
  samples.forEach((s, i) => {
    if (s.dopamine === 0) return;
    const h = squash(s.dopamine) * (dopH / 2 - 2);
    ctx.fillStyle = alpha(s.dopamine > 0 ? COLOR.inner : COLOR.threat, 0.9);
    ctx.fillRect(x(i + offset), h > 0 ? mid - h : mid, barW, Math.abs(h));
  });

  MOTOR_NODE_IDS.forEach((id, row) => {
    const y = rasterTop + row * rowH;
    ctx.fillStyle = COLOR.dim;
    ctx.fillText(nodeLabel(id), 8, y + rowH * 0.75);
    ctx.fillStyle = alpha(COLOR.motor, 0.9);
    samples.forEach((s, i) => {
      if (s.motors[row] === 1) ctx.fillRect(x(i + offset), y + 1, barW, rowH - 2);
    });
  });
}
