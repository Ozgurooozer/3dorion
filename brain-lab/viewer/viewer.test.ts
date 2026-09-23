// brain-lab/viewer/viewer.test.ts — the viewer must show the real world, not a copy of it.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkWiring } from "../sensorimotor/index.ts";
import { DEFAULT_CONFIG as C, Room, makeConfig, runEpisode } from "../world/index.ts";
import { layoutBrain } from "./brain-layout.ts";
import { PRESETS, createSession } from "./presets.ts";
import { nodeLabel } from "./theme.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const sources = readdirSync(HERE).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

test("not a copy: the viewer imports the world and nerves, and implements no physics or senses", () => {
  const all = sources.map((f) => readFileSync(join(HERE, f), "utf8")).join("\n");
  assert.match(all, /from "\.\.\/world\/index\.ts"/);
  assert.match(all, /from "\.\.\/sensorimotor\/index\.ts"/);
  for (const forbidden of [/class \w*Room\b/, /maxAccel|drag \*|basalEnergyCost/, /rayCircle|rayBoxInside/, /encodeObservation\(/, /outcomeOf\(|- prev\.energy/]) {
    assert.doesNotMatch(all, forbidden, `viewer re-implements something: ${forbidden}`);
  }
});

test("nothing below the viewer imports it", () => {
  for (const dir of ["../world", "../sensorimotor", "../brain-ir"]) {
    for (const f of readdirSync(join(HERE, dir)).filter((n) => n.endsWith(".ts"))) {
      assert.doesNotMatch(readFileSync(join(HERE, dir, f), "utf8"), /viewer\//, `${dir}/${f} imports the viewer`);
    }
  }
});

test("every preset fits the body and runs 500 ticks without error", () => {
  for (const p of PRESETS) {
    const s = createSession(p.id, 3);
    assert.doesNotThrow(() => checkWiring(s.graph, C), p.id);
    const ep = runEpisode(s.room, s.policy, 500, false, s.dopamine.hooks());
    assert.ok(ep.ticks > 0, p.id);
    assert.ok(s.controller.last, `${p.id}: brain never stepped`);
  }
  assert.throws(() => createSession("nope", 1), /unknown preset/);
});

test("the viewer's world is the same world Node runs: same seed, same hash", () => {
  const viewerWorld = createSession("empty", 42).room;
  assert.equal(viewerWorld.hash(), new Room(42).hash());
});

test("the random baseline is deterministic per seed and differs across seeds", () => {
  const run = (seed: number) => { const s = createSession("random", seed); return runEpisode(s.room, s.policy, 300).finalHash; };
  assert.equal(run(5), run(5));
  assert.notEqual(run(5), run(6));
});

test("layout: every node has one position, inside the frame, none overlapping", () => {
  for (const p of PRESETS) {
    const g = p.graph(C, 1);
    const pos = layoutBrain(g, C, 620, 620, 30);
    assert.equal(pos.size, g.nodes.length, p.id);
    const pts = [...pos.values()];
    for (const q of pts) assert.ok(q.x >= 30 && q.x <= 590 && q.y >= 30 && q.y <= 590, `${p.id} out of frame`);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        assert.ok(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y) >= 18, `${p.id} nodes overlap`);
      }
    }
  }
  const withInner = { ...PRESETS[0]!.graph(C, 1), nodes: [...PRESETS[0]!.graph(C, 1).nodes, { id: "relay", type: "neuron" as const }] };
  assert.equal(layoutBrain(withInner, C, 620, 620).get("relay")!.column, "inner");
  const three = makeConfig({ rayAngles: [-1, 0, 1] });
  assert.equal(layoutBrain(PRESETS[0]!.graph(three, 1), three, 620, 620).size, 3 * 3 + 7 + 4);
});

test("labels: every node of every preset has a Turkish label", () => {
  for (const p of PRESETS) for (const n of p.graph(C, 1).nodes) assert.notEqual(nodeLabel(n.id), n.id, `${p.id}: ${n.id}`);
});
