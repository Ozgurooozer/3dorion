---
name: themis
description: "brain-lab bilim yöntemi (Themis — düzen ve adil ölçünün tanrıçası): ölçüyü kalibre et, teşhisten önce tedavi etme, öngörüyü koşmadan yaz, tarama → doğrulama, dürüst karne. Use for ANY work in 3dorion/brain-lab: designing or running an experiment, adding a measure, changing the brain, writing tests, interpreting results, or preparing a meeting. Also loaded by the Atlas agent."
---

# Themis — the brain-lab method

Themis holds the scales: every claim is weighed against a measurement that was itself checked first.
This skill is the working method of `3dorion/brain-lab`, distilled from what actually went wrong and
right (see `brain-lab/LAB-DEFTERI.md`, 2026-09-22 → 09-25). Follow it in order. When a step feels
like overhead, remember why it exists — each rule below was paid for with a wrong conclusion.

## 0. Before anything: know where the lab is

Read, in this order, and do not act before you have:

1. `brain-lab/CLAUDE.md` — purpose, folder map, dependency rules, hard principles.
2. `brain-lab/LAB-DEFTERI.md` — the **last three dated entries** and "Açık sorular".
3. The newest `brain-lab/TASARIM-*.md` (the design currently approved or awaiting approval).
4. The newest meeting in `C:\vault\forum\beyin0fis\toplantilar\` — its decisions (K1…) are binding until Ozyn changes them.

Then state in one line what question you are about to answer. If you cannot, stop and ask.

## 1. The cycle

```
question → calibrate the measure → diagnose → predict (in the notebook) → build (tests, mutants,
regression) → commit → screen (10 subjects) → diagnose again → confirm (20 + CROSS) → scorecard → meeting
```

### 1.1 Calibrate every measure before trusting it

A new or changed measure is checked on **at least three policies whose answer is known**, and the
expected values are fixed in tests:

- a floor (random / untrained learner),
- a habit that knows nothing (e.g. "forward + always left"),
- a ceiling (hand-coded).

Why: in one week three measures were wrong — the oracle was not the ceiling (a seeker scores 25.8 vs
12.4), "turn direction" and "approach" reward a one-sided habit in the closed loop (0.465 / 0.557 for a
food-blind body), and meals/1000 ticks punishes a homeostatic brain for resting when fed.

### 1.2 Diagnose before you treat

Before adding a module "because biology has it", run the cheap diagnostics:

- **Capacity fixture** — set the learning weights by hand (labelled fixture, never shipped): can this
  architecture express the behaviour at all? (Graph brain: steering 0.52 at w 2; selector: 0.79.)
- **What was learned** — read the ledger: which weights moved, and are they side-specific? (E7:
  food → own-side Go +0.57 vs other side +0.52 — "move when you see food", no side.)
- **What the critic values** — `ledger.criticWeight("ray*.food")`. (0.004: seeing food was never
  valued — the vicious circle.)

The last two are one command: `node --experimental-strip-types brain-lab/experiments/diagnose.ts
<summary.json> …` (read-only, safe during a run).

Two minutes of diagnosis told more than every module run together. Every biological part enters with
a stated function and a measurement; three times in a row an added part made things worse.

### 1.3 Predict before running

Write the predictions into `LAB-DEFTERI.md` **before** the run: concrete numbers or directions per
condition, and what result would falsify the idea. After the run, score each one ✓/✗ in the notebook.
A missed prediction is information, not embarrassment — never rewrite it.

### 1.4 Build

- Every change is a **switch**, default off; with it off the brain must be bit-identical. Prove it:
  retrain a recorded subject from scratch and compare its evaluation with the record
  (`experiments/harness.ts` evaluation is deterministic; `remeasure.ts` stops on any difference).
- **Tests first, adversarial**, then a **mutation pass**: back up every touched file, break the code
  on purpose, every mutant must fail a test, restore from the backup (never `git checkout` a file with
  uncommitted work — it silently deletes it). A surviving mutant needs a new test or a written reason
  why it is equivalent.
- `npx tsc --noEmit` 0 errors and `npm test` green before every commit.
- Commit **before** running an experiment, so every result names its code commit.

### 1.5 Screen, then confirm

One command, parallel on worker threads (results equal a sequential run — tested):
`npm run exp -- liste | tara KOD… | dogrula KOD… | curut KOD | teshis dosya…` (`--isci N`, `--egitim N`,
`--degerlendirme N`). Conditions are defined once in `experiments/conditions.ts`; add new ones there.
Every subject row lands in `data/results.jsonl` — query it with DuckDB
(`duckdb -c "SELECT … FROM read_json_auto('brain-lab/data/results.jsonl')"`), filter out short test runs
by `trainEpisodes`.

- **Screen** (`tara`): seeds 1–5 × both innate groups, 40 training + 10 evaluation episodes.
- Only what looks promising goes to **confirmation** (`dogrula`): 20 subjects **and** the CROSS control
  (dopamine from another episode). "It learned" needs: better than its **yoked body** AND gone under
  CROSS. E10 beat its twin 12/14 and was mostly a non-learning drift.
- The **yoked body** ("bağlı beden", `experiments/yoked.ts`, 2026-09-25): the learner's own actions replayed
  blind in its other evaluation rooms. Every new learner gets one automatically (`Row.y`, results.jsonl `y`;
  the `tara` report compares learner vs yoked per group). Why: the frozen twin barely moves, so beating it
  can only mean "learned to move" — Ozyn: "rastgele motor bile yeterince çalışınca yemek yiyebiliyor".
  Beating the yoked body means the learner uses what it senses.
- **Choose a room blind movement cannot win** before judging a learner in it: calibrate blind bursts,
  "food ahead → forward" and the seeker first (`experiments/calibrate-005b.ts`). In room 1 blind bursts
  plus "food ahead → forward" reach 19.7 of the seeker's 26.8 meals — room 1 never asked for turning.
  Room 3 (`ROOM3`, 5 food, energy 0.8): blind survives 1 %, "ahead" 81 %, seeker 92 %.
- The **twin** ("ikiz kontrol"): same birth, same evaluation worlds and noise, learning off — what the
  learner gains over it is what learning added.
- Test seeds (1001+) are never touched without Ozyn's explicit approval of a frozen pre-registration.
  This is also a guard: `harness.birth` refuses a seed ≥ 1001 unless it is given a pre-registration
  file whose status line reads `**Durum: DONDURULDU**`.

### 1.6 Try to refute before you claim

"It learns" (or any positive claim) is not written down until a falsification battery has tried to
break it (Ozyn, 2026-09-25: "önce bu testleri çürütmeye çalışalım"). It is one command for any
condition — `npm run exp -- curut KOD` — do not re-invent it (the first version, `falsify-s1n.ts`, is kept
as the record of the S1n run). It covers:

- fresh seeds never used to choose or tune the condition (selection bias / winner's curse);
- CROSS and LOCAL controls (`crossDopamine`, `localDopamine`): gain must vanish under both;
- is the control fair? compare plasticity activity (ledger weight entries);
- lesions (`lesionClone`): the learned pathway back to birth must remove the gain, an unrelated one must not;
- paired statistics (`stats.ts`: sign test + Wilcoxon), other rooms, learning curve, both innate groups.

Write each prediction **with its refutation criterion** before running. If the claim survives, say
"survived these tests", not "proven". If it fails, retract the claim in the notebook in plain words.

### 1.7 Report

Notebook entry (Turkish, dated): what was run, a table of the measured numbers, the prediction
scorecard, a short interpretation that claims no more than was measured, and what is next. Mark
`[ÖLÇÜLDÜ]` for measured, and say plainly what was not measured.

## 2. The measures (calibrated as of 2026-09-25)

Primary — use these to judge:

| measure | meaning | calibration |
|---|---|---|
| `steering` | habit-free: ½[(P(L\|food L)−P(L\|food R)) + (P(R\|food R)−P(R\|food L))] | always-left 0, perfect 1, away −1 |
| `sideInfo` | I(food side; turn) in bits | perfect 1, habit 0 |
| `meanDrive` | mean hunger² + injury² over the whole episode (dead = last value) — lower is better | |
| `survival` | share of episodes alive at 3000 ticks | |
| `harmPerK` | health lost per 1000 ticks (room 2, threats on) | |

Each of these is read **against the yoked body** first (paired Wilcoxon), the twin second.
`orientation` (share of food-in-sight ticks with the move toward it) is meaningful only against the yoked
body: S1n 0.28 vs yoked 0.16 (fresh seeds, 19/20) — almost all "food ahead → forward".

Secondary: meals/1000 ticks, meals per moving tick, bumpsPerK, life, still %. Legacy (biased, keep only
for old comparisons): turnToward, approach.

Reference numbers (room 1: 10 food, no threats, born hungry 0.4): random 0.67 meals/1000t · seeker
ceiling 25.8 · TD SARSA(λ) 8.38 · E7 twin (graph) drive 0.72, survival 11% · E7 drive 0.47, survival
52%, steering 0.06 · S1n (competitive selection, no dip floor), confirmed 2026-09-25 (20 subjects + CROSS):
drive 0.32 (twin 0.84, CROSS 0.81), survival 67%, steering 0.13 (16/20 > 0; CROSS 0.004). Falsification
(fresh seeds 11–20): drive gain survived (0.48 vs 0.85, p 0.0003; gone under CROSS and LOCAL); **steering did not**
(0.048, p 0.52) — the 0.13 was selection bias.

The twin must behave through the **same machinery** as the learner (e.g. the same selector); a
selector acts on the tick it senses (evaluation lag 0), the graph brain needs its conduction delay.

## 3. Tests — Ozyn reads them

- One condition per assertion, each with a message carrying the values.
- Every case starts from fresh state — no object shared between cases that should be independent
  (a shared compartment once made a test fail in the wrong place).
- The test name says what is measured, not a story ("a meal speaks on the reward channel only").
- Property checks over a systematic grid including the edges (0, 1), not random samples.
- Floating-point tolerances are measured first and justified in a comment (e.g. "max difference on
  the grid: 1 ε; values ≤ 2, so 2ε").

## 4. Traps that already happened

- **Backslashes through heredoc/Python/`node -e`** turn into control characters or vanish (`\n`, `\d`,
  `C:\vault`). Write such text with the Write/Edit tools; scan before commit:
  `grep -c -P '[\x00-\x08\x0B\x0C\x0E-\x1F]' file` must be 0.
- **Parallel writers** once could race on `brain-lab/data/registry.json` (subject numbers). Now a guard:
  every index change runs under `data/.index.lock` (atomic directory); tested with concurrent processes
  and a 12-thread stress run. On Windows a lock being removed answers EPERM, not EEXIST — it is handled as
  "busy" (the bug that crashed the first parallel run). Still prefer one `npm run exp` at a time: it
  already uses every core. Read during a run with `RegistryStore(DATA, { readOnly: true })`.
- **Background processes**: after stopping a task, check no `node` experiment is left running
  (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"`).
