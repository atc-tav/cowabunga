# Imperative 1 — Fun & Feel

> Every action confirms itself; the game feels alive in the hand.

This is the polisher's home turf. The builder makes a game *work*; this
imperative makes it *satisfying*. Feel is not decoration — it's the difference
between input that registers and input that lands.

## The grammar of feel

Three questions every player-facing action should answer:

1. **Did it register?** — immediate visual/audio confirmation on the frame the
   input is consumed (mouth chomps, ship fires, platform bonks).
2. **Did it matter?** — proportional feedback to the *weight* of the event (a
   dot is quiet; losing a life shakes the screen).
3. **What do I do next?** — feedback points the player forward (the floated
   score says "do that again"; the death pause gives a beat to reset).

## The shared toolkit

Feel primitives live in `src/shared/` and are wired through `BaseGameScene` so
every game reaches for the same vocabulary:

| Tool | Where | Use it for |
|------|-------|-----------|
| `impact(preset)` | `BaseGameScene` → `juice.ts` `screenShake` | Genuine impacts only — death, slam, POW. Presets: `light` / `medium` / `heavy`. |
| `popScore(x, y, points, opts)` | `BaseGameScene` → `popups.ts` `floatingText` | Positioned reward events — a ghost eaten, an enemy shot, a barrel smashed. Banks the points *and* floats them. |
| `floatingText(...)` | `popups.ts` | Non-score callouts — `CAPTURED!`, `RESCUED!`, `BONUS`. |
| `playFrames(...)` | `effects.ts` | One-shot sprite bursts — explosions. |
| Hit-stop | per-game (e.g. Pac-Man `eatPauseTimer`) | Freeze the world for a beat on a high-impact event so it reads. |

## Taste rules (the hard part)

- **Restraint is the craft.** Juice everything and nothing reads. Shake is for
  impacts, not for points. `light`/`medium`/`heavy` exist so intensity tracks
  weight — don't reach past the event.
- **Faithfulness gates flash.** See [faithfulness.md](./faithfulness.md). Pac-Man
  deliberately has *no* screen shake; it uses `popScore` only.
- **Confirm on the consuming frame.** Feedback fires where and when the event is
  resolved, not a tick later.
- **Reuse the convention.** New positioned-score event? `popScore`. New impact?
  `impact`. Don't re-roll `addScore + floatingText` by hand — that's what the
  conventions replaced.

## Current posture (per game)

| Game | Score popups | Impact | Notes |
|------|:---:|:---:|------|
| Pac-Man | ✅ `popScore` | — (by design) | Hit-stop on ghost-eat; faithful no-shake. |
| Galaga | ✅ `popScore` | heavy on player death | Flash on capture/rescue; explosion bursts. |
| Donkey Kong | ✅ `popScore` | medium on death, light on smash | Flash on death; HELP!/countdown intro. |
| Mario Bros. | — (no scoring yet) | light on bump | Bump is the core verb — it now lands. |

## <a name="checklist"></a>Checklist — "feels good"

- [ ] Every player action gives feedback on the frame it's consumed.
- [ ] Feedback intensity is proportional to event weight.
- [ ] High-impact events use the shared `impact` / `popScore` / hit-stop tools,
      not bespoke one-offs.
- [ ] No juice that the original game's feel wouldn't justify (see faithfulness).
- [ ] All feel flourishes are visual-only and survive `setJuiceEnabled(false)`
      (see [rl-dojo-readiness.md](./rl-dojo-readiness.md)).

## Open threads

- **Procedural audio** is the single biggest remaining feel multiplier — 23
  `audio.play()` calls fire into a no-op seam today. See
  [procedural-assets-and-audio.md](./procedural-assets-and-audio.md).
- A shared **hit-flash / tint** helper (white-flash an enemy on hit) would round
  out the toolkit alongside `impact`.
