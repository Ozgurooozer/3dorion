// brain-lab/learning/growth.ts — the growing food memory (TASARIM-008 §5, A2). What the body sees is remembered as
// new neurons in its brain graph: a memory neuron is born where food was seen and nothing was remembered, confirmed
// when food is seen there again, faded when the place is looked at and the food is not there (surprise) or, slowly,
// with time, and it dies when its food is eaten, when it fades below a floor, or when the room changes (K6).
//
// Memory is structure, so it is learning (K4): every birth, change and death is a ledger entry (node+, memory, node-)
// and the live graph changes in step with the ledger, so birth graph + ledger is the brain, memories included. What
// the body sees and where it thinks it is are its own: rays and the pose from memory/pose.ts, never the room.
//
// A2 grows memories without synapses: nothing reads them yet (A3 adds the reading pathway), so behaviour cannot
// change. Their strength lives in their own record until then.
"use strict";

import type { BrainDugumu, BrainGrafi, MemoryRecord } from "../brain-ir/ir.ts";
import type { Pose } from "../memory/index.ts";
import type { Ledger, LedgerEntry, LedgerInput } from "../registry/index.ts";
import { memId, regionOf } from "../regions/index.ts";
import type { Observation, WorldConfig } from "../world/index.ts";

export interface GrowthParams {
  /** Vigilance (m): a sighting this close to a remembered place is that memory; farther, a new memory is born. */
  readonly vigilance: number;
  readonly birthStrength: number;
  /** Confirmation: w ← w + rate·(1 − w). */
  readonly confirmRate: number;
  /** Ticks since the last confirmation before a sighting counts again (bounds the ledger: a place in view for a
   * while is one confirmation, not one per tick). */
  readonly confirmGap: number;
  /** The place is the mean of the sightings, each counted once, up to this many. */
  readonly maxSightings: number;
  /** A ray passing this close (m) to a remembered place and seeing beyond it was looking at the place. */
  readonly surpriseRadius: number;
  /** Surprise: w ← w·(1 − fade). */
  readonly surpriseFade: number;
  /** Ticks since the last change before another surprise counts. */
  readonly surpriseGap: number;
  /** Fading with time, per tick: w·(1 − timeFade)^ticks — only a backup for memories never confirmed nor refuted. */
  readonly timeFade: number;
  /** A meal kills food memories within this distance (m) of the body: body + food radius + room for pose error. */
  readonly eatenRadius: number;
  /**
   * Which of them: "nearest" — the one nearest the body (A2 as measured); "reach" — every food memory within reach,
   * so a second memory of the same food, or one the pose put a little off, dies with it (the memory of a food right
   * next to it too, until that food is seen again). The falsification of 2026-09-26 found "nearest" letting a food's
   * second memory live on in 10-food rooms (G5 94 %).
   */
  readonly eatenRule: "nearest" | "reach";
  /** A memory weaker than this dies. */
  readonly floor: number;
  /** At most this many live food memories; a birth beyond it is refused (and counted). */
  readonly cap: number;
}

/**
 * Chosen before measuring (LAB-DEFTERI 2026-09-26, "A2 — koşmadan önce"), except the eaten rule: "reach" was chosen
 * the same day on seeds 1–10 in rooms 1–3 and confirmed on fresh seeds 11–20 (G5 pooled 93.7 → 97.4 %, precision and
 * coverage within 0.5 points; LAB-DEFTERI, "Açıkları kapatma").
 */
export const DEFAULT_GROWTH: GrowthParams = Object.freeze({
  vigilance: 0.5,
  birthStrength: 0.5,
  confirmRate: 0.3,
  confirmGap: 20,
  maxSightings: 20,
  surpriseRadius: 0.25,
  surpriseFade: 0.5,
  surpriseGap: 5,
  timeFade: 0.001,
  eatenRadius: 0.85,
  eatenRule: "reach",
  floor: 0.1,
  cap: 30,
});

const MEM_ID = /^mem\.food\.(\d+)$/;

/** A memory neuron as the growth sees it: its id and what it remembers now. */
export interface LiveMemory {
  readonly id: string;
  readonly memory: MemoryRecord;
}

