// brain-lab/viewer/deneyler.ts — the experiment dashboard. Reads the lab's own records through the dev
// server's read-only API (api.ts) and draws them as plain SVG; it measures nothing itself.
"use strict";

import { signTest, wilcoxon } from "../experiments/stats.ts";
import type { EvalView, GroupSummary, LearnedMatrix, ResultRow } from "./dashboard-data.ts";
import { nodeLabel } from "./theme.ts";

// --- small helpers ------------------------------------------------------------------------------

const SVG_NS = "http://www.w3.org/2000/svg";
const byId = <T extends Element>(id: string): T => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`missing element #${id}`);
  return e as unknown as T;
};
const f2 = (x: number) => x.toFixed(2);
const f3 = (x: number) => x.toFixed(3);
const pct = (x: number) => `${Math.round(100 * x)}%`;
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const pValue = (p: number) => (p < 0.001 ? p.toExponential(1) : p.toFixed(3));

/** Text from the data is always escaped before it goes into HTML. */
const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
}

function withTitle<E extends SVGElement>(e: E, title: string): E {
  e.append(svgEl("title", {}, title));
  return e;
}

function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

async function api<T>(path: string): Promise<T> {
  const r = await fetch(path);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${path}: ${r.status} ${(body as { error?: string }).error ?? ""}`);
  return body as T;
}

/** Paired test line: "k/n in favour · Wilcoxon p". Positive differences favour the learner. */
function pairedText(diffs: readonly number[]): string {
  const s = signTest(diffs);
  return `${s.statistic}/${s.n} lehte · Wilcoxon p ${pValue(wilcoxon(diffs).p)}`;
}

/** Colors from the CSS tokens, read once. */
const COLORS = (() => {
  const css = getComputedStyle(document.documentElement);
  const get = (name: string) => css.getPropertyValue(name).trim();
  return { good: get("--good"), bad: get("--bad"), warn: get("--warn"), inner: get("--inner"), twin: get("--twin"), text: get("--text"), border: get("--border"), accent: get("--accent") };
})();

/** Horizontal grid lines with labels for a value axis. */
function valueAxis(svg: SVGSVGElement, ticks: readonly number[], y: (v: number) => number, x1: number, x2: number, format = f2): void {
  for (const v of ticks) {
    svg.append(svgEl("line", { x1, x2, y1: y(v), y2: y(v), stroke: COLORS.border }));
    svg.append(svgEl("text", { x: x1 - 6, y: y(v) + 4, "text-anchor": "end" }, format(v)));
  }
}

const COMMAND_TR: Readonly<Record<string, string>> = { tara: "tarama", dogrula: "doğrulama", curut: "çürütme" };
const ACTION_TR: Readonly<Record<string, string>> = { forward: "ileri", back: "geri", left: "sol", right: "sağ" };
const GROUP_TR: Readonly<Record<string, string>> = { reflexless: "reflekssiz", reflexive: "refleksli", none: "—" };
const groupKey = (r: Pick<ResultRow, "command" | "code" | "control" | "food" | "threats">) => `${r.command}|${r.code}|${r.control}|${r.food}|${r.threats}`;

// --- state --------------------------------------------------------------------------------------

let rows: ResultRow[] = [];
let groups: GroupSummary[] = [];
let selectedKey = "";

// --- conditions table ---------------------------------------------------------------------------

function groupRow(g: GroupSummary): string {
  const better = g.learner.meanDrive < g.twin.meanDrive;
  const control = g.control === "none" ? "—" : g.control;
  const room = `${g.food} yemek${g.threats ? ` · ${g.threats} tehlike` : ""}`;
  return `<tr data-key="${esc(g.key)}" class="${g.key === selectedKey ? "sel" : ""}">
    <td><b>${esc(g.code)}</b></td>
    <td>${esc(COMMAND_TR[g.command] ?? g.command)}</td>
    <td><span class="tag ${esc(g.control.toLowerCase())}">${esc(control)}</span></td>
    <td>${esc(room)}</td>
    <td class="num">${g.n}</td>
    <td class="num ${better ? "good" : "bad"}">${f3(g.learner.meanDrive)}</td>
    <td class="num dim">${f3(g.twin.meanDrive)}</td>
    <td class="num">${g.driveBetter}/${g.n}</td>
    <td class="num">${pct(g.learner.survival)}</td>
    <td class="num">${f3(g.learner.steering ?? 0)}</td>
    <td class="num">${f3(g.learner.sideInfo ?? 0)}</td>
    <td class="num">${f2(g.learner.perK)}</td>
    <td class="num">${f2(g.learner.harmPerK)}</td>
    <td class="dim">${esc(g.lastDate.slice(0, 16).replace("T", " "))}</td>
  </tr>`;
}

function renderGroups(): void {
  const table = byId<HTMLTableElement>("groups");
  if (!groups.length) {
    table.innerHTML = `<tr><td class="empty">Henüz sonuç yok — <code>npm run exp -- tara KOD</code></td></tr>`;
    return;
  }
  const head = `<thead><tr><th>koşul</th><th>aşama</th><th>kontrol</th><th>oda</th><th class="num">denek</th>
    <th class="num">dürtü öğrenen</th><th class="num">ikiz</th><th class="num">öğrenen iyi</th><th class="num">hayatta</th>
    <th class="num">yönlendirme</th><th class="num">bilgi (bit)</th><th class="num">yemek/1000t</th><th class="num">zarar/1000t</th><th>son</th></tr></thead>`;
  const newestFirst = [...groups].sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  table.innerHTML = `${head}<tbody>${newestFirst.map(groupRow).join("")}</tbody>`;
  table.querySelectorAll<HTMLElement>("tbody tr").forEach((tr) => tr.addEventListener("click", () => selectGroup(tr.dataset.key!)));
}

function selectGroup(key: string): void {
  selectedKey = key;
  renderGroups();
  const g = groups.find((x) => x.key === key);
  if (!g) return;
  const members = rows.filter((r) => groupKey(r) === key);
  const control = g.control !== "none" ? ` · ${g.control}` : "";
  byId<HTMLElement>("pairTitle").textContent = `${g.code} · ${COMMAND_TR[g.command] ?? g.command}${control} · ${pairedText(members.map((r) => r.t.meanDrive - r.l.meanDrive))}`;
  renderPairs(members);
  renderSubjects(members);
}

// --- paired slope chart: twin → learner ---------------------------------------------------------

const PAIRS = { W: 520, H: 320, top: 24, bottom: 30, axisX: 60, xTwin: 130, xLearner: 390 } as const;

function renderPairs(members: readonly ResultRow[]): void {
  const svg = byId<SVGSVGElement>("pairs");
  clear(svg);
  const { W, H, top, bottom, axisX, xTwin, xLearner } = PAIRS;
  const y = (drive: number) => top + (1 - drive) * (H - top - bottom); // drive in [0, 1]
  valueAxis(svg, [0, 0.25, 0.5, 0.75, 1], y, axisX, W - 40);
  svg.append(svgEl("text", { x: 8, y: 14 }, "ortalama dürtü (düşük = iyi)"));
  svg.append(svgEl("text", { x: xTwin, y: H - 8, "text-anchor": "middle", class: "label" }, "ikiz"));
  svg.append(svgEl("text", { x: xLearner, y: H - 8, "text-anchor": "middle", class: "label" }, "öğrenen"));
  for (const r of members) {
    const color = r.l.meanDrive < r.t.meanDrive ? COLORS.good : COLORS.bad;
    const title = `${r.learner} · seed ${r.seed} · ${GROUP_TR[r.group] ?? r.group}: ikiz ${f3(r.t.meanDrive)} → öğrenen ${f3(r.l.meanDrive)}`;
    svg.append(withTitle(svgEl("line", { x1: xTwin, y1: y(r.t.meanDrive), x2: xLearner, y2: y(r.l.meanDrive), stroke: color, "stroke-width": 1.6, opacity: 0.75 }), title));
    svg.append(svgEl("circle", { cx: xTwin, cy: y(r.t.meanDrive), r: 3.5, fill: COLORS.twin }));
    svg.append(svgEl("circle", { cx: xLearner, cy: y(r.l.meanDrive), r: 3.5, fill: color }));
  }
  const twinMean = mean(members.map((r) => r.t.meanDrive));
  const learnerMean = mean(members.map((r) => r.l.meanDrive));
  svg.append(withTitle(svgEl("line", { x1: xTwin, y1: y(twinMean), x2: xLearner, y2: y(learnerMean), stroke: COLORS.text, "stroke-width": 3 }), `ortalama: ${f3(twinMean)} → ${f3(learnerMean)}`));
}

function renderSubjects(members: readonly ResultRow[]): void {
  const table = byId<HTMLTableElement>("subjects");
  const body = members.map((r) => `<tr data-id="${esc(r.learner)}">
      <td><b>${esc(r.learner)}</b></td><td>${r.seed}</td><td>${esc(GROUP_TR[r.group] ?? r.group)}</td>
      <td class="num ${r.l.meanDrive < r.t.meanDrive ? "good" : "bad"}">${f3(r.l.meanDrive)}</td>
      <td class="num dim">${f3(r.t.meanDrive)}</td><td class="num">${f3(r.l.steering ?? 0)}</td><td class="num">${pct(r.l.survival)}</td>
    </tr>`).join("");
  table.innerHTML = `<thead><tr><th>denek</th><th>seed</th><th>grup</th><th class="num">dürtü</th><th class="num">ikiz</th><th class="num">yönlendirme</th><th class="num">hayatta</th></tr></thead><tbody>${body}</tbody>`;
  table.querySelectorAll<HTMLElement>("tbody tr").forEach((tr) => tr.addEventListener("click", () => void loadSubject(tr.dataset.id!)));
}

// --- falsification battery ----------------------------------------------------------------------

interface FalsifySummary {
  readonly code: string;
  readonly what: string;
  readonly main: readonly ResultRow[];
  readonly cross: readonly ResultRow[];
  readonly local: readonly ResultRow[];
  readonly lesions: readonly { readonly label: string; readonly pattern: string; readonly evals: readonly EvalView[] }[];
}

type BarKind = "twin" | "learner" | "control" | "lesion";
interface Bar { readonly label: string; readonly values: readonly number[]; readonly kind: BarKind }

const FALSIFY = { W: 1260, H: 300, left: 50, top: 20, bottom: 70 } as const;

function falsifyBars(f: FalsifySummary): Bar[] {
  return [
    { label: "ikiz", values: f.main.map((r) => r.t.meanDrive), kind: "twin" },
    { label: "öğrenen", values: f.main.map((r) => r.l.meanDrive), kind: "learner" },
    { label: "CROSS", values: f.cross.map((r) => r.l.meanDrive), kind: "control" },
    { label: "LOCAL", values: f.local.map((r) => r.l.meanDrive), kind: "control" },
    ...f.lesions.map((l) => ({ label: l.label.replace(/ \(.*\)$/, ""), values: l.evals.map((e) => e.meanDrive), kind: "lesion" as const })),
  ];
}

function renderFalsify(f: FalsifySummary): void {
  const svg = byId<SVGSVGElement>("falsify");
  clear(svg);
  const { W, H, left, top, bottom } = FALSIFY;
  const bars = falsifyBars(f);
  const learner = bars[1]!.values;
  const slot = (W - left - 20) / bars.length;
  const y = (drive: number) => top + (1 - drive) * (H - top - bottom);
  const fill: Record<BarKind, string> = { twin: COLORS.twin, learner: COLORS.good, control: COLORS.warn, lesion: COLORS.inner };
  valueAxis(svg, [0, 0.25, 0.5, 0.75, 1], y, left, W - 10);
  svg.append(svgEl("text", { x: left, y: 12 }, "ortalama dürtü (düşük = iyi) · p: öğrenenle eşleştirilmiş Wilcoxon"));
  bars.forEach((b, i) => {
    const m = mean(b.values);
    const x = left + i * slot + slot * 0.18;
    const cx = x + slot * 0.32;
    svg.append(withTitle(svgEl("rect", { x, y: y(m), width: slot * 0.64, height: y(0) - y(m), fill: fill[b.kind], opacity: 0.85, rx: 3 }), `${b.label}: ${f3(m)}`));
    svg.append(svgEl("text", { x: cx, y: y(m) - 5, "text-anchor": "middle", class: "label" }, f3(m)));
    svg.append(svgEl("text", { x: cx, y: H - bottom + 16, "text-anchor": "middle", class: "label" }, b.label));
    if (b.kind !== "learner") {
      const p = wilcoxon(b.values.map((v, k) => v - learner[k]!)).p;
      svg.append(svgEl("text", { x: cx, y: H - bottom + 32, "text-anchor": "middle" }, `p ${pValue(p)}`));
    }
    b.values.forEach((v, k) => svg.append(svgEl("circle", { cx: x + slot * 0.08 + (k / b.values.length) * slot * 0.48, cy: y(v), r: 2, fill: COLORS.text, opacity: 0.35 })));
  });
  const steeringL = mean(f.main.map((r) => r.l.steering ?? 0));
  const steeringT = mean(f.main.map((r) => r.t.steering ?? 0));
  byId<HTMLElement>("falsifyNote").textContent =
    `${f.code} — ${f.what}. Taze seed'ler 11–20, ${f.main.length} denek. Öğrenme gerçekse: ikiz, CROSS ve LOCAL öğrenenden belirgin kötü (küçük p); ` +
    `ilgili lezyon kazancı götürür, ilgisiz lezyon götürmez. Yönlendirme: öğrenen ${f3(steeringL)} · ikiz ${f3(steeringT)} ` +
    `(${pairedText(f.main.map((r) => (r.l.steering ?? 0) - (r.t.steering ?? 0)))}).`;
}

