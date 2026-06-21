# DEVLOG — agentic test framework

## (a) What this document is

A **running decision log + orientation guide** for the agentic test-framework
effort. Every non-obvious design decision we make goes here, newest at the top,
with the *reasoning* — not just the outcome — so a future agent (or human)
can understand *why* the framework is shaped the way it is and continue the
work without re-litigating settled questions.

Read this **after** the two design docs and **before** writing any framework
code:

1. `src/shared/testkit/README.md` — the reusable framework + adaptation guide.
2. `src/games/arkanoid/test-design/TEST_DESIGN.md` — the Arkanoid worked example.
3. **this file** — why those look the way they do, and what to do next.

> **Scope note.** Arkanoid is the *incubator* for the framework, so this log
> lives in its `test-design/` folder for now. It tracks both Arkanoid-specific
> and framework-wide decisions. When a **second** game adopts `testkit`,
> promote the framework-wide entries to a shared devlog (e.g.
> `src/shared/testkit/DEVLOG.md`) and leave the Arkanoid-only ones here.

## (b) The testing framework we are building — in one screen

**Problem.** The collection is built by agents, slice by slice. Humans can't
playtest every change. We want agents to verify the **objectively-checkable
~90%** of a game and reserve human attention for the **~10%** that genuinely
needs a person (feel, fun, aesthetics, audio).

**Core stance.** Test against **game state + invariants, not pixels.**
Screenshots are evidence for the human review pack; they are never the oracle.

**Shape.** Two layers, four modes.

- *Reusable layer* (`src/shared/testkit/`): game-agnostic. Boots a game
  deterministically, drives it, runs scenarios + invariants, assembles a human
  pack. Talks to a game **only** through the `GameTestSurface` interface.
- *Per-game layer* (`src/games/<game>/test-design/` + a `<Game>TestSurface`):
  the adapter + the expertise. Exposes deterministic seams, a state snapshot,
  and the game's invariants; documents the risk map and scenarios.

Four modes, cheapest-that-can-catch-it owns each bug class:
1. **Unit** (Node/vitest) — pure logic: angle clamp, capsule RNG, thresholds.
2. **Scenario** (headless) — set → act → assert on snapshot state.
3. **Invariant / fuzz** (headless) — a seeded bot plays; invariants checked
   every frame.
4. **Human pack** — deterministic screenshot contact sheet + checklist.

**Determinism is the keystone:** an injectable **seeded RNG**
(`shared/Rng.ts`) plus a **fixed-timestep tick** (`__testkit.tick(frames)`
driving `game.step`). Without both, real-time + `Math.random()` makes tests
flaky. Bonus: the seeded RNG also implements Arkanoid's spec'd score-seeded
capsule drops.

## (c) How to continue this work

### Current status
- **Done:** design docs (README + TEST_DESIGN) and this devlog. Reviewed and
  approved by the maintainer. No runtime code yet.
- **Branch convention:** descriptive names, `claude/<topic>` (e.g.
  `claude/agentic-test-framework`, `claude/arkanoid-32-stages`).
- **Workflow:** one PR per coherent slice; squash-merge; **re-sync to
  `origin/main` before starting the next slice** (a missed re-sync caused a
  merge conflict earlier — see Decisions log).

### Build order (agreed)
1. `shared/Rng.ts` + wire Arkanoid gameplay `Math.random()` through it; add the
   `seed` seam. *Smallest change, unblocks everything.*
2. `testkit` core: the `GameTestSurface` interface as real code, a surface
   registry on `window.__testkit`, the fixed-step `tick`, the Node Playwright
   harness, the scenario runner, the invariant runner.
3. `ArkanoidTestSurface` (`snapshot`/`invariants`/`hooks`) + **extract pure
   logic** (`clampDir`, paddle-angle map, `rollCapsuleType`, extra-life
   stepper) → write the **mode-1 unit tests**. Instant, zero-flake value.
4. The **P0 scenarios** + the **fuzz/invariant** runner (the real bug-catchers).
5. The **human-pack** generator (contact sheet of all 32 stages + key power-up
   states + a checklist).

A good **first implementation PR** is **steps 1–3**: self-contained, proves the
contract end-to-end, and lands green unit tests immediately.

### Conventions for framework code
- Test seams (`window.__testkit`, surface registration) must be **gated to
  dev/test builds** — never shipped in production.
- Prefer driving the game through **surface hooks** over synthetic key events
  (Playwright `keyboard.press()` fires down+up in one tick and Phaser's
  edge-triggered input misses it; use `down → tick → up` only when a hook
  won't do).
- Use the **pre-installed** Chromium at `/opt/pw-browsers/...` with
  `--use-gl=swiftshader`. Do **not** `playwright install` — the CDN is blocked
  by network egress here.
- Keep `snapshot()` flat and JSON-serialisable; it is read every frame in fuzz
  mode.

### When adapting to a new game
Follow the checklist in `src/shared/testkit/README.md` ("Adapting `testkit` to
a new game"). If `snapshot()`/`hooks` are hard to write, that is a *design*
smell in the game (logic tangled into rendering) — surface it, don't fight it.

---

## Decisions log (newest first)

### 2026-06-21 — DEVLOG created
Maintainer asked for a running design log in the test folder with (a) what it
is, (b) the framework summary, (c) how to continue. This file. Future agents:
append a dated entry for every design decision; keep the reasoning.

### 2026-06-21 — Design approved; docs-first sequencing
Maintainer approved the framework design (README + TEST_DESIGN). Decision:
ship the design + this devlog as a review PR (no runtime code), then build in
the agreed order above. Rationale: align on the contract before investing in
browser scenarios.

### 2026-06-21 — Determinism via seeded RNG + fixed-step tick (approved)
Chose an injectable seeded RNG (`shared/Rng.ts`) plus a manual fixed-timestep
tick over wall-clock waits. Rationale: eliminates flakiness, makes failures
reproducible by seed, and doubles as the spec's score-seeded capsule RNG. This
is a small, reusable touch to gameplay code; maintainer is OK with it.

### 2026-06-21 — Test against state + invariants, not pixels
Rejected pixel-diff regression testing: brittle, defeated by intended art
changes, and it can't judge fun. Oracles are state assertions (scenarios) and
always-true properties (invariants). Pixels are only for the human pack.

### 2026-06-21 — `GameTestSurface` as the single contract
The harness is fully game-agnostic and talks to each game through one
interface: `snapshot()` + `invariants()` + per-game `hooks`. Rationale:
portability — onboarding a new game is implementing this interface plus writing
its test-design doc, nothing more.

### 2026-06-21 — Four modes, cheapest-owns-the-bug-class
Unit / scenario / invariant-fuzz / human pack. Push correctness into pure
functions (mode 1) wherever possible; reserve the browser for wiring/state.
Rationale: speed and reliability scale inversely with how much browser a test
needs.

### 2026-06-21 — Human keeps feel/fun/aesthetics/audio (the 10%)
The framework explicitly does **not** try to score these. Mode 4 stages the
evidence (deterministic screenshots + checklist); the human verdict is the
oracle. Rationale: be honest about what automation can and can't decide.

### 2026-06-21 — Harness mechanics locked from the run session
Pre-installed Chromium at `/opt/pw-browsers` + swiftshader (CDN blocked); a
dev/test-only `window` hook to reach the Phaser game/scene; `keyboard.down →
tick → up` instead of `press()` due to Phaser edge-trigger timing. These were
discovered empirically while running the game and are now baseline assumptions.
