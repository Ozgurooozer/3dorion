// brain-lab/experiments/stage3a.test.ts — the midline arm H3M (TASARIM-009 §3a, prereg 006): H3B97 with the rule switched
// on at birth and in learning, nothing else. After a real life the turn probe finds no side habit from hunger, to the bit.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RegistryStore } from "../registry/store.ts";
import { ROOM3, condition } from "./conditions.ts";
import { birth, trainStages } from "./harness.ts";
import { turnProbe } from "./yon-teshis.ts";

test("H3M is H3B97 with the midline rule at birth and in learning, in the same room", () => {
  const h3m = JSON.parse(JSON.stringify(condition("H3M").spec(ROOM3)));
  const h3b97 = JSON.parse(JSON.stringify(condition("H3B97").spec(ROOM3)));
  assert.deepEqual(h3m, { ...h3b97, learning: { ...h3b97.learning, midline: true } });
  assert.deepEqual(condition("H3M").born, { ...condition("H3B97").born, midline: true });
  assert.equal(condition("H3M").world, ROOM3);
});

test("after a life in H3M the brain has no hunger side habit, exactly, while H3B97's twin life does", () => {
  const root = mkdtempSync(join(tmpdir(), "brainlab-3a-"));
  try {
    const store = new RegistryStore(root);
    const live = (code: string) => {
      const c = condition(code);
      const s = birth(store, ROOM3, 2, "reflexive", "test", c.born);
      trainStages(store, s, [{ world: ROOM3, episodes: 20 }], c.spec(ROOM3), "test", code);
      return turnProbe(store.openLedger(s.id).graph, ROOM3);
    };
    assert.equal(live("H3M").hungerSide, 0);
    assert.notEqual(live("H3B97").hungerSide, 0, "the plain brain's pair drifts apart (else the test above proves nothing)");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
