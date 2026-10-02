# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

3dorion gives Orion (an AI) a lived-in 3D space: a room rendered in Babylon.js, viewed/piloted through an Electron shell, where a monitor surface runs a real terminal (`claude` launches inside it). The product thesis (in Turkish, kept verbatim because it's the north star): **"AI'ın oturduğu oda — terminalini onun masasında açıyorsun."** Code, comments, identifiers, commit messages and docs are overwhelmingly in Turkish — match that when editing existing files.

Full architecture rationale, decision log, and measured results live in `docs/specs/` (read these before making non-trivial architectural changes — decisions here are backed by live measurements, not intuition):
- `docs/specs/01-sanal-alan.md` — overall system spec, module boundaries, MVP ticket log, all measured accept criteria (K1–K12).
- `docs/specs/02-beyin-mimarisi.md` — two-tier brain architecture plan (local reflex vs. cloud "thought" tier).
- `docs/specs/03-algi-ve-zihin-duvari.md` — perception service + the "mind wall" self-observability panels.
- `docs/specs/04-dis-beyin.md` — the language-agnostic "external brain" HTTP contract.
- `docs/specs/05-moduler-beyin-ve-devre-paneli.md` — the mind-wall control panel (pano) and brain modularity.
- `docs/specs/06-beyin-v2.md` — **current brain direction**: state vs memory split, time/source tags, retrieval threshold, faithfulness metric. Read before touching `mind/hafiza.ts`, `bridge/kopru.ts` context assembly, or perception→memory paths.
- `docs/specs/09-ogrenen-kapi.md` — the learned gate: Ozyn teaches (`tools/ogret.ts`), a growing rule memory (`mind/kuralHafizasi.ts`) runs in SHADOW (writes `golge` to the journal, never changes the gate), rebuilt at startup from the journal's `ogretim` lines. The channel rule has one source (`kanalAcikMi` in `mind/dikkat.ts`).
- `docs/specs/08-karar-kaydi.md` — the decision journal and the named innate rules (`mind/icgudu.ts`): every gate decision, LLM wake and outcome is written as JSONL (`%APPDATA%/3dorion/karar-kaydi/`), never changing behavior. Read before touching the gate (`mind/dikkat.ts`, `mind/refleks.ts`, `bridge/kopru.ts` `algi()`/`_dusun()`): a new gate rule needs a new innate id.
- `docs/specs/10-beceri-refleksi.md` — approved 2026-09-28: the skill reflex. A task (one utterance → body intents) that succeeds once is saved with parameter slots (`mind/gorev.ts`, `mind/beceriHafizasi.ts`); the live ledger (`mind/beceriDefteri.ts`) is rebuilt from the journal and writes a SHADOW decision (`beceriGolge`) on each final utterance, never changing behavior (measured live, `3dorion.bat becerdene`). AUTHORITY (`beceriYetkisi`, `ORION_BECERI=1`) is a switch, default OFF: when on, a matched utterance runs the skill's steps sequentially through `niyetGonder` without waking the LLM (innate rule `kopru.refleks`; failures hand the utterance back to the LLM). It stays off in real use until roadmap step 6 and its own pre-registered bar. Offline measure: `tools/beceri-deney.ts`; listing: `tools/ogret.ts beceriler`. Read before adding fields to the journal's wake/perception lines or any path that bypasses the LLM.
- `docs/ACIK-ISLER.md` — open issues, ordered by what's blocking vs. cosmetic.
- `docs/FIKIR-HAVUZU.md` — idea backlog, not yet committed to.

## Commands

```
npm run typecheck              # tsc --noEmit
npm test                       # runs all *.test.ts under any top-level dir + subdirs
npm run dev                    # vite dev server (renderer only, no Electron)
npm run build                  # vite build -> dist/
npm start                      # build + launch Electron (host/main.js)
```

Run a single test file directly (this is what `npm test` wraps):
```
node --experimental-strip-types --import ./tools/babylon-cozucu.mjs --test path/to/file.test.ts
```
Tests use Node's built-in `node:test` runner directly — no Jest/Vitest. The `--import ./tools/babylon-cozucu.mjs` hook is required for any test that touches Babylon: Babylon's source uses extensionless deep imports (`@babylonjs/core/Cameras/freeCamera`) that Vite resolves but Node's ESM loader can't, so the hook rewrites `.js` onto `@babylonjs/*` subpath imports only (deliberately narrow — it must not mask a real typo in project code).

`3dorion.bat` is the primary way this project is actually run and demoed on Windows — it's not just a launcher, it encodes ~20 live-verification scenarios (see the comment header in the file for the full list, e.g. `gorudene` = does Orion actually perceive the terminal, `davranis` = does Orion react correctly to what it sees, `tahtadene` = whiteboard writing + proximity rule, `hafizadene` = 13-turn memory recall, `pybeyin` = drive the brain from an external Python process). When validating a behavior change in this repo, check whether one of these modes already exercises it before writing a new one. Key env vars it supports: `ORION_BEYIN=dis` (delegate brain to an external HTTP process), `ORION_SAGLAYICI`/`ORION_MODEL` (swap LLM provider/model), `ORION_SS=<path>` (headless screenshot capture for visual verification), `ORION_KAYIT=1` (log real brain inputs for replay via `tools/beyin-tekrar.ts`).

There is no linter configured; `tsc --noEmit` (strict mode) is the only static gate besides tests.

## Architecture: the one rule that matters most

```
protocol/   Dünya Protokolü (World Protocol). ZERO dependencies. The only contract between brain and body.
world/      Babylon rendering + simulation. Depends on protocol/ only — NEVER imports bridge/ or mind/.
  engine/     fixed 20Hz tick, scene bootstrap, camera rig; `fareKipi.ts` holds the
              mouse-mode decision (roaming = mouse drives camera under pointer lock;
              focused on a screen/panel = free cursor for clicking, Ctrl+mouse for
              camera) and is deliberately Babylon-free so it tests in ~0.2s
  level/      room, props, named anchors (table/board/window/chair/monitor/mind-wall)
  avatar/     procedural + VRM avatar, animation state machine
  arayuz/     DOM overlays above the room (model picker, M). Pure core in `*Cekirdek.ts`, types re-declared structurally (never imported from bridge/).
  surfaces/   mind-flow wall panel: `semaCekirdek.ts` (layout/state, pure), `semaCizim.ts` (canvas drawing, Babylon-free — view it standalone at `/world/surfaces/sema-deneme.html` under `npm run dev`), `sema.ts` (state + clicks). monitor = xterm state machine painted onto a DynamicTexture (not a copied canvas — xterm 6's renderer is DOM-only, so cells are painted directly); whiteboard = proportional text layout, both share a "dirty flag" repaint pattern
  player/     third-person controller, `F` to toggle first-person, `E` to interact, raycasting for line-of-sight
bridge/     protocol <-> Orion's brain(s). The only bidirectional point. Brain implementations: ollama.ts (local), opencode.ts (cloud via OpenCode server), disBeyin.ts (external process over HTTP, any language).
mind/       autonomy: idle agenda, attention filter (yerel->beyin promotion), reflex model, perception service, memory (Generative Agents scoring), command-risk gating.
voice/      STT (text-input stand-in today; no microphone hardware present) + TTS (Piper).
host/       Electron main process: pty, IPC, window, injects a PowerShell `prompt` function for OSC 133 exit-code signaling.
```

**Dependency direction is one-way:** `world -> protocol`, `bridge -> protocol`, `mind -> protocol`. `world/` must never import `bridge/`, `mind/`, or any brain code — a violation is an architecture bug, not a style nit (spec accept-criterion K4). A guard test enforces it (`world/bagimlilik.test.ts`, type-only imports included); the one documented exception is the composition root `world/giris.ts`, which wires the brain to the body. If you're touching `world/`, ask whether what you're adding belongs there or in `mind/`/`bridge/` instead.

**Front/back categories (spec 14):** ORTAK `protocol/` · ÖN `world/`, `voice/` · ARKA `mind/`, `bridge/` · KABUK `host/` · UYGULAMA (composition) `world/giris.ts` + `uygulama/`. The repo-wide guard `tools/mimari.test.ts` enforces the allowed imports per layer (front imports only protocol, plus host types; back never imports front; host only itself plus mind types).

### `protocol/` — the contract

- `temel.ts` defines the envelope (`Zarf<G>`), `Kanal` (`"yerel" | "beyin"`), and named world anchors (`CapaAdi`).
- `niyet.ts` — every action Orion can take in the world (this list doubles as the tool surface: `bridge/araclar.ts` reads it to generate the LLM tool schema). Adding a capability means adding a variant here.
- `algi.ts` — everything the world tells Orion.
- `dogrula.ts` — validates every intent before the world acts on it; a rejected intent is never silently swallowed, the error message tells the model what's valid so it can self-correct.
- **Hard rule, test-enforced (`protokol.test.ts`):** the high-frequency `tik` (tick) perception must never reach the `beyin` (brain/LLM) channel — only `mind/dikkat` (attention) decides what gets promoted from `yerel` to `beyin`, and it can only narrow `VARSAYILAN_KANAL`, never widen it. This is the project's cost ceiling: violating it turns "AI living in the world" into thousands of tokens per second.
- Adding a field or a union variant is non-breaking; removing one, or renaming an intent, is breaking (bump `SURUM`).

### Brain layer

`bridge/beyin.ts` defines the `Beyin` interface (`hazirMi()`, `dusun()`); everything else swaps behind it. Current implementations: `ollama.ts` (local models via Ollama — qwen2.5:7b was the measured pick because it reliably calls tools within the 8GB VRAM budget; see spec 01's model-selection decision logs before proposing a model swap. Local options are NOT hardcoded: `bridge/ollamaKatalog.ts` scans the installed models at startup (`/api/tags`, `/api/ps`, `/api/show` capabilities), `bridge/beyinKatalogu.ts` turns them into `yerel:<model>` selector options + picker cards, and `OllamaBeyni` omits `tools`/`think` for models that lack those capabilities. `host/ollamaSunucu.js` starts `ollama serve` if it isn't running (`ORION_OLLAMA=0` disables). Cloud (bulut) options are equally NOT hardcoded: `bridge/opencodeKatalog.ts` scans OpenCode's own `GET /config/providers` and keeps only models that are both tool-capable and free (`toolcall === true && cost.input === 0 && cost.output === 0` — a paid or toolless cloud model never becomes a silent default), across **every provider OpenCode is authenticated against** (openrouter, opencode zen, nvidia, ...); adding a new provider (e.g. `PUT /auth/nvidia` with an API key) needs zero code changes — the next scan just finds it. `bridge/beyinKatalogu.ts` turns those into `opencode:<providerID>/<modelID>` selector options + `bulut`-group picker cards, alongside the Ollama ones. The manual `?saglayici=`/`?model=` escape hatch (the fixed `opencode` option) still exists for a paid/toolless model a user picks on purpose. The user picks the thinking brain with **M** (`world/arayuz/modelSecici.ts`), which writes through the same pano confirm path as the wall panel; the last manual choice is remembered except in scenario runs (`sessiz=1`) or with `?beyin=`), `opencode.ts` (routes through a local OpenCode server to a cloud model for higher-quality "thought"-tier reasoning), `disBeyin.ts` (delegates to an external HTTP process in any language — contract is `GET /saglik`, `POST /dusun`, spec 04). `bridge/satirSozlesmesi.ts` is the line-based text protocol (`KOMUT:`, `TAHTA:`, `BAK:` prefixes) used to extract structured intents from models that don't reliably emit structured tool calls — treated as a stopgap pending real MCP tool registration (see "Karar bekleyen" in `docs/ACIK-ISLER.md`).

`mind/` implements a two-tier cost model (spec 02): a fast local/rule-based "reflex" tier handles anything with a sub-second latency requirement (look-at-player, idle micro-behavior, noise filtering, short acknowledgments), while a slower "thought" tier (cloud LLM) handles chat, terminal-output interpretation, command suggestions, and memory reflection. All output from either tier funnels through the single `niyetiYurut()` dispatcher — there is intentionally only one path from "decision" to "action" in the world, so proximity rules, the approval gate (`mind/onayKapisi.ts`), and text-shortening (`voice/kisalt.ts`) apply uniformly regardless of which tier decided.

## `brain-lab/` — a separate research subproject

A science lab for a *learning* decision mechanism (brain map: regions, pathways, dopamine, three-factor plasticity). It is **not wired into Orion** — nothing in `bridge/`, `mind/`, `world/` imports it, and the dependency direction inside it is enforced by import-guard tests. It has its own `brain-lab/CLAUDE.md` (**read it before touching anything there**; it overrides this file inside `brain-lab/`) and its own conventions that differ from the rest of the repo: **code, comments and commits in English** (conversation/vault pages Turkish), all randomness through `world/rng.ts` (same seed → bit-identical world hash), pre-registered predictions before any run, every brain change through the subject's `Ledger`, behavior never hand-coded. The method lives in the `themis` skill (`.claude/skills/themis`) and the `atlas` agent (`.claude/agents/atlas.md`) carries experiment batches end to end; use them for experiment work rather than ad-hoc scripts. Notebook: `brain-lab/LAB-DEFTERI.md`. `brain-lab/data/` is git-ignored; `brain-lab/archive/` is frozen. `ORION-BRAIN-CONTEXT.md` (repo root) and `brain-lab/brain-ir/` (Brain IR v0.2/v0.3 Alice/Bob) are the older substrate the lab builds on.

Other repo-local Claude config: `.claude/skills/orion-beden` (connect to the room's body as Orion) and `orion-sahne` (persona). `graphify-out/` is a git-ignored knowledge-graph cache, not source.

## Working conventions specific to this repo

- **Claims require live evidence, not just passing unit tests.** The spec docs use `[TEST]` (unit-tested), `[ÖLÇÜLDÜ]` (measured live), and `[YAZILDI-KOŞULMADI]` (written but never run) as status tags — a green test suite alone does not mean a feature "works" here; several real bugs in this codebase's history were only caught by an actual live run (`3dorion.bat <mod>dene`) after unit tests already passed. When adding a behavior that affects what Orion perceives or how it reacts, prefer adding/using a `*dene` scenario in `3dorion.bat` over trusting unit tests alone.
- **Don't tune behavior on vibes.** Model/parameter choices in this repo (which local LLM, temperature, memory window size, output-thinning thresholds) were each settled by a measurement script under `tools/` and are documented with the actual numbers in `docs/specs/01-sanal-alan.md`. If you're about to change one, check whether a measurement tool already exists (`tools/model-olcum.mjs`, `mind/refleks-olcum.ts`, `tools/akis-olcum.ts`, `world/davranisDenemesi.ts`) before changing it on intuition.
- Exit codes, not text-pattern matching on command output, decide whether a shell command was "long-running" or "an error" — this is why the shell was switched from cmd.exe to PowerShell (PowerShell's `prompt` function can read `$LASTEXITCODE`; cmd's `PROMPT` sequence can't). Don't reintroduce keyword-based error detection on terminal output.

## Kopya kod — kural değil, bekçi

The `ponytail` plugin was trialled 2026-09-17 → removed 2026-09-19
(`docs/olcum-ponytail.md`). Its pre-registered test failed: with its "already in
this codebase? reuse it" rule in context, a 5th copy of the known setting
normalizer was still written into `mind/inisiyatif.ts`.

What actually stopped duplication in this repo was **structure, not
instructions**: every copy-drift caught so far (`OZET_ONEKI` prefixes, the time
helpers, `host/kanallar.cjs`, the brain instruction text) was closed by a
**guard test** that derives the expected value from the single source. When
you find a second copy: delete one, derive from the other, and add a test that
fails if they diverge. Before changing a constant or text, grep ALL its users —
if the only user is a fallback, you are editing the wrong copy.

Dense Turkish "why" comments remain the deliverable; never thin them.
