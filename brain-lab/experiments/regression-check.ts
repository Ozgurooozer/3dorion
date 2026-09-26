// brain-lab/experiments/regression-check.ts — does today's code still grow the same brains? (Themis §1.4)
// Takes recorded learners of a condition, lets the same subjects be born again in a temporary registry
// (same seed, group, room, spec), trains and evaluates them with the current code, and compares with the
// record exactly: every number of the results row (learner, twin and yoked evaluations, entry counts, the
// training curve) and every ledger entry, in order and value. Any difference stops the script with the
// subject and the numbers. Leaves no records.
//
// --hafiza (2026-09-26, falsification of A2 "the memory does not act"): the subjects are trained with the
// growing memory switched on (spec.memory = {}). Growth entries (node+, memory, node-) are then left out of
// the ledger comparison; everything else must still equal the record. The trained brain is also evaluated a
// second time with the memory on, which must equal the recorded evaluation too, and the saved ledger (growth
// included) must replay from birth. train() itself refuses a live brain that differs from its ledger.
//
//   node --experimental-strip-types brain-lab/experiments/regression-check.ts K1n 2
//   node --experimental-strip-types brain-lab/experiments/regression-check.ts K1n 10 --hafiza
"use strict";

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import type { InnateGroup } from "../development/index.ts";
import type { LedgerEntry } from "../registry/index.ts";
import { RegistryStore } from "../registry/store.ts";
import { ROOM1, condition } from "./conditions.ts";
import { evaluate, runCondition, type Eval } from "./harness.ts";

/** Ledger entries that are growth (TASARIM-008): memory neurons born, changed, dying. */
export const GROWTH_KINDS: ReadonlySet<string> = new Set<LedgerEntry["kind"]>(["node+", "memory", "node-"]);

/**
 * The first difference between a recorded ledger and a new one, or null if they agree: entry by entry, in order,
 * every field but the entry id (ids shift when skipped entries sit in between), entries of the `skip` kinds left
 * out on both sides.
 */
export function ledgerDifference(recorded: readonly LedgerEntry[], now: readonly LedgerEntry[], skip: ReadonlySet<string> = new Set()): string | null {
  const kept = (es: readonly LedgerEntry[]) => es.filter((e) => !skip.has(e.kind)).map(({ id: _id, ...rest }) => rest);
  const a = kept(recorded);
  const b = kept(now);
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (!isDeepStrictEqual(a[i], b[i])) return `entry ${i + 1} (counting kept entries): now ${JSON.stringify(b[i])} vs recorded ${JSON.stringify(a[i])}`;
  }
  return a.length === b.length ? null : `now ${b.length} kept entries vs recorded ${a.length}`;
}

/**
 * The fields of a recorded object that a new one does not reproduce exactly (deep, after a JSON round trip of the
 * new one, as the record went through JSON). Only the recorded fields are compared: a record older than a measure
 * does not carry it.
 */
export function fieldDifferences(recorded: object, now: object): string[] {
  const a = recorded as Record<string, unknown>;
  const b = JSON.parse(JSON.stringify(now)) as Record<string, unknown>;
  return Object.keys(a).filter((k) => !isDeepStrictEqual(a[k], b[k])).map((k) => `${k} ${JSON.stringify(b[k])} vs recorded ${JSON.stringify(a[k])}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const DATA = join(HERE, "../data");
  const args = process.argv.slice(2);
  const withMemory = args.includes("--hafiza");
  const [code = "K1n", countArg = "2"] = args.filter((a) => !a.startsWith("--"));

  interface Recorded {
    code: string; command: string; control: string; seed: number; group: InnateGroup; learner: string; trainEpisodes?: number; evalEpisodes?: number;
    l: Eval; t: Eval; y: Eval | null; weightEntries: number; criticEntries: number; trainPerK: number[];
  }
  const recorded = readFileSync(join(DATA, "results.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Recorded)
    .filter((r) => r.code === code && r.command === "tara" && r.control === "none" && (r.trainEpisodes ?? 40) === 40 && (r.evalEpisodes ?? 10) === 10)
    .slice(0, Number(countArg));
  if (!recorded.length) throw new Error(`no recorded standard runs of ${code}`);

  const def = condition(code);
  const world = def.world ?? ROOM1;
  const baseSpec = def.spec(world);
  const spec = withMemory ? { ...baseSpec, memory: {} } : baseSpec;
  const records = new RegistryStore(DATA, { readOnly: true });
  const root = mkdtempSync(join(tmpdir(), "brainlab-regression-"));
  let failures = 0;
  try {
    const store = new RegistryStore(root);
    for (const r of recorded) {
      const [row] = runCondition(store, {
        condition: { code, what: def.what, spec }, world, seeds: [r.seed], groups: [r.group],
        trainEpisodes: 40, evalEpisodes: 10, codeCommit: "regression", label: "regression", born: def.born,
      }).rows;
      const pick = (x: Recorded | NonNullable<typeof row>) => ({ l: x.l, t: x.t, y: x.y, weightEntries: x.weightEntries, criticEntries: x.criticEntries, trainPerK: x.trainPerK });
      const bad = fieldDifferences(pick(r), pick(row!));
      // The saved ledger replays from birth (openLedger throws on a broken chain); compared with the record entry by entry.
      const fresh = store.openLedger(row!.learner.id);
      const ledgerBad = ledgerDifference(records.openLedger(r.learner).entries, fresh.entries, withMemory ? GROWTH_KINDS : new Set());
      if (ledgerBad) bad.push(`ledger: ${ledgerBad}`);
      let grown = "";
      if (withMemory) {
        const count = (k: string) => fresh.entries.filter((e) => e.kind === k).length;
        if (count("node+") === 0) bad.push("the memory grew nothing: is it switched on?");
        // A second evaluation of the trained brain, the memory on this time (it grows even when learning is frozen).
        const memoryEval = evaluate(store, store.loadSubject(row!.learner.id), world, 10, "regression", "regression memory",
          { critic: baseSpec.critic ?? null, selection: baseSpec.selection ?? null, memory: {} });
        bad.push(...fieldDifferences(r.l, memoryEval).map((d) => `evaluation with the memory on: ${d}`));
        grown = ` | growth in training: ${count("node+")} born, ${count("memory")} changed, ${count("node-")} died; ledger replays with it`;
      }
      console.log(`${code} seed ${r.seed} ${r.group} (${r.learner} → ${row!.learner.id}): ${bad.length ? "DIFFERENT " + bad.join("; ") : "identical to the record"}${grown}`);
      failures += bad.length ? 1 : 0;
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  if (failures) {
    console.error(`${failures} subject(s) differ from the record`);
    process.exit(1);
  }
  console.log(`done: ${recorded.length} subject(s) identical to the record${withMemory ? " (trained with the growing memory on)" : ""}`);
}
