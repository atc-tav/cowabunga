# Mario Bros. (1983 Arcade) — Oracle Ledger (Test Design)

> Derived from `specs/mario-bros-arcade.md`. **Reconciled 2026-06-24** to the
> spec's new authoritative **§0 Authentic-Arcade Reconciliation** (a 2026
> research pass) and the inline fixes it references. §0 overrides any conflicting
> inline value; rows below now trace to the corrected spec. The 2026-06-23 open
> questions are recorded in `DEVLOG.md` and have all been settled by §0 (see the
> 2026-06-24 DEVLOG entry). **Steps 2–3 executed 2026-06-23** (this session): the
> test surface now exists (`MarioBrosScene.buildTestSurface()` +
> `testing/scenarios.mjs` + `testing/fuzz.mjs`) and the clear behavioral reds were
> driven green and **verified** by `npm run test:game -- mariobros` (17 scenarios,
> 55 checks) + `npm run fuzz:game -- mariobros` (clean). This is the **definition
> of done**: the game is faithful when every non-`human`, non-`n/a` row is 🟢.
>
> **Faithfulness = % of this ledger that is green** (excluding `human` and `n/a`
> out-of-scope rows). Status reflects the **current** implementation
> (`src/games/mariobros/*.ts`) as of 2026-06-24. There is currently **no test
> surface** (`buildTestSurface()` and `testing/` are absent), so every
> `scenario`/`invariant` row is unverifiable today: per our convention those are
> 🔴 even where the underlying behavior may look right in play. Rows whose
> **value is now confirmed authentic** are noted "🟢 on value / unverifiable
> until the surface exists" so the genuine fix list (real bugs) is separable from
> the test-surface debt.
>
> **Status legend:** 🟢 correct & verifiable · 🟡 value correct, unverifiable
> (no surface yet) · 🔴 wrong/missing/divergent · `human` feel-tuned, human-judged
> · `n/a` out of faithfulness scope (non-spec extra, §0).

## 0. Spec coverage map (completeness gate)

Every section of `specs/mario-bros-arcade.md` and where it is covered below.

