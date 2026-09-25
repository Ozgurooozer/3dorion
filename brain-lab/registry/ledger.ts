// brain-lab/registry/ledger.ts — a subject's learning ledger: every change to its brain,
// numbered (LRN-…), in order, append-only.
//
// The ledger is a chain: each entry states the value it found ("before") and the value
// it left ("after"), and replay refuses an entry whose "before" does not match the brain
// at that point. So birth graph + ledger must reproduce the live brain exactly; a change
// made outside the ledger breaks the chain and is caught.
"use strict";

import type { BrainBaglantisi, BrainDugumu, BrainGrafi } from "../brain-ir/ir.ts";
import { canonicalGraph, checkGraph, edgeKey, graphHash } from "./graph.ts";
import { ledgerId, parseId } from "./ids.ts";
import { stageIndex, type Stage } from "./subject.ts";

interface Common {
  readonly id: string; // LRN-…
  readonly tick: number;
  readonly episode: number;
  /** Why: EVT ids from the run, or a short note. */
  readonly cause: readonly string[];
}
type EdgeRef = { readonly from: string; readonly to: string };

export type LedgerEntry =
  | (Common & { readonly kind: "weight"; readonly edge: EdgeRef; readonly before: number; readonly after: number; readonly delta?: number; readonly eligibility?: number })
  | (Common & { readonly kind: "node+"; readonly node: BrainDugumu })
  | (Common & { readonly kind: "edge+"; readonly edge: BrainBaglantisi })
  | (Common & { readonly kind: "edge-"; readonly edge: EdgeRef; readonly before: number })
  | (Common & { readonly kind: "param"; readonly node: string; readonly param: "threshold" | "decay"; readonly before: number | null; readonly after: number })
  | (Common & { readonly kind: "stage"; readonly from: Stage; readonly to: Stage; readonly reason: string })
  /** A learned value-estimate weight (critic, outside the graph); chained like weights, starts at 0. */
  | (Common & { readonly kind: "critic"; readonly feature: string; readonly before: number; readonly after: number });

type Omit1<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
export type LedgerInput = Omit1<LedgerEntry, "id">;

const misfit = (e: LedgerEntry, why: string): never => { throw new Error(`${e.id} (${e.kind}) does not fit the brain: ${why}`); };

/** The one check of a weight entry against the edge it names (undefined = the brain has no such edge). */
function checkWeight(e: LedgerEntry & { kind: "weight" }, c: BrainBaglantisi | undefined): BrainBaglantisi {
  if (!c) return misfit(e, `no edge ${edgeKey(e.edge)}`);
  if (c.weight !== e.before) misfit(e, `edge ${edgeKey(e.edge)} is ${c.weight}, entry says before=${e.before}`);
  if (!Number.isFinite(e.after)) misfit(e, `after=${e.after}`);
  return c;
}

/** Applies one entry to a graph, returning a new graph. Throws if the entry does not fit. */
export function applyEntry(g: BrainGrafi, e: LedgerEntry): BrainGrafi {
  const next: BrainGrafi = { ...g, nodes: g.nodes.map((n) => ({ ...n })), connections: g.connections.map((c) => ({ ...c })) };
  const find = (ref: EdgeRef) => next.connections.find((c) => c.from === ref.from && c.to === ref.to);
  const fail = (why: string): never => misfit(e, why);
  switch (e.kind) {
    case "weight": {
      checkWeight(e, find(e.edge)).weight = e.after;
      break;
    }
    case "node+":
      if (next.nodes.some((n) => n.id === e.node.id)) fail(`node ${e.node.id} already exists`);
      next.nodes.push({ ...e.node });
      break;
    case "edge+":
      if (find(e.edge)) fail(`edge ${edgeKey(e.edge)} already exists`);
      next.connections.push({ ...e.edge });
      break;
    case "edge-": {
      const c = find(e.edge) ?? fail(`no edge ${edgeKey(e.edge)}`);
      if (c.weight !== e.before) fail(`edge ${edgeKey(e.edge)} is ${c.weight}, entry says before=${e.before}`);
      next.connections = next.connections.filter((x) => x !== c);
      break;
    }
    case "param": {
      const n = next.nodes.find((x) => x.id === e.node) ?? fail(`no node ${e.node}`);
      const current = n[e.param] ?? null;
      if (current !== e.before) fail(`${e.node}.${e.param} is ${current}, entry says before=${e.before}`);
      n[e.param] = e.after;
      break;
    }
    case "critic": // critic weights live beside the graph; their chain is checked by the Ledger
    case "stage":
      break; // stages change the subject, not the graph; order is checked by the Ledger
  }
  checkGraph(next);
  return next;
}

