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
│   └── ui.ts               Shared colors + text styles
└── games/
    └── <name>/             Self-contained; imports only from shared/
        ├── <Name>Scene.ts  extends BaseGameScene
        ├── sprites.ts      pixel-art grids
        ├── palette.ts      named palette
        └── constants.ts    speeds/timings/dimensions (no magic numbers)
```

`games/sandbox/` is **not a real game** — it's the interactive smoke test that
exercises the whole foundation. Remove or keep as a harness as you like.

## Adding a game

1. Create `src/games/<name>/` with a scene extending `BaseGameScene` (pass
   `key`, `gameId`, native `width`/`height`).
2. Implement `createGame()` and `updateGame(time, delta)`.
3. Add one entry to `GAMES` in `src/registry.ts`. Done — it's registered and
   appears in the menu.

Build order for the games themselves: **Pac-Man → Galaga → Donkey Kong →
Mario Bros. → Dig Dug**, each one slice at a time.

## Code standards

- TypeScript strict; no `any`.
- Games import only from `src/shared/`; no cross-game imports.
- All sprites via `drawPixelArt()`; magic numbers go in `constants.ts`.

## Commands

- `npm run dev` — dev server (HMR)
- `npm run build` — typecheck + production build
- `npm run typecheck` — types only
