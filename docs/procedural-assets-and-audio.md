# Imperative 5 — Procedural Everything

> No asset files. Sprites are drawn in code; sound is synthesized in code.

> ⚠️ **Under revision (experiment pending).** User feedback showed this principle,
> as implemented, ships art people won't play. We're evaluating a design-time
> *bake-to-grid* pipeline whose candidate principle is *"no **runtime** asset
> files; design-time authoring allowed; the shipped game is still code-drawn."*
> A bake-off decides adoption — see [`art-pipeline.md`](art-pipeline.md). This
> doc remains authoritative until that gate resolves.

The whole collection ships with **zero asset files** — no PNGs, no WAVs, no font
files. Everything is generated at runtime. This keeps the repo tiny, makes every
visual diff reviewable as code, and forces a discipline that pays off on the
eventual Unity port: the *recipe* is the asset.

## Graphics — drawn, not loaded

- **`drawPixelArt()`** (`shared/textures.ts`) is the one sprite primitive. Every
  game's `sprites.ts` builds its textures from pixel-art grids through it.
- Geometry/HUD that isn't a sprite is drawn with Phaser `Graphics` (mazes,
  platforms, girders).
- **No `this.load.image(...)`** anywhere. A sprite is a grid + a palette, period.
- Text uses the system monospace font (no font files). If we ever want a true
  pixel font, we render glyphs through the same `drawPixelArt` path.

## Sound — DEFERRED no-op seam (procedural Web Audio)

`shared/SoundManager.ts` is a deliberate **no-op seam** today:

- Game code already calls `audio.play('eat')`, `audio.play('explosion')`, etc. —
  23 call sites across the games, all currently hitting an empty method.
- `unlock()` is wired to the scene's first input (browsers gate `AudioContext`
  behind a user gesture).
- The plan: synthesize each SFX with an `OscillatorNode` + `GainNode` envelope
  per sound name — **no audio files**, same as graphics.

**Why deferred, and why now is the time:** the brief said implement audio "once
gameplay feels good." It does now. Audio is the single largest remaining
feel multiplier (see [fun-and-feel.md](./fun-and-feel.md)) — and because the
seam already exists, lighting it up is implementation, not refactor.

When we build it, mind the RL imperative: synthesis must not block the sim, and
a headless/dojo run should be able to skip audio cleanly (the no-op seam already
gives us that for free).

## CRT post-FX — DEFERRED no-op seam

`shared/CRTOverlay.ts` is the same pattern: every scene calls `crt.apply()`, but
it's a no-op for now. Scanlines / curvature / glow / aberration belong on the
final upscaled output and will largely move to **Unity's post stack** on the
port. The seam means the real pipeline drops in later with zero game-code
changes.

## Checklist — "procedural"

- [ ] No new files under an `assets/` path; nothing loaded via `this.load.*`.
- [ ] Every sprite goes through `drawPixelArt()` from a grid + palette.
- [ ] New SFX go through `audio.play(name)` (works today; synthesized later).
- [ ] Scenes still call `crt.apply()` so the deferred pipeline stays seamless.

## Open threads

- **Implement `SoundManager`** with procedural Web Audio across the 23 existing
  call sites. The highest-impact unblocked feel work in the repo.
