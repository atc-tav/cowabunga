# `testkit` — agentic game-testing framework (design)

> **Status:** design spec (v1). This README defines the contract and the
> workflow; the implementation lands incrementally. Arkanoid is the first
> worked example — see `src/games/arkanoid/test-design/TEST_DESIGN.md`.

> **This is the machine; the method that feeds it is
> [`docs/spec-driven-development.md`](../../../docs/spec-driven-development.md).**
> `testkit` runs the checks — but *which* checks must exist comes from an
> **Oracle Ledger** built from the spec *before* the game is written. Tests that
> don't trace to the spec certify the wrong thing (that's how Galaga went green
> at 52% faithful). Start a new game's ledger from
> [`TEST_DESIGN.template.md`](./TEST_DESIGN.template.md).

## Why this exists

The collection is built by agents, slice by slice. The bottleneck on quality
is **verification**: a human can't playtest every change to every game. The
goal of `testkit` is to let an agent prove that the **~90% of a game that is
objectively checkable** still works after a change, so the human only spends
attention on the **~10% that genuinely needs a person** (feel, fun, difficulty,
aesthetics).

This is achievable because our games are deterministic simulations with
inspectable state. The trick is to **test against game state and invariants,
not pixels.** Screenshots are evidence for the human pack — they are not the
oracle.

## The four test modes

| Mode | Runs in | Speed | Catches | Oracle |
|------|---------|-------|---------|--------|
| **1. Unit** | Node (vitest) | ms | Math/logic bugs | exact return values |
| **2. Scenario** | Headless browser | ~1s each | Wiring/state bugs | asserted state after a scripted act |
| **3. Invariant / fuzz** | Headless browser | seconds | Crashes, impossible states, regressions | properties that must hold *every frame* |
| **4. Human pack** | Headless → human | minutes (human) | Feel, fun, looks | a person + checklist |

The cheapest mode that can catch a class of bug should own it. **Pull logic
out of the scene into pure functions** so it can be tested in mode 1 — angle
clamping, RNG, score thresholds, and layout parsing belong here and should
never need a browser.

## The contract: `GameTestSurface`

A game becomes testable by exposing **one object** to the harness. The harness
is fully game-agnostic; it only knows this interface.

```ts
export interface InvariantViolation {
  /** stable id, e.g. "ball-speed-bounds" */
  rule: string;
  detail: string;
}

export interface GameTestSurface<Snapshot = unknown> {
  /** Matches the registry game id (e.g. "arkanoid"). */
  readonly gameId: string;

  /**
   * A JSON-serializable snapshot of everything assertions care about.
   * Keep it flat and cheap — it is read every frame in fuzz mode.
   */
  snapshot(): Snapshot;

  /**
   * Properties that must hold on the current frame. Return [] when healthy.
   * This is the heart of fuzz testing — see TEST_DESIGN.md for the catalog.
   */
  invariants(): InvariantViolation[];

  /**
   * Deterministic seams scenarios use to *set up* situations: seed the RNG,
   * skip to a stage, spawn a specific enemy, force a capsule type, place the
   * ball, etc. Names + signatures are per-game and documented by the game.
   */
  readonly hooks: Readonly<Record<string, (...args: never[]) => void>>;
}
```

The game registers its surface on a global the harness reads:

```ts
// only wired in dev/test builds — never in production
registerTestSurface(new ArkanoidTestSurface(scene));
// -> window.__testkit.surfaces['arkanoid']
```

## Determinism: the two requirements

Flaky tests are worse than no tests. Two seams make a real-time game
deterministic:

1. **Seeded RNG.** Replace ambient `Math.random()` in gameplay with an
   injectable RNG (`shared/Rng.ts`). The surface's `seed(n)` hook resets it.
   Same seed ⇒ same capsule drops, enemy spawns, and ball jitter. (Bonus: this
   also implements Arkanoid's spec'd score-seeded capsule RNG.)
