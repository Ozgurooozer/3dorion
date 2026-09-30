// brain-lab/viewer/beyin3d.ts — the 3D brain page. It draws what the server filmed (beyin3d-data.ts): a recorded
// subject's neurons and synapses, and one evaluation room lived tick by tick. Nothing here runs the brain or the world:
// "activating" (silence a neuron, the birth brain) asks the server to live the room again with the real code.
"use strict";

import {
  ArcRotateCamera, Color3, Color4, DynamicTexture, Engine, GlowLayer, HemisphericLight, Mesh, MeshBuilder,
  Matrix, PointerEventTypes, Scene, StandardMaterial, Vector3, type AbstractMesh, type InstancedMesh,
} from "@babylonjs/core";
import type { Film3D, NeuronView, SubjectRow, SynapseView, Tick3D } from "./beyin3d-data.ts";
import { COLUMN_X, LANES, layout3d } from "./beyin3d-layout.ts";
import { COLOR } from "./theme.ts";
import { tabs } from "./ui.ts";

// --- what each region is, in plain words (shown in the inspector) --------------------------------------------------
const REGION_INFO: Record<string, { name: string; color: string; what: string }> = {
  sense: { name: "duyu", color: COLOR.sensor, what: "Dünyadan gelen sinyal: ışınlar (duvar/yemek/tehlike ne kadar yakın), çarpma, açlık, yara, beden hareketi. Öğrenme yalnız duyulardan Git/Gitme'ye giden sinapslarda olur." },
  mem: { name: "yemek hafızası", color: COLOR.memory, what: "Yaşarken büyüyen hafıza nöronu (TASARIM-008): gördüğü bir yemeğin yeri. Doğar, güçlenir, solar, ölür; hepsi deftere yazılır." },
  rec: { name: "hatırlanan duyu", color: "#c792ea", what: "Açken ve yemek görmezken en güçlü-en yakın hatıra, o yöndeki ışının yerine 'hatırlanan yemek' olarak yanar (A3). Yalnız kural sinapslarıyla (rec → Git) davranışa ulaşır." },
  hyp: { name: "dürtü", color: COLOR.energy, what: "Açlık ve acı: bedenin iç durumu. Açlık hareketi kışkırtır." },
  noise: { name: "gürültü", color: COLOR.spont, what: "Kendiliğinden etkinlik: beden hiçbir şey bilmeden de denesin diye." },
  cpg: { name: "üreteç", color: COLOR.spont, what: "Örüntü üreteci: açlık + gürültüyle kendiliğinden hareket önerir." },
  "bg.go": { name: "Git", color: COLOR.excite, what: "Bazal ganglion 'Git' hücresi: bu eylemi yapmaya iten toplam. Duyulardan gelen öğrenen sinapslar buraya bağlanır." },
  "bg.nogo": { name: "Gitme", color: COLOR.inhibit, what: "Bazal ganglion 'Gitme' hücresi: bu eylemi tutan toplam. Git ile yarışır." },
  "bg.out": { name: "seçim", color: COLOR.motor, what: "Rekabetçi seçim: her eksende (ileri/geri, sol/sağ) en güçlü aday kazanır, dinlenme eşiğini geçerse." },
  motor: { name: "motor", color: COLOR.motor, what: "Bedene giden komut: itme ve dönüş." },
};
const regionInfo = (r: string) => REGION_INFO[r] ?? { name: r, color: COLOR.inner, what: "" };
const ACTION_TR: Record<string, string> = { forward: "ileri", back: "geri", left: "sol", right: "sağ" };
const HIT_COLOR: Record<string, string> = { wall: COLOR.wall, food: COLOR.food, threat: COLOR.threat, none: "#2a3446" };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (v: number | null | undefined, d = 3) => (v === null || v === undefined || Number.isNaN(v) ? "—" : v.toFixed(d).replace(".", ","));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const c3 = (hex: string) => Color3.FromHexString(hex);

// --- state --------------------------------------------------------------------------------------------------------
const params = new URLSearchParams(location.search);
let subjects: SubjectRow[] = [];
let film: Film3D | null = null;
let tick = 0;
let playing = false;
let carry = 0;
let selected: { kind: "node"; id: string } | { kind: "edge"; i: number } | null = null;
let silence: string[] = (params.get("sustur") ?? "").split(",").filter((x) => x !== "");
let birthMode = params.get("dogum") === "1";
const hiddenRegions = new Set<string>();

// --- Babylon scene ------------------------------------------------------------------------------------------------
const canvas = $<HTMLCanvasElement>("scene");
const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.027, 0.039, 0.063, 1);
const camera = new ArcRotateCamera("cam", -Math.PI / 2 + 0.5, 1.1, 25, new Vector3(10.5, 0, 0), scene);
camera.attachControl(canvas, true);
camera.wheelPrecision = 18;
camera.panningSensibility = 60;
camera.lowerRadiusLimit = 4;
camera.upperRadiusLimit = 90;
new HemisphericLight("sky", new Vector3(0.2, 1, -0.3), scene).intensity = 0.55;
const glow = new GlowLayer("glow", scene, { blurKernelSize: 24 });
glow.intensity = 0.7;

