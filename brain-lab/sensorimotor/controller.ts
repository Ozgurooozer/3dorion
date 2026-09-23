// brain-lab/sensorimotor/controller.ts — plugs a Brain IR simulator into a world:
// each world tick = encode senses → one brain step → decode motor spikes.
//
// Timing: the brain updates synchronously (every node reads its sources' previous
// state), so each edge costs one tick — a direct sensor→motor arc acts one tick
// after the stimulus, a sensor→neuron→motor chain two. That is conduction delay, kept on purpose.
"use strict";

import type { BrainAdimi, BrainInputlari } from "../brain-ir/ir.ts";
import type { BrainSimulator } from "../brain-ir/simulator.ts";
import type { Policy, WorldConfig } from "../world/index.ts";
import { decodeMotor } from "./decode.ts";
import { encodeObservation, sensorNodeIds } from "./encode.ts";
import { checkWiring } from "./scaffold.ts";

export interface BrainController {
  readonly policy: Policy;
  /** Every brain step with its trace; empty unless keepSteps (trace is costly, see knowledge pool §9). */
  readonly steps: readonly BrainAdimi[];
  /** The most recent brain step, kept even without keepSteps (cheap: one step). */
  readonly last: BrainAdimi | null;
}

export interface ControllerOptions {
  readonly keepSteps?: boolean;
  /**
   * Inputs that do not come from the world, merged in every tick — e.g. spontaneous
   * activity generators. Their node ids must exist in the graph and must not be world senses.
   */
  readonly extraInputs?: { readonly ids: readonly string[]; readonly next: () => BrainInputlari };
}

export function brainController(sim: BrainSimulator, cfg: WorldConfig, opts: ControllerOptions = {}): BrainController {
  checkWiring(sim.graf, cfg);
  const extra = opts.extraInputs;
  if (extra) {
    const have = new Set(sim.graf.nodes.map((n) => n.id));
    const senses = new Set(sensorNodeIds(cfg));
    for (const id of extra.ids) {
      if (!have.has(id)) throw new Error(`extra input ${id} has no node in the brain`);
      if (senses.has(id)) throw new Error(`extra input ${id} would overwrite a world sense`);
    }
  }
  const steps: BrainAdimi[] = [];
  let last: BrainAdimi | null = null;
  const policy: Policy = (observation) => {
    const inputs = encodeObservation(observation, cfg);
    if (extra) {
      const more = extra.next();
      for (const id of extra.ids) inputs[id] = more[id] ?? 0;
    }
    const step = sim.step(inputs);
    last = step;
    if (opts.keepSteps) steps.push(step);
    return decodeMotor(step.outputs);
  };
  return { policy, steps, get last() { return last; } };
}
