// brain-lab/registry/graph.ts — a brain graph's canonical form and hash.
// Canonical = nodes sorted by id, edges sorted by (from, to): the same brain always
// hashes the same regardless of the order things were added in.
"use strict";

import type { BrainBaglantisi, BrainDugumu, BrainGrafi } from "../brain-ir/ir.ts";
import { fnv1a } from "../world/index.ts";

export const edgeKey = (e: { from: string; to: string }): string => `${e.from}->${e.to}`;

export function canonicalGraph(g: BrainGrafi): BrainGrafi {
  const nodes: BrainDugumu[] = [...g.nodes].map((n) => ({ ...n })).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const connections: BrainBaglantisi[] = [...g.connections].map((c) => ({ ...c }))
    .sort((a, b) => (edgeKey(a) < edgeKey(b) ? -1 : edgeKey(a) > edgeKey(b) ? 1 : 0));
  const out: BrainGrafi = { nodes, connections };
  if (g.name !== undefined) out.name = g.name;
  if (g.version !== undefined) out.version = g.version;
  return out;
}

/** Throws on duplicate node ids, duplicate edges, or edges to unknown nodes. */
export function checkGraph(g: BrainGrafi): void {
  const ids = new Set<string>();
  for (const n of g.nodes) {
    if (ids.has(n.id)) throw new Error(`duplicate node ${n.id}`);
    ids.add(n.id);
  }
  const edges = new Set<string>();
  for (const e of g.connections) {
    if (!ids.has(e.from) || !ids.has(e.to)) throw new Error(`edge ${edgeKey(e)} touches an unknown node`);
    if (edges.has(edgeKey(e))) throw new Error(`duplicate edge ${edgeKey(e)}`);
    if (!Number.isFinite(e.weight)) throw new Error(`edge ${edgeKey(e)} has weight ${e.weight}`);
    edges.add(edgeKey(e));
  }
}

export function graphHash(g: BrainGrafi): string {
  return fnv1a(JSON.stringify(canonicalGraph(g)));
}
