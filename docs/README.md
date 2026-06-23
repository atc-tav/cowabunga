# Cowabunga — Strategic Docs

`CLAUDE.md` covers **how to build** a game in this repo. These docs cover
**what we're optimizing for** and **how we resolve the tensions** between those
goals. They're organized by strategic imperative — read the one that matches
the decision in front of you.

## The imperatives

| # | Imperative | One-line north star | Doc |
|---|------------|---------------------|-----|
| 1 | **Fun & Feel** | Every action confirms itself; the game feels alive in the hand. | [fun-and-feel.md](./fun-and-feel.md) |
| 2 | **RL Dojo Readiness** | Every game is a deterministic, cleanly resettable, observable environment. | [rl-dojo-readiness.md](./rl-dojo-readiness.md) |
| 3 | **Faithfulness** | Recreations read true to the originals — feel beats flash. | [faithfulness.md](./faithfulness.md) |
| 4 | **Modularity & Reuse** | ~80–90% shared primitives; behavior composes on top. | [modularity.md](./modularity.md) |
| 5 | **Procedural Everything** | No asset files. Sprites drawn in code, sound synthesized in code. | [procedural-assets-and-audio.md](./procedural-assets-and-audio.md) |

## ⭐ The factory process (read before building any game)

- [spec-driven-development.md](./spec-driven-development.md) — **the most
  important doc in the repo.** Make the spec executable (an *Oracle Ledger*)
  *before* writing the game. This single discipline is the difference between
  our best clone (Arkanoid, 86% faithful) and our worst (Donkey Kong, 48%, with
  a *longer* spec). The imperatives above are the goals; *this* is the method
  that actually hits them. Faithfulness (#3) is the outcome; this is the how.
- [vetting-ledgers.md](./vetting-ledgers.md) — **for humans reviewing an agent's
  ledger.** How to tell a good assertion from a bad one, with worked
  good-vs-bad examples across several games. Vetting the ledger before code is
  written is the highest-leverage thing a human does here.

## Playbooks

Reusable how-tos for cross-cutting features:

- [title-art.md](./title-art.md) — building programmatic arcade title logos
  (arc wordmark + banner + twinkling stars) and the screenshot-driven workflow.
- [shared/world/README.md](../src/shared/world/README.md) — the scrolling-game
  foundation (ASCII tilemap, swept tile collision, scrolling camera) for the
  camera-scrolling platformer/adventure projects.

## How we work

Two agents, one repo:

- **The builder** ships games — new mechanics, new levels, new games — one
  vertical slice at a time, in the order set by `CLAUDE.md` (Pac-Man → Galaga →
  Donkey Kong → Mario Bros. → Dig Dug). The builder works the
  [spec-driven, oracle-gated process](./spec-driven-development.md): **lint the
  spec → build the Oracle Ledger → implement the slice to green.** No slice is
  "built" until its ledger rows are green — code without a ledger is the habit
  that produced our fake clones.
- **The polisher** makes the shipped games *feel* good — juice, taste,
  reproducibility — and never rewrites in-flight game logic. Polish **layers on
  top of** the shared primitives; it composes, it doesn't refactor someone
  else's slice out from under them.

Both keep `npm run build` green on every commit. Small, single-concern commits.

## The cross-cutting tensions (and how we resolve them)

These are the decisions that span imperatives. When two pull against each other,
this is the tie-breaker:

- **Fun vs. RL-readiness** → *both, equally.* A juice change is only "done" when
  it also preserves determinism, clean reset, and frame-rate independence. The
  pattern: keep flourishes **visual-only** and **globally gateable** (see the
  `setJuiceEnabled` switch in [fun-and-feel](./fun-and-feel.md) /
  [rl-dojo-readiness](./rl-dojo-readiness.md)), so the dojo gets stable frames
  without touching game code.
- **Faithfulness vs. flash** → *faithfulness wins.* If the original didn't do
  it, we need a real reason to. (Pac-Man gets score popups but **no screen
  shake** — the arcade machine never shook, and it's a game of precision.)
- **Velocity vs. polish** → *velocity ships, polish follows.* The builder
  doesn't block on feel; the polisher doesn't block the builder. Shared
  conventions (`popScore`, `impact`) make the later polish pass cheap.

## Definition of done (the short version)

**The gate, first:** a game slice isn't done until its
[Oracle Ledger](./spec-driven-development.md) traces the spec and every
non-`human` row is green (`npm run test:game -- <game>` + `fuzz:game` clean).
That is faithfulness, made measurable.

**Then the human ~10%:** every entry in these four checklists passes —
[Feel](./fun-and-feel.md#checklist), [RL-safe](./rl-dojo-readiness.md#checklist),
[Faithful](./faithfulness.md#checklist), [Modular](./modularity.md#checklist).
