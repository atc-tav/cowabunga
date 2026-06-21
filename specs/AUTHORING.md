# Spec Authoring Guide

How to write a game design specification for Cowabunga Arcade that is
**consistent with the specs we already have** and good enough for an LLM (or a
human) to implement a faithful clone from, without playing the original.

> **Audience:** Anyone — LLM or person — writing a new spec for the `specs/`
> folder. Read this once, then keep it open while you write. When in doubt,
> open an existing spec (`galaga-nes.md`, `arkanoid.md`, `dig-dug-arcade.md`)
> and match it.
>
> **Relationship to other docs:** `CLAUDE.md` is *how we build the codebase*.
> `docs/` is *what we're optimizing for*. `specs/` (this folder) is *the
> authoritative description of each game we intend to clone*. A spec is a
> contract for the implementer — not a guarantee of what's built yet.

---

## 1. What a spec is (and is not)

A spec is an **implementation contract written for an implementing LLM**, not a
pitch, not a design brainstorm, and not a description of our current code.

| A spec IS | A spec is NOT |
|-----------|---------------|
| An exhaustive description of one game's *mechanics* | A description of what we've already built |
| Phrased so every claim maps to a variable, function, or state | Vague design intent ("make it feel fun") |
| Researched from real sources and cited | Invented behavior or guesses presented as fact |
| Self-contained (assumes no prior knowledge of the game) | A doc that says "it works like the original" |
| Renderer-ready: ASCII sprites + typed TypeScript constants | Prose-only, untyped, unit-less |
| Self-verifying via embedded `✅ CHECK` callouts | A flat list of features with no way to test them |

### The mental model

The person reading your spec **cannot see the original game**. They will build
exactly — and *only* — what you write down. If a behavior isn't in the spec, it
won't exist. If a number is fuzzy, they'll guess. If a sprite grid is malformed,
the renderer will throw. Write accordingly.

Three habits follow from this:

1. **Every behavioral claim becomes a mechanism.** Not "the enemy gets angry,"
   but "implement `flipTimer`; when it expires before the kick, call
   `enemy.enrage()`, which increments `speed` and changes the color state."
2. **State the test, not just the behavior.** This is what `✅ CHECK` callouts
   are for (see §4.1).
3. **Self-contained always.** Restate shared mechanics in full. The *only*
   exception is a deliberate "delta" spec (see §7).

---

## 2. The canonical document skeleton

Every spec uses **these sections, in this order, with these numbers.** Pinning
the numbering (the existing corpus lets them drift — we are fixing that) means
"see §10" is meaningful across every spec.

```
# <Game> (<Year> <Platform>) — Clone Design Specification
   [build-target header block]

1.  Game Overview
2.  Playfield / Stage Architecture
3.  Core Gameplay Mechanics
4.  Enemy Specifications            (or "Entities" for non-enemy games)
5.  Special Mechanics               (game-specific systems; split into 5, 6, 7… as needed)
8.  Scoring System
9.  Progression                     (phases / rounds / stages / loops)
10. AI Patterns
11. Player / Avatar Sprite
12. Physics & Constants
13. Canonical vs. Tunable Values
14. Level / Content Data
15. LLM Self-Verification Checklist
16. Reference Sources
```

Notes on the skeleton:

- **Sections 5–7 are flexible space** for game-specific systems (tractor beam,
  POW block, power-up capsules, morph groups). Use as many numbered sections as
  you need; resume the fixed numbering at §8.
- **Every section listed is mandatory** unless this guide explicitly says
  otherwise. The two sections the existing corpus sometimes skips — Player
  Sprite (§11) and Reference Sources (§16) — are **required** going forward.
- **Sections 13 and 14 are new and required** (existing specs fold these into
  prose; we are promoting them). See §5 and §6 of this guide.

### 2.1 The build-target header block

Immediately under the H1 title, a set of blockquote callouts. Copy this shape:

```markdown
# Galaga (NES, 1985) — Clone Design Specification

> **Build target:** Browser-based clone using Phaser 3 + TypeScript; all
> sprites drawn programmatically from ASCII grids via `drawPixelArt()`.
> **Source / canon:** NES version (Bandai, 1985), based on the arcade original
> (Namco, 1981). This spec targets NES behavior.
> **Scope:** [anything explicitly in or out of scope — e.g. "Fireballs are out
> of scope."] If nothing is excluded, write "Full game."
> **LLM verification notes** appear throughout as `> ✅ CHECK:` callouts — use
> them to validate your implementation at each step.
```

