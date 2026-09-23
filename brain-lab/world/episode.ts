// brain-lab/world/episode.ts — the observe → act → step loop, for any World and any policy.
// A brain, a baseline (random, oracle, TD) and a test all run through this same loop,
// so their numbers are comparable.
"use strict";

import type { Action, DoneCause, Observation, StepResult, World } from "./world.ts";

export type Policy = (observation: Observation, tick: number) => Action;

export interface TickRecord { readonly tick: number; readonly action: Action; readonly result: StepResult }

export interface EpisodeSummary {
  readonly ticks: number;
  readonly doneCause: DoneCause | null; // null = hit maxTicks alive
  readonly foodEaten: number;
  readonly damage: number;
  readonly bumps: number;
  readonly finalHash: string;
  readonly records: readonly TickRecord[]; // empty unless keepRecords
}

export interface EpisodeHooks {
  /** Called once if the episode ends by death, with the final observation the policy never sees. */
  readonly onDeath?: (finalObservation: Observation, cause: DoneCause, tick: number) => void;
}

export function runEpisode(world: World, policy: Policy, maxTicks: number, keepRecords = false, hooks: EpisodeHooks = {}): EpisodeSummary {
  const records: TickRecord[] = [];
  let observation = world.observe();
  let ticks = 0;
  let foodEaten = 0;
  let damage = 0;
  let bumps = 0;
  let doneCause: DoneCause | null = null;
  while (ticks < maxTicks && !world.done) {
    const action = policy(observation, ticks);
    const result = world.step(action);
    if (keepRecords) records.push({ tick: ticks, action, result });
    foodEaten += result.foodEaten;
    damage += result.damage;
    if (result.bump) bumps++;
    doneCause = result.doneCause;
    observation = result.observation;
    ticks++;
  }
  if (doneCause !== null) hooks.onDeath?.(observation, doneCause, ticks);
  return { ticks, doneCause, foodEaten, damage, bumps, finalHash: world.hash(), records };
}
