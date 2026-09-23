// brain-lab/registry/events.ts — numbered world events of an episode (EVT-…), derived from
// what the world reported. Learning entries cite these as their cause.
"use strict";

import type { TickRecord } from "../world/index.ts";
import { eventId } from "./ids.ts";

export type WorldEventKind = "meal" | "injury" | "bump" | "death";

export interface WorldEvent {
  readonly id: string;
  readonly tick: number;
  readonly kind: WorldEventKind;
  readonly detail: string;
}

/** Events in tick order; numbering continues from `firstNumber` so ids stay unique across a run. */
export function episodeEvents(records: readonly TickRecord[], firstNumber = 1): WorldEvent[] {
  const out: WorldEvent[] = [];
  const add = (tick: number, kind: WorldEventKind, detail: string) =>
    out.push({ id: eventId(firstNumber + out.length), tick, kind, detail });
  for (const { tick, result } of records) {
    if (result.foodEaten > 0) add(tick, "meal", `ate ${result.foodEaten}, +${result.energyLedger.food.toFixed(4)} energy`);
    if (result.damage > 0) add(tick, "injury", `-${result.damage.toFixed(4)} health`);
    if (result.bump) add(tick, "bump", `impact ${result.impactSpeed.toFixed(3)} m/s`);
    if (result.done) add(tick, "death", result.doneCause ?? "unknown");
  }
  return out;
}