interface NodeMesh { readonly view: NeuronView; readonly mesh: Mesh; readonly mat: StandardMaterial; readonly base: Color3; readonly pos: Vector3; readonly size: number }
interface EdgeMesh { readonly view: SynapseView; readonly i: number; readonly mesh: Mesh; readonly mat: StandardMaterial; readonly base: Color3; readonly a: Vector3; readonly b: Vector3 }
let nodes = new Map<string, NodeMesh>();
let edges: EdgeMesh[] = [];
let decor: AbstractMesh[] = [];

const EXCITE = c3(COLOR.excite), INHIBIT = c3(COLOR.inhibit), LEARNED = c3(COLOR.motor), GREY = c3("#3a4458");

// Signal pulses: a pool of instances of one small glowing sphere, each travelling from a synapse's start to its end.
const pulseBase = MeshBuilder.CreateSphere("pulse", { diameter: 0.22, segments: 6 }, scene);
const pulseMat = new StandardMaterial("pulseMat", scene);
pulseMat.emissiveColor = new Color3(1, 0.95, 0.75);
pulseMat.disableLighting = true;
pulseBase.material = pulseMat;
pulseBase.isPickable = false;
pulseBase.setEnabled(false);
interface Pulse { mesh: InstancedMesh; a: Vector3; b: Vector3; t: number; speed: number; live: boolean }
const pulses: Pulse[] = Array.from({ length: 260 }, (_, k) => {
  const mesh = pulseBase.createInstance(`p${k}`);
  mesh.isPickable = false;
  mesh.setEnabled(false);
  return { mesh, a: Vector3.Zero(), b: Vector3.Zero(), t: 0, speed: 1, live: false };
});

function label(text: string, at: Vector3, size = 1, color = "#b8c2d3"): Mesh {
  const tex = new DynamicTexture(`lbl-${text}`, { width: 512, height: 96 }, scene, true);
  tex.hasAlpha = true;
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 512, 96);
  ctx.font = "600 44px system-ui, Segoe UI, sans-serif";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 48);
  tex.update();
  const mat = new StandardMaterial(`lblm-${text}`, scene);
  mat.diffuseTexture = tex;
  mat.emissiveColor = Color3.White();
  mat.opacityTexture = tex;
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  const plane = MeshBuilder.CreatePlane(`lblp-${text}`, { width: 4 * size, height: 0.75 * size }, scene);
  plane.material = mat;
  plane.position = at;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  return plane;
}

function buildBrain(f: Film3D): void {
  for (const n of nodes.values()) n.mesh.dispose(false, true);
  for (const e of edges) e.mesh.dispose(false, true);
  for (const d of decor) d.dispose(false, true);
  nodes = new Map();
  edges = [];
  decor = [];
  const pos = layout3d(f.neurons.map((n) => n.id), f.world.rayAngles);
  for (const view of f.neurons) {
    const p = pos.get(view.id)!;
    const size = view.region === "sense" ? 0.5 : view.region === "mem" ? 0.42 : 0.62;
    const mesh = MeshBuilder.CreateSphere(`n:${view.id}`, { diameter: size, segments: 16 }, scene);
    mesh.position = new Vector3(p.x, p.y, p.z);
    const mat = new StandardMaterial(`nm:${view.id}`, scene);
    const base = c3(regionInfo(view.region).color);
    mat.diffuseColor = base.scale(0.35);
    mat.specularColor = new Color3(0.15, 0.15, 0.15);
    mesh.material = mat;
    mesh.metadata = { kind: "node", id: view.id };
    nodes.set(view.id, { view, mesh, mat, base, pos: mesh.position, size });
  }
  f.synapses.forEach((view, i) => {
    const a = nodes.get(view.from)?.pos, b = nodes.get(view.to)?.pos;
    if (!a || !b) return;
    // Thickness shows the weight the subject really has.
    const r = 0.015 + Math.min(0.11, Math.abs(view.learned) * 0.12);
    const mesh = MeshBuilder.CreateTube(`e:${i}`, { path: [a, b], radius: r, tessellation: 6 }, scene);
    const mat = new StandardMaterial(`em:${i}`, scene);
    const changed = view.birth === null || Math.abs(view.learned - view.birth) >= 0.01;
    const base = changed && view.learns ? LEARNED : view.effect > 0 ? EXCITE : INHIBIT;
    mat.diffuseColor = base.scale(0.4);
    mat.specularColor = Color3.Black();
    mat.alpha = 0.55;
    mesh.material = mat;
    mesh.metadata = { kind: "edge", i };
    edges.push({ view, i, mesh, mat, base, a, b });
  });
  // Column and lane labels.
  const col = (region: string, text: string, y = 6.3) => decor.push(label(text, new Vector3(COLUMN_X[region]!, y, 0), 1.7));
  col("sense", "duyular"); col("rec", "hatırlanan"); col("mem", "hafıza", 7.4); col("hyp", "dürtü · gürültü"); col("cpg", "üreteç");
  col("bg.go", "Git (üst) · Gitme (alt)"); col("bg.out", "seçim"); col("motor", "motor");
  for (const l of LANES) decor.push(label(ACTION_TR[l.action]!, new Vector3(COLUMN_X.motor! + 2.8, 0, l.z), 1.3, "#7d8aa0"));
  decor.push(label("duvar", new Vector3(-2.4, 2.4, 0), 1.2, "#7d8aa0"), label("yemek", new Vector3(-2.4, 0, 0), 1.2, COLOR.food), label("tehlike", new Vector3(-2.4, -2.4, 0), 1.2, COLOR.threat), label("beden", new Vector3(-2.4, -5, 0), 1.2, "#7d8aa0"));
  applyVisibility();
}

