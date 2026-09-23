// brain-lab/viewer/presets.ts — what the viewer can run. Baselines and test fixtures only:
// none of these is a shipped behavior; a learning brain gets added here when it exists.
"use strict";

import type { BrainGrafi } from "../brain-ir/ir.ts";
import { BrainSimulator } from "../brain-ir/simulator.ts";
import { DopamineChannel, withDopamine } from "../neuromodulation/index.ts";
import { brainController, sensorimotorScaffold, type BrainController } from "../sensorimotor/index.ts";
import { DEFAULT_CONFIG, Rng, Room, type Policy, type WorldConfig } from "../world/index.ts";

export type PresetKind = "baseline" | "fixture";

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly kind: PresetKind;
  readonly note: string;
  readonly graph: (cfg: WorldConfig) => BrainGrafi;
  /** Optional override of what reaches the body; the brain still runs, so its senses stay visible. */
  readonly override?: (seed: number) => Policy;
}

export const PRESETS: readonly Preset[] = Object.freeze([
  {
    id: "empty",
    label: "Boş beyin (iskelet)",
    kind: "baseline",
    note: "Sensörler ve motorlar var, aralarında hiç bağlantı yok. Beden kıpırdamaz, ~2000 tikte açlıktan ölür.",
    graph: (cfg) => sensorimotorScaffold(cfg, "empty"),
  },
  {
    id: "random",
    label: "Rastgele motor",
    kind: "baseline",
    note: "Beyin değil, taban çizgisi: her tik rastgele itme/dönüş. Beyin yine duyuları işler, haritada görünür.",
    graph: (cfg) => sensorimotorScaffold(cfg, "random"),
    override: (seed) => {
      const rng = new Rng(seed * 2654435761 >>> 0);
      return () => ({ thrust: rng.range(-1, 1), turn: rng.range(-1, 1) });
    },
  },
  {
    id: "pipe",
    label: "Boru testi: ışın2.yemek → ileri",
    kind: "fixture",
    note: "TEST FİKSTÜRÜ, gönderilen davranış değil: elle çizilmiş tek kenar, sinirlerin uçtan uca çalıştığını gösterir.",
    graph: (cfg) => ({
      ...sensorimotorScaffold(cfg, "pipe"),
      connections: [{ from: "ray2.food", to: "motor.forward", weight: 1 }],
    }),
  },
]);

export interface Session {
  readonly preset: Preset;
  readonly seed: number;
  readonly room: Room;
  readonly graph: BrainGrafi;
  readonly controller: BrainController;
  readonly dopamine: DopamineChannel;
  readonly policy: Policy;
}

/** Pass the previous episode's channel to carry expectations over, as a real brain would. */
export function createSession(
  presetId: string,
  seed: number,
  cfg: WorldConfig = DEFAULT_CONFIG,
  dopamine: DopamineChannel = new DopamineChannel(),
): Session {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`unknown preset ${presetId}`);
  const graph = preset.graph(cfg);
  const controller = brainController(new BrainSimulator(graph), cfg);
  const override = preset.override?.(seed);
  const acting: Policy = override
    ? (obs, tick) => { controller.policy(obs, tick); return override(obs, tick); }
    : controller.policy;
  const policy = withDopamine(acting, dopamine);
  return { preset, seed, room: new Room(seed, cfg), graph, controller, dopamine, policy };
}
