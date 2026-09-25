// brain-lab/viewer/main.ts — runs the real world + brain in the browser and draws them.
// URL params reproduce a moment: ?preset=newborn-reflexless&seed=3&ticks=120 (run 120 ticks, then pause).
"use strict";

import { MOTOR_NODE_IDS } from "../sensorimotor/index.ts";
import type { Observation, StepResult } from "../world/index.ts";
import { layoutBrain, type NodePos } from "./brain-layout.ts";
import { drawBrain, nodeAt } from "./draw-brain.ts";
import { drawRoom, type Point } from "./draw-room.ts";
import { TIMELINE_LENGTH, drawTimeline, type Sample } from "./draw-timeline.ts";
import { PRESETS, createSession, type Session } from "./presets.ts";
import { nodeLabel } from "./theme.ts";

const TRAIL_LENGTH = 200;
const REAL_TIME_HZ = 20;
const MAX_TICKS_PER_FRAME = 400;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ctx2d = (id: string) => $<HTMLCanvasElement>(id).getContext("2d")!;
const roomCtx = ctx2d("room");
const brainCtx = ctx2d("brain");
const timelineCtx = ctx2d("timeline");

const params = new URLSearchParams(location.search);
let presetId = PRESETS.some((p) => p.id === params.get("preset")) ? params.get("preset")! : "newborn-reflexless";
let baseSeed = Math.max(1, Math.floor(Number(params.get("seed") ?? 1)) || 1);
let speed: number | "max" = params.get("speed") === "max" ? "max" : Number(params.get("speed") ?? 1) || 1;

let session: Session;
let layout: Map<string, NodePos>;
let obs: Observation;
let tick = 0;
let episode = 0;
let trail: Point[] = [];
let samples: Sample[] = [];
let last: StepResult | null = null;
let lastAction = { thrust: 0, turn: 0 };
let foodThisEpisode = 0;
let bumpFlash = 0;
let running = false;
let selected: string | null = "motor.forward";
let acc = 0;
const finished: { n: number; seed: number; ticks: number; food: number; cause: string }[] = [];

function start(newEpisode: boolean): void {
  episode = newEpisode ? episode + 1 : 1;
  if (!newEpisode) finished.length = 0;
  session = createSession(presetId, baseSeed + episode - 1, undefined, newEpisode ? session.dopamine : undefined);
  layout = layoutBrain(session.graph, session.room.config, brainCtx.canvas.width, brainCtx.canvas.height, 30);
  obs = session.room.observe();
  tick = 0;
  foodThisEpisode = 0;
  last = null;
  const b = session.room.state().body;
  trail = [{ x: b.x, y: b.y }];
  if (!newEpisode) samples = [];
}

function stepOnce(): void {
  if (session.room.done) {
    const cause = session.room.state().doneCause === "starved" ? "açlık" : "yara";
    finished.unshift({ n: episode, seed: session.seed, ticks: tick, food: foodThisEpisode, cause });
    finished.length = Math.min(finished.length, 8);
    start(true);
  }
  const action = session.policy(obs, tick);
  lastAction = action;
  last = session.room.step(action);
  obs = last.observation;
  tick++;
  foodThisEpisode += last.foodEaten;
  if (last.done && last.doneCause) session.dopamine.observeDeath(obs, tick, last.doneCause);
  bumpFlash = last.bump ? 1 : bumpFlash;
  const b = session.room.state().body;
  trail.push({ x: b.x, y: b.y });
  if (trail.length > TRAIL_LENGTH) trail.shift();
  const out = session.controller.last?.outputs ?? {};
  samples.push({
    energy: obs.energy,
    health: obs.health,
    dopamine: session.dopamine.last?.delta ?? 0,
    motors: MOTOR_NODE_IDS.map((id) => out[id] ?? 0),
  });
  if (samples.length > TIMELINE_LENGTH) samples.shift();
}

function render(): void {
  drawRoom(roomCtx, session.room.state(), obs.rays, trail, bumpFlash);
  drawBrain(brainCtx, session.graph, layout, session.controller.last, selected);
  drawTimeline(timelineCtx, samples);
  renderStats();
  renderInspect();
  renderEpisodes();
  $("episodeTag").textContent = `bölüm ${episode} · seed ${session.seed} · tik ${tick}`;
  $("brainTag").textContent = `${session.graph.nodes.length} düğüm · ${session.graph.connections.length} bağlantı`;
}

function stat(k: string, v: string, bar?: { value: number; color: string }): string {
  const barHtml = bar ? `<div class="bar"><i style="width:${(bar.value * 100).toFixed(1)}%;background:${bar.color}"></i></div>` : "";
  return `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div>${barHtml}</div>`;
}

function renderStats(): void {
  const { thrust, turn } = lastAction;
  $("stats").innerHTML = [
    stat("enerji", obs.energy.toFixed(3), { value: obs.energy, color: "var(--motor)" }),
    stat("sağlık", obs.health.toFixed(3), { value: obs.health, color: "var(--food)" }),
    stat("itme", signed(thrust)),
    stat("dönüş", signed(turn) + (turn > 0 ? " sol" : turn < 0 ? " sağ" : "")),
    stat("yenen yemek", String(foodThisEpisode)),
    stat("çarpma", obs.bump ? "evet" : "hayır"),
    stat("dopamin δ", dopamineText()),
    stat("beklenti (tahmin)", (session.dopamine.last?.prediction ?? 0).toFixed(5)),
    stat("dürtü (tonik)", (session.dopamine.last?.drive ?? 0).toFixed(3), { value: Math.min(1, session.dopamine.last?.drive ?? 0), color: "var(--threat)" }),
    stat("tik / bölüm", `${tick} / ${episode}`),
    stat("dünya hash", session.room.hash()),
  ].join("");
}

