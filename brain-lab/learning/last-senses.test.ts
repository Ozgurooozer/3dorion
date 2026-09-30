// brain-lab/learning/last-senses.test.ts — agent.lastSenses (for the 3D brain page): what the competitive selector read on
// the last tick — the encoded senses plus, with recall on, the recalled senses — and null for the graph brain. Reading
// it changes nothing. Every case is a fresh brain.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { bornGraph } from "../development/index.ts";
import { Ledger } from "../registry/index.ts";
import { encodeObservation } from "../sensorimotor/index.ts";
import { DEFAULT_CONFIG as C, Room, makeConfig, runEpisode } from "../world/index.ts";
import { createAgent, recalledSenses } from "./index.ts";

const HUNGRY = makeConfig({ initialEnergy: 0.4, threatCount: 0, foodCount: 5 });

test("selection: lastSenses is null before the first tick, then exactly the encoded senses of the observation", () => {
  const agent = createAgent({ cfg: HUNGRY, ledger: new Ledger("DNK-0001", bornGraph(HUNGRY, { seed: 1, group: "reflexless" })), noiseSeed: 1, learning: { frozen: true }, selection: {} });
  assert.equal(agent.lastSenses, null);
  const room = new Room(5, HUNGRY);
  agent.startEpisode(1);
  let obs = room.observe();
  for (let t = 0; t < 60; t++) {
    const action = agent.policy(obs, t);
    assert.deepEqual(agent.lastSenses, encodeObservation(obs, HUNGRY), `tick ${t}`);
    obs = room.step(action).observation;
  }
});

test("selection with recall: lastSenses carries the recalled senses the gate gave", () => {
  const born = bornGraph(HUNGRY, { seed: 2, group: "reflexless", recall: { rules: "grown" } });
  const agent = createAgent({ cfg: HUNGRY, ledger: new Ledger("DNK-0002", born), noiseSeed: 2, learning: { frozen: true }, selection: {}, memory: { recall: {} } });
  const room = new Room(7, HUNGRY);
  agent.startEpisode(1);
  let obs = room.observe();
  let recalled = 0;
  for (let t = 0; t < 1500 && !room.done; t++) {
    const action = agent.policy(obs, t);
    const want = { ...encodeObservation(obs, HUNGRY), ...recalledSenses(agent.lastRecall!.recalled, HUNGRY) };
    assert.deepEqual(agent.lastSenses, want, `tick ${t}`);
    if (agent.lastRecall!.recalled) recalled++;
    obs = room.step(action).observation;
  }
  assert.ok(recalled > 0, "a memory was recalled at least once");
});

test("the graph brain (no selection) has no lastSenses", () => {
  const agent = createAgent({ cfg: C, ledger: new Ledger("DNK-0003", bornGraph(C, { seed: 3, group: "reflexless" })), noiseSeed: 3 });
  agent.startEpisode(1);
  runEpisode(new Room(3, C), agent.policy, 20, false, agent.hooks);
  assert.equal(agent.lastSenses, null);
});
