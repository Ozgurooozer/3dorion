"use strict";

export type BrainNode =
  | { id: string; kind: "input" }
  | { id: string; kind: "neuron"; decay: number; threshold: number }
  | { id: string; kind: "decision"; threshold: number };

export interface BrainConnection {
  from: string;
  to: string;
  weight: number;
}

export interface BrainGraph {
  version: 1;
  nodes: BrainNode[];
  connections: BrainConnection[];
  inputs: string[];
  outputs: string[];
}

export interface StepResult {
  states: Record<string, number>;
  outputs: Record<string, "escape" | "ignore">;
}

export function graphDogrula(graph: BrainGraph): void {
  if (graph.version !== 1) throw new Error("unsupported graph version");
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.id || ids.has(node.id)) throw new Error(`duplicate node: ${node.id}`);
    ids.add(node.id);
    if (node.kind === "neuron" && (!Number.isFinite(node.decay) || node.decay < 0 || node.decay > 1)) {
      throw new Error(`invalid decay: ${node.id}`);
    }
    if ((node.kind === "neuron" || node.kind === "decision") && !Number.isFinite(node.threshold)) {
      throw new Error(`invalid threshold: ${node.id}`);
    }
  }
  for (const connection of graph.connections) {
    if (!ids.has(connection.from) || !ids.has(connection.to)) {
      throw new Error(`unknown connection endpoint: ${connection.from} -> ${connection.to}`);
    }
    if (!Number.isFinite(connection.weight)) throw new Error("invalid connection weight");
  }
  for (const id of [...graph.inputs, ...graph.outputs]) {
    if (!ids.has(id)) throw new Error(`unknown port: ${id}`);
  }
}

export class GraphSimulator {
  private readonly _graph: BrainGraph;
  private _states: Record<string, number>;

  constructor(graph: BrainGraph) {
    graphDogrula(graph);
    this._graph = graph;
    this._states = Object.fromEntries(graph.nodes.map((node) => [node.id, 0]));
  }

  adim(inputs: Record<string, number>): StepResult {
    const next: Record<string, number> = { ...this._states };
    const current: Record<string, number> = { ...this._states };
    for (const id of this._graph.inputs) {
      const value = inputs[id] ?? 0;
      if (!Number.isFinite(value)) throw new Error(`invalid input: ${id}`);
      current[id] = value;
      next[id] = value;
    }

    for (const node of this._graph.nodes) {
      if (node.kind === "input") continue;
      const incoming = this._graph.connections
        .filter((connection) => connection.to === node.id)
        .reduce((sum, connection) => sum + current[connection.from]! * connection.weight, 0);
      if (node.kind === "neuron") {
        next[node.id] = node.decay * current[node.id]! + incoming;
      } else {
        next[node.id] = incoming;
      }
    }

    this._states = next;
    const outputs: Record<string, "escape" | "ignore"> = {};
    for (const id of this._graph.outputs) {
      const node = this._graph.nodes.find((candidate) => candidate.id === id);
      if (!node || node.kind === "input") throw new Error(`output is not a decision: ${id}`);
      outputs[id] = next[id]! >= node.threshold ? "escape" : "ignore";
    }
    return { states: { ...next }, outputs };
  }
}