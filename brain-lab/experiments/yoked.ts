// brain-lab/experiments/yoked.ts — the yoked control (Ozyn, 2026-09-25: "even a random motor eats if it runs
// long enough"). A frozen twin that barely moves is too easy to beat: a subject that only learned to keep
// moving beats it without ever using what it sees. The yoked body is the classic answer (neuroscience's
// yoked control): it makes exactly the subject's own movements — same amount, same bursts, same rests —
// but blind, in a room where they have nothing to do with what is there. A subject that beats its yoked
// body is using its senses; one that does not only learned to move.
//
// How: in evaluation room k the yoked body replays the actions the subject took in room k+1 (cyclic), and
// continues with the following rooms' actions if it outlives them.
"use strict";

import type { Action } from "../world/index.ts";
import type { Actor } from "./harness.ts";

/** Wraps an actor so every action it takes is kept, room by room (index 0 = room 1). */
export function recordingActor(actor: Actor): { readonly actor: Actor; readonly actions: Action[][] } {
  const actions: Action[][] = [];
  let room: Action[] = [];
  return {
    actions,
    actor: {
      hooks: actor.hooks,
      startEpisode(episode: number) {
        room = [];
        actions[episode - 1] = room;
        actor.startEpisode?.(episode);
      },
      policy(obs, tick) {
        const a = actor.policy(obs, tick);
        room.push(a);
        return a;
      },
    },
  };
}

const STILL: Action = Object.freeze({ thrust: 0, turn: 0 });

/**
 * The yoked body for a subject's recorded rooms. `actions[k]` are the subject's actions in room k+1.
 * Starting room ep replays room ep+1's actions, then the rooms after it, wrapping around; a subject that
 * never acted at all gives a body that stands still.
 */
export function yokedActor(actions: readonly (readonly Action[])[]): Actor {
  const rooms = actions.length;
  if (rooms < 2) throw new Error(`a yoked control needs at least 2 recorded rooms (to replay another room's actions), got ${rooms}`);
  const total = actions.reduce((s, r) => s + r.length, 0);
  let room = 0;
  let index = 0;
  return {
    startEpisode(episode: number) {
      room = episode % rooms; // room ep+1, zero-based
      index = 0;
    },
    policy() {
      if (total === 0) return STILL;
      while (index >= actions[room]!.length) { room = (room + 1) % rooms; index = 0; }
      return actions[room]![index++]!;
    },
  };
}
