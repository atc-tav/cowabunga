# DEVLOG — Mario Bros. Oracle Ledger (newest first)

A running decision log for the Mario Bros. spec-driven build. Newest entry on
top, with *reasoning* — so a future agent continues without re-litigating
settled questions. Pairs with `TEST_DESIGN.md` (the ledger) in this folder.

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
