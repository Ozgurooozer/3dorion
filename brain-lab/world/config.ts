// brain-lab/world/config.ts — every physical constant of the world, in one place.
// Experiments vary these through makeConfig(); the config is part of the world state,
// so a replay or hash always knows which physics it ran under.
"use strict";

export interface WorldConfig {
  readonly width: number;
  readonly height: number;
  readonly dt: number;
  readonly bodyRadius: number;
  /** Energy at birth, in (0, 1]. Newborns start hungry (0.4) in experiments; 1 keeps old tests. */
  readonly initialEnergy: number;
  readonly maxAccel: number; // m/s² at |thrust| = 1
  readonly drag: number; // 1/s: velocity *= (1 - drag·dt) each tick
  readonly maxSpeed: number;
  readonly maxTurnRate: number; // rad/s at |turn| = 1
  readonly basalEnergyCost: number; // per tick
  readonly motorEnergyCost: number; // per tick at |thrust| = 1
  readonly foodCount: number;
  readonly foodRadius: number;
  readonly foodGain: number;
  readonly threatCount: number;
  readonly threatRadius: number;
  readonly threatDamage: number; // health per tick while the body's center is inside
  readonly foodClearance: number; // extra gap between new food and the body
  readonly threatClearance: number; // extra gap between a threat and the body at birth
  readonly rayAngles: readonly number[]; // relative to heading
  readonly rayRange: number;
}

export const DEFAULT_CONFIG: WorldConfig = Object.freeze({
  width: 10,
  height: 10,
  dt: 0.05, // 20 Hz, same tick as 3dorion's world engine
  bodyRadius: 0.3,
  initialEnergy: 1,
  maxAccel: 4,
  drag: 1.5,
  maxSpeed: 4,
  maxTurnRate: Math.PI,
  basalEnergyCost: 0.0005, // ~100 s to starve standing still
  motorEnergyCost: 0.001,
  foodCount: 3,
  foodRadius: 0.25,
  foodGain: 0.3,
  threatCount: 1,
  threatRadius: 1.2,
  threatDamage: 0.01,
  foodClearance: 0.5,
  threatClearance: 1,
  rayAngles: Object.freeze([-Math.PI / 3, -Math.PI / 6, 0, Math.PI / 6, Math.PI / 3]),
  rayRange: 5,
});

export function makeConfig(overrides: Partial<WorldConfig> = {}): WorldConfig {
  const c: WorldConfig = {
    ...DEFAULT_CONFIG,
    ...overrides,
    rayAngles: Object.freeze([...(overrides.rayAngles ?? DEFAULT_CONFIG.rayAngles)]),
  };
  for (const [k, v] of Object.entries(c)) {
    if (k === "rayAngles") continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new RangeError(`config.${k} must be a finite number >= 0, got ${v}`);
  }
  for (const a of c.rayAngles) if (!Number.isFinite(a)) throw new RangeError(`config.rayAngles has ${a}`);
  if (!Number.isInteger(c.foodCount) || !Number.isInteger(c.threatCount)) throw new RangeError("entity counts must be integers");
  if (c.dt <= 0 || c.bodyRadius <= 0) throw new RangeError("dt and bodyRadius must be > 0");
  if (c.initialEnergy <= 0 || c.initialEnergy > 1) throw new RangeError(`initialEnergy must be in (0, 1], got ${c.initialEnergy}`);
  if (c.width <= 2 * c.bodyRadius || c.height <= 2 * c.bodyRadius) throw new RangeError("room smaller than the body");
  if (c.drag * c.dt >= 1) throw new RangeError("drag·dt >= 1 would reverse velocity");
  // Guards the day the room gets thin obstacles: one tick may never move further than the body is wide.
  if (c.maxSpeed * c.dt >= c.bodyRadius) throw new RangeError("maxSpeed·dt >= bodyRadius allows tunnelling");
  return Object.freeze(c);
}
