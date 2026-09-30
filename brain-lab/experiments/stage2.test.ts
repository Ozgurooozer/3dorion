// brain-lab/experiments/stage2.test.ts — TASARIM-009 stage 2 (prereg 005): death teaches again, now with the critic and the
// competitive selector. The arms differ from H3B97 in one switch and one room; with the switch on, a death writes learning
// on the ledger (tagged "death"), with it off a death writes nothing and the lives before it are the same.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { bornGraph } from "../development/index.ts";
import { createAgent } from "../learning/index.ts";
import { Ledger } from "../registry/index.ts";
import { Room, makeConfig, runEpisode, type EpisodeHooks } from "../world/index.ts";
import { ROOM2, ROOM3, condition } from "./conditions.ts";

const specOf = (code: string) => JSON.stringify(condition(code).spec(condition(code).world!));

test("OL1 is H3B97 with death teaching, in the same room and born the same way", () => {
  assert.equal(specOf("OL1"), JSON.stringify({ ...JSON.parse(specOf("H3B97")), teachAtDeath: true }));
  assert.equal(condition("OL1").world, ROOM3);
  assert.deepEqual(condition("OL1").born, condition("H3B97").born);
});

test("OT0 is H3B97 in room 2 (two threats); OT1 is OT0 with death teaching", () => {
  assert.equal(specOf("OT0"), specOf("H3B97"));
  assert.equal(condition("OT0").world, ROOM2);
  assert.equal(condition("OT1").world, ROOM2);
  assert.equal(specOf("OT1"), JSON.stringify({ ...JSON.parse(specOf("OT0")), teachAtDeath: true }));
  assert.deepEqual(condition("OT1").born, condition("OT0").born);
});

/** A room with no food and little energy: the body starves within the episode. */
const STARVE = makeConfig({ initialEnergy: 0.05, foodCount: 0, threatCount: 0 });

function liveToDeath(teachAtDeath: boolean) {
  const ledger = new Ledger("DNK-0005", bornGraph(STARVE, { seed: 5, group: "reflexless" }));
  const agent = createAgent({ cfg: STARVE, ledger, noiseSeed: 5, critic: {}, selection: {}, learning: { quantum: 0.005 }, teachAtDeath });
  agent.startEpisode(1);
  let died = false;
  const hooks: EpisodeHooks = { onDeath: (obs, cause, t) => { died = true; agent.hooks.onDeath!(obs, cause, t); } };
  runEpisode(new Room(501, STARVE), agent.policy, 3000, false, hooks);
  agent.drainWrites();
  return { died, ledger };
}
const deathEntries = (l: Ledger) => l.entries.filter((e) => e.cause.includes("death"));

test("with the selector and the critic, a death teaches when the switch is on", () => {
  const { died, ledger } = liveToDeath(true);
  assert.ok(died, "the body starved within the episode");
  assert.ok(deathEntries(ledger).length > 0, "no learning tagged death");
});

test("with the switch off, a death writes nothing: the off ledger is the on ledger up to the death", () => {
  const off = liveToDeath(false), on = liveToDeath(true);
  assert.ok(off.died);
  assert.equal(deathEntries(off.ledger).length, 0);
  const n = off.ledger.entries.length;
  assert.equal(JSON.stringify(on.ledger.entries.slice(0, n)), JSON.stringify(off.ledger.entries), "the lives before death are the same");
  const extra = on.ledger.entries.slice(n);
  const deathTick = deathEntries(on.ledger)[0]!.tick;
  assert.ok(extra.every((e) => e.tick === deathTick), "everything the switch adds is written at the death");
  // The critic learns the death too (its TD entries at that tick carry "td", not "death").
  assert.ok(extra.some((e) => e.kind === "critic"), "the critic hears the death");
});
