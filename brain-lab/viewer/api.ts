// brain-lab/viewer/api.ts — a read-only data API for the experiment dashboard, as a Vite dev-server plugin.
// It opens the registry read-only, so the dashboard can stay open while experiments run.
//   GET /api/results            grouped summaries + the standard rows of data/results.jsonl
//   GET /api/falsify            codes that have a falsification summary
//   GET /api/falsify/<code>     that summary (controls, lesions, rooms)
//   GET /api/subject/<DNK-id>   identity, learned matrix, critic food values, training curve
//   GET /api/arena/<DNK-id>           which learner, which twin, which condition, how many measured rooms
//   GET /api/arena/<DNK-id>/room/<n>  room n lived by the learner and its twin, filmed tick by tick (arena.ts)
// Every answer is JSON; an error is { error } with status 404 (unknown) or 500 (could not read).
"use strict";

import { existsSync, readFileSync, readdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { Plugin } from "vite";
import { RegistryStore } from "../registry/store.ts";
import { CONDITIONS } from "../experiments/conditions.ts";
import { Contestant, filmRoom, type BrainRecord, type Film, type RecordedEpisode } from "./arena.ts";
import type { WorldConfig } from "../world/index.ts";
import { learnedMatrix, learningCurve, standardRows, summarize, type ResultRow } from "./dashboard-data.ts";

type Next = () => void;
export type Handler = (req: IncomingMessage, res: ServerResponse, next: Next) => void;

const FALSIFY_FILE = /^falsify-([A-Za-z0-9]+)-summary\.json$/;

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readResults(dataRoot: string): ResultRow[] {
  const p = join(dataRoot, "results.jsonl");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").split("\n").filter((l) => l.trim() !== "").map((l) => JSON.parse(l) as ResultRow);
}

function subjectView(dataRoot: string, id: string) {
  const store = new RegistryStore(dataRoot, { readOnly: true });
  const subject = store.loadSubject(id);
  const ledger = store.openLedger(id);
  const training = store.listRuns(id).find((r) => r.header.purpose.endsWith(" train"));
  return {
    subject,
    matrix: learnedMatrix(ledger.birthGraph, ledger.graph),
    criticFood: subject.birth.worldConfig.rayAngles.map((_, i) => ledger.criticWeight(`ray${i}.food`)),
    curve: training ? learningCurve(training.episodes) : [],
    ledgerEntries: ledger.entries.length,
  };
}

/** A subject's brain now, its critic, and its latest evaluation run, as the arena rebuilds them. */
function brainRecord(store: RegistryStore, id: string, spec: BrainRecord["spec"]): BrainRecord {
  const subject = store.loadSubject(id);
  const ledger = store.openLedger(id);
  const features = new Set(ledger.entries.flatMap((e) => (e.kind === "critic" ? [e.feature] : [])));
  const critic = Object.fromEntries([...features].map((f) => [f, ledger.criticWeight(f)]));
  const evalRun = store.listRuns(id).filter((r) => r.header.purpose.endsWith("eval (learning frozen)")).at(-1);
  const recorded: RecordedEpisode[] = (evalRun?.episodes ?? []).map((e) => ({
    episode: e.episode, worldSeed: e.worldSeed, foodEaten: e.summary.foodEaten, ticks: e.summary.ticks,
    doneCause: e.summary.doneCause, finalHash: e.summary.finalHash,
  }));
  return { id, name: subject.name, graph: ledger.graph, critic, spec, recorded };
}

export interface ArenaMeta {
  readonly code: string;
  readonly command: string;
  readonly control: string;
  readonly what: string;
  readonly seed: number;
  readonly group: string;
  readonly world: WorldConfig;
  readonly trainEpisodes: number;
  /** Evaluation rooms the experiment measured (the rooms the arena can show). */
  readonly rooms: number;
  readonly learner: { readonly id: string; readonly name: string };
  readonly twin: { readonly id: string; readonly name: string };
}

/** A learner's experiment and both frozen brains, or null when the subject has no experiment result. */
export function loadArena(dataRoot: string, learnerId: string): { meta: ArenaMeta; learner: BrainRecord; twin: BrainRecord } | null {
  if (!existsSync(join(dataRoot, "subjects", learnerId))) return null;
  const row = readResults(dataRoot).filter((r) => r.learner === learnerId).at(-1);
  if (!row) return null;
  const store = new RegistryStore(dataRoot, { readOnly: true });
  const subject = store.loadSubject(learnerId);
  const training = store.listRuns(learnerId).find((r) => r.header.purpose.endsWith(" train"));
  const spec = (training?.header.meta.spec ?? {}) as { selection?: object | null; critic?: object | null };
  const selection = spec.selection ?? null;
  // Evaluated as in experiments/harness.ts runCondition: the learner with its critic, the twin without.
  const learner = brainRecord(store, learnerId, { selection, critic: spec.critic ?? null });
  const twin = brainRecord(store, row.twin, { selection, critic: null });
  return {
    meta: {
      code: row.code, command: row.command, control: row.control, what: CONDITIONS[row.code]?.what ?? "",
      seed: subject.birth.seed, group: subject.group, world: subject.birth.worldConfig,
      trainEpisodes: training?.episodes.length ?? 0, rooms: Math.min(learner.recorded.length, twin.recorded.length),
      learner: { id: learner.id, name: learner.name }, twin: { id: twin.id, name: twin.name },
    },
    learner, twin,
  };
}

/** A learner and its twin living their rooms on the server, with every room filmed so far. */
interface ArenaSession {
  readonly meta: ArenaMeta;
  readonly learner: Contestant;
  readonly twin: Contestant;
  readonly films: { readonly learner: Film; readonly twin: Film }[];
}

/** Sessions kept in memory (a filmed room is ~1–2 MB); the oldest is dropped beyond this. */
const MAX_SESSIONS = 3;

function arenaSessions(dataRoot: string) {
  const sessions = new Map<string, ArenaSession>();
  const open = (id: string): ArenaSession | null => {
    const found = sessions.get(id);
    if (found) return found;
    const a = loadArena(dataRoot, id);
    if (!a) return null;
    const s: ArenaSession = {
      meta: a.meta, films: [],
      learner: new Contestant(a.learner, a.meta.world, a.meta.seed), twin: new Contestant(a.twin, a.meta.world, a.meta.seed),
    };
    sessions.set(id, s);
    if (sessions.size > MAX_SESSIONS) sessions.delete(sessions.keys().next().value!);
    return s;
  };
  /** Room n (1-based), living the rooms before it first, as the measurement did. */
  const room = (s: ArenaSession, n: number) => {
    while (s.films.length < n) {
      if (s.films.length) { s.learner.nextRoom(); s.twin.nextRoom(); }
      s.films.push({ learner: filmRoom(s.learner), twin: filmRoom(s.twin) });
    }
    return s.films[n - 1]!;
  };
  return { open, room };
}

/** The request handler, on its own so it can be tested without a server. */
export function createHandler(dataRoot: string): Handler {
  const arena = arenaSessions(dataRoot);
  return (req, res, next) => {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    if (!pathname.startsWith("/api/")) return next();
    try {
      if (pathname === "/api/results") {
        const all = readResults(dataRoot);
        return send(res, 200, { groups: summarize(all), rows: standardRows(all) });
      }
      if (pathname === "/api/falsify") {
        const codes = readdirSync(dataRoot).flatMap((f) => FALSIFY_FILE.exec(f)?.[1] ?? []);
        return send(res, 200, codes);
      }
      const falsify = /^\/api\/falsify\/([A-Za-z0-9]+)$/.exec(pathname);
      if (falsify) {
        const p = join(dataRoot, `falsify-${falsify[1]}-summary.json`);
        return existsSync(p) ? send(res, 200, JSON.parse(readFileSync(p, "utf8"))) : send(res, 404, { error: `no falsification summary for ${falsify[1]}` });
      }
      const subject = /^\/api\/subject\/(DNK-\d+)$/.exec(pathname);
      if (subject) {
        if (!existsSync(join(dataRoot, "subjects", subject[1]!))) return send(res, 404, { error: `no subject ${subject[1]}` });
        return send(res, 200, subjectView(dataRoot, subject[1]!));
      }
      const arenaPath = /^\/api\/arena\/(DNK-\d+)(?:\/room\/(\d+))?$/.exec(pathname);
      if (arenaPath) {
        const s = arena.open(arenaPath[1]!);
        if (!s) return send(res, 404, { error: `no experiment result for ${arenaPath[1]}` });
        if (arenaPath[2] === undefined) return send(res, 200, s.meta);
        const n = Number(arenaPath[2]);
        if (n < 1 || n > s.meta.rooms) return send(res, 404, { error: `room ${n}: the experiment measured rooms 1–${s.meta.rooms}` });
        return send(res, 200, arena.room(s, n));
      }
      return send(res, 404, { error: `unknown endpoint ${pathname}` });
    } catch (e) {
      return send(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
  };
}

export function labApi(dataRoot: string): Plugin {
  return {
    name: "brain-lab-api",
    configureServer(server) {
      server.middlewares.use(createHandler(dataRoot));
    },
  };
}