async function loadFalsify(code: string): Promise<void> {
  renderFalsify(await api<FalsifySummary>(`/api/falsify/${encodeURIComponent(code)}`));
}

// --- one subject --------------------------------------------------------------------------------

interface SubjectView {
  readonly subject: {
    readonly id: string; readonly name: string; readonly category: string; readonly group: string; readonly stage: string;
    readonly birth: { readonly seed: number; readonly date: string };
    readonly lineage: { readonly parent: string | null; readonly how: string };
  };
  readonly matrix: LearnedMatrix;
  readonly criticFood: readonly number[];
  readonly curve: readonly number[];
  readonly ledgerEntries: number;
}

async function loadSubject(id: string): Promise<void> {
  const v = await api<SubjectView>(`/api/subject/${encodeURIComponent(id)}`);
  const s = v.subject;
  byId<HTMLElement>("subjectTitle").textContent = `${s.id} «${s.name}»`;
  const facts: [string, string][] = [
    ["denek", `${s.id} «${s.name}»`], ["kategori", s.category], ["grup", GROUP_TR[s.group] ?? s.group], ["evre", s.stage],
    ["seed", String(s.birth.seed)], ["doğum", s.birth.date], ["soy", s.lineage.parent ? `${s.lineage.how} ← ${s.lineage.parent}` : "doğum"],
    ["defter kaydı", v.ledgerEntries.toLocaleString("tr-TR")],
  ];
  byId<HTMLElement>("subjectKv").innerHTML = facts.map(([k, val]) => `<div><div class="k">${esc(k)}</div><div class="v">${esc(val)}</div></div>`).join("");
  renderHeatmap(v.matrix);
  renderCurve(v.curve);
  renderCritic(v.criticFood);
}

