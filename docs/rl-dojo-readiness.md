# Imperative 2 — RL Dojo Readiness

> Every game is a deterministic, cleanly resettable, observable environment.

These games aren't just for humans — they're a reinforcement-learning dojo. That
makes "polish" mean more than feel: an RL environment that isn't reproducible,
resettable, frame-rate independent, and observable is a broken environment, no
matter how good it looks. This imperative carries **equal weight** to Fun & Feel
(see the tie-breaker in the [index](./README.md#the-cross-cutting-tensions-and-how-we-resolve-them)).

## The four properties

### 1. Determinism — same seed + same inputs ⇒ same episode

Randomness must flow through a **single seedable source**, never ad-hoc calls.

Current state (be honest about it):

- ✅ `shared/gridAI.ts` `chooseRandomDirection` takes an injectable
  `rng: () => number = Math.random` — Pac-Man's frightened wandering is already
  seedable-ready.
- ⚠️ `games/donkeykong/DKScene.ts` mixes **two unseeded sources**: raw
  `Math.random()` (fireball/barrel direction & descent) and `Phaser.Math.Between`
  (timers, jitter — Phaser's *global* RND). Neither is wired to an episode seed.
- ✅ `games/galaga/starfield.ts` uses `Phaser.Math.Between`, but it's
  **cosmetic** (star positions) and doesn't affect game state — acceptable.

**Target:** one `Rng` abstraction, seeded per episode, threaded through every
gameplay decision. Cosmetic-only randomness (starfield) may stay loose if it
never touches state or reward.

### 2. Clean reset — every episode starts from an identical blank slate

The pattern is already established: **rebuild all state in `createGame()`**, not
the constructor (which runs once). Pac-Man is the reference — see its
`createGame()` comment: *"createGame runs on every (re)entry but the constructor
does not, so clear any state carried over from a previous play."* No state may
leak across `scene.restart()` / menu re-entry.

### 3. Frame-rate independence — behavior is wall-clock, not frame-count

All movement and timers scale by `delta` (ms). `update(time, delta)` →
`updateGame(time, delta)` and everything downstream multiplies by `delta`. Never
advance state by a fixed amount per frame. Visual helpers follow suit:
`impact`/`screenShake` are duration-based, not frame-count based.

### 4. Observation stability & reward clarity

- **Stable pixels:** visual flourishes that jitter the whole frame (screen
  shake) corrupt a pixel-observation agent. They route through a global gate —
  `setJuiceEnabled(false)` in `shared/juice.ts` — so the dojo gets clean frames
  with zero game-code changes. Score popups stay on (deterministic, informative).
- **Reward signal:** `ScoreManager` + `addScore`/`popScore` is the canonical
  scalar reward. Keep score changes tied to meaningful game events so the signal
  is dense and legible.

## <a name="checklist"></a>Checklist — "RL-safe"

- [ ] All gameplay randomness flows through the seedable RNG (no bare
      `Math.random()` / unsown `Phaser.Math.Between` in state-affecting paths).
- [ ] All state is rebuilt in `createGame()`; nothing leaks across a reset.
- [ ] All movement/timing scales by `delta`; no per-frame constants.
- [ ] New visual flourishes are gated by `setJuiceEnabled` (or are otherwise
      observation-neutral).
- [ ] Score changes map to real events — reward stays dense and legible.

## Open threads

- **Unify the RNG.** Introduce a seeded `Rng` and migrate DK's `Math.random()`
  and gameplay `Phaser.Math.Between` calls onto it; pass the existing
  `gridAI` `rng` hook from the scene. Highest-leverage reproducibility fix.
- **Episode API.** A thin headless step/reset surface (seed in, frame +
  reward + done out) so the dojo can drive a scene without the menu.