export class Ledger {
  readonly subjectId: string;
  readonly birthGraph: BrainGrafi;
  /**
   * The brain now, owned by the ledger. Weight entries (almost all of them) change it in place through
   * `edges`; structural entries go through applyEntry, which copies and re-checks the whole graph.
   * Outside code only ever sees `graph`, a copy taken after the last change, which is never mutated.
   */
  private current: BrainGrafi;
  private edges = new Map<string, BrainBaglantisi>();
  private snapshot: BrainGrafi | null = null;
  private readonly log: LedgerEntry[] = [];
  private stageNow: Stage = "E0";
  private readonly critic = new Map<string, number>();

  /** Rebuilds from birth + existing entries; throws if the chain is broken anywhere. */
  constructor(subjectId: string, birthGraph: BrainGrafi, entries: readonly LedgerEntry[] = []) {
    checkGraph(birthGraph);
    this.subjectId = subjectId;
    this.birthGraph = canonicalGraph(birthGraph);
    this.current = this.adopt(structuredClone(this.birthGraph));
    entries.forEach((e, i) => {
      if (parseId("LRN", e.id) !== i + 1) throw new Error(`${subjectId}: entry ${i + 1} has id ${e.id}; the ledger has a gap or reorder`);
      this.accept(e);
    });
  }

  get graph(): BrainGrafi {
    return (this.snapshot ??= structuredClone(this.current));
  }

  private adopt(g: BrainGrafi): BrainGrafi {
    this.edges = new Map(g.connections.map((c) => [edgeKey(c), c]));
    return g;
  }

  get entries(): readonly LedgerEntry[] {
    return this.log;
  }

  /** Current critic weight for a feature (0 until learned). */
  criticWeight(feature: string): number {
    return this.critic.get(feature) ?? 0;
  }

  get stage(): Stage {
    return this.stageNow;
  }

  hash(): string {
    return graphHash(this.current);
  }

  /** Numbers the entry, checks it against the brain, and appends it. */
  record(input: LedgerInput): LedgerEntry {
    const entry = { ...input, id: ledgerId(this.log.length + 1) } as LedgerEntry;
    this.accept(entry);
    return entry;
  }

  /** True if a live brain matches birth + ledger exactly; false means it learned off the record. */
  matches(live: BrainGrafi): boolean {
    return graphHash(live) === this.hash();
  }

  private accept(e: LedgerEntry): void {
    if (e.kind === "stage") {
      if (e.from !== this.stageNow) throw new Error(`${e.id}: stage entry from ${e.from}, but subject is at ${this.stageNow}`);
      if (stageIndex(e.to) !== stageIndex(e.from) + 1) throw new Error(`${e.id}: stages advance one at a time (${e.from} → ${e.to})`);
    }
    if (e.kind === "critic") {
      const now = this.critic.get(e.feature) ?? 0;
      if (now !== e.before) throw new Error(`${e.id} (critic) does not fit: ${e.feature} is ${now}, entry says before=${e.before}`);
      if (!Number.isFinite(e.after)) throw new Error(`${e.id} (critic) after=${e.after}`);
    }
    if (e.kind === "weight") checkWeight(e, this.edges.get(edgeKey(e.edge))).weight = e.after;
    else if (e.kind !== "stage" && e.kind !== "critic") this.current = this.adopt(applyEntry(this.current, e));
    if (e.kind !== "stage" && e.kind !== "critic") this.snapshot = null;
    if (e.kind === "stage") this.stageNow = e.to;
    if (e.kind === "critic") this.critic.set(e.feature, e.after);
    this.log.push(e);
  }
}
