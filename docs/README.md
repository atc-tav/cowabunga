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

## Playbooks

Reusable how-tos for cross-cutting features:

- [title-art.md](./title-art.md) — building programmatic arcade title logos
  (arc wordmark + banner + twinkling stars) and the screenshot-driven workflow.

## How we work

Two agents, one repo:

- **The builder** ships games — new mechanics, new levels, new games — one
  vertical slice at a time, in the order set by `CLAUDE.md` (Pac-Man → Galaga →
  Donkey Kong → Mario Bros. → Dig Dug).
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

A game slice is "done feeling good" when every entry in these four checklists
passes: [Feel](./fun-and-feel.md#checklist), [RL-safe](./rl-dojo-readiness.md#checklist),
[Faithful](./faithfulness.md#checklist), [Modular](./modularity.md#checklist).