const HEAT = { W: 520, left: 150, top: 30, maxRow: 22 } as const;

function renderHeatmap(m: LearnedMatrix): void {
  const svg = byId<SVGSVGElement>("heatmap");
  clear(svg);
  const { W, left, top, maxRow } = HEAT;
  const cw = (W - left - 10) / m.actions.length;
  const ch = maxRow;
  svg.setAttribute("viewBox", `0 0 ${W} ${top + ch * m.senses.length + 10}`);
  const scale = Math.max(0.05, ...m.values.flat().map(Math.abs)); // at least ±0.05, so noise stays pale
  m.actions.forEach((a, j) => svg.append(svgEl("text", { x: left + j * cw + cw / 2, y: top - 10, "text-anchor": "middle", class: "label" }, ACTION_TR[a] ?? a)));
  m.senses.forEach((sense, i) => {
    const rowY = top + i * ch;
    svg.append(svgEl("text", { x: left - 8, y: rowY + ch * 0.68, "text-anchor": "end" }, nodeLabel(sense)));
    m.actions.forEach((action, j) => {
      const v = m.values[i]![j]!;
      const strength = Math.min(1, Math.abs(v) / scale);
      const cell = svgEl("rect", { x: left + j * cw + 1, y: rowY + 1, width: cw - 2, height: ch - 2, rx: 2, fill: v >= 0 ? COLORS.good : COLORS.bad, "fill-opacity": 0.08 + 0.85 * strength });
      svg.append(withTitle(cell, `${nodeLabel(sense)} → ${ACTION_TR[action] ?? action}: ${v >= 0 ? "+" : ""}${f3(v)}`));
      if (strength > 0.35) svg.append(svgEl("text", { x: left + j * cw + cw / 2, y: rowY + ch * 0.68, "text-anchor": "middle", class: "label" }, f2(v)));
    });
  });
}