| Spec section | Covered by rows | Notes |
|--------------|-----------------|-------|
| §1 Game Overview (lives, extra life, modes, core loop, wrap) | `flow/*`, `lives/*`, `scoring/extra-life`, `mode/*`, `wrap/*` | ✅ CHECK Screen Wrap mapped to `wrap/*` |
| §2.1 Platform Layout (4 rows, gaps) | `stage/platform-rows`, `traverse/gap-fall`, `traverse/edge-no-fall` | ✅ CHECK Platform Collision |
| §2.2 Pipe Positions | `stage/pipes-present`, `spawn/top-pipes`, `traverse/exit-bottom-recycle` | |
| §2.3 Icicles (Phase 9+) | `icicle/*` | ✅ CHECK Icicle Timer |
| §3.1 Player Movement (momentum, jump, fall, **stomp kills player**, no drop-through) | `move/*`, `stomp/kills-player` | ✅ CHECK Momentum Physics |
| §3.2 Enemy Defeat Sequence (flip=**0** §0 #1, kick=800, flip recovery ~5 s §0 #4, speed states) | `scoring/flip`, `scoring/kick`, `flip/*`, `enemy/speed-ordering`, `enemy/speed-exact` | ✅ CHECK Flip Recovery (fly-last edge case → `enemy/fly-not-last-fast`) |
| §3.3 POW Block | `pow/*` | ✅ CHECK POW Logic |
| §3.4 Scoring & Combos | `scoring/*` | every value lifted to a unit row |
| §3.5 Enemy Collision Behavior | `enemy/headon-reverse` | |
| §4.1 Shellcreeper | `enemy/turtle-*` | ✅ CHECK Shellcreeper Sprite (human) |
| §4.2 Sidestepper | `enemy/crab-*` | ✅ CHECK Two-Hit Mechanic |
| §4.3 Fighter Fly | `enemy/fly-*` | ✅ CHECK Jump-Only Flip Rule |
| §4.4 Slipice | `slipice/*` | ✅ CHECK Ice Physics, ✅ CHECK Slipice Non-Target |
| §5 TX Registry | `sprite/tx-completeness` | ✅ CHECK TX Completeness |
| §6.1 Phase Progression (Phases 1–14) | `phase/roster-*` (one per listed phase), `phase/count` | ⚠️ enumerate EVERY phase |
| §6.2 Phase Looping | `phase/loop`, `phase/loop-speed-ramp`, `phase/counter-wrap` | |
| §6.3 Bonus Phase Rules | `bonus/*` | ✅ CHECK Bonus Phase State |
| §7.1 Spawn Sequencing | `spawn/stagger`, `spawn/alternate-pipes` | |
| §7.2 Platform Traversal | `traverse/*` | |
| §7.3 Fighter Fly AI | `enemy/fly-hops`, `enemy/fly-cross-level` | |
| §7.4 Slipice AI | `slipice/walks-to-center`, `slipice/reverse-on-enemy-only` | |
| §8 Rendering / Color Tokens | `sprite/color-variant`, human rows | ✅ CHECK Color Variant Rendering |
| §9 Physics Constants | `const/*` | every PHYSICS value lifted to a unit row |
| §10 Self-Verification Checklist | cross-referenced — every item maps to a row above | the checklist is a digest of §1–§5 |

## 1. Risk map — what to test, ranked

### P0 — correctness-critical and bug-prone
| Area | Why it's risky | Primary oracle |
|------|----------------|----------------|
| Scoring values (kick/coin/bonus/combo) | known-wrong in current build: kick varies by enemy (800/1200/1000, must be 800), coin 300 (→800), bonus 3000/5000 (→5000/8000, §0 #3), combo doubles (→additive+800 cap 3200, §0 #2). *Flip=0 is now CORRECT (§0 #1).* | unit (each value) + scenario (flip→kick deltas) |
| Stomp rule (jump-onto-enemy kills the **player**) | current build lets the player stomp turtles/flies — inverts the spec | scenario (land on turtle → player dies) + invariant |
| Two-step defeat (flip-from-below, then kick) | flip must score 10 and stun; kick must score 800 and remove/launch | scenario + invariant (`flipped⇒stun∈(0,stunMs]`) |
| Sidestepper two-hit | 1st hit angers (no flip), 2nd flips; recovery must NOT reset hitPoints to 2 | scenario (both hits + post-recovery) |
| Fighter Fly grounded-only flip | mid-air bump must be a no-op | scenario (airborne bump → unchanged) + invariant |
| Extra life at 20,000 | not implemented anywhere | unit (threshold stepper) + scenario |
| Phase clear accounting (Slipice excluded) | clear must require only target enemies kicked off | scenario + invariant (`targetsRemaining == count of alive target enemies`) |
| Screen wrap (player + ALL enemies) | ground enemies currently recycle via pipes, not wrap | scenario + invariant (positions ∈ [0,W) after wrap) |

### P1 — important, lower bug odds
- Flip recovery: timer expiry → enrage (faster + color change); ~5 s Mode A, shorter Mode B (exact frames feel-tuned, §0 #4/#7).
- Last-enemy super-fast/blue state (immediate, even if flipped) — **turtle & crab only; Fighterfly is exempt** (§0 #6).
- POW: 3 uses, flips grounded enemies, removed at 0, re-flips an already-flipped enemy upright (spec caution).
- Bonus phase: 10 coins, 20 s (15 s ice bonus), all-collected = **5 000 first / 8 000 subsequent** (§0 #3).
- Icicle state machine `hidden→forming→full→falling`; lethal only while `falling`.
- Slipice: walks to platform center, ices it, self-destroys; reverses only on enemy contact; 3 platforms max.
- Combo multiplier: **additive +800, capped at 3 200** (800/1600/2400/3200), within ~1 s (§0 #2).
- Head-on enemy collision → both reverse.
- Per-loop enemy speed ramp.

### P2 — low risk, smoke only
- Spawn stagger (~1.5–2 s) and alternating pipes.
- Coin score popups; phase banner/counter display.
- Ice friction multiplier value on an iced platform.

### Human-only (the ~10%)
- Enemy/player sprite readability and the per-state recolors (green/red/blue
  Shellcreeper; angry crab; blue last-enemy).
- "Slip-and-slide" momentum *feel*; jump arc feel.
- Difficulty arc across phases 1–14 and the loop.
- Whether iced platforms / icicles / coins read clearly.

## 2. The Oracle Ledger (every row traces to the spec)

Status legend: 🟢 correct & verifiable · 🟡 value/behavior matches the corrected
spec but is **not yet verified by a scenario/invariant** · 🔴 wrong, missing, or
divergent / unverified-and-untested · `human` feel-tuned (human-judged) · `n/a`
out of faithfulness scope (non-spec extra; see §0). **A 🟡 is not a pass** — it
becomes 🟢 only once a real check verifies it — but it is *not* a known bug, so it
is tracked separately from the 🔴 fix list.

**Tally (2026-06-23, after Steps 2–3): 🟢 36 · 🟡 7 · 🔴 56 · human 4 · n/a 1.**
The Step-3 behavioral-fix targets are all 🟢 and verified by
`npm run test:game -- mariobros` (17 scenarios / 55 checks) + a clean
`npm run fuzz:game -- mariobros` soak. The remaining 🔴 are **untested** rows
(plausible-in-code behaviors the harness does not yet exercise: momentum,
traversal/gaps, screen-wrap, recycle, slipice/icicle state machines, head-on
reverse, spawn stagger, sprite/TX/color, phases 11–14 & looping) plus the
explicitly **deferred** rows (Mode A/B, phase 12/14 rosters, bonus-phase cadence,
color-variant palette-swap) — none were in this session's scope. They are honest
red: not yet proven, so not green.

### Constants (§9 PHYSICS, §3, §6) → unit rows

| ID | Spec ref | Oracle | Assertion (state-based) | Status |
|----|----------|--------|--------------------------|:--:|
| `const/gravity` | §9 `gravity:0.45` (px/frame²) | unit | gravity constant equals spec value (per-frame 0.45 ≈ 700 px/s² at 60fps — current `GRAVITY=700`); document the unit conversion used | 🔴 |
| `const/player-max-speed` | §9 `playerMaxSpeedX:3.2` | unit | horizontal speed cap equals spec (3.2 px/frame ≈ 192 px/s; current `RUN_MAX=100`) | 🔴 |
| `const/player-accel` | §9 `playerAccelX:0.35` | unit | ground accel equals spec value (current `RUN_ACCEL=650` px/s² — verify conversion) | 🔴 |
| `const/jump-velocity` | §9 `playerJumpVelocity:-8.5` | unit | initial jump velocity equals spec (current `JUMP_SPEED=265` px/s) | 🔴 |
| `const/ground-friction` | §9 `groundFriction:0.18` | unit | ground deceleration equals spec value | 🔴 |
| `const/ice-friction` | §9 `iceFriction:0.02` + ✅ Ice Physics | unit | iced-platform friction equals spec; ratio ice/ground ≈ 0.02/0.18 ≈ 0.11 (current `ICE_FRICTION_SCALE=0.12` — close, verify) | 🟢 |
| `const/enemy-base-shell` | §9 `shellcreeper:0.9` | unit | turtle base speed equals spec (current `SHELL_SPEED=42` px/s — verify conversion) | 🔴 |
| `const/enemy-base-crab` | §9 `sidestepper:1.4` | unit | crab base speed equals spec | 🔴 |
| `const/enemy-base-fly` | §9 `fighterFly:1.1` | unit | fly horizontal speed equals spec | 🔴 |
| `const/enemy-base-slipice` | §9 `slipice:0.6` | unit | slipice speed equals spec | 🔴 |
| `const/enrage-ordering` | §0 #8 (per-enemy §4 governs; global §9 1.6× removed) | invariant | for each enemy, `enraged speed > normal speed` (exact multiplier feel-tuned). crab `CRAB_ANGRY_SPEED=74 > CRAB_SPEED=46` ✓; turtle `SHELL_RECOVER_SPEED=60 > SHELL_SPEED=36` ✓ | 🟢 (speed-ordering invariant verified; enrage>normal holds in code) |
| `const/enrage-exact` | §0 #8 (LOW conf — exact numbers undocumented) | human | exact enraged-speed feel per enemy is human-tuned (no authentic source); only the ordering above is asserted | human |
| `const/last-mult` | §0 #6/#8 (per-enemy §4 governs; global §9 2.2× removed) | invariant | last-enemy speed > enemy's normal speed for turtle & crab; **fly is exempt** (does NOT speed up as last — §0 #6). `effSpeed` now gates the last boost on `kind.lastBoost` (turtle/crab only). | 🟢 (verified: `fly-last-no-boost` invariant + `fly as last enemy keeps its pace` scenario) |
| `const/flip-recovery-A` | §0 #4 (~5 s Mode A; exact frames feel-tuned) | human (loose bound) | Mode-A flip recovery sits in the **4–6 s range** (authentic ≈5 s; the old 20 000 ms was the *bonus-stage* time limit, not recovery). Current `SHELL_STUN_MS=4200` is in band. Exact frame count is feel-tuned | human |
| `const/flip-recovery-B` | §0 #4/#7 (Mode B shorter; exact undocumented) | human | Mode-B flip recovery is **shorter than Mode A** (must kick sooner); exact value feel-tuned. No A/B mode exists yet (single 4 200 ms stun) | human |
| `const/pow-uses` | §3.3 "3 per phase" | unit | `POW_USES === 3` | 🟢 |
| `const/bonus-time` | §6.3 "20 seconds" | unit | bonus timer = 20 000 ms (current `BONUS_TIME_MS=20000`) | 🟢 |
| `const/bonus-time-ice` | §6.3 "15 seconds in the Ice Bonus" | unit | ice-bonus timer = 15 000 ms (not implemented — single 20 s timer) | 🔴 |
| `const/lives-start` | §1 "starts with 3 lives" | unit | `LIVES_START === 3` | 🟢 |

### Scoring (§3.4 table) → unit + scenario rows

| ID | Spec ref | Oracle | Assertion (state-based) | Status |
|----|----------|--------|--------------------------|:--:|
| `scoring/flip` | §3.4 + §0 #1 "Flip enemy → **0**; points only on the kick" | unit+scenario | bump a grounded target enemy from below → score increases by **exactly 0**; enemy enters `flipped`. Then the kick scores (see `scoring/kick`) | 🟢 (verified: `flip awards 0` scenario) |
| `scoring/kick` | §3.4 "Kick enemy off platform → 800" | unit+scenario | run into a flipped enemy → score increases by **exactly 800** (base, combo=1). Holds for turtle, crab, fly. | 🟢 (verified: `kick awards 800 for every enemy kind`; `CRAB_SCORE`/`FLY_SCORE` now `KICK_SCORE=800`) |
| `scoring/slipice` | §3.4 + §0 #9 "Hit Slipice → 500 *(undocumented)*" | unit+scenario | bump a Slipice from below → score += **exactly 500**; Slipice removed. **Value is UNVERIFIED against any source (§0 #9) — flag for human**: keep 500 as the placeholder but do not treat green here as faithfulness evidence | 🟡 (code `SLIPICE_SCORE=500` matches the placeholder; both value-authenticity and runtime are unverified) |
| `scoring/coin` | §3.4 "Collect bonus coin → 800" | unit+scenario | collect one bonus coin → score += **exactly 800** | 🟢 (verified: `coins award 800 each` — `COIN_SCORE=800`) |
| `scoring/bonus-all-first` | §3.4 + §0 #3 "all coins, 1st bonus stage → **5,000**" | unit+scenario | collect all 10 coins in the **first** bonus stage → +5 000 beyond the 800/coin | 🟢 (verified: `coins...5000 full first bonus` — 10×800+5000 = 13000; `BONUS_COMPLETE_FIRST=5000`) |
| `scoring/bonus-all-subsequent` | §3.4 + §0 #3 "all coins, 2nd bonus stage onward → **8,000**" | unit+scenario | collect all 10 coins in a **subsequent** bonus stage → +8 000 beyond the 800/coin | 🟡 (value fixed: `BONUS_COMPLETE_REPEAT=8000`; first-stage path verified, subsequent-stage path not yet exercised by a scenario) |
| `scoring/combo-additive` | §3.4 + §0 #2 "additive +800: 800/1600/2400/3200, capped at 3200 (NOT doubling)" | unit+scenario | kicking enemies in quick succession yields deltas **800, 1600, 2400, 3200, 3200…** (each +800, capped at 3200); a kick after the window resets to 800 | 🟢 (verified: `combo is additive +800 capped at 3200` + `combo resets to 800 after the window`; pure `comboScore(n)=min(800n,3200)` replaces the doubling) |
| `scoring/extra-life` | §3.4 + §1 + §0 #5 "extra life at 20,000 (US DIP default)" | unit+scenario | crossing 20 000 points grants exactly **+1 life**, once (20 000 confirmed authentic — §0 #5) | 🟢 (verified: `extra life awarded once crossing 20,000` — +1 at 20k, one-shot via `Player.grantExtraLifeIfDue`) |

### Player movement (§3.1) → rows

| ID | Spec ref | Oracle | Assertion | Status |
|----|----------|--------|-----------|:--:|
| `move/momentum` | §3.1 + ✅ Momentum Physics | scenario | at full speed, release direction → `vx` decays by friction each frame (not 0 next frame); player slides 1–2 tile widths before stopping | 🔴 (friction model present; unverifiable) |
| `move/fixed-jump-arc` | §3.1 "Fixed arc (cannot adjust mid-air)" | scenario | jump direction is fixed at takeoff; horizontal input mid-air does not change `vx` at all | 🟢 (verified: `fixed jump arc — airborne input does not change vx`; air-accel path removed — `applyHorizontal` only accelerates while grounded) |
| `move/fall-no-damage` | §3.1 "fall from any height without damage" | scenario | drop the player from the top platform to the floor → no life lost | 🔴 |
| `stomp/kills-player` | §3.1 "Jumping onto an enemy from above causes the **player** to lose a life" + §10 | scenario | land on top of an un-flipped turtle/crab/fly → **player** loses a life; enemy survives | 🟢 (verified: `stomping an un-flipped enemy kills the player` for all 3 kinds; `canStomp`/stomp-kills-enemy removed) |
| `move/no-platform-drop` | §3.1 "cannot drop through platforms" | invariant | no input causes the player to pass downward through a platform surface | 🔴 |

### Flip / defeat sequence (§3.2) → rows

| ID | Spec ref | Oracle | Assertion | Status |
|----|----------|--------|-----------|:--:|
| `flip/from-below-only` | §3.2 Step 1 | scenario | bump the platform directly under a grounded target enemy → it flips; bumping a platform with no enemy on it does nothing | 🔴 |
| `flip/recovery-enrage` | §3.2 + ✅ Flip Recovery + §0 #4 | scenario | leave a flipped enemy un-kicked until `flipTimer` expires (~5 s Mode A) → it stands up, speed increases, color/state = `enraged`. (Exact timer feel-tuned — `const/flip-recovery-A`.) | 🟡 (recovery behavior present, `SHELL_STUN_MS=4200` in the 4–6 s band; unverifiable) |
| `flip/last-immediate-superfast` | §3.2 ✅ Flip Recovery edge case + §0 #6 | scenario | when only 1 **turtle or crab** remains → it immediately enters super-fast (`last`) state regardless of flip state. **A last-enemy Fighterfly must NOT speed up** (§0 #6) — covered by `enemy/fly-not-last-fast` | 🟢 (verified: `fly as last enemy keeps its pace` also asserts turtle last > normal; speed boost gated on `kind.lastBoost`) |
| `enemy/speed-ordering` | §0 #8 (per-enemy §4 governs; global §9 removed) | invariant | normal walking-speed ordering holds: **Shellcreeper (slowest) < Fighterfly < Sidestepper (fastest)**, and for each enemy enraged > normal. Exact numbers feel-tuned. Now: turtle 36 < fly 40 < crab 46 | 🟢 (verified: `normal speed ordering turtle < fly < crab` scenario + `speed-ordering` invariant) |
| `enemy/speed-exact` | §0 #8 (LOW conf — exact numbers undocumented) | human | exact per-enemy speed/enrage/last multipliers are human-tuned for feel; only the ordering invariant above is automatable | human |

### POW block (§3.3) → rows

| ID | Spec ref | Oracle | Assertion | Status |
|----|----------|--------|-----------|:--:|
| `pow/uses-counter` | §3.3 + ✅ POW Logic | scenario | `powUsesRemaining` starts at 3; each activation decrements by 1; at 0 the POW sprite is removed | 🟢 (verified: `POW disappears after 3 uses`; `pow-uses-range` invariant) |
| `pow/flips-grounded` | §3.3 "all enemies touching a platform/floor are flipped" | scenario | with N grounded active enemies, one POW hit → all N become `flipped` simultaneously | 🟢 (verified: `POW flips grounded enemies, skips airborne, counts down`) |
| `pow/skips-airborne` | §3.3 + ✅ POW Logic ("does NOT affect airborne Fighter Fly") | scenario | a Fighter Fly mid-hop during a POW hit is **not** flipped (stays active) | 🟢 (verified: airborne fly in the POW scenario is not flipped) |
| `pow/reflips-flipped-upright` | §3.3 "if already flipped, hitting POW flips it back upright" | scenario | hit POW while an enemy is already flipped → that enemy returns to active (possibly faster) | 🟢 (verified: `POW re-flips an already-flipped enemy upright`; `activatePow` now calls `recover()` on flipped grounded enemies) |

### Enemies — Shellcreeper (§4.1)

| ID | Spec ref | Oracle | Assertion | Status |
|----|----------|--------|-----------|:--:|
| `enemy/turtle-one-hit-flip` | §4.1 "1 hit to flip" | scenario | one bump from below flips a Shellcreeper | 🔴 (logic present; unverifiable) |
| `enemy/turtle-enrage-red` | §4.1 "recovers shell red, +speed" | scenario | a recovered turtle is in `enraged` state and faster than base | 🔴 |
| `enemy/turtle-last-blue` | §4.1 + §0 #6/#8 "last enemy turns blue, super-fast" | scenario | as last enemy a turtle enters `last` state and is faster than its normal speed (exact multiplier feel-tuned — §0 #8); color → blue | 🟡 (turtle enters `makeLast()` and accelerates; exact value feel-tuned; unverifiable) |
| `enemy/turtle-no-jump` | §4.1 "does not jump; walks off gaps" | invariant | a turtle's vertical motion only comes from falling through gaps, never a jump | 🔴 |

### Enemies — Sidestepper (§4.2)

| ID | Spec ref | Oracle | Assertion | Status |
|----|----------|--------|-----------|:--:|
| `enemy/crab-two-hit` | §4.2 + ✅ Two-Hit Mechanic | scenario | hit 1 → crab `hitPoints` 2→1, becomes enraged + faster, **not** flipped; hit 2 → flipped | 🟢 (verified: `crab takes two hits to flip; recovery keeps one`) |
| `enemy/crab-recovery-no-reset` | §4.2 ✅ Two-Hit ("recovering does NOT reset hitPoints to 2") | scenario | after flip + recovery, the crab needs only **1** more hit to flip again (not 2) | 🟢 (verified: same scenario — one bump re-flips after recovery) |
| `enemy/crab-faster` | §4.2 + §0 #8 "Sidestepper is the fastest; Shellcreeper slowest" | unit | crab base speed > turtle base speed (and > fly) | 🟢 (verified: `CRAB_SPEED=46 > FLY_SPEED=40 > SHELL_SPEED=36`; speed-ordering scenario + invariant) |
| `enemy/crab-last-blue` | §4.2 + §0 #6 "Sidestepper speeds up as last enemy" | scenario | last crab enters super-fast (`last`) state and is faster than its normal speed (exact multiplier feel-tuned — §0 #8) | 🟡 (crab does enter `makeLast()`; behavior present, exact value feel-tuned; unverifiable) |

### Enemies — Fighter Fly (§4.3)

| ID | Spec ref | Oracle | Assertion | Status |
|----|----------|--------|-----------|:--:|
| `enemy/fly-hops` | §4.3 / §7.3 "moves by hopping 2–3 tiles" | scenario | the fly's vertical velocity is periodically launched (hops), not continuous walking | 🔴 (hop logic present; unverifiable) |
| `enemy/fly-grounded-only-flip` | §4.3 + ✅ Jump-Only Flip | scenario | bump the platform under an **airborne** fly → no effect (stays active); bump while grounded → flips | 🟢 (verified: `fly is only flippable while grounded`; `bump()` now no-ops when `groundedFlipOnly && !onGround`) |
| `enemy/fly-quick-recovery` | §4.3 "gets back up very quickly" | scenario | a flipped fly's stun duration is shorter than a turtle's | 🔴 (current build uses same `SHELL_STUN_MS` for all; divergence) |
| `enemy/fly-no-enrage` | §4.3 "no enraged faster state" | scenario | a recovered fly returns to normal speed (no enrage tier) | 🟡 (fly `angrySpeed===walkSpeed`, no enrage tier; unverifiable) |
| `enemy/fly-not-last-fast` | §4.3 + §0 #6 "Fighterfly does NOT speed up as last enemy" | scenario+invariant | when a Fighterfly is the last enemy on screen its speed/hop-rate is **unchanged** from its normal pace (no last-enemy boost — unlike turtle/crab). The `last` color/state may still render, but `effSpeed` must not multiply | 🟢 (verified: `fly as last enemy keeps its pace` + `fly-last-no-boost` invariant; `effSpeed` gates on `kind.lastBoost`, fly=false) |
| `enemy/fly-cross-level` | §4.3 "can hop to a different platform level" | scenario | over many hops a fly can land on a different platform row than it started | 🔴 |

### Enemies — Slipice (§4.4)

| ID | Spec ref | Oracle | Assertion | Status |
|----|----------|--------|-----------|:--:|
| `slipice/walks-to-center` | §4.4 / §7.4 "reaches platform center, ices it, self-destroys" | scenario | a Slipice reaching a non-floor platform's center → that platform `isIced=true`, Slipice removed | 🔴 (logic present; unverifiable) |
| `slipice/ice-friction` | §4.4 + ✅ Ice Physics | scenario | the player on an iced platform uses `ICE_FRICTION` (~10% of normal) and overshoots its intended stop | 🔴 (`ICE_FRICTION_SCALE=0.12`; unverifiable) |
| `slipice/three-platforms-max` | §4.4 "three platforms can be iced; then no more spawn" | scenario | once all three non-floor platforms are iced, no further Slipice spawns this phase | 🔴 (`SLIPICE_PER_PHASE=3` caps spawns; needs the 3-iced condition too) |
| `slipice/one-hit-kill` | §4.4 "1 hit, no kick, 500 pts" | scenario | one bump from below removes a Slipice and scores 500; no kick step | 🔴 |
| `slipice/touch-kills-player` | §4.4 "touching Slipice loses a life" | scenario | player contacts an un-flipped Slipice → player loses a life | 🔴 |
| `slipice/non-target` | §4.4 + ✅ Slipice Non-Target | invariant | killing a Slipice never decrements the phase's `targetsRemaining`; phase clears regardless of Slipice presence | 🟡 (`targetsRemaining()` counts only the `enemies`/`spawnQueue` lists — Slipice lives in a separate `slipices` list and the `Slipice is not a phase-clear target` scenario confirms it never enters them; a full kill-a-slipice-then-clear scenario is still TODO) |
| `slipice/reverse-on-enemy-only` | §4.4 / §7.4 "reverses only on enemy contact, not the player" | scenario | a Slipice overlapping the player does NOT reverse; overlapping another enemy DOES reverse | 🔴 (logic present; unverifiable) |

### Icicles (§2.3)

| ID | Spec ref | Oracle | Assertion | Status |
|----|----------|--------|-----------|:--:|
| `icicle/state-machine` | §2.3 + ✅ Icicle Timer | scenario | each icicle transitions `hidden→forming→full→falling`; independent timers | 🔴 (states `forming→full→falling→done`; "hidden" folded into spawn delay) |
| `icicle/lethal-only-falling` | §2.3 ✅ Icicle Timer | scenario | player overlapping an icicle in `forming`/`full` → no death; overlapping in `falling` → death | 🔴 (`lethal` getter true only in `falling`; unverifiable) |
| `icicle/not-flippable` | §2.3 "not enemies, cannot be flipped" | invariant | an icicle is never added to the enemy/target list and never responds to a bump | 🔴 |

### Stage / traversal (§2.1, §2.2, §7.1, §7.2)

| ID | Spec ref | Oracle | Assertion | Status |
|----|----------|--------|-----------|:--:|
| `stage/platform-rows` | §2.1 "4 rows: top, middle, lower-mid, floor" | unit | the level defines the four platform rows at the spec's relative heights; floor is full-width with no gaps | 🔴 (`FLOORS` has the rows; floor x1=0..x2=256; verify gap layout) |
| `stage/pipes-present` | §2.2 "4 pipes (TL, TR spawn; BL, BR exit)" | unit | exactly 4 pipes exist: 2 top (role spawn) + 2 bottom (role exit) | 🔴 (present in `PIPES`; unverifiable) |
| `traverse/gap-fall` | §2.1 + ✅ Platform Collision | scenario | a walker reaching a platform-end **gap** falls to the next lower platform | 🔴 |
| `traverse/edge-no-fall` | ✅ Platform Collision | scenario | a walker reaching a platform edge that is **not** a gap reverses/does not fall | 🔴 |
| `traverse/exit-bottom-recycle` | §2.2 / §7.2 "exit bottom pipe → teleport to top spawn" | scenario | an active enemy entering a bottom-pipe zone is recycled to a top spawn (so it must be defeated to clear) | 🔴 (logic present; unverifiable) |
| `spawn/stagger` | §7.1 "staggered ~1.5–2 s" | scenario | enemies emerge one at a time, ≥ ~1.5 s apart | 🔴 (`SPAWN_STAGGER_MS=1500`) |
| `spawn/alternate-pipes` | §7.1 "top pipes alternate" | scenario | consecutive spawns alternate between the two top pipes | 🔴 (`pipeToggle` alternates; unverifiable) |

### Screen wrap (§1 ✅ CHECK)

| ID | Spec ref | Oracle | Assertion | Status |
|----|----------|--------|-----------|:--:|
| `wrap/player` | §1 ✅ Screen Wrap | scenario | player at `x>W` wraps to `x≈0`; at `x<0` wraps to `x≈W` | 🔴 (player wraps in `move()`; unverifiable) |
| `wrap/enemies` | §1 ✅ Screen Wrap ("both player and all enemies") | scenario+invariant | every enemy at `x>W`/`x<0` wraps to the other edge | 🔴 (upper floors wrap; **ground floor does not** — enemies recycle via pipes instead. Partial divergence; see Q5) |

### Phases (§6.1, §6.2)

| ID | Spec ref | Oracle | Assertion | Status |
|----|----------|--------|-----------|:--:|
| `phase/count` | §6.1 "Phases 1–14" | unit | the unique phase table has **14** entries before the loop | 🔴 (current `PHASES` has **11**) |
| `phase/roster-1` | §6.1 Phase 1 | unit | Phase 1 roster = Shellcreeper ×3 | 🟢 |
| `phase/roster-2` | §6.1 Phase 2 | unit | Phase 2 roster = Shellcreeper ×5 | 🟢 |
| `phase/roster-3-bonus` | §6.1 Phase 3 | unit | Phase 3 is a BONUS phase (no enemies) | 🟢 |
| `phase/roster-4` | §6.1 Phase 4 | unit | Phase 4 roster = Sidestepper ×4 | 🟢 |
| `phase/roster-5` | §6.1 Phase 5 | unit | Phase 5 roster = Shellcreeper ×2 + Sidestepper ×4 | 🟢 |
| `phase/roster-6` | §6.1 Phase 6 | unit | Phase 6 roster = Fighter Fly ×4 | 🟢 |
| `phase/roster-7` | §6.1 Phase 7 | unit | Phase 7 roster = Fighter Fly ×3 + Sidestepper ×2 | 🟢 |
| `phase/roster-8-bonus` | §6.1 Phase 8 | unit | Phase 8 is a BONUS phase | 🟢 |
| `phase/roster-9` | §6.1 Phase 9 | unit | Phase 9 = Shellcreeper ×4 + Fighter Fly ×1 + Slipice | 🟢 |
| `phase/roster-10` | §6.1 Phase 10 | unit | Phase 10 = Sidestepper ×4 + Fighter Fly ×1 + Slipice | 🟢 |
| `phase/roster-11` | §6.1 Phase 11 | unit | Phase 11 = Sidestepper ×4 + Fighter Fly ×2 + Slipice | 🔴 (current phase 11 = crab×2+fly×2 +slipice+icicles — wrong composition) |
| `phase/roster-12` | §6.1 Phase 12 | unit | Phase 12 = Mixed enemies + Slipice + Icicles | 🔴 (missing — only 11 phases exist) |
| `phase/roster-13-bonus` | §6.1 Phase 13 | unit | Phase 13 = BONUS (ice-floor variant, 15 s timer) | 🔴 (missing) |
| `phase/roster-14` | §6.1 Phase 14 | unit | Phase 14 = Mixed + Slipice + Icicles (final unique) | 🔴 (missing) |
| `phase/clear-on-targets` | §6.1 "clears when all target enemies kicked off" | scenario+invariant | phase advances iff `spawnQueue` empty AND zero alive target enemies; Slipice does not block | 🔴 |
| `phase/loop` | §6.2 "after 14, loop ~10–14" | scenario | after phase 14, the next phase is drawn from the 10–14 loop set (not phase 1) | 🔴 (current loops to phase 1) |
| `phase/loop-speed-ramp` | §6.2 "each loop +speed" | scenario | enemy `speedScale` increases by `LOOP_SPEED_STEP` per completed loop | 🔴 (logic present; unverifiable) |
| `phase/counter-wrap` | §6.2 "Phase 99 wraps to Phase 0" | unit | the displayed phase counter wraps at 99 → "Phase 0" | 🔴 (not implemented) |
| `mode/A-B` | §1 + §0 #7 "Mode A (default) / Mode B (faster enemies + shorter flip-recovery)" | scenario | a Mode-B run has **faster enemy speeds AND shorter flip-recovery** than Mode A (must kick sooner); exact deltas feel-tuned (§0 #7). Single-player A/B is the faithful target | 🔴 (no A/B difficulty mode exists; the menu offers solo/coop/versus player-count modes instead) |
| `mode/2p-coop-versus` | §0 (2P co-op/versus = non-spec extra, out of faithfulness scope) | n/a | the build's solo/coop/versus player-count modes and versus mechanics (`VS_STUN_MS`, `shellHurts`, per-player score) are an **intentional out-of-spec extension** — neither green nor red; excluded from faithfulness % | n/a (out of scope per §0) |

### Bonus phase (§6.3)

| ID | Spec ref | Oracle | Assertion | Status |
|----|----------|--------|-----------|:--:|
| `bonus/ten-coins` | §6.3 + ✅ Bonus Phase State | scenario | a bonus phase spawns exactly **10** coins | 🟢 value (`bonusCoinSpots()` returns 10); 🔴 unverifiable |
| `bonus/no-enemies` | §6.3 + ✅ Bonus Phase State | invariant | during a bonus phase, no enemies or Slipice ever spawn | 🔴 |
| `bonus/timer-20s` | §6.3 "20 seconds (15 ice bonus)" | scenario | the bonus countdown starts at 20 s (15 s for the Phase-13 ice bonus) | 🔴 (single 20 s; ice variant missing) |
| `bonus/ends-on-empty-or-timeout` | §6.3 + ✅ Bonus Phase State | scenario | the bonus phase ends when all coins collected OR the timer hits 0 | 🔴 (logic present; unverifiable) |

### Enemy collision (§3.5)

| ID | Spec ref | Oracle | Assertion | Status |
|----|----------|--------|-----------|:--:|
| `enemy/headon-reverse` | §3.5 / §7.2 "head-on collision → both reverse" | scenario | two active enemies meeting head-on both flip direction and separate | 🔴 (logic present; unverifiable) |

### Sprites / rendering (§5, §8)

| ID | Spec ref | Oracle | Assertion | Status |
|----|----------|--------|-----------|:--:|
| `sprite/tx-completeness` | §5 + ✅ TX Completeness | unit | every key referenced by the renderer has a registered texture; a missing key throws at init (no silent undefined) | 🔴 (current `TX` is a **reduced** set — spec's `shellEnraged*`, `shellFast*`, `crabEnraged*`, `crabFast*`, `flyFast*`, `powBlockUsed`, `icicleHit`, `platformIced`, `pipe` keys are absent) |
| `sprite/color-variant` | §8.3 + ✅ Color Variant Rendering | human+scenario | a normal Shellcreeper renders green; enraged renders red; last-enemy renders blue — via palette swap by state | 🔴 (uses Phaser tint, not palette swap; turtle enrage has no red tint applied — only crab has `angryTint`) |
| `sprite/mirror-by-facing` | §10 Phase-4 checklist | scenario | a sprite's `flipX` matches its movement direction | 🔴 (logic present; unverifiable) |
| `sprite/shell-flip-legs-up` | §4.1 ✅ Shellcreeper Sprite | human | the flipped turtle sprite shows legs pointing upward | 🔴 (human row) |

## 3. Invariant catalog (checked every frame in fuzz mode)

1. `flow.state` is always a known state; **no exception is ever thrown** during a run.
2. `score ≥ 0` and is monotonically non-decreasing (no scoring event ever subtracts).
3. `lives` only ever decreases when a player died this frame, or increases by exactly 1 when crossing the 20 000-point extra-life threshold (once).
4. `powUsesRemaining ∈ [0,3]`; the POW sprite is present iff `powUsesRemaining > 0`.
5. Every flipped enemy has `stun ∈ (0, stunMs]`; an enemy is never simultaneously `flipped` and `shell`.
6. `targetsRemaining == count of alive non-Slipice enemies + unspawned target roster`; Slipice never affects it.
7. Every entity position satisfies `x ∈ [0, W)` after wrap resolution (player AND all enemies, per ✅ Screen Wrap).
8. An icicle is lethal to the player **only** while in the `falling` state.
9. A Fighter Fly is only flippable while grounded — an airborne fly can never transition to `flipped` from a bump.
10. The player never passes through a platform surface from above (no drop-through).
11. During a bonus phase, the enemy and Slipice lists are always empty.
12. At most 3 platforms are iced at once; iced platforms are only the non-floor rows.
13. No two active enemies occupy overlapping bounds for more than one frame (head-on reverse resolves them).
14. Normal-state speed ordering always holds: `turtle < fly < crab`; for every enemy, `enraged ≥ normal` and `last ≥ normal` (§0 #8 ordering).
15. A last-enemy **Fighterfly** moves at its normal pace — its `effSpeed` is never multiplied by a last-enemy factor (§0 #6); only turtle/crab get the last boost.

## 4. Scenario catalog (named, deterministic, set→act→assert)

- `scoring/flip-awards-0` (flip scores nothing; only the kick scores — §0 #1)
- `scoring/kick-awards-800-all-kinds`
- `scoring/coin-awards-800-and-full-bonus`
- `scoring/combo-additive-800-1600-2400-3200-capped` (additive +800, cap 3200 — §0 #2)
- `scoring/extra-life-at-20k`
- `scoring/slipice-500-no-kick` (value unverified per §0 #9)
- `stomp/land-on-enemy-kills-player`
- `flip/from-below-then-kick`
- `flip/recovery-enrages-after-timer`
- `flip/last-enemy-immediate-superfast` (turtle/crab only)
- `enemy/fly-last-enemy-keeps-pace` (Fighterfly does NOT speed up as last — §0 #6)
- `enemy/crab-two-hit-then-recovery-keeps-one`
- `enemy/fly-airborne-bump-noop`
- `enemy/fly-grounded-bump-flips`
- `enemy/headon-both-reverse`
- `pow/three-uses-then-removed`
- `pow/flips-grounded-skips-airborne-fly`
- `pow/reflips-already-flipped-upright`
- `slipice/ices-center-and-self-destructs`
- `slipice/non-target-does-not-block-clear`
- `slipice/touch-kills-player`
- `icicle/lethal-only-while-falling`
- `wrap/player-and-enemies-both-edges`
- `traverse/gap-falls-edge-reverses`
- `traverse/exit-bottom-recycles-to-top`
- `phase/clears-on-last-target`
- `phase/loops-10-to-14-after-14`
- `phase/14-unique-phases-present`
- `bonus/ten-coins-no-enemies-20s`
- `bonus/all-coins-5000-first-8000-subsequent` (§0 #3)
- `mode/B-faster-enemies-and-shorter-recovery-than-A` (§0 #7; exact deltas feel-tuned)

## 5. Pure logic to extract for mode-1 unit tests

These should be lifted out of the scene/entities into pure, import-and-call functions:

- `comboScore(comboCount)` → spec wants **additive +800 capped at 3200** (800/1600/2400/3200; §0 #2). Current `Player.registerKill()` returns `2^(n-1)` *multiplier* — wrong shape; replace with a pure `comboScore(n) = min(800*n, 3200)` and unit-test the sequence incl. the cap.
- `extraLifeThreshold(prevScore, newScore)` → a pure stepper returning lives to grant when crossing 20 000 (does not exist yet — add it).
- `effSpeed(kind, base, speedScale, state, last)` → enemy speed resolver from `Enemy.effSpeed`, so the **ordering** invariant (turtle < fly < crab; enraged > normal) and the **fly-exempt-from-last** rule (§0 #6) are unit-checkable. Exact multipliers are feel-tuned (human).
- `bumpResult(kind, bumps)` → pure "does this bump flip or enrage?" (from `Enemy.bump`) so the two-hit crab rule is unit-checkable.
- `parsePhases()` / phase-roster table → assert the 14-phase composition without a browser.
- `icicleState(timer, vy)` stepper → pure state-machine transition for `hidden→forming→full→falling`.
- `gapFall(x, segment)` → pure "is x over a gap?" for platform traversal.

## 6. Deterministic seams the game must expose (`hooks`)

| Hook | Purpose |
|------|---------|
| `seed(n)` | reset the shared RNG (enemy spawn pipe, recover direction, slipice spawn) |
| `skipToPhase(n)` | jump to any phase incl. bonus (3/8/13) and looped phases |
| `setMode('A'\|'B')` | select Mode A/B to test recovery timing |
| `spawnEnemy(kind, x, y, dir)` | deterministic enemy placement |
| `setEnemyState(i, state)` | force flipped/enraged/shell for a target enemy |
| `bumpPlatform(seg)` | simulate a head-bump under a platform (drives flips) |
| `activatePow()` | fire the POW programmatically |
| `setScore(n)` | drive the extra-life threshold |
| `placePlayer(x, y)` / `forceJump(dir)` | deterministic player setup for stomp/wrap tests |
| `spawnSlipice(x,dir)` / `spawnIcicle(x)` | deterministic hazard setup |
| `spawnCoin(x,y)` | deterministic bonus-phase setup |

## 7. Snapshot shape

What `MarioBrosTestSurface.snapshot()` should expose (flat, JSON-serializable):

```
{ score, high, lives, phase, loopCount, flow, mode,
  players:[{x,y,vx,onGround,alive,invuln,comboCount}],
  enemies:[{kind,x,y,state,dir,bumps,grounded,last,stun}],
  targetsRemaining, spawnQueueLength,
  slipices:[{x,y,floorIndex}], icedPlatforms:[bool],
  icicles:[{x,y,state,lethal}],
  coins:[{x,y}], bonusActive, bonusTimer, bonusCompletions,
  powUsesRemaining }
```

## 8. Auto vs. human — the split, explicitly

- **Automated:** every non-`human` row of §2, every invariant of §3, every
  scenario of §4, all of §5. Target: `npm run test:game -- mariobros` (scenarios)
  and `npm run fuzz:game -- mariobros` (invariant soak) read pass/fail plus the
  first invariant violation with its seed.
- **Human (the ~10%):** the mode-4 pack — screenshots of each phase, the
  per-state enemy recolors (green/red/blue turtle, angry crab, blue last-enemy),
  iced platforms, falling icicles, and the bonus phase — judged for readability,
  "slip-and-slide" feel, jump-arc feel, and the difficulty arc across phases.

---

<!-- See DEVLOG.md (same folder) for the dated decision log and the numbered
     open questions raised to the human. -->
