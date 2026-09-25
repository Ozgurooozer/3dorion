// brain-lab/viewer/arena.ts — a subject's frozen brain living in the rooms it was measured in, one tick at a
// time, so a person can watch it next to its twin. It runs on the lab's server (api.ts), in Node — the same
// engine the experiment ran in — and the browser only draws the result, a Film per room. That is not a
// detail: the browser's JavaScript engine rounds Math.cos differently in the last bit (found 2026-09-25:
// room 1 of DNK-2747 diverges at tick 706, body.vx …938 vs …936), so a brain run in the browser would be a
// near copy, not the measured run. A test checks that every filmed room matches the experiment's record.
//
// Rooms play in order (1, 2, 3 …) because the brain's noise generator carries on from one room to the
// next exactly as it did during the measurement; jumping to room 5 means living rooms 1–4 first.
"use strict";

import type { BrainGrafi } from "../brain-ir/ir.ts";
import type { Actor } from "../experiments/harness.ts";
import { MAX_TICKS, evalNoise, evalWorld } from "../experiments/seeds.ts";
import { createAgent, type AgentSpec } from "../learning/index.ts";
import { drive } from "../neuromodulation/index.ts";
import { Ledger, type LedgerInput } from "../registry/ledger.ts";
import { Room, type DoneCause, type Observation, type Ray, type WorldConfig } from "../world/index.ts";
import type { RoomState } from "../world/room.ts";

/** What the arena needs to rebuild one subject's frozen brain (served by api.ts /api/arena). */
export interface BrainRecord {
  readonly id: string;
  readonly name: string;
  /** The brain now: birth graph plus every change on its ledger. */
  readonly graph: BrainGrafi;
  /** Learned critic weights by feature (they shape δ, which a frozen brain feels but does not learn from). */
  readonly critic: Readonly<Record<string, number>>;
  /** The evaluation spec the experiment used for this subject. */
  readonly spec: Pick<AgentSpec, "selection" | "critic">;
  /** Recorded evaluation episodes, room by room, to check the replay against. */
  readonly recorded: readonly RecordedEpisode[];
}

export interface RecordedEpisode {
  readonly episode: number;
  readonly worldSeed: number;
  readonly foodEaten: number;
  readonly ticks: number;
  readonly doneCause: DoneCause | null;
  readonly finalHash: string;
}

export interface EpisodeResult {
  readonly episode: number;
  /**
   * Mean drive over the whole room (MAX_TICKS), a dead body counted at its last drive until the end —
   * the experiment's primary measure (experiments/harness.ts measureEpisodes), for this one room.
   */
  readonly meanDrive: number;
  readonly foodEaten: number;
  readonly ticks: number;
  readonly doneCause: DoneCause | null;
  readonly finalHash: string;
}

/** A ledger holding the brain as it is now; critic weights are chained in from 0 as the ledger requires. */
function ledgerOf(b: BrainRecord): Ledger {
  const ledger = new Ledger(b.id, b.graph);
  for (const [feature, after] of Object.entries(b.critic)) {
    const entry: LedgerInput = { kind: "critic", tick: 0, episode: 0, cause: ["arena"], feature, before: 0, after };
    ledger.record(entry);
  }
  return ledger;
}

/**
 * What a contestant is: a subject's frozen brain, or any other body with a policy (the yoked body, which
 * replays the learner's actions blind; experiments/yoked.ts). Only a brain has recorded rooms to check.
 */
export type Source = BrainRecord | { readonly id: string; readonly name: string; readonly actor: Actor; readonly recorded: readonly RecordedEpisode[] };

/** A subject's frozen brain as an actor, exactly as experiments/harness.ts evaluates it. */
export function brainActor(brain: BrainRecord, cfg: WorldConfig, seed: number): Actor {
  return createAgent({
    cfg, ledger: ledgerOf(brain), noiseSeed: evalNoise(seed),
    learning: { frozen: true }, selection: brain.spec.selection ?? null, critic: brain.spec.critic ?? null,
  });
}

/** One body living its evaluation rooms (a brain with learning frozen, or any actor), one tick per step(). */
export class Contestant {
  readonly brain: Source;
  private readonly cfg: WorldConfig;
  private readonly seed: number;
  private readonly agent: Actor;
  private roomNow: Room;
  private obsNow: Observation;
  private episodeNow = 0;
  private ticksNow = 0;
  private mealsNow = 0;
  private driveSum = 0;
  private causeNow: DoneCause | null = null;
  private resultNow: EpisodeResult | null = null;

  /** `seed` is the subject's birth seed: it picks the evaluation rooms and the noise, as in the experiment. */
  constructor(brain: Source, cfg: WorldConfig, seed: number) {
    this.brain = brain;
    this.cfg = cfg;
    this.seed = seed;
    this.agent = "actor" in brain ? brain.actor : brainActor(brain, cfg, seed);
    this.roomNow = this.enter(1);
    this.obsNow = this.roomNow.observe();
  }

