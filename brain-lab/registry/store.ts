// brain-lab/registry/store.ts — the registry on disk (Node only; the rest of registry/ is pure).
//
//   <root>/registry.json                    index + next numbers (numbers are never reused)
//   <root>/subjects/DNK-0007/subject.json   identity
//   <root>/subjects/DNK-0007/birth-graph.json
//   <root>/subjects/DNK-0007/ledger.jsonl   learning events, append-only
//   <root>/runs/RUN-000045.jsonl            header line, then one line per episode
//
// Default root is brain-lab/data/, which git ignores (Ozyn, 2026-09-23).
"use strict";

import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BrainGrafi } from "../brain-ir/ir.ts";
import type { EpisodeSummary, WorldConfig } from "../world/index.ts";
import type { WorldEvent } from "./events.ts";
import { canonicalGraph, checkGraph, graphHash } from "./graph.ts";
import { runId, subjectId } from "./ids.ts";
import { Ledger, type LedgerEntry } from "./ledger.ts";
import { nameFor } from "./names.ts";
import type { Category, Group, Lineage, Stage, Subject } from "./subject.ts";

interface IndexRow { id: string; name: string; category: Category; group: Group; stage: Stage }
interface RegistryIndex { version: 1; nextSubject: number; nextRun: number; subjects: IndexRow[] }

export interface NewSubject {
  readonly category: Category;
  readonly group: Group;
  readonly seed: number;
  readonly worldConfig: WorldConfig;
  readonly birthGraph: BrainGrafi;
  readonly lineage?: Lineage;
  readonly date?: string;
  readonly codeCommit?: string | null;
}

export interface RunHeader {
  readonly kind: "run";
  readonly id: string;
  readonly subject: string;
  readonly purpose: string;
  readonly date: string;
  readonly codeCommit: string | null;
  readonly meta: Readonly<Record<string, unknown>>;
}

export interface EpisodeLine {
  readonly kind: "episode";
  readonly episode: number;
  readonly worldSeed: number;
  readonly summary: Omit<EpisodeSummary, "records">;
  readonly events: readonly WorldEvent[];
  readonly extra?: Readonly<Record<string, unknown>>;
}

const today = () => new Date().toISOString().slice(0, 10);
const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;
const writeJson = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
const readLines = <T>(p: string): T[] =>
  existsSync(p) ? readFileSync(p, "utf8").split("\n").filter((l) => l.trim() !== "").map((l) => JSON.parse(l) as T) : [];

/** Name of the writer lock file inside the registry root. */
export const WRITER_LOCK = ".writer.lock";

const alive = (pid: number): boolean => {
  try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === "EPERM"; }
};

export interface StoreOptions {
  /**
   * Read-only: no lock taken, every write refused. For diagnosis and inspection while an experiment
   * is running. Default false.
   */
  readonly readOnly?: boolean;
}

export class RegistryStore {
  readonly root: string;
  readonly readOnly: boolean;

  /**
   * A writer takes the registry's lock: two processes writing at once would race on registry.json
   * and hand out the same subject number (measured risk, 2026-09-24 — until then only a rule).
   * A lock left by a dead process is taken over; one held by a live process is refused.
   */
  constructor(root: string, opts: StoreOptions = {}) {
    this.root = root;
    this.readOnly = opts.readOnly ?? false;
    if (this.readOnly) {
      if (!existsSync(this.indexPath)) throw new Error(`no registry at ${root}`);
      return;
    }
    mkdirSync(join(root, "subjects"), { recursive: true });
    mkdirSync(join(root, "runs"), { recursive: true });
    this.lock();
    if (!existsSync(this.indexPath)) writeJson(this.indexPath, { version: 1, nextSubject: 1, nextRun: 1, subjects: [] } satisfies RegistryIndex);
  }

  private lock(): void {
    const p = join(this.root, WRITER_LOCK);
    const mine = JSON.stringify({ pid: process.pid, since: new Date().toISOString() }) + "\n";
    try {
      writeFileSync(p, mine, { flag: "wx" }); // exclusive: two starting processes cannot both create it
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      const holder = (JSON.parse(readFileSync(p, "utf8")) as { pid: number }).pid;
      if (holder === process.pid) return;
      if (alive(holder)) throw new Error(`registry ${this.root} is being written by process ${holder}; run experiments one at a time (or open it read-only)`);
      writeFileSync(p, mine); // the holder is dead: a stale lock, taken over
    }
    process.once("exit", () => {
      try { if ((JSON.parse(readFileSync(p, "utf8")) as { pid: number }).pid === process.pid) unlinkSync(p); } catch { /* already gone */ }
    });
  }

  private writable(): void {
    if (this.readOnly) throw new Error(`registry ${this.root} was opened read-only`);
  }

  private get indexPath() { return join(this.root, "registry.json"); }
  private dir(id: string) { return join(this.root, "subjects", id); }
  private index(): RegistryIndex { return readJson<RegistryIndex>(this.indexPath); }

  list(): readonly IndexRow[] {
    return this.index().subjects;
  }