// --- per-tick drawing ---------------------------------------------------------------------------------------------
const current = (): Tick3D | null => film?.ticks[tick] ?? null;

function edgeVisible(e: EdgeMesh): boolean {
  const v = e.view;
  if (hiddenRegions.has(nodes.get(v.from)!.view.region) || hiddenRegions.has(nodes.get(v.to)!.view.region)) return false;
  if ($<HTMLInputElement>("onlyLearning").checked && !v.learns) return false;
  if ($<HTMLInputElement>("onlyChanged").checked && !(v.birth === null || Math.abs(v.learned - v.birth) >= 0.01)) return false;
  return Math.abs(v.learned) >= Number($<HTMLInputElement>("minW").value);
}

function focusSet(): Set<string> | null {
  if (!selected || !film) return null;
  if (selected.kind === "edge") { const e = film.synapses[selected.i]!; return new Set([e.from, e.to]); }
  const s = new Set([selected.id]);
  for (const e of film.synapses) { if (e.from === selected.id) s.add(e.to); if (e.to === selected.id) s.add(e.from); }
  return s;
}

function applyVisibility(): void {
  for (const n of nodes.values()) n.mesh.setEnabled(!hiddenRegions.has(n.view.region));
  for (const e of edges) e.mesh.setEnabled(edgeVisible(e));
  drawTick();
}

function drawTick(): void {
  const k = current();
  if (!film || !k) return;
  const focus = focusSet();
  for (const n of nodes.values()) {
    const act = Math.min(1, Math.abs(k.a[n.view.id] ?? 0));
    const silent = film.silenced.includes(n.view.id);
    const dim = focus && !focus.has(n.view.id) ? 0.25 : 1;
    const col = silent ? GREY : n.base;
    n.mat.emissiveColor = col.scale((0.08 + 0.92 * act) * dim);
    n.mat.diffuseColor = col.scale(0.3 * dim);
    n.mesh.scaling.setAll(1 + 0.55 * act);
    n.mesh.renderOutline = selected?.kind === "node" && selected.id === n.view.id;
    n.mesh.outlineColor = Color3.White();
    n.mesh.outlineWidth = 0.04;
  }
  for (const e of edges) {
    const flow = Math.abs((k.a[e.view.from] ?? 0) * e.view.w);
    const inFocus = !focus || (selected?.kind === "edge" ? selected.i === e.i : focus.has(e.view.from) && focus.has(e.view.to) && (e.view.from === (selected as { id: string }).id || e.view.to === (selected as { id: string }).id));
    e.mat.emissiveColor = e.base.scale(Math.min(1, 0.06 + flow * 3) * (inFocus ? 1 : 0.15));
    e.mat.alpha = inFocus ? (selected ? 0.95 : 0.5 + Math.min(0.45, flow * 2)) : 0.06;
  }
  updateReadout(k);
  drawRoom(k);
  if (selected) drawSparkMarker();
  const lbl = $("tickLbl");
  lbl.textContent = `tik ${k.t} / ${film.ticks.length - 1}`;
  $<HTMLInputElement>("scrub").value = String(tick);
}

function spawnPulses(k: Tick3D): void {
  if (!$<HTMLInputElement>("pulses").checked) return;
  const flows = edges.filter((e) => e.mesh.isEnabled()).map((e) => ({ e, f: Math.abs((k.a[e.view.from] ?? 0) * e.view.w) })).filter((x) => x.f >= 0.01);
  flows.sort((p, q) => q.f - p.f);
  for (const { e } of flows.slice(0, 36)) {
    const p = pulses.find((x) => !x.live);
    if (!p) return;
    p.live = true;
    p.t = 0;
    p.a = e.a;
    p.b = e.b;
    p.speed = 2.2;
    p.mesh.setEnabled(true);
    p.mesh.position.copyFrom(e.a);
  }
}