  private enter(episode: number): Room {
    this.episodeNow = episode;
    this.ticksNow = 0;
    this.mealsNow = 0;
    this.driveSum = 0;
    this.causeNow = null;
    this.resultNow = null;
    this.agent.startEpisode?.(episode);
    return new Room(evalWorld(this.seed, episode), this.cfg);
  }

  get room(): Room { return this.roomNow; }
  get observation(): Observation { return this.obsNow; }
  get episode(): number { return this.episodeNow; }
  get ticks(): number { return this.ticksNow; }
  get meals(): number { return this.mealsNow; }
  get doneCause(): DoneCause | null { return this.causeNow; }
  /** Set once the room is over (death or MAX_TICKS alive). */
  get result(): EpisodeResult | null { return this.resultNow; }
  get finished(): boolean { return this.resultNow !== null; }

  /** One tick; does nothing once the room is over. Mirrors world/episode.ts runEpisode exactly. */
  step(): void {
    if (this.resultNow) return;
    const action = this.agent.policy(this.obsNow, this.ticksNow);
    const r = this.roomNow.step(action);
    this.obsNow = r.observation;
    this.ticksNow++;
    this.mealsNow += r.foodEaten;
    this.driveSum += drive(r.observation);
    this.causeNow = r.doneCause;
    if (this.ticksNow >= MAX_TICKS || this.roomNow.done) {
      if (this.causeNow !== null) this.agent.hooks?.onDeath?.(this.obsNow, this.causeNow, this.ticksNow);
      const rest = drive(this.obsNow) * (MAX_TICKS - this.ticksNow); // dead: stays at its last drive
      this.resultNow = { episode: this.episodeNow, meanDrive: (this.driveSum + rest) / MAX_TICKS, foodEaten: this.mealsNow, ticks: this.ticksNow, doneCause: this.causeNow, finalHash: this.roomNow.hash() };
    }
  }

  /** Lives the rest of this room at once. */
  finishRoom(): EpisodeResult {
    while (!this.resultNow) this.step();
    return this.resultNow;
  }

  /** Moves on to the next room; the current one is finished first so the brain's state stays true. */
  nextRoom(): void {
    this.finishRoom();
    this.roomNow = this.enter(this.episodeNow + 1);
    this.obsNow = this.roomNow.observe();
  }

  /** The recorded evaluation episode of the current room, if the experiment measured it. */
  get recorded(): RecordedEpisode | undefined {
    return this.brain.recorded.find((e) => e.episode === this.episodeNow);
  }
}

/** Does a replayed room match the experiment's record? null when that room was not measured. */
export function matchesRecord(result: EpisodeResult, recorded: RecordedEpisode | undefined): boolean | null {
  if (!recorded) return null;
  return result.finalHash === recorded.finalHash && result.foodEaten === recorded.foodEaten && result.ticks === recorded.ticks;
}

// --- films: what the browser draws ------------------------------------------------------------------------

/** One tick as the page shows it. Display values are rounded (DISPLAY_DIGITS); the verdict is not. */
export interface Frame {
  readonly tick: number;
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly energy: number;
  readonly health: number;
  readonly drive: number;
  readonly meals: number;
  readonly rays: readonly Ray[];
  /** Index into Film.scenes: where the food and threats are at this tick (they move only when food is eaten). */
  readonly scene: number;
}

export interface Film {
  readonly episode: number;
  readonly scenes: readonly RoomState["entities"][];
  /** frames[0] is the room as entered (tick 0), then one frame per tick until the room is over. */
  readonly frames: readonly Frame[];
  /** Exact, computed on the server: the numbers the verdict and the record check use. */
  readonly result: EpisodeResult;
  readonly recorded: RecordedEpisode | null;
  readonly matches: boolean | null;
}

const DISPLAY_DIGITS = 4;
const round = (v: number) => Number(v.toFixed(DISPLAY_DIGITS));

/** Lives the contestant's current room to its end (it must be at tick 0) and films every tick. */
export function filmRoom(c: Contestant): Film {
  if (c.ticks !== 0) throw new Error(`filmRoom needs a room at tick 0, this one is at tick ${c.ticks}`);
  const scenes: RoomState["entities"][] = [];
  let sceneKey = "";
  const frame = (): Frame => {
    const s = c.room.state();
    const key = JSON.stringify(s.entities);
    if (key !== sceneKey) { scenes.push(s.entities.map((e) => ({ ...e, x: round(e.x), y: round(e.y) }))); sceneKey = key; }
    const o = c.observation;
    return {
      tick: c.ticks, x: round(s.body.x), y: round(s.body.y), heading: round(s.body.heading),
      energy: round(o.energy), health: round(o.health), drive: round(drive(o)), meals: c.meals,
      rays: o.rays.map((r) => ({ hit: r.hit, distance: round(r.distance) })), scene: scenes.length - 1,
    };
  };
  const frames: Frame[] = [frame()];
  while (!c.finished) {
    c.step();
    frames.push(frame());
  }
  const recorded = c.recorded ?? null;
  return { episode: c.episode, scenes, frames, result: c.result!, recorded, matches: matchesRecord(c.result!, recorded ?? undefined) };
}