const CURVE = { W: 520, H: 240, left: 40, top: 14, bottom: 26, smoothing: 5 } as const;

function renderCurve(curve: readonly number[]): void {
  const svg = byId<SVGSVGElement>("curve");
  clear(svg);
  if (!curve.length) {
    svg.append(svgEl("text", { x: 10, y: 20 }, "eğitim koşusu bulunamadı"));
    return;
  }
  const { W, H, left, top, bottom, smoothing } = CURVE;
  const maxY = Math.max(1, ...curve) * 1.1;
  const x = (i: number) => left + (i / Math.max(1, curve.length - 1)) * (W - left - 10);
  const y = (v: number) => top + (1 - v / maxY) * (H - top - bottom);
  valueAxis(svg, [0, maxY / 2, maxY], y, left, W - 10, (v) => v.toFixed(1));
  const points = (vs: readonly number[]) => vs.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const smooth = curve.map((_, i) => mean(curve.slice(Math.max(0, i - smoothing + 1), i + 1)));
  svg.append(svgEl("polyline", { points: points(curve), fill: "none", stroke: COLORS.accent, "stroke-width": 1.2, opacity: 0.6 }));
  svg.append(svgEl("polyline", { points: points(smooth), fill: "none", stroke: COLORS.good, "stroke-width": 2.5 }));
  svg.append(svgEl("text", { x: W - 10, y: H - 6, "text-anchor": "end" }, `bölüm 1–${curve.length} · kalın: ${smoothing} bölümlük ortalama`));
}