export class FoodMemory {
  readonly params: GrowthParams;
  private readonly ledger: Ledger;
  private readonly graph: BrainGrafi;
  private readonly cfg: WorldConfig;
  private readonly liveNodes = new Map<string, BrainDugumu>();
  private next: number;
  private lastEnergy: number | null = null;
  private refusedBirths = 0;

  /** `graph` is the subject's live brain: it is changed in place, in step with the ledger. */
  constructor(ledger: Ledger, graph: BrainGrafi, cfg: WorldConfig, params: Partial<GrowthParams> = {}) {
    const p = { ...DEFAULT_GROWTH, ...params };
    for (const [k, v] of Object.entries(p)) {
      if (k === "eatenRule") continue;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new RangeError(`bad growth params: ${k} must be a finite number >= 0, got ${v}`);
    }
    if (p.eatenRule !== "nearest" && p.eatenRule !== "reach") throw new RangeError(`bad growth params: eatenRule must be "nearest" or "reach", got ${String(p.eatenRule)}`);
    if (p.birthStrength <= p.floor || p.birthStrength > 1) throw new RangeError(`bad growth params: birthStrength must be in (floor, 1], got ${p.birthStrength}`);
    for (const k of ["confirmRate", "surpriseFade", "timeFade"] as const) if (p[k] > 1) throw new RangeError(`bad growth params: ${k} must be at most 1, got ${p[k]}`);
    if (!Number.isInteger(p.cap) || !Number.isInteger(p.maxSightings) || p.maxSightings < 1) throw new RangeError("bad growth params: cap and maxSightings must be integers, maxSightings >= 1");
    this.params = Object.freeze(p);
    this.ledger = ledger;
    this.graph = graph;
    this.cfg = cfg;
    for (const n of graph.nodes) if (n.type === "memory") this.liveNodes.set(n.id, n);
    // Numbers are never reused: continue after the highest one ever born on this ledger.
    let highest = 0;
    for (const e of ledger.entries) {
      const m = e.kind === "node+" ? MEM_ID.exec(e.node.id) : null;
      if (m) highest = Math.max(highest, Number(m[1]));
    }
    this.next = highest + 1;
  }

  /** The live food memories, in birth order. */
  get live(): LiveMemory[] {
    return [...this.liveNodes.values()].map((n) => ({ id: n.id, memory: n.memory! }));
  }

  /** Births refused at the cap so far. */
  get refused(): number {
    return this.refusedBirths;
  }

  /** A memory's strength at `tick`, faded with time since it last changed. */
  strengthAt(m: MemoryRecord, tick: number): number {
    return m.strength * (1 - this.params.timeFade) ** Math.max(0, tick - m.updated);
  }

  /** A new room: every place memory dies (K6). */
  newRoom(tick: number, episode: number): LedgerEntry[] {
    this.lastEnergy = null;
    return [...this.liveNodes.values()].map((n) => this.kill(n, tick, episode, ["new room"]));
  }

