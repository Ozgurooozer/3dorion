// brain-lab/world/index.ts — public entry point; import the world from here.
"use strict";

export type { Action, DoneCause, EntityKind, Motion, Observation, Ray, RayHit, StepResult, World } from "./world.ts";
export { DEFAULT_CONFIG, makeConfig, type WorldConfig } from "./config.ts";
export { Room, type RoomState } from "./room.ts";
export { runEpisode, type EpisodeHooks, type EpisodeSummary, type Policy, type TickRecord } from "./episode.ts";
export { Rng } from "./rng.ts";
export { fnv1a } from "./hash.ts";