// --- the room, as a 2D map ----------------------------------------------------------------------------------------
const roomCtx = $<HTMLCanvasElement>("room").getContext("2d")!;
function drawRoom(k: Tick3D): void {
  if (!film) return;
  const W = 400, w = film.world, s = W / Math.max(w.width, w.height);
  const X = (x: number) => x * s, Y = (y: number) => W - y * s;
  roomCtx.fillStyle = COLOR.floor;
  roomCtx.fillRect(0, 0, W, W);
  roomCtx.strokeStyle = COLOR.wall;
  roomCtx.lineWidth = 3;
  roomCtx.strokeRect(1.5, W - w.height * s + 1.5, w.width * s - 3, w.height * s - 3);
  for (const ent of film.scenes[k.scene] ?? []) {
    roomCtx.fillStyle = ent.kind === "food" ? COLOR.food : COLOR.threat;
    roomCtx.globalAlpha = ent.kind === "food" ? 1 : 0.45;
    roomCtx.beginPath();
    roomCtx.arc(X(ent.x), Y(ent.y), Math.max(3, ent.r * s), 0, 2 * Math.PI);
    roomCtx.fill();
  }
  roomCtx.globalAlpha = 1;
  w.rayAngles.forEach((ang, i) => {
    const r = k.rays[i]!;
    const a = k.heading + ang;
    roomCtx.strokeStyle = HIT_COLOR[r.hit] ?? COLOR.dim;
    roomCtx.globalAlpha = r.hit === "none" ? 0.35 : 0.9;
    roomCtx.lineWidth = 1.5;
    roomCtx.beginPath();
    roomCtx.moveTo(X(k.x), Y(k.y));
    roomCtx.lineTo(X(k.x + Math.cos(a) * r.d), Y(k.y + Math.sin(a) * r.d));
    roomCtx.stroke();
  });
  roomCtx.globalAlpha = 1;
  roomCtx.fillStyle = COLOR.body;
  roomCtx.beginPath();
  roomCtx.arc(X(k.x), Y(k.y), Math.max(4, w.bodyRadius * s), 0, 2 * Math.PI);
  roomCtx.fill();
  roomCtx.strokeStyle = COLOR.bg;
  roomCtx.lineWidth = 2;
  roomCtx.beginPath();
  roomCtx.moveTo(X(k.x), Y(k.y));
  roomCtx.lineTo(X(k.x + Math.cos(k.heading) * w.bodyRadius * 1.6), Y(k.y + Math.sin(k.heading) * w.bodyRadius * 1.6));
  roomCtx.stroke();
}

function updateReadout(k: Tick3D): void {
  $("rEnergy").textContent = fmt(k.energy, 2);
  $("rDrive").textContent = fmt(k.drive, 3);
  $("rMeals").textContent = String(k.meals);
  $("rDelta").textContent = fmt(k.delta, 3);
  const sal = k.sal;
  $("bars").innerHTML = ["forward", "back", "left", "right"].map((a) => {
    const v = sal?.[a] ?? (k.a[`bg.go.${a}`] ?? 0);
    const on = k.a[`bg.out.${a}`] === 1;
    const left = v < 0 ? 50 + Math.max(-50, v * 60) : 50, width = Math.min(50, Math.abs(v) * 60);
    return `<div class="bar${on ? " on" : ""}">${ACTION_TR[a]} <b style="font:12px var(--mono)">${fmt(v, 2)}</b>${on ? " ✓" : ""}<div class="track"><div class="fill" style="left:${left}%;width:${width}%"></div></div></div>`;
  }).join("");
  const exp = k.explored?.some(Boolean) ? " · bu tik keşif (rastgele seçim)" : "";
  const gate = k.recall ? (k.recall.open ? (k.recall.id ? `hatırlama kapısı açık: ${k.recall.id} hatırlandı` : "hatırlama kapısı açık, hatıra yok") : "hatırlama kapısı kapalı (tok ya da yemek görüyor)") : "";
  $("gate").textContent = `${film?.machinery === "selection" ? "çubuklar: eylem başına belirginlik (öğrenilmiş toplam + açlık + gürültü); ✓ seçilen" : "çubuklar: Git etkinliği"}${exp}${gate ? " · " + gate : ""}`;
}

// --- the inspector ------------------------------------------------------------------------------------------------
const insp = $("insp");
let sparkSeries: number[] = [];

function select(s: typeof selected): void {
  selected = s;
  renderInspector();
  drawTick();
}

function synRow(e: SynapseView, i: number, other: string): string {
  const d = e.birth === null ? "doğdu" : fmt(e.learned - e.birth, 3);
  return `<tr class="link" data-edge="${i}"><td>${esc(other)}</td><td class="n">${e.birth === null ? "—" : fmt(e.birth, 3)}</td><td class="n">${fmt(e.learned, 3)}</td><td class="n">${d}</td></tr>`;
}

