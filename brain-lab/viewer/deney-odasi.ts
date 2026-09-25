// brain-lab/viewer/deney-odasi.ts — the Deney Odası page: pick a condition, pick a subject, watch the learner
// and its twin live the measured evaluation rooms side by side, and read in plain words what the experiment
// says. The brains live their rooms on the lab's server with the real code (arena.ts, api.ts), in the same
// engine the experiment ran in; this page only plays the filmed rooms back.
"use strict";

import { MAX_TICKS } from "../experiments/seeds.ts";
import type { WorldConfig } from "../world/index.ts";
import type { ArenaMeta } from "./api.ts";
import type { EpisodeResult, Film, Frame } from "./arena.ts";
import type { GroupSummary, LearnedMatrix, ResultRow } from "./dashboard-data.ts";
import { drawRoom, type Point } from "./draw-room.ts";
import { MEAL_REFERENCES, TERMS } from "./guide.ts";
import { learnedSentences, verdict, type Verdict } from "./plain.ts";
import { api, byId, esc, num, pct, showError, tabs, tip } from "./ui.ts";

// --- data from the API ------------------------------------------------------------------------------

const groupKey = (r: Pick<ResultRow, "command" | "code" | "control" | "food" | "threats">) => `${r.command}|${r.code}|${r.control}|${r.food}|${r.threats}`;
const COMMAND_TR: Readonly<Record<string, string>> = { tara: "tarama · seed 1–10", dogrula: "doğrulama", curut: "çürütme · taze seed 11–20" };
const GROUP_TR: Readonly<Record<string, string>> = { reflexless: "reflekssiz", reflexive: "refleksli" };
const CAUSE_TR: Readonly<Record<string, string>> = { starved: "açlıktan öldü", killed: "yaralanıp öldü" };
const room = (g: { food: number; threats: number }) => `${g.food} yemek · ${g.threats ? `${g.threats} tehlike bölgesi` : "tehlike yok"}`;
const drivePct = (d: number) => `${Math.round(100 * Math.min(1, d))}%`;

let rows: ResultRow[] = [];
let groups: GroupSummary[] = [];
let groupNow: GroupSummary | null = null;
let learnerNow: string | null = null;

// --- step 1: conditions ------------------------------------------------------------------------------

function gainsOf(members: readonly ResultRow[]): number[] {
  return members.map((r) => r.t.meanDrive - r.l.meanDrive);
}

function verdictChip(v: Verdict, control: string): string {
  const cls = control !== "none" && v.kind === "no-difference" ? "control" : v.kind;
  return `<span class="chip ${cls}">${esc(v.title)}</span>`;
}

function conditionCard(g: GroupSummary): string {
  const members = rows.filter((r) => groupKey(r) === g.key);
  const v = verdict(gainsOf(members), g.control);
  const control = g.control !== "none" ? ` · kontrol ${g.control}` : "";
  const what = TERMS.get(g.code)?.short ?? "";
  return `<button class="cond${g.key === groupNow?.key ? " sel" : ""}" data-key="${esc(g.key)}">
    <div class="row1"><span class="name">${esc(g.code)}${esc(control)}</span>${verdictChip(v, g.control)}</div>
    ${what ? `<div class="what">${esc(what)}</div>` : ""}
    <div class="meta">${esc(COMMAND_TR[g.command] ?? g.command)} · ${esc(room(g))} · ${g.n} denek</div>
    <div class="meta">dürtü: öğrenen <b>${num(g.learner.meanDrive)}</b> · ikiz ${num(g.twin.meanDrive)} &nbsp;|&nbsp; ${g.driveBetter}/${g.n} öğrenen iyi</div>
  </button>`;
}

/** Real learning conditions first (no control), newest first; controls after them. */
function orderedGroups(): GroupSummary[] {
  return [...groups].sort((a, b) => Number(a.control !== "none") - Number(b.control !== "none") || b.lastDate.localeCompare(a.lastDate));
}

