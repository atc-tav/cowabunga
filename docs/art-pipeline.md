# Art Pipeline — design-time authoring, code-drawn runtime

> **Status: EXPERIMENT PENDING.** This doc proposes a revision to Imperative 5
> (*Procedural Everything*) and the bake-off that decides whether we adopt it.
> Nothing here is the standard yet — `docs/procedural-assets-and-audio.md` still
> governs until the bake-off resolves. See **Decision gate** at the bottom.

## Why we're revisiting the principle

The original principle — "no asset files; sprites drawn in code" — was a bet that
programmatic art could reach arcade quality *at scale, purely through code*. We
now have **user-feedback evidence against the principle as implemented**: every
human shown the Donkey Kong build called the art a deal-breaker that reads as
amateurish (salmon bars with stray blue dots for girders, a crude DK blob, a
placeholder triangle fireball, and — the worst offender — a giant system-font
"GO!" that looked like a browser alert).

Crucially, that screenshot was **three different failures wearing one coat**:

1. **Code/style bugs** that no art tool fixes — the "GO!" was a 40px plain
   `Text`. (Fixed: chunky arcade styling + scale-pop. The deeper fix is a shared
   programmatic overlay font — see *Follow-ups*.)
2. **Poorly-authored grids** `drawPixelArt()` could render well with care — the
   girders had the wrong studs and no shading. (Fixed: three-tone shaded beam +
   real rivets.)
3. **Genuinely hard-to-hand-author sprites** — a detailed, weighty DK or an
   animated fireball is miserable to hand-place as TypeScript arrays. **This is
   the real gap**, and where an authoring tool (e.g. PixelLab) earns its keep.

Only (3) justifies a new tool. (1) and (2) are execution quality — the same
"wrote it, then looked at it" failure the spec-driven process exists to prevent.

## The candidate principle (revised Imperative 5)

> **No *runtime* asset files. Design-time authoring is allowed. The shipped game
> is still code-drawn.**

This keeps what was actually valuable about the original constraint — a
deterministic, asset-free, port-friendly runtime where *the recipe is the asset*
— while dropping the part reality rejected: the demand that every pixel also be
*authored* by hand in code. A tool may **design** a sprite; its output is
**baked into a pixel grid** (the same `string[]` rows `drawPixelArt()` already
eats) and committed as code. The runtime never loads a PNG.

**Artifact, not craft.** The imperative is about the shipped *artifact* (no
runtime assets, deterministic, Unity/RL-port-safe), not about the *authorship*
of the pixels. This reading is the project owner's explicit ruling.

## The pipeline (bake-to-grid)

Design-time only; the runtime is untouched.

```
art-src/<game>/<sprite>/        ← tool export (export.png) + reference.png
        │
        ▼  npm run sprites:bake -- --game <id> --src export.png --name <SPRITE>
src/games/<game>/sprites.ts     ← quantized pixel grid + { key: 0xRRGGBB } legend,
                                  with a `// source:` provenance header
        │
        ▼  drawPixelArt(scene, key, grid, legend)   (unchanged)
runtime: a texture built in code — no asset load, deterministic
```

- **Palette-locked.** The bake quantizes every pixel to the game's `palette.ts`.
  Best results come from constraining the *tool* to that palette up front;
  quantize-after is the fallback (that's where sprites go muddy).
- **Regenerable.** Each baked grid carries a `// source:` header (prompt /
  reference, tool, date) so a sprite stays reproducible — not a magic array
  nobody can edit. This preserves the one genuinely good property procedural
  gave us for free.
- **Tooling:** `scripts/sprites/bake.mjs` (`npm run sprites:bake`) +
  `npm run sprites:selftest` (a round-trip proof the quantizer is exact).

## Where art quality lives in THE PROCESS

Sprite quality is **aesthetic — the human ~10%**. It must **never** enter the
Oracle Ledger (the ledger is *behavior*; mixing in "looks good" is how
faithfulness scores go fake). Its analog of the test surface is a **contact
sheet**: every sprite rendered at 1×/4× beside the arcade reference, for human
sign-off (`art-src/contact-sheet.html`). That's the aesthetic gate; the ledger
stays behavioral.

## The bake-off (the deciding experiment)

One sprite (Donkey Kong), authored three ways, judged on a **pre-registered**
rubric so we can't rationalize after seeing results.

| Sprite version | Who authors |
| --- | --- |
| **hand-crafted** | a *carefully* drawn `drawPixelArt` grid (not dashed off) |
| **transcribed** | the actual arcade sprite, transcribed pixel-for-pixel |
| **pixellab-baked** | PixelLab export → `sprites:bake` → grid |

**Rubric (score each 1–5, decide before looking):**

1. **Faithful to reference** — reads as *the* DK, not *a* gorilla.
2. **Clean at native resolution** — holds up at 1×, not just zoomed.
3. **Palette-disciplined** — within the game's palette; cohesive.
4. **Animation-frame coherence** — frames read as one character moving.
5. **Bake throughput** — *manual touch-up minutes per sprite* after the one
   command. **This column decides scale**, which is the whole reason to adopt a
   tool. A gorgeous sprite needing 20 min of hand-fixing per frame does not
   scale; a 90%-there one-command bake does.

Compare against `drawPixelArt` **done right** (hand-crafted entry), not the lazy
version — the two free fixes above exist so the comparison is fair.

**Scope guardrail:** the bake-off is **one sprite + the converter**. We do *not*
convert all of DK's art until the principle is decided — the answer must land
*before* Donkey Kong goes into full production.

## Division of labor

- **Human (aesthetic judgment + setup):** stand up PixelLab, set the palette
  lock, author/approve frames, export. Never hand-edits a grid.
- **Pipeline (automatable):** quantize → bake → wire → contact-sheet.

## Decision gate

- **If `pixellab-baked` (or `transcribed`) wins** → adopt bake-to-grid as the
  standard, promote the candidate principle above into Imperative 5
  (`docs/procedural-assets-and-audio.md`) and CLAUDE.md, and keep the runtime
  code-drawn.
- **If `hand-crafted` wins** → the original principle stands unchanged; we close
  this experiment and invest in better hand-authoring discipline instead.

## Follow-ups (independent of the bake-off outcome)

- **Shared programmatic overlay font.** All overlay text ("GO!", "HELP!",
  banners) uses system monospace. A `drawBlockText` helper over an extended
  `BLOCK_FONT` (digits + punctuation) would render arcade pixel glyphs through
  the existing `drawPixelArt` path — fixing the root cause the "GO!" hack only
  papered over, for every game at once.
