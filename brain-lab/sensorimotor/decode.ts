// brain-lab/sensorimotor/decode.ts — motor-node spikes → a motor command.
// Antagonist pairs, like muscles: forward vs back drives thrust, left vs right drives turn.
// Motor nodes fire 0/1 (ir.ts sinyal), so each axis is one of {-1, 0, 1}.
"use strict";

import type { Action } from "../world/index.ts";

export const MOTOR_NODE_IDS = Object.freeze(["motor.forward", "motor.back", "motor.left", "motor.right"] as const);

function spike(outputs: Readonly<Record<string, number>>, id: string): 0 | 1 {
  const v = outputs[id];
  if (v !== 0 && v !== 1) throw new RangeError(`motor node ${id} must output 0 or 1, got ${v}`);
  return v;
}

/** "left" = positive turn (heading increases). */
export function decodeMotor(outputs: Readonly<Record<string, number>>): Action {
  return {
    thrust: spike(outputs, "motor.forward") - spike(outputs, "motor.back"),
    turn: spike(outputs, "motor.left") - spike(outputs, "motor.right"),
  };
}