function renderInspector(): void {
  if (!film || !selected) {
    insp.innerHTML = `<h2>Bir şeye tıkla</h2><p class="explain">Bir nörona tıkla: bölgesi, neye bağlı olduğu, odadaki etkinlik eğrisi. Bir sinapsa tıkla: hangi yolda olduğu, doğumdaki ve şimdiki ağırlığı, bu tikte taşıdığı sinyal.</p><p class="explain">Fare: sol tuş döndür, sağ tuş kaydır, tekerlek yakınlaş. Boşluk: oynat/durdur. ← →: bir tik.</p>`;
    return;
  }
  const name = (id: string) => `${film!.neurons.find((n) => n.id === id)?.label ?? id}`;
  if (selected.kind === "node") {
    const id = selected.id;
    const n = film.neurons.find((x) => x.id === id)!;
    const info = regionInfo(n.region);
    const ins = film.synapses.map((e, i) => ({ e, i })).filter((x) => x.e.to === id).sort((p, q) => Math.abs(q.e.learned) - Math.abs(p.e.learned));
    const outs = film.synapses.map((e, i) => ({ e, i })).filter((x) => x.e.from === id).sort((p, q) => Math.abs(q.e.learned) - Math.abs(p.e.learned));
    sparkSeries = film.ticks.map((k) => k.a[id] ?? 0);
    const active = sparkSeries.filter((v) => v !== 0).length;
    const silent = silence.includes(id);
    const table = (rows: { e: SynapseView; i: number }[], dir: "from" | "to") => rows.length === 0 ? `<p class="dim" style="font-size:12.5px">yok</p>` :
      `<table><tr><th>${dir === "from" ? "nereden" : "nereye"}</th><th>doğum</th><th>şimdi</th><th>Δ</th></tr>${rows.slice(0, 14).map((x) => synRow(x.e, x.i, name(dir === "from" ? x.e.from : x.e.to))).join("")}</table>${rows.length > 14 ? `<p class="dim" style="font-size:12px">+${rows.length - 14} daha</p>` : ""}`;
    insp.innerHTML = `
      <div class="eyebrow" style="color:${info.color}">${esc(info.name)}${n.action ? " · " + ACTION_TR[n.action] : ""}${n.grown ? " · yaşarken doğdu" : ""}</div>
      <h2>${esc(n.label)}</h2>
      <dl class="kv"><dt>kimlik</dt><dd>${esc(id)}</dd><dt>bu tik</dt><dd id="nowAct">${fmt(current()?.a[id] ?? 0, 3)}</dd><dt>etkin olduğu tik</dt><dd>${active} / ${film.ticks.length}</dd></dl>
      <div class="why">${esc(info.what)}</div>
      <canvas id="spark" width="640" height="140" title="odadaki etkinliği; tıkla, o tike git"></canvas>
      <div class="actions">
        ${outs.length ? `<button id="silenceBtn" class="${silent ? "" : "warnb"}">${silent ? "Susturmayı kaldır" : "Sustur ve yeniden yaşat"}</button>` : `<span class="dim" style="font-size:12.5px">çıkış sinapsı yok: susturulacak bir şey yok</span>`}
        <button id="clearSel">Seçimi bırak</button>
      </div>
      <h3>Gelen sinapslar (${ins.length})</h3>${table(ins, "from")}
      <h3>Giden sinapslar (${outs.length})</h3>${table(outs, "to")}`;
    $("silenceBtn")?.addEventListener("click", () => {
      silence = silent ? silence.filter((x) => x !== id) : [...silence, id];
      void load();
    });
  } else {
    const e = film.synapses[selected.i]!;
    sparkSeries = film.ticks.map((k) => (k.a[e.from] ?? 0) * e.w);
    const used = film.machinery === "graph" || e.learns;
    insp.innerHTML = `
      <div class="eyebrow">${e.pathway ? `yol ${esc(e.pathway)}` : "yol yok"} · ${e.learns ? "öğrenir" : "doğuştan, öğrenmez"} · ${e.effect > 0 ? "iter" : "tutar"}</div>
      <h2><a href="#" data-node="${esc(e.from)}">${esc(name(e.from))}</a> → <a href="#" data-node="${esc(e.to)}">${esc(name(e.to))}</a></h2>
      <dl class="kv">
        <dt>doğumda</dt><dd>${e.birth === null ? "yoktu — yaşarken doğdu" : fmt(e.birth, 4)}</dd>
        <dt>şimdi (öğrenmiş)</dt><dd>${fmt(e.learned, 4)}</dd>
        <dt>öğrenmeyle Δ</dt><dd>${e.birth === null ? fmt(e.learned, 4) : fmt(e.learned - e.birth, 4)}</dd>
        ${e.w !== e.learned ? `<dt>bu yaşamda</dt><dd class="warn">${fmt(e.w, 4)} (${birthMode ? "doğuştaki beyin" : "susturuldu"})</dd>` : ""}
        <dt>bu tik taşıdığı</dt><dd id="nowAct">${fmt((current()?.a[e.from] ?? 0) * e.w, 4)}</dd>
      </dl>
      ${e.why ? `<div class="why">${esc(e.why)}</div>` : ""}
      ${used ? "" : `<div class="why warn">Bu denek rekabetçi seçimle karar veriyor: seçici yalnız öğrenen sinapsları (duyu → Git/Gitme) okur. Bu sinaps beyinde var ama bu yaşamda kararı etkilemiyor.</div>`}
      <canvas id="spark" width="640" height="140" title="taşıdığı sinyal (etkinlik × ağırlık); tıkla, o tike git"></canvas>
      <div class="actions"><button id="clearSel">Seçimi bırak</button></div>`;
  }
  $("clearSel")?.addEventListener("click", () => select(null));
  insp.querySelectorAll<HTMLElement>("tr[data-edge]").forEach((tr) => tr.addEventListener("click", () => select({ kind: "edge", i: Number(tr.dataset.edge) })));
  insp.querySelectorAll<HTMLElement>("a[data-node]").forEach((a) => a.addEventListener("click", (ev) => { ev.preventDefault(); select({ kind: "node", id: a.dataset.node! }); }));
  const spark = document.getElementById("spark") as HTMLCanvasElement | null;
  spark?.addEventListener("click", (ev) => {
    const r = spark.getBoundingClientRect();
    seek(Math.round(((ev.clientX - r.left) / r.width) * (film!.ticks.length - 1)));
  });
  drawSparkMarker();
}

