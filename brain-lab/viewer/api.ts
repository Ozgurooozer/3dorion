// brain-lab/viewer/api.ts — a read-only data API for the experiment dashboard, as a Vite dev-server plugin.
// It opens the registry read-only, so the dashboard can stay open while experiments run.
//   GET /api/results            grouped summaries + the standard rows of data/results.jsonl
//   GET /api/falsify            codes that have a falsification summary
//   GET /api/falsify/<code>     that summary (controls, lesions, rooms)
//   GET /api/subject/<DNK-id>   identity, learned matrix, critic food values, training curve
// Every answer is JSON; an error is { error } with status 404 (unknown) or 500 (could not read).
"use strict";

import { existsSync, readFileSync, readdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { Plugin } from "vite";
import { RegistryStore } from "../registry/store.ts";
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

/** The request handler, on its own so it can be tested without a server. */
export function createHandler(dataRoot: string): Handler {
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