/**
 * The page opens on the best brain that learns on its own (DEFAULT_CODE, screened on seeds 1–10), not on a
 * teacher diagnostic (T1…), because the page's "what to look for" notes describe that brain.
 */
const DEFAULT_CODE = "S1n";
function defaultGroup(): GroupSummary | undefined {
  return groups.find((g) => g.code === DEFAULT_CODE && g.command === "tara" && g.control === "none") ?? orderedGroups()[0];
}

function renderConditions(): void {
  const box = byId("conditions");
  box.classList.remove("loading");
  if (!groups.length) {
    box.innerHTML = `<div class="callout warn">Henüz sonuç yok. Bir deney koş: <code>npm run exp -- tara S1n</code></div>`;
    return;
  }
  box.innerHTML = orderedGroups().map(conditionCard).join("");
  box.querySelectorAll<HTMLElement>(".cond").forEach((b) => b.addEventListener("click", () => selectGroup(b.dataset.key!)));
}

function selectGroup(key: string, learner?: string): void {
  groupNow = groups.find((g) => g.key === key) ?? null;
  renderConditions();
  if (!groupNow) return;
  const members = rows.filter((r) => groupKey(r) === key);
  renderSubjects(members);
  renderVerdict(groupNow, members);
  renderReferences(groupNow);
  const first = members.find((r) => r.learner === learner) ?? members.find((r) => r.l.meanDrive < r.t.meanDrive) ?? members[0];
  if (first) selectSubject(first.learner).catch(showError);
}

// --- step 2: subjects ---------------------------------------------------------------------------------

function subjectRow(r: ResultRow): string {
  const better = r.l.meanDrive < r.t.meanDrive;
  return `<button class="subj${r.learner === learnerNow ? " sel" : ""}" data-id="${esc(r.learner)}" title="Öğrenen dürtü ${num(r.l.meanDrive)} · ikiz ${num(r.t.meanDrive)}">
    <div class="who"><b>${esc(r.learner)}</b><span>seed ${r.seed} · ${esc(GROUP_TR[r.group] ?? r.group)} · <span class="${better ? "good" : "bad"}">${better ? "öğrenen daha iyi" : "öğrenen daha kötü"}</span></span></div>
    <div class="mini">
      <div class="lbl"><span>öğrenen</span><span>${num(r.l.meanDrive)}</span></div><i style="width:${drivePct(r.l.meanDrive)};background:var(--good)"></i>
      <div class="lbl"><span>ikiz</span><span>${num(r.t.meanDrive)}</span></div><i style="width:${drivePct(r.t.meanDrive)};background:var(--twin)"></i>
    </div>
  </button>`;
}

function renderSubjects(members: readonly ResultRow[]): void {
  const box = byId("subjects");
  box.classList.remove("loading");
  box.innerHTML = members.map(subjectRow).join("");
  box.querySelectorAll<HTMLElement>(".subj").forEach((b) => b.addEventListener("click", () => { selectSubject(b.dataset.id!).catch(showError); }));
}

// --- the experiment's verdict and measures ----------------------------------------------------------------

