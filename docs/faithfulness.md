# Imperative 3 — Faithfulness

> Recreations read true to the originals — feel beats flash.

This is a collection of *faithful* recreations of golden-age arcade games. The
bar is: a player who grew up on the original should recognize it instantly — in
how it looks, how the enemies think, and how it feels under the thumb. When a
"polish" idea conflicts with the original's character, **the original wins**
unless we have a deliberate, documented reason to diverge.

## What faithfulness covers

- **Behavior over cosmetics.** The hard, valuable part is faithful *systems* —
  enemy AI, timing, movement rules — not just matching colors. Pac-Man is the
  standard: real Blinky/Pinky/Inky/Clyde targeting, the scatter↔chase schedule,
  frightened → eyes → revive, staggered house release. That fidelity is the
  product.
- **Authentic palettes.** Per the brief: authentic arcade colors (richer than
  strict NES) as long as the pixelation reads true. Each game owns its
  `palette.ts` — no shared "house style" flattening the differences.
- **Native resolution.** Each game renders at its real arcade resolution
  (Pac-Man 224×288, DK 224×240, Mario Bros. 256×240) via the registry, not a
  one-size canvas.
- **Feel, faithfully.** Juice serves the original's character; it doesn't
  override it (see [fun-and-feel.md](./fun-and-feel.md)).

## Faithfulness gates flash

The standing example: **Pac-Man has no screen shake.** The arcade machine never
shook, and it's a game of pixel-precise maze navigation where a jittering frame
actively hurts. Pac-Man gets `popScore` and hit-stop — feedback that fits its
character — and nothing that fights it. Every "should we add X?" runs through:
*did the original's feel justify it?*

## Per-game fidelity notes

- **Pac-Man** — the reference implementation. Ghost personalities and phase
  schedule are the real thing. Preserve them; don't "balance" them away.
- **Galaga** — capture/rescue + dual-fighter, dive-bomb entry paths, challenge
  stages. The tension is in the divers; keep it.
- **Donkey Kong** — sloped girders (barrels roll downhill), ladders, hammer,
  HELP!/countdown intro. The slope behavior is core, not garnish.
- **Mario Bros.** — bump-from-below is the defining verb; everything (flipping
  enemies, POW) builds on it landing right.

## <a name="checklist"></a>Checklist — "faithful"

> **How you achieve everything below:** the
> [spec-driven, oracle-gated process](./spec-driven-development.md). Faithfulness
> is not a vibe you check at the end — it's the **percentage of the game's
> Oracle Ledger that is green**. The items here are the human-judged remainder
> on top of a green ledger, not a substitute for it.

- [ ] **An Oracle Ledger exists** (`src/games/<game>/test-design/TEST_DESIGN.md`),
      traces every spec section, and **every non-`human` row is green** —
      `npm run test:game -- <game>` and `fuzz:game` pass clean. *(This is the
      gate; the rest is the human ~10%.)*
- [ ] Enemy/AI behavior matches the original's logic, not just its sprites.
- [ ] Colors come from the game's own `palette.ts` and read true to the arcade.
- [ ] Renders at the game's authentic native resolution.
- [ ] Any juice/feature the original lacked has a documented reason to exist.
- [ ] Timing and difficulty curve evoke the original (then ramp for the dojo).

## Open threads

- Capture **source references** (resolution, palette intent, AI rules) per game
  near its `constants.ts`, so faithfulness is checkable, not from memory.
