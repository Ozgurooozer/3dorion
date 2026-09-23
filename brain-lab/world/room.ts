// brain-lab/world/room.ts — one-room, headless, deterministic physics world.
//
// The world knows nothing about any brain: dependency is one-way (brain -> world),
// same rule as 3dorion's world/ never importing mind/ or bridge/. A brain talks to
// it only through the World contract (world.ts).
//
// Actions are raw motor commands (thrust, turn), never behaviors like "go to food":
// the brain has to learn to use the body itself.
"use strict";

import { makeConfig, type WorldConfig } from "./config.ts";
import { foodKeepouts, sampleFreePosition, spawnEntities, type Entity } from "./entities.ts";
import { dist } from "./geometry.ts";
import { fnv1a } from "./hash.ts";
import { moveBody, newBody, type Body } from "./physics.ts";
import { Rng } from "./rng.ts";
import { senseRays } from "./sensors.ts";
import type { Action, DoneCause, Observation, StepResult, World } from "./world.ts";

export interface RoomState {
  readonly config: WorldConfig;
  readonly seed: number;
  readonly rngState: number;
  readonly tick: number;
  readonly body: Readonly<Body>;
  readonly entities: readonly Readonly<Entity>[];
  readonly lastBump: boolean;
  readonly doneCause: DoneCause | null;
}

export class Room implements World {
  readonly seed: number;
  readonly config: WorldConfig;
  private rng: Rng;
  private tick = 0;
  private body: Body;
  private entities: Entity[];
  private lastBump = false;
  private doneCause: DoneCause | null = null;

  constructor(seed: number, config: Partial<WorldConfig> = {}) {
    this.seed = seed;
    this.config = makeConfig(config);
    this.rng = new Rng(seed);
    this.body = newBody(this.config);
    this.entities = spawnEntities(this.rng, this.config, this.body);
  }

  /** Rebuild a world from a snapshot: continues exactly where state() was taken. */
  static fromState(s: RoomState): Room {
    const room = new Room(s.seed, s.config);
    room.rng = new Rng(s.rngState);
    room.tick = s.tick;
    room.body = { ...s.body };
    room.entities = s.entities.map((e) => ({ ...e }));
    room.lastBump = s.lastBump;
    room.doneCause = s.doneCause;
    return room;
  }

  get done(): boolean {
    return this.doneCause !== null;
  }

  observe(): Observation {
    return {
      rays: senseRays(this.body, this.body.heading, this.entities, this.config),
      bump: this.lastBump,
      energy: this.body.energy,
      health: this.body.health,
    };
  }

  step(action: Action): StepResult {
    if (this.done) throw new Error(`episode is over (${this.doneCause}); create a new Room`);
    checkUnit("thrust", action.thrust);
    checkUnit("turn", action.turn);
    const cfg = this.config;
    const b = this.body;

    const contact = moveBody(b, action, cfg);
    this.lastBump = contact.bump;

    // Homeostasis: costs first, then food (capped so energy never exceeds 1), then threats.
    const basal = cfg.basalEnergyCost;
    const motor = cfg.motorEnergyCost * Math.abs(action.thrust);
    const afterCosts = b.energy - basal - motor;
    let eaten = 0;
    let damage = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i]!;
      if (e.kind === "food" && dist(b, e) < cfg.bodyRadius + e.r) {
        eaten++;
        const p = sampleFreePosition(this.rng, cfg, e.r, foodKeepouts(cfg, b, this.entities));
        this.entities[i] = { ...e, ...p };
      } else if (e.kind === "threat" && dist(b, e) < e.r) {
        damage += cfg.threatDamage;
      }
    }
    const food = eaten > 0 ? Math.min(eaten * cfg.foodGain, 1 - afterCosts) : 0;
    b.energy = Math.max(0, afterCosts + food);
    damage = Math.min(damage, b.health);
    b.health -= damage;

    this.tick++;
    if (b.energy <= 0) this.doneCause = "starved";
    else if (b.health <= 0) this.doneCause = "killed";

    return {
      observation: this.observe(),
      bump: contact.bump,
      impactSpeed: contact.impactSpeed,
      foodEaten: eaten,
      damage,
      energyLedger: { basal, motor, food },
      done: this.done,
      doneCause: this.doneCause,
    };
  }

  /** Plain-data snapshot; mutating it cannot reach the world. */
  state(): RoomState {
    return {
      config: this.config,
      seed: this.seed,
      rngState: this.rng.state,
      tick: this.tick,
      body: { ...this.body },
      entities: this.entities.map((e) => ({ ...e })),
      lastBump: this.lastBump,
      doneCause: this.doneCause,
    };
  }

  /** FNV-1a over the JSON snapshot (config included): equal hash = bit-identical world. */
  hash(): string {
    return fnv1a(JSON.stringify(this.state()));
  }
}

function checkUnit(name: string, v: number): void {
  if (typeof v !== "number" || !Number.isFinite(v) || v < -1 || v > 1) {
    throw new RangeError(`${name} must be a finite number in [-1, 1], got ${v}`);
  }
}
