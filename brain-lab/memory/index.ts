// brain-lab/memory/index.ts — public entry point of the memory (TASARIM-007 §4–5): the core and its modules.
"use strict";

export { MemoryCore, SOURCES, WorkingMemory, withMemory, type Entry, type MemoryModule, type Source, type Stamp } from "./core.ts";
export { DEFAULT_POSE, POSE_SCALE, POSE_SLOT, PoseModule, inRoom, poseConfidence, slideAlong, terminalSpeed, touchedWalls, type Pose, type PoseParams } from "./pose.ts";