function drawSparkMarker(): void {
  const spark = document.getElementById("spark") as HTMLCanvasElement | null;
  if (!spark || !film) return;
  const ctx = spark.getContext("2d")!;
  const W = spark.width, H = spark.height, n = sparkSeries.length;
  ctx.clearRect(0, 0, W, H);
  const max = Math.max(1e-6, ...sparkSeries.map(Math.abs));
  const bucket = Math.max(1, Math.ceil(n / W));
  ctx.fillStyle = COLOR.sensor;
  for (let x = 0; x < W; x++) {
    let m = 0;
    for (let j = Math.floor((x * n) / W); j < Math.min(n, Math.floor((x * n) / W) + bucket); j++) m = Math.max(m, Math.abs(sparkSeries[j] ?? 0));
    const h = (m / max) * (H - 8);
    ctx.fillRect(x, H - 4 - h, 1, h);
  }
  const x = (tick / Math.max(1, n - 1)) * W;
  ctx.fillStyle = COLOR.motor;
  ctx.fillRect(x - 1, 0, 2, H);
  const now = document.getElementById("nowAct");
  if (now && selected) now.textContent = selected.kind === "node" ? fmt(current()?.a[selected.id] ?? 0, 3) : fmt((current()?.a[film.synapses[selected.i]!.from] ?? 0) * film.synapses[selected.i]!.w, 4);
}

// --- picking and hovering -----------------------------------------------------------------------------------------
const hover = $("hover");
scene.onPointerObservable.add((pi) => {
  if (pi.type === PointerEventTypes.POINTERTAP && pi.event.button === 0) {
    const m = pi.pickInfo?.pickedMesh?.metadata as { kind: string; id?: string; i?: number } | undefined;
    if (m?.kind === "node") select({ kind: "node", id: m.id! });
    else if (m?.kind === "edge") select({ kind: "edge", i: m.i! });
  }
  if (pi.type === PointerEventTypes.POINTERMOVE && film) {
    const pick = scene.pick(scene.pointerX, scene.pointerY, (mesh) => mesh.isPickable && mesh.isEnabled() && mesh.metadata !== null && mesh.metadata !== undefined);
    const m = pick?.pickedMesh?.metadata as { kind: string; id?: string; i?: number } | undefined;
    if (!m) { hover.style.display = "none"; canvas.style.cursor = "default"; return; }
    canvas.style.cursor = "pointer";
    const k = current();
    let html = "";
    if (m.kind === "node") {
      const n = film.neurons.find((x) => x.id === m.id)!;
      html = `<b>${esc(n.label)}</b> <span class="dim">${esc(regionInfo(n.region).name)}</span><br>etkinlik ${fmt(k?.a[n.id] ?? 0, 3)}`;
    } else {
      const e = film.synapses[m.i!]!;
      const nm = (id: string) => film!.neurons.find((x) => x.id === id)?.label ?? id;
      html = `<b>${esc(nm(e.from))} → ${esc(nm(e.to))}</b><br>ağırlık ${fmt(e.learned, 3)}${e.birth === null ? " (yaşarken doğdu)" : ` · doğumda ${fmt(e.birth, 3)}`}`;
    }
    hover.innerHTML = html;
    hover.style.display = "block";
    hover.style.left = `${scene.pointerX + 14}px`;
    hover.style.top = `${scene.pointerY + 10}px`;
  }
});