function renderVerdict(g: GroupSummary, members: readonly ResultRow[]): void {
  const v = verdict(gainsOf(members), g.control);
  const tone = v.kind === "learned" ? (g.control === "none" ? "good" : "bad") : v.kind === "worse" ? "bad" : g.control !== "none" ? "good" : "warn";
  const controlNote = g.control !== "none" ? ` ${TERMS.get(g.control.toLowerCase())?.short ?? ""}` : "";
  byId("verdictExplain").innerHTML =
    `<b>${esc(g.code)}</b> · ${esc(COMMAND_TR[g.command] ?? g.command)} · ${esc(room(g))}.${esc(controlNote)} ` +
    `Karar, her öğrenenin kendi ikizinden ne kadar tok yaşadığına bakar${tip("p")}.`;
  byId("verdict").innerHTML = `<div class="callout ${tone}"><b>${esc(v.title)}.</b> ${esc(v.text)}</div>`;

  const L = g.learner, T = g.twin;
  const line = (label: string, id: string, l: string, t: string, reading: string) =>
    `<tr><td>${label}${tip(id)}</td><td class="num">${l}</td><td class="num">${t}</td><td>${reading}</td></tr>`;
  const cmp = (l: number, t: number, lowerIsBetter: boolean, same = 0.005) =>
    Math.abs(l - t) < same ? `<span class="dim">aynı</span>` : (l < t) === lowerIsBetter ? `<span class="good">öğrenen iyi</span>` : `<span class="bad">öğrenen kötü</span>`;
  const steering = L.steering ?? 0;
  byId("measures").innerHTML = `<thead><tr><th>ölçü</th><th class="num">öğrenen</th><th class="num">ikiz</th><th>okuma</th></tr></thead><tbody>
    ${line("Ortalama dürtü", "durtu", num(L.meanDrive), num(T.meanDrive), `${cmp(L.meanDrive, T.meanDrive, true)} · düşük = tok yaşıyor`)}
    ${line("Hayatta kalma", "hayatta", pct(L.survival), pct(T.survival), `${cmp(L.survival, T.survival, false)} · odaların kaçında sona kadar yaşadı`)}
    ${line("Yemek / 1000 tik", "yemek", num(L.perK), num(T.perK), `${cmp(L.perK, T.perK, false, 0.05)} · TD öğrenicisi 8,38`)}
    ${line("Yönlendirme", "yonlendirme", num(steering, 3), num(T.steering ?? 0, 3), steering > 0.1 ? `<span class="good">yemeğe dönüyor</span>` : `<span class="warn">yön yok</span> · 0 = şans, hedef belirgin > 0`)}
    ${line("Bilgi (bit)", "bilgi", num(L.sideInfo ?? 0, 3), num(T.sideInfo ?? 0, 3), "dönüş, yemeğin tarafını ne kadar gösteriyor")}
    ${g.threats ? line("Zarar / 1000 tik", "zarar", num(L.harmPerK), num(T.harmPerK), cmp(L.harmPerK, T.harmPerK, true)) : ""}
  </tbody>`;
}

// --- meals against the reference points ------------------------------------------------------------------

const REF = { W: 900, left: 250, right: 70, rowH: 30, top: 6 } as const;

function renderReferences(g: GroupSummary): void {
  const svg = byId<SVGSVGElement>("references");
  const bars = [
    ...MEAL_REFERENCES.map((r) => ({ label: r.who, value: r.perK, color: "#56627a", note: r.note })),
    { label: `Bu deney: öğrenen (${g.code})`, value: g.learner.perK, color: "#4cc38a", note: "bu deneyin öğrenenlerinin ortalaması" },
    { label: "Bu deney: ikiz", value: g.twin.perK, color: "#7d8aa0", note: "aynı doğum, öğrenmeden" },
  ].sort((a, b) => a.value - b.value);
  const { W, left, right, rowH, top } = REF;
  const max = Math.max(...bars.map((b) => b.value));
  const x = (v: number) => left + (v / max) * (W - left - right);
  svg.setAttribute("viewBox", `0 0 ${W} ${top * 2 + bars.length * rowH}`);
  svg.innerHTML = bars.map((b, i) => {
    const y = top + i * rowH;
    return `<g><title>${esc(`${b.label}: ${num(b.value)} — ${b.note}`)}</title>
      <text x="${left - 10}" y="${y + rowH * 0.62}" text-anchor="end" class="${b.color === "#56627a" ? "" : "label"}">${esc(b.label)}</text>
      <rect x="${left}" y="${y + 5}" width="${Math.max(2, x(b.value) - left)}" height="${rowH - 10}" rx="4" fill="${b.color}"/>
      <text x="${x(b.value) + 8}" y="${y + rowH * 0.62}" class="label">${num(b.value)}</text></g>`;
  }).join("");
  byId("referencesNote").textContent = g.food === 10 && g.threats === 0
    ? "Karşılaştırma noktaları bu deneyle aynı odada (10 yemek, tehlike yok) ölçüldü; doğrudan kıyaslanabilir."
    : `Dikkat: karşılaştırma noktaları 10 yemekli, tehlikesiz odada ölçüldü; bu deneyin odası farklı (${room(g)}), kıyas yaklaşık.`;
}

