// brain-lab/experiments/stage4.test.ts — the stage 4 arms (prereg 007) differ from H3B97 only in the critic's switches.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ROOM3, condition } from "./conditions.ts";

const spec = (code: string) => JSON.parse(JSON.stringify(condition(code).spec(ROOM3)));

test("KL, KN and KLN are H3B97 with one critic change each (or both), born the same way, in the same room", () => {
  const base = spec("H3B97");
  const withCritic = (critic: object) => ({ ...base, critic: { ...base.critic, ...critic } });
  assert.deepEqual(spec("KL"), withCritic({ lambda: 0.9 }));
  assert.deepEqual(spec("KN"), withCritic({ features: "need" }));
  assert.deepEqual(spec("KLN"), withCritic({ lambda: 0.9, features: "need" }));
  assert.deepEqual(spec("KLw"), withCritic({ lambda: 0.9, proprio: false }));
  assert.deepEqual(spec("KLNw"), withCritic({ lambda: 0.9, features: "need", proprio: false }));
  for (const code of ["KL", "KN", "KLN", "KLw", "KLNw"]) {
    assert.deepEqual(condition(code).born, condition("H3B97").born, code);
    assert.equal(condition(code).world, ROOM3, code);
  }
});
