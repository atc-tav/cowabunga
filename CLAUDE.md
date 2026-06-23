# Cowabunga Arcade — Project Guide

Browser-based collection of faithful recreations of golden-age arcade games,
built with **Phaser 3 + TypeScript** via **Vite**. All graphics are drawn
**programmatically** (no asset files); all sound will be **procedural** Web
Audio. Personal/educational project — not for commercialization.

> This file reflects decisions made while scaffolding. The original design
> brief is preserved in `docs/` history; where this file and the brief differ,
> **this file wins**.

> **Strategic docs:** `CLAUDE.md` is *how to build*. `docs/` is *what we're
> optimizing for* — one doc per strategic imperative (Fun & Feel, RL Dojo
> Readiness, Faithfulness, Modularity, Procedural Everything). Start at
> [`docs/README.md`](docs/README.md) when a decision spans goals.

## ⭐ THE PROCESS (read this before building, fixing, or regenerating any game)

We are a **factory for faithful arcade clones**, and the process *is* the
product. There is **one rule** that separates our best clone (Arkanoid, 86%
faithful) from our worst (Donkey Kong, 48% — and it has a *longer* spec):

> **Make the spec executable before you write the game. Don't write the game and
> then test whatever you happened to write.**

Concretely: from `specs/<game>.md` you build an **Oracle Ledger** — a complete,
risk-ranked list where every spec mechanic, constant, scoring value, stage, and
`✅ CHECK` is a checkable row that traces to the spec — **before** writing game
code, then implement until every row is green. **Faithfulness = % of the ledger
that is green.** A passing test that doesn't trace to the spec proves nothing
(that's how Galaga shipped a green suite at 52% faithful).

- **The full process:** [`docs/spec-driven-development.md`](docs/spec-driven-development.md) ← start here
- **Vetting an agent's ledger (humans):** [`docs/vetting-ledgers.md`](docs/vetting-ledgers.md) — good vs. bad assertions
- **The spec quality bar + lint:** [`specs/SPEC_GUIDE.md`](specs/SPEC_GUIDE.md)
- **The Oracle Ledger template:** [`src/shared/testkit/TEST_DESIGN.template.md`](src/shared/testkit/TEST_DESIGN.template.md)
- **The worked example (copy this):** [`src/games/arkanoid/test-design/`](src/games/arkanoid/test-design/)
- **Commands:** `/new-game <id>`, `/regen-game <id>`, `/spec-lint <id>`

**You are expected to call out missing inputs to a human** (via
`AskUserQuestion`) the moment a spec is ambiguous, contradicts itself, or a
`✅ CHECK` can't be made automatable. Guessing silently is how clones come out
fake. See "Calling out to humans" in the process doc.

## Key decisions (read before building)

- **Plugins: native Phaser first.** Use built-in Phaser 3.60+ FX
  (`camera.shake/flash/fade`, `Glow`, `Vignette`, `Barrel`, tweens) instead of
  `phaser3-juice-plugin`. Only reach for a plugin / custom shader where the
  native path genuinely falls short.
- **CRT post-FX: DEFERRED.** Scanlines / curvature / glow / aberration belong
  on the final upscaled output and will largely move to **Unity's post stack**
  on the eventual port. `src/shared/CRTOverlay.ts` is a no-op seam for now —
  every scene calls `crt.apply()` so the real pipeline drops in later with zero
  game-code changes.
- **Sound: DEFERRED.** `src/shared/SoundManager.ts` is a no-op seam. Game code
  calls `audio.play('name')` today; `unlock()` is wired to first input
  (browsers gate AudioContext behind a gesture). We implement audio only once
  gameplay feels good.
- **Palettes: authentic arcade colors** (richer than strict NES), as long as
  the pixelation reads true to the originals. Each game owns
  `games/<name>/palette.ts`.
- **Modularity is the point.** Target ~80–90% shared via reusable *primitives*;
  game-specific *behavior* (ghost AI, formations, terrain) composes on top.
  Composition over deep inheritance.
- **Every game ships a test surface.** Games are verified headlessly by the
  agentic test harness in `src/shared/testkit/` — run `npm run test:game --
  <game>` (scenarios) and `npm run fuzz:game -- <game>` (random-play soak).
  Adding a game **includes** adding its test surface + scenarios; this is how we
  verify the ~90% of a game that doesn't need a human. Start at
  [`src/shared/testkit/README.md`](src/shared/testkit/README.md). See Arkanoid
  and Galaga for worked examples.

## Architecture

```
src/
├── main.ts                 Phaser bootstrap; registers MainMenu + all games
├── registry.ts             GAMES[] — single source of truth (add a game here)
├── scenes/
│   └── MainMenu.ts         Arcade launcher; builds a tile per registry entry
├── shared/                 Reusable across ALL games
│   ├── BaseGameScene.ts    Abstract base: services, HUD, resolution, back-to-menu
│   ├── InputManager.ts     Keyboard + gamepad -> normalized actions
│   ├── ScoreManager.ts     Per-game score + localStorage high score
│   ├── SoundManager.ts     DEFERRED no-op seam
│   ├── CRTOverlay.ts       DEFERRED no-op seam
│   ├── StateMachine.ts     Generic FSM (ghost states, enemy AI, flow)
│   ├── textures.ts         drawPixelArt() — the programmatic-sprite primitive
│   ├── titleArt.ts         Arc title logos (banner + arc wordmark + stars); see docs/title-art.md
│   ├── transition.ts       Fade scene transitions (home<->game, with title card)
│   ├── ui.ts               Shared colors + text styles
│   ├── world/              Scrolling-game foundation (camera platformers/adventures); see world/README.md
│   └── testkit/            Agentic test harness — every game exposes a test surface; see testkit/README.md
└── games/
    └── <name>/             Self-contained; imports only from shared/
        ├── <Name>Scene.ts  extends BaseGameScene (+ buildTestSurface(), dev-only)
        ├── sprites.ts      pixel-art grids
        ├── palette.ts      named palette
        ├── constants.ts    speeds/timings/dimensions (no magic numbers)
        └── testing/        scenarios.mjs (+ fuzz.mjs) for the test harness
```

`games/sandbox/` is **not a real game** — it's the interactive smoke test that
exercises the whole foundation. Remove or keep as a harness as you like.

## Adding a game

> Follow **[THE PROCESS](#-the-process-read-this-before-building-fixing-or-regenerating-any-game)**
> above — the steps below are the mechanics, not the method. The order is
> deliberate: **spec → Oracle Ledger → test surface → implement to green.** Do
> not skip to step 2. Run `/new-game <id>` to have an agent drive this.

0. **Lint the spec** (`specs/<name>.md`) against
   [`specs/SPEC_GUIDE.md`](specs/SPEC_GUIDE.md); raise every gap/contradiction to
   a human. No spec → no faithful game (write one first).
1. **Build the Oracle Ledger** *before any game code*: copy
   [`src/shared/testkit/TEST_DESIGN.template.md`](src/shared/testkit/TEST_DESIGN.template.md)
   to `src/games/<name>/test-design/TEST_DESIGN.md`, enumerate every spec
   section as a spec-traced, risk-ranked row, and get it reviewed.
2. Create `src/games/<name>/` with a scene extending `BaseGameScene` (pass
   `key`, `gameId`, native `width`/`height`); implement `createGame()` and
   `updateGame(time, delta)`; add one entry to `GAMES` in `src/registry.ts`.
3. **Stand up the test surface.** Add a `buildTestSurface()` to the scene (a
   `snapshot` + `invariants` + `hooks`, registered under `import.meta.env.DEV`)
   and `src/games/<name>/testing/scenarios.mjs` (+ `fuzz.mjs`) — wired to the
   ledger's assertions. Follow the checklist in
   [`src/shared/testkit/README.md`](src/shared/testkit/README.md), using
   Arkanoid as the template.
4. **Implement to green.** Build the game chasing the ledger; done = every
   non-`human` row 🟢 and `npm run test:game -- <name>` + `fuzz:game` pass clean.

Build order for the games themselves: **Pac-Man → Galaga → Donkey Kong →
Mario Bros. → Dig Dug**, each one slice at a time.

**Scrolling games** (camera-scrolling platformer/adventure — e.g. Super Mario
Bros. 2, Kirby's Adventure) build on the **`src/shared/world/`** foundation:
ASCII-tile levels (`parseAsciiLevel`), swept tile collision (`TileBody`),
scrolling camera (`WorldCamera`), and a baked tile layer (`renderTileLayer`).
Read [`src/shared/world/README.md`](src/shared/world/README.md) and compose on
it **before** writing your own camera or tile collision.

## Code standards

- TypeScript strict; no `any`.
- Games import only from `src/shared/`; no cross-game imports.
- All sprites via `drawPixelArt()`; magic numbers go in `constants.ts`.

## Commands

- `npm run dev` — dev server (HMR)
- `npm run build` — typecheck + production build
- `npm run typecheck` — types only
- `npm run test:game -- <game>` — headless scenario suite for a game (e.g.
  `arkanoid`, `galaga`)
- `npm run fuzz:game -- <game> [secs]` — invariant-checked random-play soak test
- `npm test` — pure-logic unit tests (vitest)
- `npm test` — Vitest mode-1 unit tests (pure logic; e.g. `shared/world`)