2. **Fixed-timestep tick.** In test mode the harness stops the RAF loop and
   advances the game by calling `game.step(time, FIXED_DT)` exactly N times via
   `__testkit.tick(frames)`. No `waitForTimeout` races; "3 seconds of play" is
   `tick(180)` and is byte-for-byte reproducible.

Both live in the reusable kit; a game only has to *use* the shared RNG.

## The harness (node side, Playwright)

Mechanics already proven in this repo:

- Launch the **pre-installed** Chromium at `/opt/pw-browsers/...` with
  `--use-gl=swiftshader` (the Playwright CDN is blocked here, so don't
  `playwright install`).
- The dev server exposes the game; the test build exposes `window.__testkit`.
- **Input gotcha:** Playwright's `keyboard.press()` fires down+up in one tick,
  which Phaser's edge-triggered input misses. Use `down → tick → up`, or better,
  inject actions through a surface hook rather than synthetic key events.

A scenario is just: `boot → seed → set up via hooks → tick → read snapshot →
assert`. A fuzz run is: `boot → seed → loop { random action; tick; collect
invariant violations } → report`.

## Adapting `testkit` to a new game — the checklist

Onboarding a game is a bounded, mechanical task — **but the order matters.** The
Oracle Ledger comes *first*, derived from the spec, because it dictates what the
snapshot and hooks must expose. (Building the surface first, then testing
whatever it could reach, is how a game goes green while missing half its spec.)

1. **Author the Oracle Ledger first** — copy
   [`TEST_DESIGN.template.md`](./TEST_DESIGN.template.md) to
   `src/games/<game>/test-design/TEST_DESIGN.md` and fill it **from the spec**
   (`specs/<game>.md`, linted per `specs/SPEC_GUIDE.md`): the risk map
   (P0/P1/P2 + human), a spec-traced oracle-per-mechanic table, the invariant
   catalog, and the scenario list. Every spec section becomes a row. This is the
   expertise layer and the definition of done — see
   `docs/spec-driven-development.md`. Get it reviewed before writing game code.
2. **Switch gameplay RNG to `shared/Rng.ts`.** Grep the game for
   `Math.random` and route it through the injected instance.
3. **Write `<Game>TestSurface`** implementing `GameTestSurface`, shaped by what
   the ledger's assertions need to read and drive:
   - `snapshot()` — surface the scalar state your assertions need (score,
     lives, phase/flow, entity counts, key flags).
   - `invariants()` — encode the ledger's "can never be true" list for this game
     (see the Arkanoid catalog as a template: bounds, conservation counts,
     mutually-exclusive flags, no overlaps, known-state-only).
   - `hooks` — the minimum set of deterministic seams your scenarios need to
     reach interesting states quickly (skip-to-level, spawn, force-drop, etc.).
4. **Register the surface** behind the test-build flag.
5. **Implement the game to green** against the ledger; reuse the shared harness,
   scenario runner, and human-pack generator as-is.

If steps 2–3 feel hard for a game, that is usually a *design* signal: state
that can't be snapshotted or seams that can't be reached often means logic is
tangled into rendering and should be teased apart anyway.

## What stays human (by design)

The framework must **not** pretend to judge these — it should make them fast to
review and then get out of the way:

- **Feel** — input latency, paddle/ball speed, "juice".
- **Fun & difficulty** — pacing, the difficulty curve, capsule generosity.
- **Aesthetics** — sprite/colour readability, layout, effects.
- **Audio** — once procedural sound exists.

For these, mode 4 produces a **review pack**: a deterministic screenshot
contact sheet (one per stage / key state) plus a short checklist the human
ticks. The human verdict is the oracle; the kit just stages the evidence.

## Non-goals

- No pixel-diff regression testing (brittle; defeated by intended art changes).
- No attempt to score "fun".
- No replacement for a human's final sign-off before a release tag.