The title format is fixed: **`<Game> (<Year> <Platform>) — Clone Design
Specification`**.

> **Original games.** Cowabunga also builds original games, not just clones. For
> those, title the spec `<Game> (<Year>, Original) — Game Design Specification`,
> and reinterpret three sections: **§13 Canonical vs. Tunable** becomes "identity
> invariants (the design decisions that *are* the game — don't change) vs.
> tunable feel values"; **§14 Level / Content Data** holds the procedural content
> (spawn tables, difficulty ramps, probability tables) rather than authored
> levels; and **§16 Reference Sources** becomes design influences. Everything
> else — skeleton, `✅ CHECK` callouts, sprite rules, typed constants — is
> identical. See `hydra-original.md` for the worked example.

---

## 3. Section-by-section requirements

### §1 Game Overview

A bulleted summary covering, at minimum:

- **Genre** (e.g. "fixed vertical shooter", "single-screen arena platformer")
- **Setting** (one line of flavor)
- **Core loop** (one sentence: the repeating verb cycle)
- **Win condition** and **lose condition** (state explicitly — many arcade games
  have no win condition; say "None — loops indefinitely")
- **Lives** and **extra-life thresholds** (exact numbers)
- **Screen orientation & resolution** (see §8 of this guide for the resolution rule)
- **Modes** if any (A/B difficulty, etc.)

End the section with at least one `✅ CHECK` on the single most
constraint-defining rule (e.g. Galaga's two-bullet cap).

### §2 Playfield / Stage Architecture

- A **dimensions table** (width, height, wall thicknesses, key Y positions).
- An **ASCII art diagram** of the screen layout, fenced in a plain code block.
  This is a required, expected device — see the existing specs for the style
  (box-drawing characters, labeled zones with `←` annotations).
- Prose describing each zone and any grid the game runs on (tile grid, brick
  grid, formation grid) with exact dimensions.

### §3 Core Gameplay Mechanics

The central verbs. Use **property tables** for movement (one row per property:
horizontal, jump, fall, etc.) and **numbered step sequences** for multi-step
actions (a firing sequence, a defeat sequence). Attach a `✅ CHECK` to anything
with non-obvious physics (momentum, angle reflection, grid snapping).

### §4 Enemy Specifications (or Entities)

Open with an **implementation pattern** note describing the shared base class
and its fields (`state`, `direction`, `speed`, `hitPoints`, timers, etc.).

Then **one subsection per enemy**, each containing:

- **First appears** / **Role** (one line each)
- **Behavior** (bulleted; cover movement, attacks, recovery, last-enemy state)
- **Speed/state tables** (state → trigger → color → multiplier)
- **ASCII sprite design** (see §4.2 of this guide for the strict format)
- **TX keys** and **Animation** lines (see §4.2)
- A `✅ CHECK` per non-trivial behavior

### §8 Scoring System

Exhaustive **point tables**. One table per scoring category. Include combo/
multiplier rules, depth/position modifiers, and bonus thresholds. Numbers must
be exact and sourced.

### §9 Progression

Phases / rounds / stages / loops. Include a **per-level composition table**
(enemy counts per level), the **difficulty-scaling rule**, and the
**loop/kill-screen behavior**. Use exact level numbers.

### §10 AI Patterns

Decision logic as **pseudocode and/or flow diagrams**. Describe pathfinding,
state transitions, special-case AI (flee/pursuit, fire conditions). Pseudocode
is preferred over prose for anything conditional.

### §11 Player / Avatar Sprite — REQUIRED

The player's ASCII sprites, in the same format as enemies (§4.2): run/walk
frames, jump, climb, action poses, death. Do **not** declare player TX keys in
§12's registry without providing the matching art here. (Mario Bros currently
violates this — don't copy that.)

### §12 Physics & Constants

A single typed `export const GAME = { … } as const` object. **Every numeric
value gets an inline comment with its unit** (`// px per frame`,
`// ms`, `// tiles per second`). Name thresholds (`AGGRESSIVE_THRESHOLD`),
don't bury magic numbers.

### §16 Reference Sources — REQUIRED

A bulleted list. For each source, **say what it substantiated**
(e.g. "GameFAQs FAQ by X — definitive NES source: all 12 round walkthroughs,
vegetable table, the 30-second speed-up mechanic"). Real research is expected;
inventing behavior and presenting it as canonical is the one unforgivable error.

---

## 4. The signature micro-conventions

These are the "tells" that make a spec recognizably one of ours. Get these
right and the spec will read as on-brand even before the content is reviewed.

### 4.1 The `✅ CHECK` callout — our signature device

After (almost) every non-trivial behavior, add a verification callout:

```markdown
> ✅ **CHECK — <Short Topic>:** <What to implement, in terms of named variables
> and methods.> <A concrete test case with an expected result.>
```

Rules:

- Format is a blockquote starting `> ✅ **CHECK — Topic:**`.
- **Name concrete variables/methods** (`flipTimer`, `enemy.enrage()`,
  `capsuleInFlight`). Don't say "track the state" — say which field.
- **Include a falsifiable test** wherever possible: "Place Fygar directly below
  Dig Dug — no fire should trigger." A check the reader can't run is half a check.
- Put them inline, right after the behavior they validate — not collected at the
  end. (The end-of-doc checklist in §15 is separate and serves a different role.)
- A spec with zero `✅ CHECK` callouts is off-brand and will be sent back.

### 4.2 ASCII sprite format — strict

Sprites are authored as ASCII grids inside fenced `typescript` blocks. Follow
this exact shape:

```typescript
// Shellcreeper Walk Frame 0 (12x10). S=shell (green), E=eye, L=leg, B=beak
const SHELL_WALK_0: string[] = [
  '            ',
  '  SSSSSSSS  ',
  ' SSESISSSS  ',
  // … exactly 10 rows, each exactly 12 chars wide …
];
```

Hard requirements (these are lint-able — see §9 of this guide):

1. **Rectangular.** Every row is the *same width*, and the row count and width
   **match the dimension label** in the comment (`(12x10)` = 12 wide, 10 tall).
   The existing specs are sloppy here; you must not be.
2. **A legend in the comment**: every glyph used maps to a part/color
   (`S=shell (green)`). Spaces are transparent.
3. **ASCII only.** No smart quotes, no Cyrillic look-alikes, no box-drawing
   *inside sprite grids*. (Galaga's `BOSS_HIT` currently has stray Cyrillic
   `Д`/`З` — that's a bug, not a model.)
4. **Frame pairs for animation** (`_0` / `_1`) plus **state variants**
   (flip, inflate, hit, dead) as the game needs.
5. Immediately follow the grids with:
   - `**TX keys:** \`shellWalk0\`, \`shellWalk1\`, \`shellFlip\``
   - `**Animation:** alternate \`shellWalk0\` ↔ \`shellWalk1\` at ~200ms/frame; mirror horizontally by \`direction\`.`

Sprites describe colors **by named token only** (the legend). Actual hex lives
in the palette block (§5 of this guide, the canon/tunable section, or a dedicated
palette table) — never leave the implementer to invent colors.

### 4.3 TX (Texture Key) Registry

A single typed const, grouped by entity with comments:

```typescript
export const TX = {
  // Player
  marioRun0:  'mb-mario-0',
  marioRun1:  'mb-mario-1',
  // Shellcreeper
  shellWalk0: 'mb-shell-0',
  // …
} as const;

export type TXKey = keyof typeof TX;
```

- Key names are camelCase; string values are kebab-case with a game prefix
  (`mb-`, `gal-`, `dd-`, `dk-`, `ak-`).
- Convention to state in the spec: **a missing sprite definition for any TX key
  throws at init time** — never renders silently empty.
- Every key here must have matching art in the spec (enemy sections or §11).

### 4.4 Constants object

- Always typed `as const`.
- **Always name the object `GAME`** (the corpus uses both `GAME` and `PHYSICS`;
  we standardize on `GAME`). Exception: a delta spec may use `GAME_<PLATFORM>`
  and spread the parent (see §7).
- **Every value carries a unit comment.** No exceptions.

### 4.5 Tables, voice, emphasis

- **Use a Markdown table for anything enumerable**: scoring, speed states,
  dimensions, per-level composition.
- **Voice:** imperative second person toward the implementer ("Maintain a
  counter…", "Verify…"); present tense for game behavior ("The Zako dives,
  then loops back").
- **Bold the load-bearing nouns** so a skimmer catches the rules.
- Hedge **only** where the source genuinely is uncertain, and when you do, route
  the number into the Tunable list (§5 of this guide) rather than leaving it
  fuzzy in prose.

---

## 5. Canonical vs. Tunable (§13) — REQUIRED, and the most important rule

The existing specs mix fidelity-critical numbers ("POW = 3 uses") with free
choices ("aggressive threshold ≈ 5 enemies") in the same breath, so an
implementer can't tell what they're allowed to change. **Every spec must split
its quantitative claims into two explicit lists.**

```markdown
## 13. Canonical vs. Tunable Values

### 13.1 Canonical (must match the original — do not change)
| Value | Setting | Source |
|-------|---------|--------|
| POW block uses | 3 | StrategyWiki |
| Bullets on screen (player) | 2 | Namco wiki |
| Extra life threshold | 20,000 pts | … |

### 13.2 Tunable (implementer may adjust for feel; defaults given)
| Value | Default | Range | Notes |
|-------|---------|-------|-------|
| Enemy enrage multiplier | 1.6× | 1.4–1.8 | Tune to feel |
| Aggressive-mode threshold | 5 enemies | 3–6 | When formation breaks |
```

Rule of thumb: if a player or a long-time fan would *notice the game is wrong*
when the value changes, it's **Canonical**. If it only affects "feel," it's
**Tunable** — and you must give a default plus a sane range.

When a value appears in `✅ CHECK` callouts or the §12 constants object, its
canon/tunable status should be unambiguous from this section.

---

## 6. Level / Content Data (§14) — REQUIRED, and the gap we're closing

**This is the single biggest weakness in the existing specs and the thing a new
writer most needs to get right.** Today's specs fully describe *systems* but
leave *authored content* as illustrative samples:

- Galaga's fly-in paths are described as "arc right and down → loop" with **zero
  waypoint coordinates**.
- Arkanoid ships **1 of 33** stage layouts.
- Donkey Kong gives ASCII platform art but **no pixel geometry or tilt angles**.
- Dig Dug says rocks are at "fixed positions" but **never says where**.

A spec is not complete until its content data is **complete and machine-readable**,
not sampled. Section 14 must contain the *actual data* for everything the game
needs to run, in a defined schema. Concretely:

- **Per-level layouts in full.** All N stages/rounds, each as a 2D grid of cell
  codes (Arkanoid's `'.'/'W'/'S'/'X'` format is the model — extend it to every
  stage, not one).
- **Authored paths as real coordinates.** Galaga fly-in / dive paths as arrays
  of waypoints (or control points for splines), with units, not prose.
- **Fixed object placements** as coordinates (rock/cave positions, hammer
  positions, rivet positions, pipe positions).
- **Geometry that the diagram only suggests** as numbers (platform spans, girder
  tilt, gap locations) in px or tile units.

If a section genuinely can't be fully enumerated yet, mark it explicitly:

```markdown
> ⚠️ DATA INCOMPLETE: Stages 6–32 not yet authored. Implementer must not invent
> these; they block a faithful build. Tracked as a follow-up.
```

Never let missing content masquerade as a finished spec by hiding behind a
single example. Call it out so it's visible.

### 6.1 Palette block

Because §4.2 sprites reference colors by token only, §14 (or a dedicated
sub-section) must include a **palette table mapping every token to a hex value**,
per the game's authentic arcade palette. This makes the per-game `palette.ts`
directly derivable. No spec should describe a color in words alone.

```markdown
| Token | Name | Hex |
|-------|------|-----|
| S (normal) | Shell green | #4CAF2E |
| S (enraged) | Shell red | #D1232A |
```

---

## 7. The "delta" spec pattern (NES vs. arcade)

When a game has two versions worth specifying (e.g. arcade Dig Dug + NES Dig
Dug), write the **primary version as a full standalone spec**, then write the
second as a **delta document** that only describes differences. This is our
sanctioned exception to "self-contained."

Rules for a delta spec (model: `dig-dug-nes.md`):

- Header states it's a delta and names its parent: "This is the NES-specific
  spec; read the arcade spec first."
- Open with a **differences-summary table** (Feature | Parent | This version).
- Flag every divergence inline with `⚠️ <PLATFORM> DIFF:`.
- Constants spread the parent: `export const GAME_NES = { ...GAME_ARCADE,
  /* overrides */ } as const;`
- Don't restate shared mechanics — point to the parent and only document deltas.

**Default canon policy:** unless a game's primary cultural reference point is the
NES port, **target the arcade original** as the canonical version, and add an
NES delta only if specifically wanted. State the chosen canon in the header
either way.

---

## 8. Standing decisions (so you don't have to guess)

The existing six disagree on these points. Here are the resolved defaults —
follow them so new specs are *more* consistent than the current set:

| Question | Decision |
|----------|----------|
| Section numbering | **Fixed**, per §2 of this guide |
| Constants object name | **`GAME`** (not `PHYSICS`) |
| Player sprite section | **Mandatory** (§11) |
| Reference Sources section | **Mandatory** (§16) |
| Canon vs. tunable | **Mandatory split** (§13) |
| Full level/content data | **Mandatory** (§14); flag gaps loudly |
| Palette hex values | **Mandatory** (token→hex table) |
| Arcade vs. NES default | **Arcade canonical**; NES as a delta if wanted |
| Resolution | State exact logical resolution in §1; match the canonical version (arcade dims for arcade specs). Don't default to "NES-era 256×240" for an arcade game. |
| Sprite grids | **Rectangular, dimension-labeled, ASCII-only** (§4.2) |
| Renderer reference | Phaser 3 + `drawPixelArt()` (match `CLAUDE.md`); don't assume a bespoke `drawTile(char, colorState)` palette-swap engine unless you also specify it |

---

## 9. Before you submit: the self-review checklist

Run this over your own draft. The mechanical items are automated — run
`npm run lint:specs` (see §10) — but the judgment items below are on you.

**Structure**
- [ ] Title matches `<Game> (<Year> <Platform>) — Clone Design Specification`
- [ ] Build-target header block present (build target, source/canon, scope, CHECK note)
- [ ] All mandatory sections present and in the fixed numbering
- [ ] Player sprite (§11) and Reference Sources (§16) are present

**Signature conventions**
- [ ] `✅ CHECK` callouts throughout, each naming concrete vars + a test case
- [ ] Every ASCII sprite is rectangular, dimension-labeled, ASCII-only, with a legend
- [ ] Every sprite has `**TX keys:**` + `**Animation:**` lines
- [ ] `TX` registry typed `as const` with `export type TXKey`; every key has art
- [ ] Constants object named `GAME`, `as const`, every value unit-commented

**Completeness (the parts that get skipped)**
- [ ] §13 splits Canonical vs. Tunable; tunables have defaults + ranges
- [ ] §14 contains *complete* level/content data, or loudly flags `⚠️ DATA INCOMPLETE`
- [ ] Palette table maps every color token to hex
- [ ] All scoring numbers are exact and sourced

**Cross-contamination & correctness (real bugs we've found)**
- [ ] No values copied from another game's spec (e.g. a brick-breaker must not
      reference a "rock crush" table)
- [ ] No internal contradictions — prose tables, formulas, and the constants
      object agree (e.g. silver-brick hit counts must match in all three places)
- [ ] Win/lose conditions, lives, and extra-life thresholds stated and consistent

**Sourcing**
- [ ] Reference Sources lists each source and what it substantiated
- [ ] Nothing is invented and presented as canonical; uncertainty is hedged and
      routed to the Tunable list

---

## 10. The spec linter

Most of the mechanical items in §9 are enforced automatically by a linter:
`scripts/lint-specs.mjs`. Run it before submitting any spec.

```bash
npm run lint:specs                 # lint every specs/*.md
node scripts/lint-specs.mjs specs/pac-man-arcade.md   # one file
node scripts/lint-specs.mjs --strict                  # warnings also fail
```

It's a single dependency-free Node script (Node builtins only), so it runs
anywhere the repo does — no install step.

### 10.1 How it works

The linter reads each spec as plain text and runs a series of independent
checks. It does **not** understand game design — it only catches *structural*
defects and copy-paste bugs. Each check appends findings tagged **ERROR** (a
real defect — fails the run, exit code 1) or **WARN** (the standard isn't met
yet — informational; only fails under `--strict`). Output is grouped per file
with line numbers, ending in a summary table.

The checks, by rule name (the `[tag]` shown in output):

| Rule | Severity | What it catches |
|------|----------|-----------------|
| `title` | error/warn | H1 must end `— Clone Design Specification`; should carry `(<Year> <Platform>)` |
| `header` | warn | Missing `**Build target:**` header callout |
| `check-callouts` | warn | No `✅ **CHECK**` callouts in the file |
| `sections` | error/warn | A required section heading is absent (see `REQUIRED_SECTIONS`) |
| `constants` | warn | Constants object missing, or named `PHYSICS` instead of `GAME` |
| `sprite-shape` | error | An ASCII sprite's rows are not all the same width |
| `sprite-dims` | error/warn | Grid size doesn't match its `(WxH)` label; or no label present |
| `sprite-ascii` | error | A non-ASCII glyph inside sprite art (e.g. a Cyrillic look-alike) |
| `contamination` | error | A term unique to *another* game's spec appears (copy-paste leak) |
| `tx` | warn | No typed `TX` registry / `TXKey`; or a referenced TX key isn't declared |

How the two trickiest checks work:

- **Sprite grids** (`sprite-shape` / `sprite-dims` / `sprite-ascii`): the linter
  finds every `const NAME: string[] = [ … ];` block, collects the quoted rows
  (tolerating a trailing `// comment`), looks back up to 3 lines for a `(WxH)`
  label, then asserts the rows are uniform width, match the label, and contain
  only ASCII. This is what flags ragged art and stray non-ASCII characters
  before they reach `drawPixelArt()`.
- **Contamination** (`contamination`): each game has a short list of
  *genuinely unique* terms in `GAME_SIGNATURE_TERMS` (e.g. `pooka`/`fygar` for
  Dig Dug, `vaus`/`doh` for Arkanoid). The owning spec is identified from the
  filename; if any *other* game's unique term appears, it's almost always a
  paste from the wrong template. (This is how we found a Dig Dug "rock crush"
  line living in the Arkanoid checklist.) Shared words like "barrel" are
  deliberately excluded to avoid false positives.

### 10.2 What it does NOT check

These remain manual review items (§9): internal numeric contradictions across
prose/formula/constants (e.g. silver-brick hit counts disagreeing), whether
level/content data is genuinely *complete* vs. sampled, palette accuracy, and
whether sourcing is real. The linter proves a spec is *well-formed*, not that
it's *correct or complete*.

### 10.3 Extending it

The config lives at the top of the script and is the only part you normally
touch:

- **`REQUIRED_SECTIONS`** — add a `{ name, re, severity }` row to require a new
  section. Use `severity: 'warn'` for a new standard so pre-existing specs
  aren't broken retroactively; promote to `'error'` once they're updated.
- **`GAME_SIGNATURE_TERMS`** — add an entry (`'<filename-substring>': [terms]`)
  for each new game. Only list terms unique to that one game.

When you add a brand-new check, push findings via `r.error(...)` / `r.warn(...)`
inside a `checkX(text, r)` function and call it from `lintFile`. Keep checks
mechanical and high-signal — a noisy linter gets ignored.

> **Known state:** the six original specs predate the linter and currently
> report real errors (ragged sprites, the Galaga Cyrillic glyph, the Arkanoid
> contamination) plus warnings for the newer-standard sections. Fixing those is
> tracked separately; new specs should pass clean.

## 11. Adding the finished file

1. Save it in `specs/` with a lowercase-kebab filename, `<game>-<platform>.md`
   (e.g. `pac-man-arcade.md`, `frogger-arcade.md`).
2. Add a row to the index table in `specs/README.md`.
3. If it's a delta spec, note the parent in the README "Notes" section, as the
   Dig Dug NES entry does.

That's it. Match the existing specs, follow the standing decisions above, and
your spec will drop straight into the set.
```