const dopamineText = () => {
  const raw = session.dopamine.last?.delta ?? 0;
  const d = Math.abs(raw) < 5e-5 ? 0 : raw;
  const mood = d > 0.05 ? " sürpriz" : d < -0.005 ? " hayal kırıklığı" : "";
  return (d > 0 ? "+" : "") + d.toFixed(4) + mood;
};
const signed = (v: number) => (v > 0 ? "+" : "") + (Math.round(v * 100) / 100).toString();

function renderInspect(): void {
  const el = $("inspect");
  if (!selected) { el.textContent = "Beyin haritasında bir düğüme tıkla."; return; }
  const node = session.graph.nodes.find((n) => n.id === selected);
  const t = session.controller.last?.trace.find((x) => x.node === selected);
  if (!node) { el.textContent = "Düğüm bu beyinde yok."; return; }
  const inEdges = session.graph.connections.filter((c) => c.to === selected);
  const lines = [
    `<b>${nodeLabel(node.id)}</b>  (${node.id}, ${node.type})`,
    t ? `tik ${t.tick} · önceki ${t.previousState.toFixed(3)} · uyarma ${t.excitation.toFixed(3)} · bastırma ${t.inhibition.toFixed(3)}` : "henüz adım yok",
    t ? `ham durum ${t.rawState.toFixed(3)}${t.threshold !== undefined ? ` · eşik ${t.threshold}` : ""} · ateşledi: <b>${t.activated ? "evet" : "hayır"}</b>` : "",
    `gelen bağlantı: ${inEdges.length ? inEdges.map((c) => `${nodeLabel(c.from)} (${c.weight.toFixed(3)})`).join(", ") : "yok"}`,
    t && t.causeNodes.length > 1 ? `nedenler (trace): ${t.causeNodes.filter((c) => c !== node.id).map(nodeLabel).join(", ")}` : "",
  ];
  el.innerHTML = lines.filter(Boolean).join("\n");
}

function renderEpisodes(): void {
  $("episodes").innerHTML = finished.map((f) => `<tr><td>${f.n}</td><td>${f.seed}</td><td>${f.ticks}</td><td>${f.food}</td><td>${f.cause}</td></tr>`).join("");
}

function frame(now: number, prev: number): void {
  if (running) {
    if (speed === "max") for (let i = 0; i < MAX_TICKS_PER_FRAME; i++) stepOnce();
    else {
      acc += ((now - prev) / 1000) * REAL_TIME_HZ * speed;
      let n = 0;
      while (acc >= 1 && n < MAX_TICKS_PER_FRAME) { stepOnce(); acc -= 1; n++; }
    }
  }
  bumpFlash = Math.max(0, bumpFlash - 0.08);
  render();
  requestAnimationFrame((t) => frame(t, now));
}

function restart(): void {
  start(false);
  lastAction = { thrust: 0, turn: 0 };
}

function setRunning(on: boolean): void {
  running = on;
  $("play").textContent = on ? "⏸ Duraklat" : "▶ Oynat";
}

function setSpeed(s: number | "max"): void {
  speed = s;
  for (const b of $("speed").querySelectorAll("button")) b.classList.toggle("on", b.dataset.speed === String(s));
}

function showPresetNote(): void {
  const p = PRESETS.find((x) => x.id === presetId)!;
  const note = $("presetNote");
  note.textContent = (p.kind === "fixture" ? "⚠ " : "") + p.note;
  note.className = "note" + (p.kind === "fixture" ? " fixture" : "");
}

// --- wiring ------------------------------------------------------------------
const presetSel = $<HTMLSelectElement>("preset");
presetSel.innerHTML = PRESETS.map((p) => `<option value="${p.id}">${p.label}${p.kind === "fixture" ? " — test fikstürü" : ""}</option>`).join("");
presetSel.value = presetId;
presetSel.onchange = () => { presetId = presetSel.value; showPresetNote(); restart(); };
const seedInput = $<HTMLInputElement>("seed");
seedInput.value = String(baseSeed);
seedInput.onchange = () => { baseSeed = Math.max(1, Math.floor(Number(seedInput.value)) || 1); restart(); };
$("play").onclick = () => setRunning(!running);
$("step").onclick = () => { setRunning(false); stepOnce(); };
$("reset").onclick = () => restart();
for (const b of $("speed").querySelectorAll<HTMLButtonElement>("button")) {
  b.onclick = () => setSpeed(b.dataset.speed === "max" ? "max" : Number(b.dataset.speed));
}
$<HTMLCanvasElement>("brain").onclick = (e) => {
  const c = e.currentTarget as HTMLCanvasElement;
  const r = c.getBoundingClientRect();
  const hit = nodeAt(layout, ((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height);
  if (hit) selected = hit;
};

restart();
showPresetNote();
setSpeed(speed);
const warmup = Math.max(0, Math.floor(Number(params.get("ticks") ?? 0)) || 0);
for (let i = 0; i < warmup; i++) stepOnce();
setRunning(warmup === 0 && params.get("run") !== "0");
requestAnimationFrame((t) => frame(t, t));
