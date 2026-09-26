// brain-lab/experiments/critic-diagnosis.test.ts — the pieces of the critic diagnosis compute what they say: discounted
// returns cut at the room's end, least squares that recovers an exact line, offline TD that takes the steps critic.ts takes.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeObservation } from "../sensorimotor/index.ts";
import { DEFAULT_CONFIG as C, Room } from "../world/index.ts";
import { criticFeatures, leastSquares, offlineTD, returns } from "./critic-diagnosis.ts";

test("returns: G_j = r_(j+1) + γ G_(j+1), and the last state's return is 0 (cut at the room's end)", () => {
  assert.deepEqual(returns([1, 0, 2], 0.5), [1.5, 1, 2, 0]);
});

test("least squares recovers an exact line and explains all of it", () => {
  const rows = [0, 1, 2, 3, 4].map((x) => [x, 1]);
  const { w, r2 } = leastSquares(rows, rows.map(([x]) => 2 * x! + 3));
  assert.ok(Math.abs(w[0]! - 2) < 1e-6 && Math.abs(w[1]! - 3) < 1e-6, `w ${w}`);
  assert.ok(Math.abs(r2 - 1) < 1e-9, `R² ${r2}`);
});

test("offline TD(0): one transition with reward 1 from a state of feature 1 moves its weight by α", () => {
  const w = offlineTD([{ x: [[1], [0]], r: [1] }], 1, { alpha: 0.05, lambda: 0, normalize: false, passes: 1 });
  assert.ok(Math.abs(w[0]! - 0.05) < 1e-15, `w ${w}`);
});

test("offline TD normalised: the step is α / max(1, ‖x‖²), as critic.ts takes it", () => {
  const w = offlineTD([{ x: [[2], [0]], r: [1] }], 1, { alpha: 0.05, lambda: 0, normalize: true, passes: 1 });
  assert.ok(Math.abs(w[0]! - (0.05 / 4) * 2) < 1e-15, `w ${w}`);
});

test("offline TD(λ): a reward two steps on reaches the first state through the trace", () => {
  // States with features [1,0], [0,1], [0,0]; reward only on the second transition.
  const room = { x: [[1, 0], [0, 1], [0, 0]], r: [0, 1] };
  const td0 = offlineTD([room], 2, { alpha: 0.1, lambda: 0, normalize: false, passes: 1 });
  const tdl = offlineTD([room], 2, { alpha: 0.1, lambda: 0.9, normalize: false, passes: 1 });
  assert.equal(td0[0], 0, "TD(0): the first state learns nothing in one pass");
  assert.ok(Math.abs(tdl[0]! - 0.1 * 0.99 * 0.9) < 1e-15, `TD(λ): the first state gets α γ λ; got ${tdl[0]}`);
});

test("the critic's features are the encoded senses and a bias of 1", () => {
  const obs = new Room(1, C).observe();
  assert.deepEqual(criticFeatures(obs, C), { ...encodeObservation(obs, C), bias: 1 });
});
