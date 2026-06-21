# Arkanoid — Test Design

> The worked example for `src/shared/testkit/` (read that first for the
> framework + the `GameTestSurface` contract). This document is the
> *expertise* layer: what is worth testing in Arkanoid, how to assert it, and
> what only a human can sign off. It is written from the spec
> (`docs`/the original Arkanoid brief) and from how this implementation
> actually works (`ArkanoidScene.ts`).

## 1. Risk map — what to test, and how hard

Ranked by **(likelihood of a latent bug) × (impact if wrong)**. Higher tiers
get scenario *and* invariant coverage; lower tiers get a smoke scenario.

### P0 — correctness-critical and bug-prone
| Area | Why it's risky | Primary oracle |
|------|----------------|----------------|
| Ball collision integrity | sub-stepping, reflection-axis choice, corner case, angle clamp | unit (clamp) + scenario (single-brick hits) + invariant (bounds/speed) |
| Stage-clear accounting + flow | `destroyableRemaining` vs gold/silver; the mid-step transition bug already fixed once | scenario (clear a stage) + invariant (count == alive non-gold) |
| Multiball life rule | life lost **only** when the last ball is gone | scenario + invariant (`balls.length===0` ⇔ life decremented) |
| Capsule state machine | one-at-a-time, L⊻C, P-once-per-life, dup→D, B-only-if-portal-closed, multiball suppression | unit (`rollCapsuleType`) + scenarios (each rule) |
| DOH boss | 16 ball-hits only, laser no-effect, projectile instant-kill, defeat→victory | scenarios (hit count, laser immunity, instant-kill) |

### P1 — important, lower bug odds
- Brick scoring values (W50/O60/C70/G90/R100/B110/V120/Y50); silver = `50×stage`.
- Silver hit scaling by stage; gold never destroyed by ball **or** laser.
- Enemy: ball deflects by inverting **both** components and does **not** kill it;
  laser and Vaus contact **do** kill it.
- Extra-life thresholds (20k, then every 60k).
- Catch-release angle equals the paddle-zone mapping; laser beam lifecycle.

### P2 — low risk, smoke only
- Capsule fall + collect, slow-creep ramp, enlarge stacking (2nd E is a no-op).

### Human-only (the 10%)
- Paddle/ball *feel* and speed curve; capsule drop generosity; difficulty arc
  across the 32 stages; sprite/colour readability; effects; audio (later).

## 2. Oracle-per-mechanic (the asserts)

The point of this table is that **every row has a concrete, state-based
assertion** — none of it needs a human or a pixel compare.

| Mechanic | Setup (hooks) | Act | Assert (snapshot) |
|----------|---------------|-----|-------------------|
| Angle clamp | — (pure) | reflect many vectors incl. near-horizontal | `|vy| ≥ sin(30°)`; angle ∈ [30,150] |
| Anti-tunnel | `seed`, place 1 brick, ball at `maxSpeed` aimed at it | `tick` until contact | brick destroyed; ball reflected; ball never below brick row unbroken |
| Color brick | load stage, hit a white brick | `tick` | score += 50; `destroyableRemaining` −1 |
| Silver brick | skip to stage S | hit silver `silverHits(S)`× | survives N−1 hits, dies on Nth; score += `50×S` |
| Gold brick | place gold | ball + laser hit it | never destroyed; both reflect/absorb; count unchanged |
| Stage clear | force-destroy all destroyable | `tick` | `flow → cleared → ready`; `stage` +1 |
| Multiball | `splitBall()` to 3 | remove 2 balls | no life lost; remove last ⇒ life −1 |
| L⊻C | give C then L | — | `vausMode==='laser'` and `catchMode===false`; reverse cancels laser |
| P cap | force two P drops in one life | collect both | lives +1 only once |
| Dup→D | force same type twice | roll | second roll returns `D` |
| B gating | open portal, force-roll B | — | B excluded while `portalOpen` |
| Capsule suppression | 2 balls active, destroy capsule brick | — | no capsule spawns |
| Enemy deflect | spawn enemy, ball into it | `tick` | enemy alive; ball `vx,vy` both inverted; clamp still holds |
| Enemy kill | spawn enemy | laser / Vaus contact | enemy gone; score += points |
| DOH hits | skip to 33 | inject 16 ball hits | `dohHits` 16→0; `flow→victory` on the 16th |
| DOH laser immune | skip to 33 | laser at DOH | `dohHits` unchanged; beam consumed |
| DOH instant-kill | skip to 33 | projectile onto Vaus | `flow→dying` regardless of ball count |
| Extra life | `setScore(19999)` then +1 | — | lives +1 at 20k; next at 60k |
| Physics timing | drop ball from ceiling at base speed | `tick` to bottom | ~85 frames (±tolerance) |

## 3. Invariant catalog (checked every frame in fuzz mode)

These must hold **at all times** during random play across stages. Any
violation is a bug, full stop.

