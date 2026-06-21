# Imperative 4 — Modularity & Reuse

> ~80–90% shared primitives; game-specific behavior composes on top.

Modularity is the point of this repo, not a nice-to-have. The goal is that the
fifth game is mostly assembly: reach into `src/shared/` for the primitives,
write only the behavior that makes *this* game itself. It's also what makes the
polish pass cheap — a feel improvement to a shared primitive lifts every game.

## The split: primitives vs. behavior

- **`src/shared/` = primitives.** Reusable across *all* games. Movement,
  pathing, FSM, input, scoring, lives, juice, texture drawing. If two games
  would write the same thing, it belongs here.
- **`src/games/<name>/` = behavior.** What makes the game distinct — ghost AI
  target selection, formation entry paths, girder slopes, the bump verb.
  Behavior *composes* primitives; it doesn't reimplement them.

The current primitive set: `BaseGameScene`, `Grid`, `GridMover`, `PathFollower`,
`Platformer`, `StateMachine`, `gridAI`, `InputManager`, `ScoreManager`,
`LivesManager`, `juice`, `popups`, `effects`, `textures`, `ui`.

A **cohesive feature-set** earns its own subfolder under `shared/` (rather than
landing flat as one-off files). The first is
[`shared/world/`](../src/shared/world/README.md) — the scrolling-game foundation
(ASCII tilemap, swept tile collision, scrolling camera) that the camera-scrolling
platformer/adventure projects (SMB2, Kirby) compose on. Future world/level/camera
work lands there; other clusters can get sibling folders.

## Rules (enforced, not aspirational)

- **Composition over deep inheritance.** Games extend exactly one base
  (`BaseGameScene`) and otherwise *use* primitives. No game-specific base
  classes, no inheritance chains.
- **Games import only from `src/shared/`.** No cross-game imports, ever. If
  Galaga and DK both need a thing, the thing moves to `shared/`.
- **No magic numbers.** Tunables live in the game's `constants.ts`. The scene
  reads named constants; reviewers can see and tune the design in one file.
- **Strict TypeScript, no `any`.** `noUnusedLocals` / `noUnusedParameters` are
  on — dead imports fail the build.
- **Promote on the third copy.** Two games doing the same thing is a smell; the
  third is a refactor into `shared/`. (How `popScore`/`impact` came to be — the
  `addScore + floatingText` pair existed in three games.)

## Where a new thing goes — quick test

1. Will another game ever want this? → `shared/`.
2. Is it *this* game's identity (AI, layout, verb)? → `games/<name>/`.
3. Is it a number that tunes the design? → `games/<name>/constants.ts`.
4. Is it a sprite? → drawn in `games/<name>/sprites.ts` via `drawPixelArt`
   (see [procedural-assets-and-audio.md](./procedural-assets-and-audio.md)).

## <a name="checklist"></a>Checklist — "modular"

- [ ] No cross-game imports; games pull only from `src/shared/`.
- [ ] Reusable logic lives in `shared/`; only behavior lives in `games/`.
- [ ] No magic numbers in the scene — all tunables in `constants.ts`.
- [ ] One base class deep; behavior composes primitives.
- [ ] Strict TS clean (no `any`, no unused) — `npm run build` green.

## Open threads

- As Dig Dug lands, watch for the next primitive to promote (digging/terrain may
  generalize the grid layer).
