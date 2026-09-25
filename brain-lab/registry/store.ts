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

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmdirSync, statSync, writeFileSync } from "node:fs";
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

/** Lock directory that serialises every read-modify-write of registry.json. */
export const INDEX_LOCK = ".index.lock";

/** Synchronous sleep (no event loop needed): the registry API is synchronous. */
const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export interface StoreOptions {
  /**
   * Read-only: every write refused. For diagnosis and inspection while experiments are running.
   * Default false.
   */
  readonly readOnly?: boolean;
  /** How long to wait for the index lock before giving up (ms). Default 30 000. */
  readonly lockTimeoutMs?: number;
  /** A lock older than this is taken to be left by a crashed process and removed (ms). Default 10 000. */
  readonly staleLockMs?: number;
}

export class RegistryStore {
  readonly root: string;
  readonly readOnly: boolean;
  private readonly lockTimeoutMs: number;
  private readonly staleLockMs: number;

  /**
   * Many processes may write to one registry at once (parallel experiments): subject folders and run
   * files are unique per number, and every change to registry.json — handing out a subject or run
   * number, recording a stage — happens under INDEX_LOCK, a directory created atomically. Two writers
   * can therefore never get the same number (tested with concurrent processes). The index is written
   * to a temporary file and renamed, so a reader never sees half a file.
   */
  constructor(root: string, opts: StoreOptions = {}) {
    this.root = root;
    this.readOnly = opts.readOnly ?? false;
    this.lockTimeoutMs = opts.lockTimeoutMs ?? 30_000;
    this.staleLockMs = opts.staleLockMs ?? 10_000;
    if (this.readOnly) {
      if (!existsSync(this.indexPath)) throw new Error(`no registry at ${root}`);
      return;
    }
    mkdirSync(join(root, "subjects"), { recursive: true });
    mkdirSync(join(root, "runs"), { recursive: true });
    this.withIndex((idx) => idx); // creates the index on first use
  }

  /** Runs `change` on the index under the lock, writes back what it returns, then returns `result`. */
  private withIndex<T>(change: (idx: RegistryIndex) => RegistryIndex, result?: () => T): T {
    const lock = join(this.root, INDEX_LOCK);
    const started = Date.now();
    for (;;) {
      try { mkdirSync(lock); break; } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        try { if (Date.now() - statSync(lock).mtimeMs > this.staleLockMs) { rmdirSync(lock); continue; } } catch { continue; }
        if (Date.now() - started > this.lockTimeoutMs) throw new Error(`registry ${this.root} is busy: index lock held for more than ${this.lockTimeoutMs} ms`);
        sleep(5);
      }
    }
    try {
      const before: RegistryIndex = existsSync(this.indexPath) ? this.index() : { version: 1, nextSubject: 1, nextRun: 1, subjects: [] };
      const after = change(before);
      const tmp = `${this.indexPath}.${process.pid}.tmp`;
      writeJson(tmp, after);
      for (let i = 0; ; i++) {
        try { renameSync(tmp, this.indexPath); break; } catch (e) {
          if (i > 50 || (e as NodeJS.ErrnoException).code !== "EPERM") throw e; // a reader holds the file for a moment (Windows)
          sleep(5);
        }
      }
      return result ? result() : (undefined as T);
    } finally {
      rmdirSync(lock);
    }
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
    const lineage = input.lineage ?? { parent: null, how: "birth" as const };
    let subject: Subject | null = null;
    this.withIndex((idx) => {
      const n = idx.nextSubject;
      if (lineage.parent !== null && !idx.subjects.some((s) => s.id === lineage.parent)) {
        throw new Error(`parent ${lineage.parent} is not in the registry`);
      }
      const made: Subject = {
        id: subjectId(n),
        name: nameFor(n),
        category: input.category,
        group: input.group,
        lineage,
        birth: {
          seed: input.seed,
          date: input.date ?? today(),
          worldConfig: input.worldConfig,
          graphHash: graphHash(input.birthGraph),
          codeCommit: input.codeCommit ?? null,
        },
        stage: "E0",
      };
      const d = this.dir(made.id);
      if (existsSync(d)) throw new Error(`${made.id} already exists on disk; registry index is out of sync`);
      mkdirSync(d);
      writeJson(join(d, "subject.json"), made);
      writeJson(join(d, "birth-graph.json"), canonicalGraph(input.birthGraph));
      writeFileSync(join(d, "ledger.jsonl"), "");
      subject = made;
      return { ...idx, nextSubject: n + 1, subjects: [...idx.subjects, { id: made.id, name: made.name, category: made.category, group: made.group, stage: "E0" }] };
    });
    return subject!;
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
      this.withIndex((idx) => ({ ...idx, subjects: idx.subjects.map((r) => (r.id === s.id ? { ...r, stage: ledger.stage } : r)) }));
    }
    return fresh.length;
  }

  startRun(subject: string, purpose: string, meta: Record<string, unknown> = {}, opts: { date?: string; codeCommit?: string | null } = {}): RunHeader {
    this.writable();
    this.loadSubject(subject);
    let header: RunHeader | null = null;
    this.withIndex((idx) => {
      const made: RunHeader = { kind: "run", id: runId(idx.nextRun), subject, purpose, date: opts.date ?? today(), codeCommit: opts.codeCommit ?? null, meta };
      writeFileSync(join(this.root, "runs", `${made.id}.jsonl`), JSON.stringify(made) + "\n", { flag: "wx" });
      header = made;
      return { ...idx, nextRun: idx.nextRun + 1 };
    });
    return header!;
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
