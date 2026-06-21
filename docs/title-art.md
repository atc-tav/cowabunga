# Title Art — playbook for arcade title screens

How we build programmatic, hand-drawn-looking title logos (no asset files) and
the workflow that gets them there. The reusable engine is
[`src/shared/titleArt.ts`](../src/shared/titleArt.ts); the first preset built on
it is the menu's COWABUNGA logo in
[`src/scenes/logo.ts`](../src/scenes/logo.ts). Every game will get a title, so
this captures the recipe, the knobs, and the lessons.

## The recipe (three layers)

A title is composed of three layers that read together as an arcade logo:

1. **Banner** — a trapezoid (wider at top) with a bold subtitle, e.g. *CLASSIC
   ARCADE GAMES*. Drawn twice (a slightly larger black fill behind the colour)
   for a chunky outline.
2. **Arc wordmark** — the game name in a chunky pixel **block font**, bent onto
   a single circle so it forms one continuous arc, growing and tilting toward
   the ends.
3. **Starfield** — a few sparkles that twinkle in the **black gaps** around the
   wordmark.

Compose all three with one call:

```ts
import { drawArcTitle, ArcTitleSpec, BLOCK_FONT } from '../shared/titleArt';

const SPEC: ArcTitleSpec = {
  banner:   { text: 'CLASSIC ARCADE GAMES', width: 200, height: 16, inset: 9,
              fill: 0xd1232a, outline: 0x000000, textColor: '#ffffff', fontSize: 13 },
  wordmark: { text: 'COWABUNGA', font: BLOCK_FONT, fill: 0x86d52a, crack: 0x3f7d1e,
              outline: 0x000000, pixelSize: 2, grow: 0.5, growExp: 1.3,
              gapTight: -2, targetArc: 200, endAngleDeg: 36 },
  starColors: [0xfcfc00, 0xffffff, 0x3cbcfc],
};

drawArcTitle(scene, centerX, topY, SPEC); // returns the height it drew
```

## The key idea: arc text, not per-letter rotation

The make-or-break insight. Our first attempt rotated each letter around its own
centre and nudged it along a shallow parabola. It looked **disjointed** — the
baselines didn't share a curve, so the letters read as disconnected fragments.

The fix is real **arc text**: pick one circle (radius derived from the arc-length
budget and the desired end-tilt), then place every letter so its **baseline sits
on the circle** (`origin (0.5, 1)`) and it's **rotated tangent** to it. The
wordmark becomes a single continuous arc, and the geometry gives you the
arcade-logo look for free:

- outer letters' **bottoms drop much lower** than the centre,
- outer letters' **tops drop a little lower** than the centre,
- with `grow`, the **end letters are taller** (C/A pop, O/G transition).

## The knobs (`WordmarkSpec`)

| Field | What it does | COWABUNGA |
|------|---------------|-----------|
| `targetArc` | Arc-length budget → overall size. | `200` |
| `endAngleDeg` | Tilt of the outermost letters → how curved. | `36` |
| `grow` | Extra height the ends gain over the centre. | `0.5` |
| `growExp` | `>1` makes only the very ends pop; `1` is linear. | `1.3` |
| `gapTight` | Negative tracking so neighbours share only their outlines. | `-2` |
| `pixelSize` | Generation size of each glyph cell. | `2` |

Banner: keep it **tight** (small `height`, subtitle near full height). The
wordmark is placed to overlap the banner's **fill** but never its **text**.

## Layering rules (don't relearn these)

- Wordmark renders **in front of** the banner (`depth 22 > 21`): its tops can
  cover a little banner fill, never the subtitle. Place its top just below the
  subtitle's ink.
- Stars sit **behind** the letters (`depth 21 < 22`): a star that drifts too far
  is hidden by a glyph rather than drawn on top of it.

## Starfield: only in the black

Stars must read as sitting in empty space, so they're confined to:

- the **wedges** just under the banner, above the dipping outer letters, and
- the **concave pocket** beneath the arc — but **never below the big end
  letters' bottoms** (`endBottom`, which `drawArcWordmark` returns).

Each star fades + scales in and out on a **staggered** loop (random delay /
duration) so the field shimmers instead of blinking in unison, and is
**re-placed to a fresh random point** in its zone at the start of each cycle so
the field never repeats. Tint from a small palette (we use yellow / white / UI
light-blue).

## Constraints (this is Cowabunga)

- **Programmatic only** — no asset files. Glyphs are pixel grids; the outline and
  crack texture are generated from each glyph (`outlineGlyph`).
- **Fit the canvas** and leave room for what's below (the menu nudged the TV down
  to clear the deeper arc). `drawArcTitle` returns its height to help.
- Match the project's **pixel aesthetic** — a faithful interpretation of a
  reference, not a 1:1 copy of smooth artwork.

## Adding a title for a new game

1. Make sure every letter of the word exists in `BLOCK_FONT`
   (`src/shared/titleArt.ts`). Add any missing glyphs using the same **8×9**
   footprint (`'#'` body, `' '` empty); the outline is added automatically.
2. Define an `ArcTitleSpec` preset (palette + banner + knobs) next to the scene
   that uses it.
3. Call `drawArcTitle(scene, cx, topY, spec)` and lay out the rest below the
   returned height.

## Workflow that made this fast: screenshot-driven iteration

Title art is visual; you cannot tune it blind. We drove a headless browser to
screenshot the **real** running app and looked at each change:

```bash
npm run build
npx vite preview --port 4319 &           # serve the built app
# puppeteer (bundled Chromium): load the page, wait, screenshot '#game canvas'
node shot.mjs http://localhost:4319 out.png
```

Lessons that generalised:

- **Iterate on real frames, not assumptions.** Every "looks about right" guess
  that shipped without a screenshot was wrong about something (clipping, a star
  on a letter, the curve inverted).
- **Capture a few frames** for anything animated (the twinkle) — one frame lies
  about a staggered loop.
- **Keep the tooling out of the repo.** Puppeteer was a dev-only convenience;
  it's installed transiently and never committed (no `package.json` change).
- **Annotated reference beats prose.** The single most useful piece of feedback
  was screenshots with the curve / tops / bottoms drawn over them — it turned
  "feels off" into a precise, mechanical fix.
- **Name the diagnosis before coding.** Calling the problem "disjointed because
  the baselines don't share a curve" pointed straight at arc text; chasing the
  symptom (tweaking angles) would not have.
- **One concern per change, verify, commit.** Sizing, then spacing, then stars —
  each verified on a frame before the next.
