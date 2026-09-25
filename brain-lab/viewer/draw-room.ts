// brain-lab/viewer/draw-room.ts — the room from above. Draws only what the real Room reports.
// World y is flipped so a positive turn ("left") turns left on screen.
"use strict";

import type { Ray } from "../world/index.ts";
import type { RoomState } from "../world/room.ts";
import { COLOR, alpha } from "./theme.ts";

export interface Point { x: number; y: number }

/** What drawing a room needs: a live Room's state() or a filmed frame (arena.ts) both provide it. */
export type RoomView = Pick<RoomState, "config" | "entities"> & { readonly body: Pick<RoomState["body"], "x" | "y" | "heading"> };

export function drawRoom(ctx: CanvasRenderingContext2D, s: RoomView, rays: readonly Ray[], trail: readonly Point[], bumpFlash: number): void {
  const { width: cw, height: ch } = ctx.canvas;
  const cfg = s.config;
  const pad = 16;
  const k = Math.min((cw - 2 * pad) / cfg.width, (ch - 2 * pad) / cfg.height);
  const ox = (cw - cfg.width * k) / 2;
  const oy = (ch - cfg.height * k) / 2;
  const X = (x: number) => ox + x * k;
  const Y = (y: number) => oy + (cfg.height - y) * k;

  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = COLOR.floor;
  ctx.fillRect(X(0), Y(cfg.height), cfg.width * k, cfg.height * k);

  // 1 m grid
  ctx.strokeStyle = COLOR.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < cfg.width; x++) { ctx.moveTo(X(x), Y(0)); ctx.lineTo(X(x), Y(cfg.height)); }
  for (let y = 1; y < cfg.height; y++) { ctx.moveTo(X(0), Y(y)); ctx.lineTo(X(cfg.width), Y(y)); }
  ctx.stroke();

  // walls, red while bumping
  ctx.strokeStyle = bumpFlash > 0 ? alpha(COLOR.threat, 0.4 + 0.6 * bumpFlash) : COLOR.wall;
  ctx.lineWidth = 4;
  ctx.strokeRect(X(0), Y(cfg.height), cfg.width * k, cfg.height * k);

  for (const e of s.entities) {
    ctx.beginPath();
    ctx.arc(X(e.x), Y(e.y), e.r * k, 0, Math.PI * 2);
    if (e.kind === "threat") {
      ctx.fillStyle = alpha(COLOR.threat, 0.18);
      ctx.fill();
      ctx.strokeStyle = alpha(COLOR.threat, 0.7);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = COLOR.food;
      ctx.fill();
    }
  }

  // trail, oldest faintest
  for (let i = 1; i < trail.length; i++) {
    ctx.strokeStyle = alpha(COLOR.sensor, (i / trail.length) * 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(trail[i - 1]!.x), Y(trail[i - 1]!.y));
    ctx.lineTo(X(trail[i]!.x), Y(trail[i]!.y));
    ctx.stroke();
  }

  // rays: color = what was seen, length = distance
  const b = s.body;
  rays.forEach((ray, i) => {
    const a = b.heading + cfg.rayAngles[i]!;
    const ex = b.x + Math.cos(a) * ray.distance;
    const ey = b.y + Math.sin(a) * ray.distance;
    const c = ray.hit === "food" ? COLOR.food : ray.hit === "threat" ? COLOR.threat : ray.hit === "wall" ? COLOR.dim : COLOR.none;
    ctx.strokeStyle = alpha(c, ray.hit === "none" ? 0.35 : 0.9);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(b.x), Y(b.y));
    ctx.lineTo(X(ex), Y(ey));
    ctx.stroke();
    if (ray.hit !== "none") {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(X(ex), Y(ey), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // body + heading
  ctx.fillStyle = COLOR.body;
  ctx.beginPath();
  ctx.arc(X(b.x), Y(b.y), cfg.bodyRadius * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLOR.bg;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(X(b.x), Y(b.y));
  ctx.lineTo(X(b.x + Math.cos(b.heading) * cfg.bodyRadius), Y(b.y + Math.sin(b.heading) * cfg.bodyRadius));
  ctx.stroke();

  ctx.fillStyle = COLOR.dim;
  ctx.font = "11px ui-monospace, Consolas, monospace";
  ctx.fillText(`${cfg.width}×${cfg.height} m · ızgara 1 m`, X(0), ch - 4);
}
