// brain-lab/world/bench.mjs — headless speed of the room world (no brain attached).
// Run: node --experimental-strip-types brain-lab/world/bench.mjs
import { Rng, Room, runEpisode } from "./index.ts";

const TICKS = 1_000_000;
const rng = new Rng(1);
const policy = () => ({ thrust: rng.range(-1, 1), turn: rng.range(-1, 1) });
let ticks = 0;
let episodes = 0;
const t0 = performance.now();
while (ticks < TICKS) ticks += runEpisode(new Room(++episodes), policy, TICKS - ticks).ticks;
const ms = performance.now() - t0;
const tps = Math.round(ticks / (ms / 1000));
console.log(`${ticks} ticks, ${episodes} episodes, ${ms.toFixed(0)} ms`);
console.log(`${tps} ticks/s = ${Math.round(tps / 20)}x real time (20 Hz)`);