// --- step 3: the arena (rooms are lived on the server, arena.ts; here they are only played back) ---------------

interface Side {
  readonly ctx: CanvasRenderingContext2D;
  readonly statsId: string;
  film: Film | null;
  trail: Point[];
}

const TRAIL = 240; // ticks of trail = 12 seconds
const SPEEDS = [1, 5, 20, 100] as const; // × real time (20 ticks per second)
const TICKS_PER_SECOND = 20;
let meta: ArenaMeta | null = null;
let sides: Side[] = [];
let roomNow = 0;
let tickNow = 0;
let running = false;
let loadingRoom = false;
let speed: number = SPEEDS[1];
let owed = 0;
const played: { room: number; l: Film; t: Film }[] = [];

/** The frame a side shows at `tick`: a body that died earlier stays at its last frame. */
const frameAt = (film: Film, tick: number): Frame => film.frames[Math.min(tick, film.frames.length - 1)]!;
const roomLength = () => Math.max(0, ...sides.map((s) => (s.film ? s.film.frames.length - 1 : 0)));

async function selectSubject(id: string): Promise<void> {
  learnerNow = id;
  setRunning(false);
  byId("subjects").querySelectorAll<HTMLElement>(".subj").forEach((b) => b.classList.toggle("sel", b.dataset.id === id));
  byId("learnerWho").textContent = `${id} — beyin defterden kuruluyor…`;
  byId("twinWho").textContent = "—";
  byId("learned").className = "loading";
  byId("learned").textContent = "Beyin defterden okunuyor…";
  for (const b of ["play", "finish", "next"]) byId<HTMLButtonElement>(b).disabled = true;
  const m = await api<ArenaMeta>(`/api/arena/${encodeURIComponent(id)}`);
  if (learnerNow !== id) return; // another subject was picked while this one loaded
  meta = m;
  played.length = 0;
  sides = [
    { ctx: byId<HTMLCanvasElement>("learnerCanvas").getContext("2d")!, statsId: "learnerStats", film: null, trail: [] },
    { ctx: byId<HTMLCanvasElement>("twinCanvas").getContext("2d")!, statsId: "twinStats", film: null, trail: [] },
  ];
  byId("learnerWho").textContent = `${m.learner.id} «${m.learner.name}»`;
  byId("twinWho").textContent = `${m.twin.id} «${m.twin.name}»`;
  byId("learnerRole").textContent = `${m.trainEpisodes} odada öğrendi; şimdi öğrenmesi dondurulmuş, yalnızca öğrendiğini kullanıyor.`;
  renderScore();
  loadLearned(id, m.world).catch(showError);
  await enterRoom(1);
}

/** Fetches room n (the server lives it, and the rooms before it, the first time) and shows its start. */
async function enterRoom(n: number): Promise<void> {
  if (!meta) return;
  const id = meta.learner.id;
  loadingRoom = true;
  setRunning(false);
  for (const b of ["play", "finish", "next"]) byId<HTMLButtonElement>(b).disabled = true;
  byId("clock").textContent = `oda ${n} hesaplanıyor…`;
  const films = await api<{ learner: Film; twin: Film }>(`/api/arena/${encodeURIComponent(id)}/room/${n}`);
  loadingRoom = false;
  if (meta?.learner.id !== id) return;
  roomNow = n;
  tickNow = 0;
  sides[0]!.film = films.learner;
  sides[1]!.film = films.twin;
  for (const s of sides) s.trail = [];
  byId("result").classList.add("hidden");
  byId<HTMLButtonElement>("play").disabled = false;
  byId<HTMLButtonElement>("finish").disabled = false;
  byId<HTMLButtonElement>("next").disabled = n >= meta.rooms;
  draw();
}

