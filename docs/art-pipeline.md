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
6. **Density calibration** — bake the PixelLab **DK *and* Mario** (plus a girder
   tile) and drop them in one scene at the same integer scale. `sprites:density`
   must report the **same atom K and hard edges** for all of them. A density
   mismatch (or anti-aliasing) is a **dealbreaker** — caught here, before we
   commit, for the price of one screenshot. See *Pixel cohesion* below.

Compare against `drawPixelArt` **done right** (hand-crafted entry), not the lazy
version — the two free fixes above exist so the comparison is fair.

**Scope guardrail:** the bake-off is **one sprite + the converter**. We do *not*
convert all of DK's art until the principle is decided — the answer must land
*before* Donkey Kong goes into full production.

## Pixel cohesion — the atom

The cardinal rule of pixel art: the whole game shares **one logical pixel** — an
indivisible atom — and nothing ever renders at a fractional or differently-sized
pixel. Two things both get called "pixel"; keep them apart:

- **Display pixel** — a physical screen pixel. Scales freely, means nothing
  artistically.
- **Logical pixel (the atom)** — the game's internal unit. This is what we
  protect.

**Cohesion is about *density*, not *size*.** A bigger character is *more pixels,
not bigger pixels*. DK at 64×64, Mario at 32×32, Pauline at 32×64 are different
*counts* of the *same atom* — authentic (arcade DK really is a big multi-pixel
ape next to a tiny Mario), and fine **so long as every asset is authored at the
same density**. The governing invariant:

> Every asset's **(true logical pixels ÷ intended tile-span) = the same K**.
> K is the atom — logical pixels per tile. Cohesion ≡ "K is constant."

So a tool's minimum canvas (e.g. PixelLab's 32×32) is **not** the world unit —
it's a character-canvas floor. The **tile unit** (typically 8 or 16 logical px in
NES-era games) is a separate, smaller choice; characters span multiple tiles.

### The render side is already enforced by the engine

`main.ts` + `BaseGameScene.ts` already do the right thing: each game renders at
its own **internal resolution** (e.g. 256×288), with `pixelArt: true`
(nearest-neighbor, no bilinear blur) and `roundPixels: true` (integer
sprite/camera placement), and the canvas upscales as a whole via `Scale.FIT`.
That *is* the "one global scale, applied to the canvas, never to a sprite" rule.

- **Never `.setScale()` a *base* sprite.** Per-sprite scaling is the #1 way to
  break the atom. (Transient juice tweens that pop and return to scale 1 — like
  the countdown — are fine; they're FX, not the base size.)
- **`FIT` caveat:** FIT fits the parent *exactly*, so its canvas scale can be
  *fractional* (3.37×), making some logical pixels 3 device-px and neighbors 4.
  `pixelArt`+`roundPixels` keep it crisp but not integer-perfect. If we ever want
  integer-perfect, snap the canvas scale to the largest integer that fits (a few
  lines on the resize event). Not urgent — noted so we know the knob exists.

### The bake side enforces the atom on *input*

The real threat from an AI tool is *does its pixel equal ours?* Two failure modes
the pipeline now catches automatically (`sprites:density`):

- **Fake hi-res** — art exported upscaled (16×16 drawn at 64×64 = ×4). The check
  detects the **intrinsic scale S** and true logical dims; bake with `--cell S`
  to collapse it onto the true grid (the baker warns if you forgot).
- **Anti-aliasing** — soft/partial-alpha edges mean the atom is already mush. The
  check flags soft pixels; exports must have **hard edges**. (Quick manual
  version: open the PNG at 100% — the edges between color and transparency should
  be a clean step, no blurry transition pixels.)
- **Cross-asset mismatch** — two sprites at different K. The check asserts a
  constant K across a set and fails on mismatch.

### Adopting a finer atom is a *global re-baseline* (and the upgrade we wanted)

Our current DK sprites are coarse (Mario is **10×14**). A PixelLab world at
~32px characters means K goes **up** — which you can't mix into a 10px world.
So this is a **world decision, not a per-sprite swap**: pick the new K, raise the
game's internal resolution, and re-author its tiles at that density. The upside,
named explicitly: **more pixels = more detail = more character** — the coarse
10px Mario is part of *why* the art read as cheap. The re-baseline isn't only a
cost; it's the aesthetic upgrade the whole experiment is chasing — and the
density-calibration bake-off tells us exactly **what new native resolution** the
game must adopt to hold cohesion.

## Division of labor

- **Human (aesthetic judgment + setup):** stand up PixelLab, set the palette
  lock, author/approve frames, export. Never hand-edits a grid.
- **Pipeline (automatable):** quantize → bake → cohesion-check → contact-sheet.

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
