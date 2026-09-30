// brain-lab/viewer/beyin3d-layout.ts — where each neuron sits in the 3D brain (beyin3d.html). Pure: no Babylon.
//   x  the way a signal travels: senses → grown memory → recalled senses → drives / noise → generators → Go / NoGo →
//      selection → motor (the column order of the 2D map, brain-layout.ts)
//   z  side: the left of the body is +z. A ray sits at its angle; a per-action neuron sits in its action's lane, so
//      "food seen on the left" and "turn left" line up across the brain
//   y  kind: wall / food / threat rays stacked; Go above NoGo; drives above noise
"use strict";

import { ACTIONS, regionOf } from "../regions/index.ts";

export interface P3 { readonly x: number; readonly y: number; readonly z: number }

/** Each action's lane across the brain: left and right at the sides, forward and back in the middle. */
export const LANE: Readonly<Record<string, number>> = Object.freeze({ left: 3.3, forward: 1.1, back: -1.1, right: -3.3 });
export const COLUMN_X: Readonly<Record<string, number>> = Object.freeze({
  sense: 0, mem: 3.5, rec: 6, hyp: 9, noise: 9, cpg: 12, "bg.go": 15, "bg.nogo": 15, "bg.out": 18.5, motor: 22, other: 4.8,
});
const RAY_KIND_Y: Readonly<Record<string, number>> = { wall: 2.4, food: 0, threat: -2.4 };
const RAY_SPREAD = 2.6; // z per radian of ray angle

export function layout3d(ids: readonly string[], rayAngles: readonly number[]): Map<string, P3> {
  const pos = new Map<string, P3>();
  const body: string[] = [], mem: string[] = [], other: string[] = [];
  for (const id of ids) {
    const ray = /^ray(\d+)\.(\w+)$/.exec(id);
    const rec = /^rec(\d+)\./.exec(id);
    const r = regionOf(id);
    if (ray) pos.set(id, { x: COLUMN_X.sense!, y: RAY_KIND_Y[ray[2]!] ?? 0, z: (rayAngles[Number(ray[1])] ?? 0) * RAY_SPREAD });
    else if (rec) pos.set(id, { x: COLUMN_X.rec!, y: 0, z: (rayAngles[Number(rec[1])] ?? 0) * RAY_SPREAD });
    else if (r?.region === "sense") body.push(id);
    else if (r?.region === "mem") mem.push(id);
    else if (r?.action && r.region in COLUMN_X) {
      const y = r.region === "bg.go" ? 1.8 : r.region === "bg.nogo" ? -1.8 : r.region === "noise" ? -2.2 : 0;
      pos.set(id, { x: COLUMN_X[r.region]!, y, z: LANE[r.action]! });
    } else if (id === "hyp.hunger" || id === "hyp.pain") pos.set(id, { x: COLUMN_X.hyp!, y: 2.4, z: id === "hyp.hunger" ? 1.2 : -1.2 });
    else other.push(id);
  }
  // Body senses (touch, interoception, proprioception) in a row below the rays.
  body.forEach((id, i) => pos.set(id, { x: COLUMN_X.sense!, y: -5, z: (i - (body.length - 1) / 2) * 1.15 }));
  // Grown memory neurons: a wall of six per row, growing upward as the brain grows them.
  mem.forEach((id, i) => pos.set(id, { x: COLUMN_X.mem!, y: -1.5 + Math.floor(i / 6) * 1.1, z: ((i % 6) - 2.5) * 1.2 }));
  other.forEach((id, i) => pos.set(id, { x: COLUMN_X.other!, y: 4.5, z: (i - (other.length - 1) / 2) * 1.1 }));
  return pos;
}

/** The action lanes, in the order the page draws them. */
export const LANES = ACTIONS.map((a) => ({ action: a, z: LANE[a]! }));