async function loadLearned(id: string, world: WorldConfig): Promise<void> {
  const s = await api<{ matrix: LearnedMatrix }>(`/api/subject/${encodeURIComponent(id)}`);
  if (learnerNow !== id) return;
  const sentences = learnedSentences(s.matrix, world.rayAngles, 8);
  const box = byId("learned");
  box.className = "";
  box.innerHTML = sentences.length
    ? `<ol class="sentences">${sentences.map((x) => `<li>${esc(x.text)} <span class="v ${x.value > 0 ? "good" : "bad"}">(${x.value > 0 ? "+" : ""}${num(x.value)})</span></li>`).join("")}</ol>
       <div class="explain" style="margin-top:10px">Sayı, bağlantının doğumdan bu yana değişimi (Git − Gitme). Bağlantı gücü 0 ile 2 arasında olabilir; ±2'ye yakın değerler, öğrenmenin o bağlantıyı sonuna kadar ittiğini gösterir. Yemek ışınlarından <b>kendi tarafına</b> dönme bağlantıları güçlenmediyse, beden yön öğrenmemiş demektir.</div>`
    : `<div class="callout">Bu denekte belirgin bir öğrenilmiş değişiklik yok.</div>`;
}

function statBox(label: string, termId: string, value: string, bar?: { v: number; color: string }, small = false): string {
  const b = bar ? `<div class="bar"><i style="width:${(100 * Math.max(0, Math.min(1, bar.v))).toFixed(1)}%;background:${bar.color}"></i></div>` : "";
  return `<div class="stat"><div class="k">${label}${tip(termId)}</div><div class="v${small ? " small" : ""}">${value}</div>${b}</div>`;
}

function renderStats(side: Side, f: Frame): void {
  const r = side.film!.result;
  const over = f.tick >= r.ticks;
  const state = over
    ? (r.doneCause ? `<span class="bad">${CAUSE_TR[r.doneCause]} (${num(r.ticks / TICKS_PER_SECOND, 0)}. sn)</span>` : `<span class="good">sona kadar yaşadı</span>`)
    : `<span class="good">yaşıyor</span>`;
  byId(side.statsId).innerHTML = [
    statBox("Yenen yemek", "yemek", String(f.meals)),
    statBox("Tokluk (enerji)", "aclik", num(f.energy), { v: f.energy, color: "var(--warn)" }),
    statBox("Dürtü şu an", "durtu", num(f.drive), { v: f.drive, color: "var(--bad)" }),
    statBox("Durum", "tik", state, undefined, true),
    statBox("Sağlık", "zarar", num(f.health), { v: f.health, color: "var(--good)" }),
    statBox("Yaşadığı süre", "tik", `${num(f.tick / TICKS_PER_SECOND, 0)} sn`, { v: f.tick / MAX_TICKS, color: "var(--accent)" }),
  ].join("");
}

function draw(): void {
  if (!meta) return;
  for (const s of sides) {
    if (!s.film) continue;
    const f = frameAt(s.film, tickNow);
    drawRoom(s.ctx, { config: meta.world, entities: s.film.scenes[f.scene]!, body: f }, f.rays, s.trail, 0);
    renderStats(s, f);
  }
  byId("clock").textContent = `tik ${tickNow} / ${MAX_TICKS} · ${num(tickNow / TICKS_PER_SECOND, 0)} / ${MAX_TICKS / TICKS_PER_SECOND} sn`;
  byId("roomTitle").textContent = `— oda ${roomNow} / ${meta.rooms} (deneyde ölçülen odalar)`;
}