// --- playback -----------------------------------------------------------------------------------------------------
function seek(t: number): void {
  if (!film) return;
  tick = Math.max(0, Math.min(film.ticks.length - 1, t));
  drawTick();
}

engine.runRenderLoop(() => {
  const dt = engine.getDeltaTime() / 1000;
  if (playing && film) {
    carry += dt * 20 * Number($<HTMLSelectElement>("speed").value);
    let steps = Math.floor(carry);
    carry -= steps;
    while (steps-- > 0) {
      if (tick >= film.ticks.length - 1) { setPlaying(false); break; }
      tick++;
      if (steps < 2) spawnPulses(film.ticks[tick]!);
    }
    drawTick();
  }
  for (const p of pulses) {
    if (!p.live) continue;
    p.t += dt * p.speed;
    if (p.t >= 1) { p.live = false; p.mesh.setEnabled(false); continue; }
    Vector3.LerpToRef(p.a, p.b, p.t, p.mesh.position);
  }
  scene.render();
});
window.addEventListener("resize", () => engine.resize());

function setPlaying(on: boolean): void {
  playing = on;
  $("play").textContent = on ? "❚❚ Durdur" : "▶ Oynat";
}
$("play").addEventListener("click", () => { if (film && tick >= film.ticks.length - 1) seek(0); setPlaying(!playing); });
$("back").addEventListener("click", () => { setPlaying(false); seek(tick - 1); });
$("fwd").addEventListener("click", () => { setPlaying(false); seek(tick + 1); if (film) spawnPulses(film.ticks[tick]!); });
$<HTMLInputElement>("scrub").addEventListener("input", (e) => seek(Number((e.target as HTMLInputElement).value)));
window.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "SELECT") return;
  if (e.key === " ") { e.preventDefault(); $("play").click(); }
  if (e.key === "ArrowRight") $("fwd").click();
  if (e.key === "ArrowLeft") $("back").click();
});
for (const id of ["onlyLearning", "onlyChanged"]) $(id).addEventListener("change", applyVisibility);
$<HTMLInputElement>("minW").addEventListener("input", (e) => { $("minWv").textContent = (e.target as HTMLInputElement).value; applyVisibility(); });

// --- choosing a subject, a room, a brain --------------------------------------------------------------------------
function renderRegions(): void {
  if (!film) return;
  const regions = [...new Set(film.neurons.map((n) => n.region))];
  $("regions").innerHTML = regions.map((r) => `<span class="chip${hiddenRegions.has(r) ? " off" : ""}" data-r="${esc(r)}"><i style="background:${regionInfo(r).color}"></i>${esc(regionInfo(r).name)}</span>`).join("");
  $("regions").querySelectorAll<HTMLElement>(".chip").forEach((c) => c.addEventListener("click", () => {
    const r = c.dataset.r!;
    if (hiddenRegions.has(r)) hiddenRegions.delete(r); else hiddenRegions.add(r);
    renderRegions();
    applyVisibility();
  }));
}

function renderSilenced(): void {
  $("silenced").innerHTML = silence.length === 0 ? `<span class="dim" style="font-size:13px">yok — bir nörona tıkla, "Sustur" de</span>` :
    silence.map((id) => `<span class="chip" data-s="${esc(id)}" title="kaldırmak için tıkla">✕ ${esc(film?.neurons.find((n) => n.id === id)?.label ?? id)}</span>`).join("");
  $("silenced").querySelectorAll<HTMLElement>(".chip[data-s]").forEach((c) => c.addEventListener("click", () => { silence = silence.filter((x) => x !== c.dataset.s); void load(); }));
}

function renderSubjects(): void {
  const code = $<HTMLSelectElement>("code").value;
  const q = $<HTMLInputElement>("find").value.trim().toLowerCase();
  const id = params.get("id");
  const list = subjects.filter((s) => s.code === code.split("@")[0] && String(s.trainEpisodes) === code.split("@")[1])
    .filter((s) => !q || `${s.id} ${s.name} seed ${s.seed} ${s.group}`.toLowerCase().includes(q));
  $("subjects").innerHTML = list.map((s) => `<button data-id="${s.id}" class="${s.id === id ? "sel" : ""}"><b>${s.id} · ${esc(s.name)}</b><span>dürtü ${fmt(s.drive, 2)}</span><span>seed ${s.seed} · ${s.group === "reflexive" ? "refleksli" : "reflekssiz"} · ${s.command}</span></button>`).join("");
  $("subjects").querySelectorAll<HTMLElement>("button").forEach((b) => b.addEventListener("click", () => { params.set("id", b.dataset.id!); params.set("room", "1"); silence = []; void load(); renderSubjects(); }));
}

