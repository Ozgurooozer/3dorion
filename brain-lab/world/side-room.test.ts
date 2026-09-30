// brain-lab/world/side-room.test.ts — the side room (TASARIM-009 §0.3): food appears beside the body, and a room without
// the rule is the room it always was. Every case builds its own room.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, Room, makeConfig, type WorldConfig } from "./index.ts";

const SIDE = { min: (50 * Math.PI) / 180, max: (120 * Math.PI) / 180, near: 1.5, far: 4 };
const sideRoom = (extra: Partial<WorldConfig> = {}) => makeConfig({ initialEnergy: 0.6, threatCount: 0, foodCount: 3, foodSide: SIDE, ...extra });

/** Bearing of p from a body at b facing `heading`, in (−π, π]. */
const bearing = (b: { x: number; y: number }, heading: number, p: { x: number; y: number }) => {
  const a = Math.atan2(p.y - b.y, p.x - b.x) - heading;
  return Math.atan2(Math.sin(a), Math.cos(a));
};
const inBand = (b: { x: number; y: number }, heading: number, p: { x: number; y: number }) => {
  const a = Math.abs(bearing(b, heading, p)), d = Math.hypot(p.x - b.x, p.y - b.y);
  return a >= SIDE.min - 1e-9 && a <= SIDE.max + 1e-9 && d >= SIDE.near - 1e-9 && d <= SIDE.far + 1e-9;
};

test("no foodSide: the config has no foodSide key, and makeConfig({ foodSide: undefined }) is the same config", () => {
  assert.ok(!("foodSide" in makeConfig({})));
  assert.deepEqual(makeConfig({ foodSide: undefined }), makeConfig({}));
  assert.equal(JSON.stringify(makeConfig({})), JSON.stringify(makeConfig({ foodSide: undefined })));
});

test("no foodSide: every room is bit-for-bit the room it was (same hash over 300 ticks of a fixed action, 20 seeds)", () => {
  // The reference is the same room built without the new key; both must also equal DEFAULT_CONFIG's room.
  for (let seed = 1; seed <= 20; seed++) {
    const a = new Room(seed, DEFAULT_CONFIG), b = new Room(seed, makeConfig({}));
    for (let t = 0; t < 300 && !a.done; t++) { a.step({ thrust: 1, turn: 0.3 }); b.step({ thrust: 1, turn: 0.3 }); }
    assert.equal(a.hash(), b.hash(), `seed ${seed}`);
  }
});

test("side room: every first-placed food lies beside the newborn (bearing 50–120°, 1.5–4 m), both sides used", () => {
  let left = 0, right = 0, total = 0, off = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const s = new Room(seed, sideRoom()).state();
    for (const e of s.entities.filter((x) => x.kind === "food")) {
      total++;
      if (!inBand(s.body, s.body.heading, e)) { off++; continue; }
      if (bearing(s.body, s.body.heading, e) > 0) left++; else right++;
    }
  }
  assert.equal(off, 0, `${off}/${total} first foods off the band`);
  assert.ok(left > 0.4 * total && right > 0.4 * total, `left ${left}, right ${right} of ${total}`);
});

test("side room: a food that is eaten grows back beside where the body is then facing", () => {
  let regrown = 0, off = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const room = new Room(seed, sideRoom({ foodCount: 1 }));
    for (let t = 0; t < 3000 && !room.done && regrown < 400; t++) {
      // Steer straight at the one food: the body eats it, then its new place is checked against the heading at that tick.
      const s = room.state();
      const food = s.entities.find((e) => e.kind === "food")!;
      const turn = Math.max(-1, Math.min(1, bearing(s.body, s.body.heading, food) * 3));
      const r = room.step({ thrust: Math.abs(turn) < 0.5 ? 1 : 0.2, turn });
      if (r.foodEaten > 0) {
        regrown++;
        const after = room.state();
        const f = after.entities.find((e) => e.kind === "food")!;
        if (!inBand(after.body, after.body.heading, f)) off++;
      }
    }
  }
  assert.ok(regrown >= 100, `only ${regrown} meals to check`);
  // Near a wall the side place may not fit; SIDE_ATTEMPTS misses fall back to a uniform place. Measured: rare.
  assert.ok(off / regrown < 0.05, `${off}/${regrown} regrown foods off the band`);
});

test("side room: deterministic per seed, different across seeds", () => {
  const foods = (seed: number) => JSON.stringify(new Room(seed, sideRoom()).state().entities);
  assert.equal(foods(7), foods(7));
  assert.notEqual(foods(7), foods(8));
});

test("side room: a bad foodSide is refused, the edges are accepted", () => {
  for (const bad of [{ ...SIDE, min: -0.1 }, { ...SIDE, min: 2, max: 1 }, { ...SIDE, max: 4 }, { ...SIDE, near: 0 }, { ...SIDE, near: 5, far: 4 }, { ...SIDE, far: Number.NaN }]) {
    assert.throws(() => makeConfig({ foodSide: bad }), RangeError, JSON.stringify(bad));
  }
  for (const ok of [{ ...SIDE, min: 0, max: Math.PI }, { ...SIDE, near: 2, far: 2 }]) assert.doesNotThrow(() => makeConfig({ foodSide: ok }));
});
