// brain-lab/memory/core.ts — the memory core (TASARIM-007 §4): the one contract every memory module speaks, as
// 3dorion's protocol/ is for brain and body. Modules plug in behind it: H1 pose now, the map and surprise later.
//
// The core's rules are enforced here, not only written down:
//   - Working memory holds what is the case now: a slot is overwritten, never appended. Events ("I ate", "I bumped")
//     will get a store of their own (H5). 3dorion measured what goes wrong when the present is written into an
//     event store: Orion told yesterday's view as today's (docs/specs/06-beyin-v2.md).
//   - Every entry carries when (tick), where it came from (source) and how sure it is (confidence, 0–1).
//   - Retrieval threshold: an entry less sure than the reader asks for is not returned; "maybe" does not decide.
//   - Content is state, not learning. reset() at every new room, and nothing here touches a subject's ledger: the
//     ledger holds what the brain learned, the run trace what it remembered. Mixed, the ledger bloats and replay breaks.
//   - Ticks arrive one at a time, in order, from 0 after each reset. Path integration adds up every tick, so a skipped
//     or repeated tick, or a room started without reset(), would corrupt it silently; it throws instead.
// A module reads only the body's senses (an Observation), never the world: it cannot know more than the body could.
"use strict";

import type { Observation, Policy } from "../world/index.ts";

/** Where an entry came from. */
export type Source =
  | "sensed" // perceived this tick
  | "inferred" // computed from the senses by a module (path integration, the map)
  | "recalled" // remembered, not perceived now
  | "planner" // Bob said so
  | "teacher"; // a teacher said so (Ozyn, Claude, the oracle fixture)

export const SOURCES: readonly Source[] = Object.freeze(["sensed", "inferred", "recalled", "planner", "teacher"]);

export interface Stamp {
  readonly tick: number;
  readonly source: Source;
  /** How sure the writer is, 0–1. */
  readonly confidence: number;
}

export interface Entry<T> {
  readonly value: T;
  readonly stamp: Stamp;
}

function checkStamp(key: string, s: Stamp): void {
  if (!Number.isInteger(s.tick) || s.tick < 0) throw new RangeError(`${key}: tick must be an integer >= 0, got ${s.tick}`);
  if (!SOURCES.includes(s.source)) throw new RangeError(`${key}: unknown source ${String(s.source)}`);
  if (!(s.confidence >= 0 && s.confidence <= 1)) throw new RangeError(`${key}: confidence must be in [0, 1], got ${s.confidence}`);
}

/**
 * What is the case now: one entry per key, overwritten by the next write. The entry and its stamp are frozen; a
 * module writes values its readers cannot change (a frozen object or a fresh copy).
 */
export class WorkingMemory {
  private readonly slots = new Map<string, Entry<unknown>>();

  write<T>(key: string, value: T, stamp: Stamp): void {
    checkStamp(key, stamp);
    this.slots.set(key, Object.freeze({ value, stamp: Object.freeze({ tick: stamp.tick, source: stamp.source, confidence: stamp.confidence }) }));
  }

  /** The entry under `key`, or undefined when there is none or it is less sure than `threshold` (0–1). */
  read<T>(key: string, threshold = 0): Entry<T> | undefined {
    if (!(threshold >= 0 && threshold <= 1)) throw new RangeError(`threshold must be in [0, 1], got ${threshold}`);
    const e = this.slots.get(key);
    return e && e.stamp.confidence >= threshold ? (e as Entry<T>) : undefined;
  }

  keys(): string[] {
    return [...this.slots.keys()];
  }

  clear(): void {
    this.slots.clear();
  }
}

/** One memory module: it hears the body's senses every tick and keeps what it knows in working memory. */
export interface MemoryModule {
  readonly name: string;
  /** A new room: forget all content. */
  reset(): void;
  /** One tick of the body's senses; write what is now the case into `working`. */
  observe(obs: Observation, tick: number, working: WorkingMemory): void;
}

/** The modules and their shared working memory; the brain's memory as one piece. */
export class MemoryCore {
  readonly working = new WorkingMemory();
  readonly modules: readonly MemoryModule[];
  private next = 0;

  constructor(modules: readonly MemoryModule[]) {
    const names = modules.map((m) => m.name);
    if (new Set(names).size !== names.length) throw new Error(`memory module names must be unique: ${names.join(", ")}`);
    this.modules = Object.freeze([...modules]);
  }

  /** A new room: every module forgets, working memory empties, ticks start again from 0. */
  reset(): void {
    this.working.clear();
    for (const m of this.modules) m.reset();
    this.next = 0;
  }

  /** One tick; the modules run in the order given. */
  observe(obs: Observation, tick: number): void {
    if (tick !== this.next) {
      const hint = tick === 0 ? " (a new room needs reset() first)" : "";
      throw new Error(`memory expected tick ${this.next}, got ${tick}${hint}`);
    }
    for (const m of this.modules) m.observe(obs, tick, this.working);
    this.next++;
  }

  /** Ticks observed since the last reset. */
  get ticks(): number {
    return this.next;
  }
}

/** A policy whose memory hears every observation first; the policy's own decisions are untouched. */
export function withMemory(policy: Policy, core: MemoryCore): Policy {
  return (obs, tick) => {
    core.observe(obs, tick);
    return policy(obs, tick);
  };
}
