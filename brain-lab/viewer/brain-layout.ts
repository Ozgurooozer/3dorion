// brain-lab/viewer/brain-layout.ts — where each brain node sits on the map:
// sensors on the left (grouped per ray), motors on the right, everything else in between.
"use strict";

import type { BrainGrafi } from "../brain-ir/ir.ts";
import { MOTOR_NODE_IDS, RAY_KINDS, sensorNodeIds } from "../sensorimotor/index.ts";
import type { WorldConfig } from "../world/index.ts";

export interface NodePos { readonly x: number; readonly y: number; readonly column: "sensor" | "inner" | "spont" | "motor" }

const GROUP_GAP = 0.6; // extra row-heights between sensor groups

/** Positions in [0,w]×[0,h] with `pad` margin. Deterministic: same graph → same map. */
export function layoutBrain(graph: BrainGrafi, cfg: WorldConfig, w: number, h: number, pad = 28): Map<string, NodePos> {
  const out = new Map<string, NodePos>();
  const ids = new Set(graph.nodes.map((n) => n.id));

  // Sensor column: one group per ray, then the body senses as a last group.
  const sensors = sensorNodeIds(cfg).filter((id) => ids.has(id));
  const perGroup = RAY_KINDS.length;
  const groups = Math.ceil(sensors.length / perGroup);
  const rows = sensors.length + (groups - 1) * GROUP_GAP;
  const step = rows > 1 ? (h - 2 * pad) / (rows - 1) : 0;
  sensors.forEach((id, i) => {
    const y = pad + (i + Math.floor(i / perGroup) * GROUP_GAP) * step;
    out.set(id, { x: pad, y, column: "sensor" });
  });

  const place = (list: string[], x: number, column: NodePos["column"]) => {
    list.forEach((id, i) => out.set(id, { x, y: pad + ((i + 1) * (h - 2 * pad)) / (list.length + 1), column }));
  };
  place(MOTOR_NODE_IDS.filter((id) => ids.has(id)), w - pad, "motor");
  // Spontaneous generators sit next to the motors they drive.
  place(graph.nodes.map((n) => n.id).filter((id) => id.startsWith("spont.")), w * 0.66, "spont");
  place(graph.nodes.map((n) => n.id).filter((id) => !out.has(id)), w / 2, "inner");
  return out;
}
