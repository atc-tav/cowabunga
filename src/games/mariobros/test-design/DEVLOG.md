# DEVLOG — Mario Bros. Oracle Ledger (newest first)

A running decision log for the Mario Bros. spec-driven build. Newest entry on
top, with *reasoning* — so a future agent continues without re-litigating
settled questions. Pairs with `TEST_DESIGN.md` (the ledger) in this folder.

---

## 2026-06-23 — Steps 2–3: stood up the test surface and drove the behavioral reds green

**What I did.** Implemented Step 2 (test surface) and Step 3 (the clear
behavioral-fix targets) for Mario Bros., then verified with the real harness.

**Step 2 — test surface (follows Arkanoid).** Added
`MarioBrosScene.buildTestSurface()` (registered under `import.meta.env.DEV`),
`src/games/mariobros/testing/scenarios.mjs` (17 scenarios), and `fuzz.mjs`. The
snapshot is flat JSON (score/lives/phase/flow/mode/combo, `players[]`,
`enemies[{kind,x,y,state,dir,bumps,grounded,last,stun,effSpeed}]`,
`targetsRemaining`, `coinCount`, `powUsesRemaining`, bonus fields, iced count,
…). Hooks cover the ledger §6 seams plus what the scenarios need
(`beginPlay`, `skipToPhase`, `spawnEnemy`, `flipEnemy`, `kickEnemy`,
`activatePow`, `setScore`, `checkExtraLife`, `placePlayer`, `resolveContact`,
`collectAllCoins`, `makeLast`, `setEnemyAirborne`, `stepHorizontal`, …).
Invariants coded: score≥0, pow-uses∈[0,3], ≤3 iced platforms, enemies in bounds,
flipped⊕shell, **fly-last-no-boost**, and the **turtle<fly<crab** speed ordering.

**Step 3 — behavioral fixes (only these + the surface touched game code).**
- Scoring: kick = **800 flat** for all kinds (`KICK_SCORE`; crab 1200→800, fly
  1000→800); coin **300→800**; bonus all-coins **5000 first / 8000 subsequent**;
  combo replaced the `2^(n-1)` doubling with a pure `comboScore(n)=min(800n,3200)`
  (additive +800, capped 3200); **extra life at 20,000** wired through
  `Player.grantExtraLifeIfDue` (one-shot, US default) and awarded on kick + coin.
