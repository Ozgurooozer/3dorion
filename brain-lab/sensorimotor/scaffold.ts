// brain-lab/sensorimotor/scaffold.ts — the nerves every brain graph must have.
// The scaffold has sensor and motor nodes and NO connections: what links them is
// the brain's business (and later, learning's), never this file's.
"use strict";

import type { BrainGrafi } from "../brain-ir/ir.ts";
import type { WorldConfig } from "../world/index.ts";
import { MOTOR_NODE_IDS } from "./decode.ts";
import { sensorNodeIds } from "./encode.ts";

export function sensorimotorScaffold(cfg: WorldConfig, name = "sensorimotor-scaffold"): BrainGrafi {
  return {
    name,
    version: "1",
    nodes: [
      ...sensorNodeIds(cfg).map((id) => ({ id, type: "sensor" as const })),
      ...MOTOR_NODE_IDS.map((id) => ({ id, type: "motor" as const })),
    ],
    connections: [],
  };
}

/** Throws, naming every problem, if the graph cannot be plugged into this body. */
export function checkWiring(graf: BrainGrafi, cfg: WorldConfig): void {
  const types = new Map(graf.nodes.map((n) => [n.id, n.type]));
  const problems: string[] = [];
  for (const id of sensorNodeIds(cfg)) {
    const t = types.get(id);
    if (t === undefined) problems.push(`missing sensor ${id}`);
    else if (t !== "sensor" && t !== "input") problems.push(`${id} is ${t}, must be sensor`);
  }
  for (const id of MOTOR_NODE_IDS) {
    const t = types.get(id);
    if (t === undefined) problems.push(`missing motor ${id}`);
    else if (t !== "motor") problems.push(`${id} is ${t}, must be motor`);
  }
  if (problems.length > 0) throw new Error(`brain does not fit the body: ${problems.join("; ")}`);
}
