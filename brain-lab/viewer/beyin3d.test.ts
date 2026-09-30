// brain-lab/viewer/beyin3d.test.ts — the 3D brain page must show the measured life: a filmed room is the experiment's room
// (record check), a silenced neuron is really silent, the birth brain is the born brain, and the activity drawn on Go/NoGo
// is the sum the selector read. One small real experiment (H3B: memory recall, rule synapses grown), shared read-only.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { condition } from "../experiments/conditions.ts";
import { runCondition } from "../experiments/harness.ts";
import { RegistryStore } from "../registry/store.ts";
import { createHandler, type Handler } from "./api.ts";
import { film3d, subjectRows, type Film3D } from "./beyin3d-data.ts";

function ask<T>(handler: Handler, url: string): { status: number; body: T } {
  let status = 0;
  let text = "";
  const res = { set statusCode(s: number) { status = s; }, setHeader: () => undefined, end: (t: string) => { text = t; } } as unknown as ServerResponse;
  handler({ url } as IncomingMessage, res, () => undefined);
  return { status, body: JSON.parse(text) as T };
}

const ROOMS = 2;
const root = mkdtempSync(join(tmpdir(), "brainlab-beyin3d-"));
const store = new RegistryStore(root);
const def = condition("H3B");
const [row] = runCondition(store, {
  condition: { code: "H3B", what: def.what, spec: def.spec(def.world!) }, world: def.world!, seeds: [2], groups: ["reflexless"],
  trainEpisodes: 3, evalEpisodes: ROOMS, codeCommit: "test", label: "beyin3d-test", born: def.born,
}).rows;
const id = row!.learner.id;
writeFileSync(join(root, "results.jsonl"), JSON.stringify({ code: "H3B", command: "tara", control: "none", seed: 2, group: "reflexless", learner: id, twin: row!.twin.id, trainEpisodes: 3, l: row!.l }) + "\n");
const films = new Map<number, Film3D>();
const filmed = (room: number) => films.get(room) ?? films.set(room, film3d(store, id, "H3B", { room })).get(room)!;
test.after(() => rmSync(root, { recursive: true, force: true }));

test("every filmed room is the experiment's room (final world hash and meals as recorded)", () => {
  for (let room = 1; room <= ROOMS; room++) assert.equal(filmed(room).matches, true, `room ${room}`);
});

test("one frame per tick lived, numbered from 0", () => {
  const f = filmed(1);
  assert.equal(f.ticks.length, f.result.ticks);
  assert.ok(f.ticks.every((k, i) => k.t === i));
});

test("a silenced neuron's outgoing synapses all weigh 0 in the brain that lived, and the film is marked counterfactual", () => {
  const f = film3d(store, id, "H3B", { room: 1, silence: ["intero.hunger"] });
  const out = f.synapses.filter((e) => e.from === "intero.hunger");
  assert.ok(out.length > 0, "hunger has synapses");
  assert.ok(out.every((e) => e.w === 0), "all silent");
  assert.ok(out.some((e) => e.learned !== 0), "the real weights are still reported");
  assert.equal(f.matches, null);
});

test("silencing a neuron that does not exist is refused", () => {
  assert.throws(() => film3d(store, id, "H3B", { room: 1, silence: ["no.such"] }), RangeError);
});

test("the birth brain lives with its birth weights, and is marked counterfactual", () => {
  const f = film3d(store, id, "H3B", { room: 1, birth: true });
  assert.ok(f.synapses.every((e) => e.birth === null || e.w === e.birth), "every born synapse at its birth weight");
  assert.equal(f.matches, null);
});

test("Go/NoGo activity is the sum of weight × sense the selector read, per tick", () => {
  const f = filmed(1);
  const into = (node: string) => f.synapses.filter((e) => e.to === node && e.learns);
  let checked = 0;
  for (const k of f.ticks.slice(0, 300)) {
    for (const node of ["bg.go.forward", "bg.nogo.left"]) {
      const sum = into(node).reduce((s, e) => s + e.w * (k.a[e.from] ?? 0), 0);
      assert.ok(Math.abs((k.a[node] ?? 0) - sum) < 0.01 * into(node).length, `tick ${k.t} ${node}: ${k.a[node]} vs ${sum}`);
      checked++;
    }
  }
  assert.ok(checked > 0);
});

test("the selected actions and the motor neurons agree with the action taken", () => {
  for (const k of filmed(1).ticks) {
    assert.equal(k.a["motor.forward"] === 1, k.thrust > 0, `tick ${k.t} forward`);
    assert.equal(k.a["motor.left"] === 1, k.turn > 0, `tick ${k.t} left`);
    assert.equal(k.a["bg.out.forward"] === 1, k.thrust > 0, `tick ${k.t} selection forward`);
  }
});

test("subjectRows: the newest learner per key, controls left out", () => {
  const line = (o: object) => JSON.stringify({ code: "S1n", command: "tara", control: "none", seed: 1, group: "reflexless", learner: "DNK-1", trainEpisodes: 40, l: { meanDrive: 0.5 }, ...o });
  const rows = subjectRows([line({}), line({ learner: "DNK-2" }), line({ learner: "DNK-3", control: "CROSS" }), line({ learner: "DNK-4", seed: 2 }), ""]);
  assert.deepEqual(rows.map((r) => r.id), ["DNK-4", "DNK-2"]);
});

test("the API lists the subject and films a room", () => {
  const handler = createHandler(root);
  const list = ask<{ id: string }[]>(handler, "/api/beyin3d");
  assert.deepEqual(list.body.map((r) => r.id), [id]);
  const room = ask<Film3D>(handler, `/api/beyin3d/${id}/room/1?sustur=intero.hunger`);
  assert.equal(room.status, 200);
  assert.deepEqual(room.body.silenced, ["intero.hunger"]);
  assert.equal(ask(handler, `/api/beyin3d/${id}/room/9`).status, 500, "a room the experiment did not measure");
});

test("a recalled memory lights its recalled sense (rec*) exactly on the ticks the gate recalled one", () => {
  const ticks = [1, 2].flatMap((room) => filmed(room).ticks);
  const lit = (k: (typeof ticks)[number]) => Object.keys(k.a).some((n) => n.startsWith("rec"));
  const recalling = ticks.filter((k) => k.recall?.id);
  assert.ok(recalling.length > 0, "the rooms contain recalls");
  for (const k of ticks) assert.equal(lit(k), Boolean(k.recall?.id), `tick ${k.t}`);
});
