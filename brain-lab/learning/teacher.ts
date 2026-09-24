// brain-lab/learning/teacher.ts — learning from a teacher (series 005, T0).
//
// A songbird learns its song by comparing its own attempts with a memorised tutor song; its basal
// ganglia (Area X) get dopamine that says "closer to the template" or "further". Here the teacher
// says, every tick, which actions it would have taken; for each action the brain actually took,
// that action's compartment gets:
//   +gain  if the teacher would have taken it too
//   −gain  if the teacher would not
//   0      for actions the brain did not take (nothing was tried, nothing to judge)
// The signal reaches only the Go/NoGo synapses of that action, through the ordinary three-factor
// rule: the brain still learns from its own tries, just with a far denser signal than meals.
//
// The teacher is a policy (observation → motor command). In T0 it is the hand-coded oracle — a
// diagnostic fixture, never the design: it asks whether the brain can represent "which way" at all.
// Later the teacher is meant to be a region of the brain itself (Bob), not an outside puppeteer.
"use strict";

import { ACTIONS, type ActionName as BrainAction } from "../regions/index.ts";
import type { Action, Policy } from "../world/index.ts";

export interface TeacherSpec {
  readonly policy: Policy;
  /** Size of the teacher's signal; the reward δ of a meal is ~0.2–0.4 for comparison. */
  readonly gain: number;
}

/** The actions (antagonist motor pairs) a motor command asks for. */
export function actionsOf(command: Action): Set<BrainAction> {
  const wanted = new Set<BrainAction>();
  if (command.thrust > 0) wanted.add("forward");
  if (command.thrust < 0) wanted.add("back");
  if (command.turn > 0) wanted.add("left");
  if (command.turn < 0) wanted.add("right");
  return wanted;
}

/** Each action's teaching signal for one tick, given what the brain took and what the teacher would have. */
export function teacherDeltas(taken: Readonly<Record<string, number>>, teacherCommand: Action, gain: number): Record<BrainAction, number> {
  if (!(gain >= 0) || !Number.isFinite(gain)) throw new RangeError(`teacher gain ${gain}`);
  const wanted = actionsOf(teacherCommand);
  const deltas = {} as Record<BrainAction, number>;
  for (const a of ACTIONS) {
    deltas[a] = taken[`bg.out.${a}`] !== 1 ? 0 : wanted.has(a) ? gain : -gain;
  }
  return deltas;
}