const CRITIC = { W: 520, H: 120, left: 40, mid: 55, maxBar: 40 } as const;

function renderCritic(values: readonly number[]): void {
  const svg = byId<SVGSVGElement>("critic");
  clear(svg);
  const { W, H, left, mid, maxBar } = CRITIC;
  const scale = Math.max(0.02, ...values.map(Math.abs));
  const slot = (W - left - 10) / values.length;
  svg.append(svgEl("line", { x1: left, x2: W - 10, y1: mid, y2: mid, stroke: COLORS.border }));
  values.forEach((v, i) => {
    const h = (Math.abs(v) / scale) * maxBar;
    const cx = left + i * slot + slot / 2;
    svg.append(svgEl("rect", { x: left + i * slot + slot * 0.2, y: v >= 0 ? mid - h : mid, width: slot * 0.6, height: h, fill: v >= 0 ? COLORS.good : COLORS.bad, rx: 2 }));
    svg.append(svgEl("text", { x: cx, y: H - 22, "text-anchor": "middle", class: "label" }, `ışın ${i}`));
    svg.append(svgEl("text", { x: cx, y: H - 6, "text-anchor": "middle" }, v.toFixed(4)));
  });
}

// --- start --------------------------------------------------------------------------------------

function showError(e: unknown): void {
  const box = document.createElement("div");
  box.className = "panel";
  box.style.cssText = "border-color:var(--bad);margin-bottom:12px";
  box.textContent = `Veri okunamadı: ${e instanceof Error ? e.message : String(e)}`;
  document.querySelector("main")!.prepend(box);
}

async function start(): Promise<void> {
  const results = await api<{ groups: GroupSummary[]; rows: ResultRow[] }>("/api/results");
  groups = results.groups;
  rows = results.rows;
  renderGroups();
  const newest = [...groups].sort((a, b) => b.lastDate.localeCompare(a.lastDate))[0];
  if (newest) selectGroup(newest.key);

  const codes = await api<string[]>("/api/falsify");
  const select = byId<HTMLSelectElement>("falsifyCode");
  select.innerHTML = codes.map((c) => `<option>${esc(c)}</option>`).join("");
  select.addEventListener("change", () => void loadFalsify(select.value).catch(showError));
  if (codes[0]) await loadFalsify(codes[0]);
  else byId<HTMLElement>("falsifyNote").textContent = "Henüz çürütme paketi yok — npm run exp -- curut KOD";

  const firstSubject = rows.find((r) => groupKey(r) === newest?.key) ?? rows[0];
  if (firstSubject) await loadSubject(firstSubject.learner);
}

start().catch(showError);
