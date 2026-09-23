// brain-lab/sensorimotor/index.ts — public entry point for the world ↔ brain nerves.
"use strict";

export { BODY_SENSOR_IDS, RAY_KINDS, encodeObservation, rayNodeId, sensorNodeIds } from "./encode.ts";
export { MOTOR_NODE_IDS, decodeMotor } from "./decode.ts";
export { checkWiring, sensorimotorScaffold } from "./scaffold.ts";
export { brainController, type BrainController } from "./controller.ts";