/** Moves playback one tick on (trails follow); the room ends when both bodies' films are over. */
function advance(): void {
  if (tickNow >= roomLength()) return;
  tickNow++;
  for (const s of sides) {
    if (!s.film || tickNow >= s.film.frames.length) continue;
    const f = s.film.frames[tickNow]!;
    s.trail.push({ x: f.x, y: f.y });
    if (s.trail.length > TRAIL) s.trail.shift();
  }
  if (tickNow >= roomLength()) roomOver();
}

function roomOver(): void {
  setRunning(false);
  const [l, t] = sides.map((s) => s.film!) as [Film, Film];
  if (played.some((p) => p.room === roomNow)) return;
  played.push({ room: roomNow, l, t });
  renderScore();
  const life = (r: EpisodeResult) => (r.doneCause ? `${CAUSE_TR[r.doneCause]}, ${num(r.ticks / TICKS_PER_SECOND, 0)}. saniyede` : "sona kadar yaşadı");
  // Who lived better is decided by the experiment's own primary measure: mean drive over the room.
  const d = t.result.meanDrive - l.result.meanDrive;
  const winner = Math.abs(d) < 0.005 ? "Berabere (ortalama dürtüleri aynı)."
    : d > 0 ? `<b class="good">Öğrenen daha iyi yaşadı</b> (ortalama dürtü ${num(l.result.meanDrive)}, ikizinin ${num(t.result.meanDrive)}).`
    : `<b class="bad">İkizi daha iyi yaşadı</b> (ortalama dürtü ${num(t.result.meanDrive)}, öğrenenin ${num(l.result.meanDrive)}).`;
  const check = l.matches === null || t.matches === null ? "Bu oda deneyde ölçülmemişti; karşılaştıracak kayıt yok."
    : l.matches && t.matches ? "✓ İkisi de deneyde kaydedilenle birebir aynı (yemek, süre ve dünyanın son hali eşleşti): izlediğin, ölçülenin kendisi."
    : "✗ Deney kaydıyla eşleşmedi — bu bir hata; lütfen bildir.";
  const box = byId("result");
  box.className = `callout result ${l.matches === false || t.matches === false ? "bad" : "good"}`;
  const next = meta && roomNow < meta.rooms ? " Devam etmek için <b>Sonraki oda →</b>." : " Ölçülen odaların hepsi bitti.";
  box.innerHTML = `<b>Oda ${roomNow} bitti.</b> Öğrenen ${l.result.foodEaten} yemek yedi (${life(l.result)}); ikizi ${t.result.foodEaten} yemek yedi (${life(t.result)}). ${winner}${next}<br><span style="font-size:13px">${check}</span>`;
}

function renderScore(): void {
  const table = byId("score");
  if (!played.length) {
    table.innerHTML = `<tr><td class="dim">Henüz biten oda yok. ▶ Başlat'a bas ya da "Odayı bitir" ile sonucu hemen gör.</td></tr>`;
    return;
  }
  type Played = (typeof played)[number];
  const mark = (p: Played) => (p.l.matches === null || p.t.matches === null ? `<span class="dim">kayıt yok</span>` : p.l.matches && p.t.matches ? `<span class="good">✓ aynı</span>` : `<span class="bad">✗ farklı</span>`);
  const life = (r: EpisodeResult) => (r.doneCause ? `<span class="bad">${CAUSE_TR[r.doneCause]}</span>` : `<span class="good">yaşadı</span>`);
  const sum = (f: (p: Played) => number) => played.reduce((s, p) => s + f(p), 0);
  const drv = (l: number, t: number) => `<span class="${l < t - 0.005 ? "good" : l > t + 0.005 ? "bad" : ""}">${num(l)}</span>`;
  const rowsHtml = played.map((p) => `<tr><td>${p.room}</td><td class="num">${drv(p.l.result.meanDrive, p.t.result.meanDrive)}</td><td class="num">${num(p.t.result.meanDrive)}</td><td class="num">${p.l.result.foodEaten}</td><td class="num">${p.t.result.foodEaten}</td><td>${life(p.l.result)}</td><td>${life(p.t.result)}</td><td>${mark(p)}</td></tr>`).join("");
  const alive = (f: (p: Played) => EpisodeResult) => `${played.filter((p) => !f(p).doneCause).length}/${played.length} yaşadı`;
  table.innerHTML = `<thead><tr><th>oda</th><th class="num">öğrenen dürtü${tip("durtu")}</th><th class="num">ikiz dürtü</th><th class="num">öğrenen yemek</th><th class="num">ikiz yemek</th><th>öğrenen</th><th>ikiz</th><th>deney kaydıyla</th></tr></thead><tbody>
    ${rowsHtml}
    <tr><td><b>ortalama / toplam</b></td><td class="num"><b>${num(sum((p) => p.l.result.meanDrive) / played.length)}</b></td><td class="num"><b>${num(sum((p) => p.t.result.meanDrive) / played.length)}</b></td><td class="num"><b>${sum((p) => p.l.result.foodEaten)}</b></td><td class="num"><b>${sum((p) => p.t.result.foodEaten)}</b></td><td>${alive((p) => p.l.result)}</td><td>${alive((p) => p.t.result)}</td><td></td></tr>
  </tbody>`;
}

