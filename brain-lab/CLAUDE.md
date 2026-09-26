# brain-lab — guidance for Claude

A research lab for a decision mechanism that learns, built as a brain map. It is
independent of 3dorion's production code (`bridge/`, `mind/`, `world/` at the repo root):
nothing here is wired into Orion.

Purpose (Ozyn, 2026-09-22): "Basit kararlar veren, kendi ekosistemine sahip, dinamik ve
dinamik olmayan değişkenlerle çevrelenmiş bir karar mekanizması kurmak ve geliştirmek."

## This is science, done the human way

Observation → hypothesis → pre-registration (criteria frozen before running) → experiment
→ honest report, negative results included → dated entry in `LAB-DEFTERI.md`. Subjects are
numbered and named with lineage; every learning event is recorded; anyone must be able to
reproduce a result from the records alone. Never tune on test seeds. Never claim more
than was measured.

## Method and helpers

- **Themis** (`.claude/skills/themis/SKILL.md`, repo root) — the lab's working method: calibrate measures,
  diagnose before treating, predict before running, screen → confirm with CROSS, honest scorecard, test
  rules. Load it for any brain-lab work.
- **Atlas** (`.claude/agents/atlas.md`) — the delegated experiment carrier: runs batches end to end,
  diagnoses, writes the notebook entry, reports in Turkish. It never makes design decisions.

## Direction — do not invent new architectures

Follow the existing line: v0.1 (single-path graph, `archive/`) → v0.2 Brain IR substrate
(`brain-ir/ir.ts`, `simulator.ts`) → v0.3 Alice/Bob decision layer (`brain-ir/v03.ts`,
`deliberative.ts`). Build order is `ORION-BRAIN-IR-CONTEXT.md` §6: world → observation→input
→ output→action → outcome → prediction → dopamine → trace/OLY → plasticity (last). Jev is an
external observer (`JEV-AI-OBSERVER-INTEGRATION-PLAN.md`), never inside the decision path.

**Behavior is never hand-coded.** The brain learns to use the body. Hand-wired arcs exist
only as clearly labeled test fixtures.

## Map

| folder | what | may import |
|---|---|---|
| `world/` | headless deterministic one-room physics; `World` contract in `world.ts` | only itself |
| `sensorimotor/` | senses → sensor nodes, motor spikes → thrust/turn, scaffold, controller | `world`, `brain-ir` |
| `neuromodulation/` | dopamine = outcome − prediction, from the body's own senses | `world` (types) |
| `regions/` | region of every node + the pathway table; anything not in the table is refused; only senses → Go/NoGo learn | `brain-ir` (types) |
| `development/` | regional newborn brain (`INNATE` weights with reasons, born hungry via `initialEnergy`) and generator noise | `world`, `sensorimotor`, `regions`, `brain-ir` |
| `memory/` | the memory core (TASARIM-007 §4: working memory, every entry stamped with tick, source and confidence, retrieval threshold, reset per room, never on the ledger) and its modules: H1 pose by path integration (`pose.ts`) | `world` (public types) only |
| `learning/` | three-factor rule in quanta, every change on the ledger; `createAgent` = one living subject | all of the above, `registry`, `neuromodulation` |
| `registry/` | subjects (DNK-0001 «Kıvılcım»), learning ledger (LRN-…), runs (RUN-…), world events (EVT-…); disk store in `store.ts` only, data under `brain-lab/data/` (git-ignored) | `world`, `brain-ir` (types) |
| `viewer/` | `npm run lab` (port 5190): Deney Odası (a learner and its twin replaying the measured rooms, filmed on the server), Sonuçlar (verdicts, falsification, what a subject learned), Rehber (every term explained, `guide.ts`), room + brain map | all of the above |
| `brain-ir/` | v0.2 substrate + v0.3 Alice/Bob (older, Turkish identifiers) | itself |
| `archive/` | frozen old prototypes, excluded from typecheck | — |

Dependency direction is enforced by tests (import guards). Nothing below imports the viewer.
`body-simulator.html` is a stale, disconnected prototype — do not extend it.

## Rules that are easy to break

- Language: conversation and vault pages Turkish; code, comments, commits English.
- Determinism: all randomness through `world/rng.ts`; same seed → bit-identical world hash.
- Tests first and adversarial; then a mutation pass (break the code on purpose, every
  mutant must be caught). `npm run typecheck` 0 errors and `npm test` green before commit.
- The viewer must run the real code, never a re-implementation (guard test in `viewer/`).
- Known shortcut (§16 of the knowledge pool): rays report labeled kinds, so the brain is
  told what a threat is. Target: neutral senses, danger discovered from innate pain
  (`intero.injury`). Do not deepen this shortcut.
- Brain design: `TASARIM-BOLGELI-BEYIN.md`. Nature gives the structure (regions, pathways), experience
  gives the weights. Never add a pathway "to reach a goal".
- Every change to a subject's brain goes through its `Ledger` (`registry/ledger.ts`). Birth
  graph + ledger must replay to the live brain; a change made any other way breaks the chain.
- Plan first, then code, one approved step at a time.