- Chaining a script and `git commit` with `;` commits even when the script failed — use `&&`.
- E7's quirks travel with it: its dip floor silenced a teacher's "no" and hurt S1; death does not
  teach, so a punishment channel stays silent. Question the base before building on it.
- Known shortcut (§16): rays report labelled kinds. Do not deepen it — prefer switching on what the
  world already has over adding a new labelled kind.

## 5. Structure over instructions

This repo learned it the hard way (root `CLAUDE.md`, "Kopya kod — kural değil, bekçi"): a rule in a
document is forgotten, a guard in code is not. When a rule here matters enough that breaking it would
corrupt data or a conclusion, turn it into a guard with a test (done so far: yoked body on every learner
and verdicts judged against it (`viewer/plain.ts judge`), arena films checked bit-for-bit against the
record (the browser's Math.cos differs in the last bit — brains replay on the server), registry index lock for
parallel writers, test-seed guard, bit-identical regression checks, parallel = sequential test,
calibration tests of every measure). When you add a guard, name it here.

## 6. Delegating to Atlas

For batches of runs, give the **atlas** agent a task card (question, conditions, stage, predictions,
budget, stop rule — see `.claude/agents/atlas.md`). Its report lands in `brain-lab/data/atlas-reports/`
with evidence paths; before relaying a number to Ozyn, check at least one against its source file.

## 7. Principles and authority

- Behaviour is never hand-coded; the brain learns to use the body. Hand-wired arcs exist only as
  labelled fixtures (capacity tests, oracle, seeker).
- Nature gives the structure (regions, pathways), experience gives the weights. Inside a region any
  learning method that works is allowed (Ozyn, K8, 2026-09-25) — but it must be measured to help.
- Every change to a subject's brain goes through its `Ledger`; birth graph + ledger must replay.
- **Ozyn decides**: architecture, design documents, pre-registration, test seeds. Design goes to a
  document first and is coded only after approval. Decisions between options go to a vault meeting
  (`forum/beyin0fis`, persona panel, 1–5 votes, K-decisions with `Gerekçe:`).
- Talk to Ozyn in **Turkish**, briefly, with tables; code, comments and commits in English.