- Enemies: retuned to **turtle 36 < fly 40 < crab 46** (was 42/40/38, inverted);
  added `lastBoost` so the last-enemy speed multiplier applies to turtle/crab
  only — the **Fighterfly keeps its pace as last** (§0 #6); added
  `groundedFlipOnly` so a mid-air fly bump is a no-op (§4.3).
- Stomp: removed `canStomp`/stomp-kills-enemy — landing on an un-flipped enemy
  now **kills the player**, enemy survives (§3.1).
- POW: now **re-flips an already-flipped grounded enemy upright** via `recover()`
  (§3.3 caution); still skips airborne enemies.
- Player: **fixed jump arc** — extracted `applyHorizontal`; horizontal `vx` is
  locked while airborne (no mid-air steering). Removed `AIR_ACCEL` use.

**Verification.** `npm run build` green (tsc strict, no `any`);
`npm run test:game -- mariobros` 55/55 checks; `npm run fuzz:game -- mariobros`
clean (no invariant violations / exceptions); `npm test` (vitest) 9/9.

**Tally moved 🟢 36 / 🟡 7 / 🔴 56 / human 4 / n/a 1.** Every Step-3 target row is
now 🟢 and traced to a named scenario or coded invariant.

**Honest reds left.** The remaining 🔴 are **untested** behaviors the harness does
not yet exercise (momentum, gap-fall/edge traversal, screen-wrap of player +
enemies, bottom-pipe recycle, slipice/icicle state machines, head-on reverse,
spawn stagger/alternation, sprite/TX/color rows, phases 11–14 + looping) and the
**deferred** rows (Mode A/B, phase 12/14 rosters, bonus-phase cadence,
color-variant palette-swap). None were in scope this session.

**Deferred — left red with a note (per the task).** Mode A/B difficulty
(`mode/A-B`, `const/flip-recovery-*` already human); phase 12/14 rosters +
bonus-phase cadence (`phase/roster-12/13-bonus/14`, `phase/count`, loop rows —
§0 leaves cadence MED-confidence and 12/14 "Mixed" under-specified); color-variant
palette-swap sprites (`sprite/color-variant` — aesthetic/human). The 2P
solo/coop/versus modes were preserved and still pass the fuzz soak.

**Spec ambiguity hit.** `scoring/bonus-all-subsequent` (8000) — the value is fixed
in code, but the scenario only exercises the **first** bonus stage (5000); driving
a *subsequent* stage needs phase-completion plumbing I left out of scope, so that
row is 🟡 (value correct, second-stage path not yet exercised). `slipice/non-target`
is 🟡 for the same reason (separation proven; full kill-then-clear scenario TODO).

---

## 2026-06-24 — Reconciled the ledger to the authoritative §0 (authentic-arcade research pass)

**What I did.** The spec gained an authoritative **§0 Authentic-Arcade
Reconciliation** (US/English single-player 1983 arcade, sources + confidence per
row) plus matching inline fixes. I re-judged every affected ledger row against
the *corrected* spec and the current code (`src/games/mariobros/*.ts`). **No game
code was modified.** I also added a 🟡 status ("value/behavior matches the
corrected spec but unverifiable until the test surface exists") so we can
separate the genuine remaining bugs (🔴) from pure test-surface debt.

**The big reframe:** several rows that were 🔴 ("code disagrees with spec") were
*the spec being wrong*, not the code. Once §0 corrects the spec, the code is
actually right on those points:
- **`scoring/flip`** — spec now says flip awards **0** (only the kick scores, §0
  #1). Code already awards 0 on flip → now CORRECT in value (🟡, unverifiable).
- **`flip/recovery` timer** — the "20 s / 15 s" was the *bonus-stage* time limit,
  not flip recovery; authentic recovery is ~5 s (§0 #4). Code's
  `SHELL_STUN_MS=4200` is inside the 4–6 s band → reclassified the two
  `const/flip-recovery-*` rows as **human** (feel-tuned), dropped the
  20 000/15 000 ms assertions.
- **last-enemy / enrage multipliers** — exact numbers are undocumented and
  feel-tuned (§0 #8); the binding constraint is **ordering** (turtle < fly < crab;
  enraged > normal). Replaced exact-multiplier unit rows with an **ordering
  invariant** + a **human** "exact feel" row.

**Genuine bugs that stayed (or got sharper) 🔴:**
- `scoring/kick` (1200/1000 must be 800), `scoring/coin` (300→800),
  `scoring/bonus-all-first/subsequent` (3000/5000 → **5000/8000**, §0 #3),
  `scoring/combo-additive` (code **doubles** `2^(n-1)`; spec is **additive +800
  capped at 3200**, §0 #2), `scoring/extra-life` (20 000 confirmed authentic §0
  #5; code implements none).
- `enemy/crab-faster` / `enemy/speed-ordering` — crab base 38 < turtle 42: a real
  **ordering violation** (crab must be fastest, §0 #8).
- `enemy/fly-not-last-fast` (new) — code's `makeLast()` + uniform
  `ENEMY_LAST_MULT` accelerates the Fighterfly as last enemy; §0 #6 says it must
  NOT speed up. Gated `flip/last-immediate-superfast` to turtle/crab only.

**Scope:** marked solo/coop/versus player-count modes as **`n/a` out of scope**
(non-spec extra per §0), not red. Single-player Mode A/B is the faithful target
(`mode/A-B` stays 🔴 — no A/B difficulty exists; §0 #7 redefines B as faster
enemies + shorter recovery).

**Flagged for the human:** `scoring/slipice = 500` is **undocumented/unverified**
(§0 #9) — kept as a placeholder (🟡) but its *value authenticity* is unproven, so
a green here is not faithfulness evidence. Also the **bonus-phase cadence**
(phases 3/8/13 vs §0's MED-confidence "4 and 9, then every 7th") was **not**
turned into a hard roster integer — see "Couldn't cleanly turn into a row" below.

### Resolution of the 10 open questions (all settled by §0 unless noted)

1. **Modes A/B vs solo/coop/versus** → SETTLED (§0, §1). Single-player A/B is the
   faithful target; 2P co-op/versus are an out-of-scope non-spec extra (`mode/2p-coop-versus` = n/a). Mode B = faster enemies + shorter recovery (§0 #7).
2. **Last/enraged multiplier 2.2× global vs per-enemy** → SETTLED (§0 #8). The
   per-enemy §4 table governs; global §9 values removed. Exact numbers are
   feel-tuned; only the **ordering** (turtle<fly<crab; enraged>normal) and the
   **fly-last exemption** (§0 #6) are asserted.
3. **Combo ×2 doubling vs listed sequence** → SETTLED (§0 #2). It is **additive
   +800, capped at 3200** (800/1600/2400/3200), NOT doubling. Window ~1–2 s is
   feel-tuned. Code's doubling is now a confirmed bug.
4. **"Fixed jump arc" vs air control** → STILL OPEN (§0 is silent). §0 confirms
   "fixed jump arc (no mid-air steering)" as authentic but gives no air-drift
   tolerance. `move/fixed-jump-arc` keeps its loose assertion; flagged below.
5. **Ground-floor wrap vs pipe-recycle** → STILL OPEN (§0 confirms screen wrap
   for player + enemies as authentic, but does not resolve the floor pipe-recycle
   vs edge-wrap conflict with §7.2). `wrap/enemies` stays 🔴, flagged below.
6. **Units px/frame (§9) vs px/second (code)** → STILL OPEN. §0 declares the §9
   global multipliers feel-tuned/removed but does **not** give authoritative
   absolute speeds; the `const/enemy-base-*` and player `const/*` rows stay 🔴
   pending a units decision. The *ordering* is now the real faithfulness gate, so
   exact absolute values are lower-stakes (many become human/feel).
7. **POW re-flips a flipped enemy upright** → CONFIRMED IN SCOPE. §0's
   "confirmed correct" list keeps the POW caution behavior; `pow/reflips-flipped-upright` stays 🔴 (required, not implemented).
8. **Color-variant rendering automatability** → UNCHANGED. Split stands:
   state→colorToken mapping = unit-ish, on-screen readability = human.
9. **Phase 12/14 "Mixed enemies" roster** → STILL OPEN/UNDER-SPECIFIED. §0 does
   not enumerate phase 12/14 rosters; `phase/roster-12` and `phase/roster-14`
   remain non-decisive ("Mixed"). Flagged below.
10. **2P/co-op/versus scope** → SETTLED (§0). Out of faithfulness scope (n/a).

---

## 2026-06-23 — Drafted the Oracle Ledger from the spec (Steps 0–1)

**What I did.** Linted `specs/mario-bros-arcade.md` against
`specs/SPEC_GUIDE.md` and drafted the complete Oracle Ledger
(`TEST_DESIGN.md`): a §0 coverage map over every spec section, the risk map,
~90 ledger rows (every constant, every scoring value, every enemy
type/state, every phase 1–14, every `✅ CHECK`), the invariant catalog, the
scenario catalog, the pure-logic-to-extract list, the hook list, the snapshot
shape, and the auto/human split. **No game code was modified.** This is Steps
0–1 only; the test surface (Step 2) and implement-to-green (Step 3) come after a
human resolves the open questions below.

**Status is honest-red.** The current build has **no test surface** — there is
no `buildTestSurface()` on `MarioBrosScene` and no `src/games/mariobros/testing/`
directory. Every `scenario`/`invariant` row is therefore unverifiable today and
is marked 🔴 even where the underlying behavior reads plausibly correct in the
code. Several rows are 🔴 because the code is *demonstrably wrong* against the
spec (see findings) rather than merely unverifiable; those are the real
faithfulness gaps.

**Key decisions while drafting.**
1. Lifted **every** `PHYSICS` constant and **every** scoring value into its own
   `unit` row with the exact spec number, per the vetting guide — this is the
   pass that catches Mario Bros.' historically every-value-wrong scoring.
2. Where the spec gives constants in **px/frame** (§9) and the code works in
   **px/second**, I did not assume the conversion is correct — each `const/*`
   row demands the implementation document and match the converted value. Most
   are 🔴 pending that reconciliation (likely a spec-vs-impl units question —
   see Q6).
3. Enumerated **all 14** phases as separate `phase/roster-*` rows so the three
   missing phases (12, 13-bonus, 14) and the mis-composed phase 11 are
   unmissable red rows — exactly the technique that exposed Donkey Kong's
   missing 75m stage.
4. Marked the **stomp rule** as a P0 scenario (`stomp/kills-player`): the spec
   is explicit that jumping onto an enemy kills the **player**, and the current
   build does the opposite for turtles and flies. This is the single biggest
   behavioral inversion.

**Confirmed-wrong vs. current code (the faithfulness gaps).**
- Flip awards **0** points (should be 10). Kick awards **800/1200/1000** for
  turtle/crab/fly (should be **800** flat). Coin awards **300** (should be 800).
- Stomping turtles and flies kills the **enemy** (spec: kills the **player**).
- No extra-life at 20 000 points anywhere.
- Only **11** phases exist (spec lists 14); phase 11 composition is wrong;
  no Phase-13 ice-bonus; loop returns to phase 1 (spec: loop phases ~10–14).
- No **Mode A / Mode B** difficulty; the menu offers solo/coop/versus instead.
  Flip recovery uses `SHELL_STUN_MS=4200 ms`, not the spec's 20 000/15 000 ms.
- **Fighter Fly** can be flipped mid-air (spec: grounded-only) and uses the
  same long stun as a turtle (spec: recovers very fast).
- **Sidestepper** base speed (38) is *slower* than the turtle (42) — spec says
  the crab is "notably faster."
- POW does **not** re-flip an already-flipped enemy upright (spec caution).
- Ground-floor enemies do **not** wrap; they recycle through bottom pipes
  (spec's wrap CHECK says wrap applies to player and **all** enemies).
- Reduced TX set: the spec's per-state sprite keys (`shellEnraged*`,
  `shellFast*`, `crabFast*`, `flyFast*`, `powBlockUsed`, `icicleHit`,
  `platformIced`, `pipe`) are absent; color states are done with Phaser tint
  rather than the spec's palette-swap, and the turtle has no red enrage tint.

**Confirmed-correct constants (green where checkable now).** `POW_USES=3`,
`LIVES_START=3`, `BONUS_TIME_MS=20000`, `SLIPICE_SCORE=500`,
`BONUS_COMPLETE_FIRST=3000`, `BONUS_COMPLETE_REPEAT=5000`, `ICE_FRICTION_SCALE`
(~0.12 ≈ spec ratio), phase rosters 1–10. These are 🟢 as values; the behaviors
they feed are still 🔴 until a test surface verifies them.

### OPEN QUESTIONS for the human (resolve before Step 2)

1. **Game modes — A/B vs solo/coop/versus.** The spec defines **Mode A
   (default) / Mode B (faster stun recovery)** and pins flip-recovery timers to
   them (20 000 / 15 000 ms, §9). The current build instead exposes
   **solo / co-op / versus** player-count modes and a single 4 200 ms stun.
   Should we (a) add A/B difficulty on top of the player-count modes, (b)
   replace player-count modes with A/B, or (c) treat 2P/versus as an
   intentional, out-of-spec extension and keep both? This blocks
   `const/flip-recovery-*`, `flip/recovery-enrage`, and `mode/*`.

2. **Last-enemy speed multiplier — 2.2× (global) vs per-enemy (turtle 2.0×,
   crab 2.5×, fly "increased").** §9 gives `enemyLastMultiplier:2.2`, but the
   §4 per-enemy tables give 2.0× (turtle), 2.5× (crab). Which governs? Same
   conflict for enraged: §9 says 1.6×, §4.1 turtle table says 1.5×, §4.2 crab
   says 1.8×. Need one authoritative source per state.

3. **Combo multiplier shape — ×2 doubling vs the spec's listed sequence.**
   §3.4 lists "1st=800, 2nd=1600, 3rd=3200" which is ×2 doubling (current code
   matches). But is the chain unbounded, and does it reset on a missed window or
   on death? Confirm the window length (spec "~1 second"; code 1 100 ms) and
   the reset rule so `scoring/combo-multiplier` is decisive.

4. **"Fixed jump arc (cannot adjust mid-air)" vs air control.** §3.1 says the
   jump arc cannot be adjusted mid-air, yet the build applies `AIR_ACCEL` for
   mid-air steering. Is *some* air drift intended (classic Mario Bros. has a
   little), or must horizontal velocity be locked at takeoff? This sets the
   assertion for `move/fixed-jump-arc`.

5. **Screen wrap on the ground floor.** §1's ✅ CHECK says wrap applies to "both
   the player and all enemies," but §7.2 says enemies "exit through bottom pipe
   → teleport back to top spawn." On the floor these conflict: does a
   floor-walking enemy wrap edge-to-edge, or is the floor a no-wrap row where
   reaching a corner pipe recycles it (current behavior)? Need the rule for
   `wrap/enemies`.

6. **Units: px/frame (spec §9) vs px/second (code).** The spec's constants are
   px/frame at 60 fps; the code is px/second. Is the intended faithful value the
   spec number × 60 (e.g. `playerMaxSpeedX 3.2 → 192 px/s`, but code uses 100),
   or were the code values deliberately retuned for feel? If retuned, the spec
   should be amended so the `const/*` rows have an authoritative target;
   otherwise these stay red.

7. **POW re-flips a flipped enemy upright (§3.3 caution).** The spec says
   hitting POW while an enemy is already flipped flips it back upright (reviving
   it faster). Is this a required mechanic to implement, or an acceptable
   simplification to drop? Sets `pow/reflips-flipped-upright`.

8. **`✅ CHECK — Color Variant Rendering` automatability.** This CHECK asks the
   renderer to palette-swap by state without separate sprites. Color/pixels are
   normally a **human** row here, but the *which-state-maps-to-which-color*
   logic is automatable. Confirm we split it: state→colorToken mapping = unit
   row; actual on-screen readability = human row. (Drafted that way.)

9. **Phase 12 / 14 "Mixed enemies" is under-specified.** §6.1 says "Mixed
   enemies" without an exact roster for phases 12 and 14. Need explicit
   compositions to make `phase/roster-12` and `phase/roster-14` decisive (a
   ledger row cannot be "mixed").

10. **Scope: 2-player, co-op, versus.** These exist in the build but are absent
    from the spec entirely. Are they in scope for faithfulness scoring, or
    explicitly out-of-spec extras that should not count for or against the
    ledger? Affects how `shellHurts`, `stunForVersus`, and the mode menu are
    judged.
