// brain-lab/experiments/seeds.ts — which world and which noise each episode of a subject gets, and how
// long an episode lasts. One source for the harness (Node) and the viewer's arena (browser), so the room a
// person watches is exactly the room that was measured. No imports: safe in both places.
"use strict";

export const MAX_TICKS = 3000;

export const trainNoise = (seed: number) => seed * 31 + 7;
export const evalNoise = (seed: number) => seed * 31 + 999;
export const trainWorld = (seed: number, ep: number) => seed * 1000 + ep;
export const evalWorld = (seed: number, ep: number) => seed * 1000 + 500 + ep;