async function load(): Promise<void> {
  const id = params.get("id");
  if (!id) return;
  const room = Number(params.get("room") ?? 1) || 1;
  params.set("sustur", silence.join(","));
  if (!silence.length) params.delete("sustur");
  if (birthMode) params.set("dogum", "1"); else params.delete("dogum");
  history.replaceState(null, "", `?${params}`);
  setPlaying(false);
  $("busy").classList.add("on");
  try {
    const url = `/api/beyin3d/${id}/room/${room}?${silence.length ? `sustur=${encodeURIComponent(silence.join(","))}&` : ""}${birthMode ? "dogum=1" : ""}`;
    const res = await fetch(url);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? res.statusText);
    const keepSel = selected;
    film = body as Film3D;
    buildBrain(film);
    $<HTMLInputElement>("scrub").max = String(film.ticks.length - 1);
    $("roomSel").innerHTML = Array.from({ length: film.rooms }, (_, i) => `<option value="${i + 1}"${i + 1 === room ? " selected" : ""}>oda ${i + 1}</option>`).join("");
    const st = $("status");
    const verdict = film.matches === true ? "✓ deneydeki yaşamın aynısı" : film.matches === false ? "✗ kayıtla uyuşmuyor!" : "karşı-olgusal: deneyde yaşanmadı";
    st.textContent = `${film.id} «${film.name}» · ${film.code} · oda ${film.room} · ${film.result.ticks} tik, ${film.result.meals} öğün${film.result.doneCause ? " · öldü (" + film.result.doneCause + ")" : ""} · ${film.machinery === "selection" ? "rekabetçi seçim" : "sinir ağı"} · ${verdict}`;
    st.classList.toggle("cf", film.matches !== true);
    selected = keepSel && (keepSel.kind === "edge" ? keepSel.i < film.synapses.length : film.neurons.some((n) => n.id === keepSel.id)) ? keepSel : null;
    renderRegions();
    renderSilenced();
    renderInspector();
    seek(Math.min(tick, film.ticks.length - 1));
  } catch (e) {
    $("status").textContent = `hata: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    $("busy").classList.remove("on");
  }
}

$("roomSel").addEventListener("change", (e) => { params.set("room", (e.target as HTMLSelectElement).value); tick = 0; void load(); });
$("modeRecord").addEventListener("click", () => { birthMode = false; $("modeRecord").classList.add("sel"); $("modeBirth").classList.remove("sel"); void load(); });
$("modeBirth").addEventListener("click", () => { birthMode = true; $("modeBirth").classList.add("sel"); $("modeRecord").classList.remove("sel"); void load(); });
if (birthMode) { $("modeBirth").classList.add("sel"); $("modeRecord").classList.remove("sel"); }
$("code").addEventListener("change", renderSubjects);
$("find").addEventListener("input", renderSubjects);

async function start(): Promise<void> {
  $("tabs").innerHTML = tabs("beyin3d.html");
  subjects = await (await fetch("/api/beyin3d")).json() as SubjectRow[];
  const groups = new Map<string, number>();
  for (const s of subjects) groups.set(`${s.code}@${s.trainEpisodes}`, (groups.get(`${s.code}@${s.trainEpisodes}`) ?? 0) + 1);
  const codes = [...groups.keys()];
  $("code").innerHTML = codes.map((c) => `<option value="${c}">${c.split("@")[0]} · ${c.split("@")[1]} bölüm eğitim (${groups.get(c)})</option>`).join("");
  const start = params.get("id") ? subjects.find((s) => s.id === params.get("id")) : subjects.find((s) => s.code === "H3B97" && s.trainEpisodes === 200) ?? subjects[0];
  if (!start) { $("status").textContent = "kayıtlı denek yok"; return; }
  $<HTMLSelectElement>("code").value = `${start.code}@${start.trainEpisodes}`;
  params.set("id", start.id);
  renderSubjects();
  await load();
}
void start();

// For automated checks (a CDP script clicks through the page the way a person would): read-only state and the same
// actions the buttons use.
(window as unknown as { __beyin3d: unknown }).__beyin3d = {
  state: () => ({ id: film?.id, room: film?.room, ticks: film?.ticks.length, tick, selected, silenced: film?.silenced, matches: film?.matches, meals: film?.result.meals, mode: film?.mode, nodes: nodes.size, edges: edges.length, visibleEdges: edges.filter((e) => e.mesh.isEnabled()).length }),
  select, seek, play: () => setPlaying(true), pause: () => setPlaying(false),
  screenOf: (id: string) => {
    const n = nodes.get(id);
    if (!n) return null;
    const p = Vector3.Project(n.pos, Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (p.x / engine.getRenderWidth()) * r.width, y: r.top + (p.y / engine.getRenderHeight()) * r.height };
  },
};
