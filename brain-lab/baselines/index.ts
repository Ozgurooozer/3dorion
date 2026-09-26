// brain-lab/baselines/index.ts — measuring sticks for the brain: a textbook learner and a
// hand-coded ceiling. Neither is a brain; both see and act through the same body.
"use strict";

export { DEFAULT_LINEAR_Q, LinearQ, MOTOR_COMMANDS, type LinearQParams } from "./linear-q.ts";
export { ORACLE_WALL_DISTANCE, oracleAction, oraclePolicy, seekerPolicy } from "./oracle.ts";
export { BURST_TICKS, burstPolicy, centrePolicy } from "./bursts.ts";