function setRunning(on: boolean): void {
  running = on && !loadingRoom && sides.some((s) => s.film) && tickNow < roomLength();
  byId("play").textContent = running ? "⏸ Duraklat" : "▶ Başlat";
}

function finishRoom(): void {
  while (tickNow < roomLength()) advance();
  draw();
}

function nextRoom(): void {
  if (!meta || roomNow >= meta.rooms) return;
  if (tickNow < roomLength()) finishRoom(); // the result of the room being left is still recorded
  enterRoom(roomNow + 1).then(() => setRunning(true)).catch(showError);
}

function frame(now: number, prev: number): void {
  if (running) {
    owed += (Math.min(100, now - prev) / 1000) * TICKS_PER_SECOND * speed;
    while (owed >= 1 && running) { advance(); owed--; }
    draw();
  } else owed = 0;
  requestAnimationFrame((t) => frame(t, now));
}

function renderSpeeds(): void {
  byId("speeds").innerHTML = SPEEDS.map((s) => `<button data-speed="${s}" class="${s === speed ? "on" : ""}">${s}×</button>`).join(" ");
  byId("speeds").querySelectorAll<HTMLElement>("button").forEach((b) => b.addEventListener("click", () => { speed = Number(b.dataset.speed); renderSpeeds(); }));
}

// --- start ------------------------------------------------------------------------------------------------

async function start(): Promise<void> {
  byId("tabs").innerHTML = tabs("deney-odasi.html");
  document.querySelectorAll<HTMLElement>("[data-tip]").forEach((e) => { e.outerHTML = tip(e.dataset.tip!); });
  renderSpeeds();
  renderScore();
  byId("play").addEventListener("click", () => setRunning(!running));
  byId("finish").addEventListener("click", finishRoom);
  byId("next").addEventListener("click", nextRoom);
  // A finished room: the play button moves on to the next one.
  byId("play").addEventListener("click", () => { if (!running && tickNow >= roomLength() && roomNow > 0) nextRoom(); });
  requestAnimationFrame((t) => frame(t, t));

  const results = await api<{ groups: GroupSummary[]; rows: ResultRow[] }>("/api/results");
  groups = results.groups;
  rows = results.rows;
  renderConditions();
  // ?denek=DNK-… (from the results page) opens that learner's condition and the learner itself.
  const asked = new URLSearchParams(location.search).get("denek");
  const askedRow = asked ? rows.find((r) => r.learner === asked) : undefined;
  const first = askedRow ? groups.find((g) => g.key === groupKey(askedRow)) : defaultGroup();
  if (first) selectGroup(first.key, askedRow?.learner);
}

start().catch(showError);