  /** One tick: what the body senses now and where it thinks it is. Returns the ledger entries written. */
  step(obs: Observation, pose: Pose, tick: number, episode: number): LedgerEntry[] {
    const p = this.params;
    const out: LedgerEntry[] = [];
    const ate = this.lastEnergy !== null && obs.energy > this.lastEnergy;
    this.lastEnergy = obs.energy;

    // 1. A meal: the food the body just ate is gone — by the eaten rule, every food memory within reach, or the one nearest.
    if (ate && p.eatenRule === "reach") {
      for (const n of [...this.liveNodes.values()]) {
        if (Math.hypot(n.memory!.x - pose.x, n.memory!.y - pose.y) <= p.eatenRadius) out.push(this.kill(n, tick, episode, ["eaten"]));
      }
    } else if (ate) {
      let nearest: BrainDugumu | null = null;
      let best = p.eatenRadius;
      for (const n of this.liveNodes.values()) {
        const d = Math.hypot(n.memory!.x - pose.x, n.memory!.y - pose.y);
        if (d <= best) { best = d; nearest = n; }
      }
      if (nearest) out.push(this.kill(nearest, tick, episode, ["eaten"]));
    }

    // 2. Faded with time below the floor.
    for (const n of [...this.liveNodes.values()]) {
      if (this.strengthAt(n.memory!, tick) < p.floor) out.push(this.kill(n, tick, episode, ["faded"]));
    }

    // 3. Sightings: each ray that sees food gives a place (the ray meets the food's edge; its centre is one radius on).
    const seen = new Set<string>();
    obs.rays.forEach((ray, i) => {
      if (ray.hit !== "food") return;
      const a = pose.heading + this.cfg.rayAngles[i]!;
      const reach = ray.distance + this.cfg.foodRadius;
      const x = pose.x + reach * Math.cos(a);
      const y = pose.y + reach * Math.sin(a);
      let match: BrainDugumu | null = null;
      let best = p.vigilance;
      for (const n of this.liveNodes.values()) {
        const d = Math.hypot(n.memory!.x - x, n.memory!.y - y);
        if (d < best) { best = d; match = n; }
      }
      if (match) {
        seen.add(match.id);
        const m = match.memory!;
        if (tick - m.confirmed < p.confirmGap) return; // the same look, not new evidence
        const w = this.strengthAt(m, tick);
        const sightings = Math.min(m.sightings + 1, p.maxSightings);
        out.push(this.change(match, {
          ...m, strength: w + p.confirmRate * (1 - w), updated: tick, confirmed: tick, sightings,
          x: m.x + (x - m.x) / sightings, y: m.y + (y - m.y) / sightings,
        }, tick, episode, ["seen again", `ray ${i}`]));
      } else if (this.liveNodes.size >= p.cap) {
        this.refusedBirths++;
      } else {
        const node: BrainDugumu = {
          id: memId(this.next++), type: "memory",
          memory: { what: "food", x, y, strength: p.birthStrength, updated: tick, sightings: 1, born: tick, confirmed: tick },
        };
        seen.add(node.id);
        out.push(this.birth(node, tick, episode, ["food seen", `ray ${i}`]));
      }
    });

    // 4. Surprise: a ray looked past a remembered place and saw nothing there.
    for (const n of [...this.liveNodes.values()]) {
      if (seen.has(n.id)) continue;
      const m = n.memory!;
      if (tick - m.updated < p.surpriseGap) continue;
      const dx = m.x - pose.x;
      const dy = m.y - pose.y;
      const dist = Math.hypot(dx, dy);
      const looked = obs.rays.some((ray, i) => {
        const off = Math.atan2(dy, dx) - pose.heading - this.cfg.rayAngles[i]!;
        const along = dist * Math.cos(off);
        const across = Math.abs(dist * Math.sin(off));
        return along > 0 && across <= p.surpriseRadius && ray.distance > along + this.cfg.foodRadius;
      });
      if (!looked) continue;
      const w = this.strengthAt(m, tick) * (1 - p.surpriseFade);
      out.push(w < p.floor
        ? this.kill(n, tick, episode, ["expected, not seen"])
        : this.change(n, { ...m, strength: w, updated: tick }, tick, episode, ["expected, not seen"]));
    }
    return out;
  }

  private birth(node: BrainDugumu, tick: number, episode: number, cause: string[]): LedgerEntry {
    if (regionOf(node.id)?.region !== "mem") throw new Error(`growth outside the memory region: ${node.id}`);
    const entry = this.ledger.record({ kind: "node+", tick, episode, cause, node } satisfies LedgerInput);
    const live: BrainDugumu = { ...node, memory: { ...node.memory! } };
    this.graph.nodes.push(live);
    this.liveNodes.set(live.id, live);
    return entry;
  }

  private change(node: BrainDugumu, after: MemoryRecord, tick: number, episode: number, cause: string[]): LedgerEntry {
    const entry = this.ledger.record({ kind: "memory", tick, episode, cause, node: node.id, before: node.memory!, after } satisfies LedgerInput);
    node.memory = { ...after };
    return entry;
  }

  private kill(node: BrainDugumu, tick: number, episode: number, cause: string[]): LedgerEntry {
    const entry = this.ledger.record({ kind: "node-", tick, episode, cause, node: { ...node } } satisfies LedgerInput);
    const at = this.graph.nodes.indexOf(node);
    if (at >= 0) this.graph.nodes.splice(at, 1);
    this.liveNodes.delete(node.id);
    return entry;
  }
}
