// brain-lab/sensorimotor/controller.ts — plugs a Brain IR simulator into a world:
// each world tick = encode senses → one brain step → decode motor spikes.
//
// Timing: the brain updates synchronously (every node reads its sources' previous
// state), so each edge costs one tick — a direct sensor→motor arc acts one tick
// after the stimulus, a sensor→neuron→motor chain two. That is conduction delay, kept on purpose.
"use strict";

import type { BrainAdimi } from "../brain-ir/ir.ts";
import type { BrainSimulator } from "../brain-ir/simulator.ts";
import type { Policy, WorldConfig } from "../world/index.ts";
import { decodeMotor } from "./decode.ts";
import { encodeObservation } from "./encode.ts";
import { checkWiring } from "./scaffold.ts";

export interface BrainController {
  readonly policy: Policy;
  /** Every brain step with its trace; empty unless keepSteps (trace is costly, see knowledge pool §9). */
  readonly steps: readonly BrainAdimi[];
  /** The most recent brain step, kept even without keepSteps (cheap: one step). */
  readonly last: BrainAdimi | null;
}

export function brainController(sim: BrainSimulator, cfg: WorldConfig, opts: { keepSteps?: boolean } = {}): BrainController {
  checkWiring(sim.graf, cfg);
  const steps: BrainAdimi[] = [];
  let last: BrainAdimi | null = null;
  const policy: Policy = (observation) => {
    const step = sim.step(encodeObservation(observation, cfg));
    last = step;
    if (opts.keepSteps) steps.push(step);
    return decodeMotor(step.outputs);
  };
  return { policy, steps, get last() { return last; } };
}