1. `balls.length === activeBallCount`; a life is lost **iff** `balls.length`
   reached 0 that frame.
2. Ball speed ∈ `[base×slowFloor, ballMaxSpeed]`; `|vy| ≥ minVerticalSpeed`.
3. Every ball is in-bounds (`x∈[left,right]`, `y≥top`) **unless** it is exiting
   below the Vaus.
4. `destroyableRemaining ≥ 0` and equals the count of alive non-gold bricks.
5. A gold cell is never removed.
6. At most one capsule in flight; `capsuleInFlight === (capsule != null)`.
7. Never both `vausMode==='laser'` and `catchMode` true.
8. `enlarged ⇒ vausWidth === enlargedWidth`; Vaus stays within the walls.
9. `dohHits ∈ [0,16]` and only ever **decreases** (never via a laser).
10. No two alive bricks occupy the same grid cell.
11. `flow.state` is always one of the known states; **no exception ever
    thrown** during a run.

> The fuzz bot is a dumb policy (track the lowest ball with the paddle, tap
> fire) seeded deterministically. It is not meant to *win* — it is meant to
> generate millions of frames of varied state cheaply and trip an invariant.

## 4. Scenario catalog

Named, deterministic, set→act→assert. Each is one entry the runner executes.

- `ball/clamp-after-paddle-and-walls`
- `ball/no-tunnel-at-max-speed`
- `ball/ceiling-speedup-and-per-life-reset`
- `bricks/color-scoring-and-count`
- `bricks/silver-scaling-per-stage`
- `bricks/gold-indestructible-ball-and-laser`
- `flow/stage-clears-on-last-brick`
- `capsule/one-at-a-time-and-suppression`
- `capsule/L-C-mutual-exclusion`
- `capsule/P-once-per-life`
- `capsule/dup-substitutes-D`
- `capsule/B-only-when-portal-closed`
- `capsule/break-portal-advances-and-scores`
- `multiball/life-only-when-all-gone`
- `enemy/ball-deflects-both-components`
- `enemy/killed-by-laser-and-vaus-not-ball`
- `doh/sixteen-ball-hits-to-victory`
- `doh/laser-has-no-effect`
- `doh/projectile-instant-kills-vaus`
- `scoring/extra-life-thresholds`

## 5. Pure-logic to extract for mode-1 unit tests

These currently live inside `ArkanoidScene.ts` and should be lifted into pure,
import-and-call functions (no scene, no browser) — fastest, least flaky tests,
and cleaner code:

- `clampDir(x, y)` → already pure-ish; move to a `physics.ts`.
- paddle contact-ratio → outgoing-angle mapping.
- `rollCapsuleType(state, rng)` → make the RNG + "last type" + flags explicit
  args so it is a pure function of inputs.
- extra-life threshold stepper.
- `silverHitsForStage`, `parseStage` (already pure — just add tests).

## 6. Deterministic seams Arkanoid must expose (`hooks`)

The minimum set the scenarios above need:

| Hook | Purpose |
|------|---------|
| `seed(n)` | reset the shared RNG |
| `skipToStage(n)` | jump to any stage incl. 33 (DOH) |
| `placeBall(x, y, angleDeg, speed)` | deterministic ball setup |
| `clearAllBricksExcept(cells)` | isolate a brick for a hit test |
| `forceNextCapsule(type)` | bypass RNG for capsule scenarios |
| `giveCapsule(type)` | apply an effect directly |
| `splitBalls(n)` | reach a multiball state |
| `spawnEnemy(kind, x, y)` | deterministic enemy |
| `dohHit(n)` / `spawnDohProjectile(x)` | drive the boss |

These are also genuinely useful as an in-browser debug console, so the cost is
shared with development, not testing-only.

## 7. Snapshot shape

What `ArkanoidTestSurface.snapshot()` exposes (flat, JSON-serialisable):

```
{ score, high, lives, stage, flow,
  ballCount, ballSpeed, balls:[{x,y,vx,vy,caught}],
  destroyableRemaining, goldCount,
  vausMode, enlarged, catchMode, vausX, vausWidth,
  capsuleInFlight, capsuleType, lastCapsuleType, pDroppedThisLife,
  portalOpen, laserCount, enemyCount, enemies:[{kind,x,y}],
  dohActive, dohHits, dohProjectileCount }
```

## 8. Auto vs human — the split, explicitly

- **Automated (this design):** every row of §2, every invariant of §3, every
  scenario of §4, all of §5. Target: a single `npm run test:arkanoid` that an
  agent runs after any change and reads pass/fail + the first invariant
  violation with its seed for reproduction.
- **Human (the 10%):** review the mode-4 pack — a contact sheet of all 32
  stages + key power-up states — and answer: does it *feel* right, is the
  difficulty curve fair, does anything read poorly? That verdict is the only
  thing the framework can't produce.