  createSubject(input: NewSubject): Subject {
    this.writable();
    checkGraph(input.birthGraph);
    const idx = this.index();
    const n = idx.nextSubject;
    const subject: Subject = {
      id: subjectId(n),
      name: nameFor(n),
      category: input.category,
      group: input.group,
      lineage: input.lineage ?? { parent: null, how: "birth" },
      birth: {
        seed: input.seed,
        date: input.date ?? today(),
        worldConfig: input.worldConfig,
        graphHash: graphHash(input.birthGraph),
        codeCommit: input.codeCommit ?? null,
      },
      stage: "E0",
    };
    if (subject.lineage.parent !== null && !idx.subjects.some((s) => s.id === subject.lineage.parent)) {
      throw new Error(`parent ${subject.lineage.parent} is not in the registry`);
    }
    const d = this.dir(subject.id);
    if (existsSync(d)) throw new Error(`${subject.id} already exists on disk; registry index is out of sync`);
    mkdirSync(d);
    writeJson(join(d, "subject.json"), subject);
    writeJson(join(d, "birth-graph.json"), canonicalGraph(input.birthGraph));
    writeFileSync(join(d, "ledger.jsonl"), "");
    idx.nextSubject = n + 1;
    idx.subjects.push({ id: subject.id, name: subject.name, category: subject.category, group: subject.group, stage: "E0" });
    writeJson(this.indexPath, idx);
    return subject;
  }

  /** A new subject born with the parent's current brain; the parent is untouched. */
  clone(parentId: string, overrides: Partial<Pick<NewSubject, "category" | "group" | "seed" | "date" | "codeCommit">> = {}): Subject {
    const parent = this.loadSubject(parentId);
    return this.createSubject({
      category: overrides.category ?? parent.category,
      group: overrides.group ?? parent.group,
      seed: overrides.seed ?? parent.birth.seed,
      worldConfig: parent.birth.worldConfig,
      birthGraph: this.openLedger(parentId).graph,
      lineage: { parent: parentId, how: "clone" },
      date: overrides.date,
      codeCommit: overrides.codeCommit,
    });
  }

  loadSubject(id: string): Subject {
    const p = join(this.dir(id), "subject.json");
    if (!existsSync(p)) throw new Error(`no subject ${id}`);
    return readJson<Subject>(p);
  }

  /** Replays birth + ledger from disk; throws if the chain is broken or disagrees with subject.json. */
  openLedger(id: string): Ledger {
    const s = this.loadSubject(id);
    const birth = readJson<BrainGrafi>(join(this.dir(id), "birth-graph.json"));
    if (graphHash(birth) !== s.birth.graphHash) throw new Error(`${id}: birth graph does not match its recorded hash`);
    const ledger = new Ledger(id, birth, readLines<LedgerEntry>(join(this.dir(id), "ledger.jsonl")));
    if (ledger.stage !== s.stage) throw new Error(`${id}: subject.json says ${s.stage}, ledger says ${ledger.stage}`);
    return ledger;
  }

  /** Appends the ledger's entries that are not on disk yet, and updates the stage. */
  saveLedger(ledger: Ledger): number {
    this.writable();
    const p = join(this.dir(ledger.subjectId), "ledger.jsonl");
    const disk = readLines<LedgerEntry>(p);
    const onDisk = disk.length;
    if (onDisk > ledger.entries.length) throw new Error(`${ledger.subjectId}: disk has more entries than this ledger; refusing to overwrite`);
    // Same length is not enough: a stale copy that learned differently must not pass as "already saved".
    disk.forEach((e, i) => {
      if (JSON.stringify(e) !== JSON.stringify(ledger.entries[i])) throw new Error(`${ledger.subjectId}: history diverges from disk at ${e.id}`);
    });
    const fresh = ledger.entries.slice(onDisk);
    if (fresh.length > 0) appendFileSync(p, fresh.map((e) => JSON.stringify(e)).join("\n") + "\n");
    const s = this.loadSubject(ledger.subjectId);
    if (s.stage !== ledger.stage) {
      writeJson(join(this.dir(s.id), "subject.json"), { ...s, stage: ledger.stage });
      const idx = this.index();
      const row = idx.subjects.find((r) => r.id === s.id)!;
      row.stage = ledger.stage;
      writeJson(this.indexPath, idx);
    }
    return fresh.length;
  }

  startRun(subject: string, purpose: string, meta: Record<string, unknown> = {}, opts: { date?: string; codeCommit?: string | null } = {}): RunHeader {
    this.writable();
    this.loadSubject(subject);
    const idx = this.index();
    const header: RunHeader = {
      kind: "run",
      id: runId(idx.nextRun),
      subject,
      purpose,
      date: opts.date ?? today(),
      codeCommit: opts.codeCommit ?? null,
      meta,
    };
    idx.nextRun += 1;
    writeJson(this.indexPath, idx);
    writeFileSync(join(this.root, "runs", `${header.id}.jsonl`), JSON.stringify(header) + "\n");
    return header;
  }

  appendEpisode(run: string, line: Omit<EpisodeLine, "kind">): void {
    this.writable();
    const p = join(this.root, "runs", `${run}.jsonl`);
    if (!existsSync(p)) throw new Error(`no run ${run}`);
    appendFileSync(p, JSON.stringify({ kind: "episode", ...line }) + "\n");
  }

  readRun(run: string): { header: RunHeader; episodes: EpisodeLine[] } {
    const [header, ...rest] = readLines<RunHeader | EpisodeLine>(join(this.root, "runs", `${run}.jsonl`));
    if (!header || header.kind !== "run") throw new Error(`${run} has no header`);
    return { header, episodes: rest as EpisodeLine[] };
  }
}
