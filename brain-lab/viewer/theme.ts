// brain-lab/viewer/theme.ts — canvas colors (mirrors the CSS tokens in index.html) and node labels.
"use strict";

export const COLOR = Object.freeze({
  bg: "#0b0f17",
  floor: "#101723",
  grid: "#1a2433",
  wall: "#3b4a61",
  text: "#e8edf5",
  dim: "#7d8aa0",
  body: "#e8edf5",
  food: "#4cc38a",
  threat: "#e5484d",
  sensor: "#5b8def",
  inner: "#a37af0",
  motor: "#f2b84b",
  spont: "#3fb8c4",
  excite: "#4cc38a",
  inhibit: "#e5484d",
  energy: "#f2b84b",
  health: "#4cc38a",
  none: "#56627a",
  /** The memory's own picture of the body (A1): where it thinks the body is. */
  memory: "#a37af0",
});

const RAY_KIND_TR: Record<string, string> = { wall: "duvar", food: "yemek", threat: "tehlike" };
const FIXED_TR: Record<string, string> = {
  "touch.bump": "çarpma",
  "intero.hunger": "açlık",
  "intero.injury": "yara",
  "proprio.forward": "hareket ileri",
  "proprio.backward": "hareket geri",
  "proprio.left": "dönüş sol",
  "proprio.right": "dönüş sağ",
  "motor.forward": "ileri",
  "motor.back": "geri",
  "motor.left": "sol",
  "motor.right": "sağ",
};

const ACTION_TR: Record<string, string> = { forward: "ileri", back: "geri", left: "sol", right: "sağ" };
const REGION_TR: [RegExp, string][] = [
  [/^cpg\.noise\.(\w+)$/, "gürültü"], [/^cpg\.(\w+)$/, "üreteç"], [/^bg\.go\.(\w+)$/, "git"],
  [/^bg\.nogo\.(\w+)$/, "gitme"], [/^bg\.out\.(\w+)$/, "seçim"],
];

/** Turkish on-screen label for a node id; unknown ids are shown as-is. */
export function nodeLabel(id: string): string {
  const fixed = FIXED_TR[id];
  if (fixed) return fixed;
  if (id === "hyp.hunger") return "açlık dürtüsü";
  if (id === "hyp.pain") return "acı dürtüsü";
  for (const [re, name] of REGION_TR) {
    const m = re.exec(id);
    if (m) return `${name} ${ACTION_TR[m[1]!] ?? m[1]}`;
  }
  const m = /^ray(\d+)\.(\w+)$/.exec(id);
  if (m) return `ışın${m[1]} ${RAY_KIND_TR[m[2]!] ?? m[2]}`;
  return id;
}

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Hex color with alpha in [0,1]. */
export function alpha(hex: string, a: number): string {
  return hex + Math.round(clamp01(a) * 255).toString(16).padStart(2, "0");
}
