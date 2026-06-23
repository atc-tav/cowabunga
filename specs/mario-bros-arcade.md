# Mario Bros. (1983 Arcade) — Clone Design Specification

> **Build target:** Browser-based clone using font/ASCII character tile rendering system.
> **Scope exclusions:** Fireballs (both red and green variants) are explicitly out of scope.
> **LLM verification notes** appear throughout as `> ✅ CHECK:` callouts — use these to validate implementation correctness at each stage.

---

## 0. Authentic-Arcade Reconciliation (2026 research pass)

> This section is **authoritative** and overrides any conflicting inline value
> below. It records corrections made after researching the authentic 1983 US
> arcade (sources + confidence per row). Canonical target = **US/English arcade,
> single-player**; Mode A/B are the difficulty target (2P co-op/versus are a
> non-spec extra and out of faithfulness scope). Where the authentic value is
> **not documented in accessible sources**, we say so and treat it as
> **feel-tuned** (a human-judged row), rather than inventing precision.

| # | Spec said | Corrected to (authentic) | Conf. | Source |
|---|-----------|--------------------------|-------|--------|
| 1 | Flip enemy = **10 pts** | **0 pts** — flipping scores nothing; points are awarded only on the kick | MED | mariowiki / strategywiki (no source attributes points to a flip) |
| 2 | Combo = 800 → 1600 → **3200** (doubling) | **Additive +800: 800 / 1600 / 2400 / 3200, capped at 3200** | HIGH | strategywiki |
| 3 | All-coins bonus = 3,000 first / 5,000 later | **5,000 first bonus stage / 8,000 subsequent** (the 800 is per-coin and additional) | HIGH | strategywiki / mariowiki |
| 4 | Flip recovery = **20 s** (A) / 15 s (B) | **~5 s** before it rights itself (Mode B shorter). The "20 s / 15 s" is the **bonus-stage time limit**, not recovery. Exact frames **undocumented → feel-tuned** | HIGH (that 20 s is wrong) / LOW (exact) | strategywiki, tcrf |
| 5 | Extra life at **20,000** | **Correct** — 20,000 is the US DIP factory default (options 20k/30k/40k/None). JP adds a **recurring** life every 30,000. Current code implements **none** — that's the bug | HIGH | arcade-museum.com dipswitch, tcrf |
| 6 | Last enemy → all turn blue/super-fast | Shellcreeper & Sidestepper jump to fastest pace; **Fighterfly does NOT speed up as last enemy** | HIGH | mariowiki / strategywiki |
| 7 | Mode A/B = "easier/harder timing" | **Mode B = faster enemies + shorter flip-recovery** (must kick sooner); exact deltas undocumented → feel-tuned | MED | tcrf |
| 8 | Per-enemy speed multipliers (§3.2/§9 conflict: 1.6×/2.2× global vs 1.5×/2.0×, 1.8×/2.5× per-enemy) | **The per-enemy table (§4) governs; the global §9 values are removed.** Exact numbers are **feel-tuned**; the binding constraint is the **ordering**: Shellcreeper (slowest) < Fighterfly < Sidestepper (fastest), and enraged > normal | MED (ordering) / LOW (exact numbers undocumented) | mariowiki |
| 9 | `Hit Slipice = 500 pts` | **Undocumented** — no source confirms a Slipice point value. Left at 500 but flagged unverified | LOW | — |

**Confirmed correct (no change):** kick = 800, coin = 800, POW = 3 uses + no
effect on airborne Fighterfly, Slipice freezes a platform at its center and
makes it slippery, two-hit Sidestepper, screen wrap for player + enemies, fixed
jump arc (no mid-air steering).

**Bonus-phase numbering** (spec says phases 3/8/13): authentic cadence is most
likely phases **4 and 9, then every 7th** — but this is MED confidence, so the
ledger marks phase-cadence rows as needing confirmation rather than asserting a
specific wrong integer.

---

## 1. Game Overview

- **Genre:** Single-screen arena platformer
- **Setting:** Side-scrolling sewer of New York City with pipes at all four corners
- **Core loop:** Enemies emerge from top pipes → traverse platforms downward → exit through bottom pipes → repeat. Player must flip every *target enemy* onto its back, then kick it off the screen to clear the phase.
- **Screen wrap:** The playfield uses horizontal wrap-around. A character exiting the left edge reappears at the right edge at the same Y position, and vice versa.
- **Lives:** Player starts with 3 lives. Earn an extra life at 20,000 points.
- **Game modes:** Mode A (default) and Mode B (expert — enemies move faster *and* recover from a flip in less time, so they must be kicked off sooner). Single-player A/B is the faithful target; 2P co-op/versus are a non-spec extra (see §0). Exact Mode-B deltas are feel-tuned (undocumented).

> ✅ **CHECK — Screen Wrap:** Verify that a sprite whose `x` position exceeds `stageWidth` wraps to `0`, and a sprite at `x < 0` wraps to `stageWidth`. This should apply to both the player and all enemies.

---

## 2. Stage Architecture

### 2.1 Platform Layout

The stage is a fixed single-screen arena. All phases share the same platform structure:

```
┌──────────────────────────────────────────────────────┐
│  [PIPE-TL]                              [PIPE-TR]    │  ← Top row: enemy spawn pipes
│                                                      │
│    ─────────────────────────────────────────         │  ← Platform row 1 (top)
│                                                      │
│        ──────────────────────────────────            │  ← Platform row 2 (middle)
│                                                      │
│    ─────────────────────────────────────────         │  ← Platform row 3 (lower-mid)
│                                                      │
│              [ P O W ]                               │  ← POW Block (center, above floor)
│                                                      │
│  [PIPE-BL]          [FLOOR]             [PIPE-BR]    │  ← Floor + enemy exit pipes
└──────────────────────────────────────────────────────┘
```

**Platform rows (top → bottom):**

| Row | Label | Vertical Position (relative) | Notes |
|-----|-------|-------------------------------|-------|
| 1 | Top platform | ~20% from top | Enemies traverse left–right here first |
| 2 | Middle platform | ~45% from top | Central zone, key tactical area |
| 3 | Lower-mid platform | ~65% from top | Has gaps near pipe entrances |
| 4 | Floor | Bottom of stage | Always full-width, no gaps |

- Platforms have small gaps at the edges near the pipes, allowing enemies to walk off and fall to the next platform.
- The POW Block spawns centered just above the player's starting position (center of floor row).

> ✅ **CHECK — Platform Collision:** A character walking off the right or left edge of a platform row (not a gap) should NOT fall. A character reaching the **gap** at the pipe end of a platform SHOULD fall to the next lower platform. Verify gap boundaries match the artwork.

### 2.2 Pipe Positions

| Pipe | Location | Function |
|------|----------|----------|
| Top-Left | Top-left corner | Enemy spawn (enter upward) |
| Top-Right | Top-right corner | Enemy spawn (enter upward) |
| Bottom-Left | Floor-left | Enemy exit (walk in and teleport to top spawn) |
| Bottom-Right | Floor-right | Enemy exit (walk in and teleport to top spawn) |

- Enemies spawn from the top pipes and walk toward the bottom pipes, cycling until defeated.
- Coin collectibles (post-kill) also pop out of the top pipes after an enemy is eliminated.

### 2.3 Icicles (Phases 9+)

- In later phases, icicles form on the **underside** of the top platform (Platform Row 1).
- They grow visually over time (small nub → full spike) and then **drop** when fully formed.
- A fully formed falling icicle kills the player on contact.
- Icicles are cosmetic hazards only — they are **not** enemies and cannot be flipped.

> ✅ **CHECK — Icicle Timer:** Each icicle should have an independent formation timer. When the timer expires it transitions through: `hidden → forming → full → falling`. The `falling` state is lethal to the player. Verify the player collision check is **only active** in the `falling` state.

---

## 3. Core Gameplay Mechanics

### 3.1 Player Movement

| Property | Behavior |
|----------|----------|
| Horizontal movement | Momentum-based; player does **not** stop instantly. Deceleration is gradual, creating a "slip and slide" feel on normal floors. |
| Jump | Fixed arc (cannot adjust mid-air). Player chooses direction (left, right, or straight up) at jump initiation. |
| Fall | Player can fall from any height without taking damage. |
| Stomp | Jumping onto an enemy from above causes the **player** to lose a life — enemies cannot be stomped in this game. |
| Platform drop | Players **cannot** drop through platforms intentionally. |

> ✅ **CHECK — Momentum Physics:** At input release, the player's `velocityX` should decay by a friction constant each frame rather than snapping to 0. Confirm that the player slides 1–2 tile-widths after releasing the direction key at full speed.

### 3.2 Enemy Defeat Sequence

All standard enemies are defeated in a two-step process:

```
Step 1: HIT FROM BELOW
  → Player jumps and hits the platform directly below the enemy
  → Enemy is FLIPPED (stunned on its back)
  → NO points for the flip itself (see §0 #1) — scoring happens on the kick

Step 2: KICK (contact while flipped)
  → Player runs into the flipped enemy
  → Enemy is KICKED off the platform (flies off the edge)
  → 800 points awarded (base; see combo multiplier below)
```

**Flip recovery (if player is too slow):**
- The flipped enemy will stand back up after a timeout and re-enter the field **faster** and **with a color change indicating anger**.
- Recovery timer (see §0 #4): **~5 seconds** before the enemy rights itself in
  Mode A; **shorter** in Mode B. (The 20 s / 15 s figures are the *bonus-stage*
  time limit, not recovery.) Exact frame count is undocumented → feel-tuned.

**Speed states for standard enemies:**

| State | Trigger | Visual Indicator |
|-------|---------|-----------------|
| Normal | Initial spawn | Default color |
| Enraged / Fast | Enemy recovers from a flip, OR is first-hit on a Sidestepper | Color change (see per-enemy specs) |
| Super Fast (Last Enemy) | Only 1 enemy remains in phase — **applies to Shellcreeper & Sidestepper only; a Fighterfly does NOT speed up as last enemy** (§0 #6) | Turns blue; hardest to defeat |

> ✅ **CHECK — Flip Recovery:** Implement a `flipTimer` on each enemy. When `flipTimer` expires before kick, call `enemy.enrage()`. Verify the enemy's speed constant increments and color state changes. Test edge case: a last-enemy Shellcreeper or Sidestepper should immediately enter super-fast state regardless of being flipped — but a **Fighterfly must NOT** (it keeps its pace; §0 #6).

### 3.3 POW Block

- **Position:** Center of stage, hovering above the floor.
- **Uses:** 3 per phase (block disappears after 3 hits).
- **Effect on activation:** All enemies **currently touching a platform or the floor** are instantly flipped onto their backs simultaneously.
- **Caution:** If an enemy is **already flipped**, hitting the POW will flip it back upright (potentially reviving it in a faster state).
- **Player impact (2P mode):** The second player is also bounced upward when the POW is hit.

> ✅ **CHECK — POW Logic:** Maintain a `powUsesRemaining` counter (starts at 3). On hit: `powUsesRemaining--`. When 0, remove the POW Block sprite. Confirm the POW does NOT affect airborne enemies (Fighter Fly mid-jump).

### 3.4 Scoring & Combos

| Action | Points |
|--------|--------|
| Flip enemy | **0** (no score for the flip; see §0 #1) |
| Kick enemy off platform | 800 |
| Hit Slipice | 500 *(undocumented — unverified, §0 #9)* |
| Collect bonus coin | 800 |
| Collect all bonus coins (1st bonus stage) | **5,000** |
| Collect all bonus coins (2nd bonus stage onward) | **8,000** |
| Extra life threshold | 20,000 points (US DIP default; JP also recurs every 30,000 — §0 #5) |

**Combo multiplier (see §0 #2):**
- Kicking enemies in quick succession adds **+800 each**: 1st kick = 800, 2nd =
  1,600, 3rd = 2,400, 4th = 3,200, **capped at 3,200**. (NOT a doubling.) The
  exact succession window is undocumented (~1–2 s) → feel-tuned.

### 3.5 Enemy Collision Behavior

- When two enemies **collide head-on** on the same platform, they both reverse direction.
- This is a key mechanic for controlling enemy clusters.

---

## 4. Enemy Specifications

> **Implementation pattern:** All enemies share a base `Enemy` class with: `state` (normal | enraged | superFast | flipped), `direction` (left | right), `speed`, `hitPoints` (1 or 2), `flipTimer`, `position`, `currentFrame`, and `animationInterval`.

---

### 4.1 Shellcreeper (Turtle)

**First Appears:** Phase 1
**Role:** Tutorial enemy; establishes the core flip-and-kick loop.

#### Behavior

- Walks in a straight line along platforms at a slow, steady pace.
- Traverses from top pipe → down through platforms → exits bottom pipe → repeats.
- **Does not jump.** Drops off platform edges naturally by walking off gaps.
- Requires **1 hit** to flip.
- If not kicked after being flipped, it recovers with its shell turning **red** and moves at an increased speed.
- As the **last enemy** on screen, it turns **blue** and enters super-fast mode regardless of hit state.

#### Speed States

| State | Color | Speed Multiplier |
|-------|-------|-----------------|
| Normal | Green | 1.0× |
| Enraged (post-recovery) | Red | 1.5× |
| Last Enemy | Blue (purple in some ports) | 2.0× |

#### ASCII Sprite Design

The Shellcreeper is a wide-bodied turtle. Key design elements: **domed shell** with a segmented pattern, **small legs** visible below, **beady eyes** on the sides of the head, and a **beak/snout**.

```
// Shellcreeper Walk Frame 0 (12x10). S=shell body (green), E=eye, L=leg, B=beak
const SHELL_WALK_0: string[] = [
  '            ',
  '  SSSSSSSS  ',
  ' SSESISSSS  ',  // E = eye socket area
  ' SSSSSSSSB  ',  // B = beak right
  ' SSSSSSSS   ',
  ' LLSSSSLL   ',  // L = legs
  '  LL  LL    ',
  '            ',
  '            ',
  '            ',
];

const SHELL_WALK_1: string[] = [
  '            ',
  '  SSSSSSSS  ',
  ' SSESISSSS  ',
  'BSSSSSSSS   ',  // B = beak left (facing other way)
  ' SSSSSSSS   ',
  '  LLSSLL    ',
  '   LL LL    ',
  '            ',
  '            ',
  '            ',
];

// Flipped state — upside down, legs in the air, shell on ground
const SHELL_FLIP: string[] = [
  '            ',
  '   LL  LL   ',  // legs up
  '  LLSSSSLL  ',
  ' SSSSSSSSSS ',  // flat shell on ground
  ' SSSSSSSSSS ',
  '  SSSSSSSS  ',
  '            ',
  '            ',
  '            ',
  '            ',
];
```

**TX keys:** `shellWalk0`, `shellWalk1`, `shellFlip`
**Animation:** Alternate `shellWalk0` ↔ `shellWalk1` at ~200ms per frame. Show `shellFlip` while in `flipped` state. Mirror horizontally based on `direction`.

> ✅ **CHECK — Shellcreeper Sprite:** Confirm the sprite renders with correct color mapping: `S` tiles = green (normal), red (enraged), blue (last enemy). Verify `shellFlip` shows legs pointing **upward** (character is upside down).

---

### 4.2 Sidestepper (Crab)

**First Appears:** Phase 4
**Role:** Intermediate enemy; introduces the two-hit mechanic.

#### Behavior

- Walks in a straight line similar to Shellcreeper, but notably **faster**.
- Requires **2 hits** to flip:
  - **Hit 1:** Sidestepper is NOT flipped. Instead, it becomes **enraged** — speed increases and face shows an angry grimace.
  - **Hit 2 (while enraged):** Sidestepper IS flipped (stunned on its back).
- After recovering from a flip, it moves at a further increased speed.
- As the last enemy, enters super-fast blue state.

#### Speed States

| State | Color | Speed Multiplier | Hit Points Remaining |
|-------|-------|-----------------|---------------------|
| Normal | Red | 1.0× | 2 |
| Enraged (after 1st hit) | Darker red / orange | 1.8× | 1 |
| Last Enemy | Blue | 2.5× | 1 |

#### ASCII Sprite Design

The Sidestepper is a wide, low-bodied crab. Key elements: **wide claw arms** extending to both sides, **multiple legs** below the body, **round eyes on stalks**, and a **wide flat body**.

```
// Sidestepper Walk Frame 0 (12x10). C=claw, B=body, E=eye stalk, L=leg
const CRAB_WALK_0: string[] = [
  ' C        C ',  // claw tips
  ' CC BBBB CC ',  // claws + body
  ' CCEBBBBECC ',  // E = eye stalks
  '  CBBBBBBCC ',
  '   BBBBBB   ',
  '  LL BB LL  ',  // L = legs
  '  LL    LL  ',
  '            ',
  '            ',
  '            ',
];

const CRAB_WALK_1: string[] = [
  ' C        C ',
  ' CC BBBB CC ',
  ' CCEBBBBECC ',
  '  CCBBBBBC  ',
  '   BBBBBB   ',
  '   LLBBLL   ',
  '    L  L    ',
  '            ',
  '            ',
  '            ',
];

// Flipped — flat on back, claws and legs in air
const CRAB_FLIP: string[] = [
  '  LL    LL  ',
  ' LLC    CLL ',
  ' LLCBBBBCLL ',
  '  CCBBBBCC  ',
  '  CBBBBBBC  ',
  '   BBBBBB   ',
  '            ',
  '            ',
  '            ',
  '            ',
];
```

**TX keys:** `crabWalk0`, `crabWalk1`, `crabFlip`
**Animation:** Alternate `crabWalk0` ↔ `crabWalk1` at ~150ms per frame (faster than turtle). Mirror horizontally based on `direction`.

> ✅ **CHECK — Two-Hit Mechanic:** Implement `sidestepper.hitPoints = 2`. On first platform-hit: decrement `hitPoints`, apply speed boost, change to enraged color, do **not** flip. On second platform-hit: flip enemy. Verify that recovering from flip after 2nd hit does NOT reset hitPoints back to 2.

---

### 4.3 Fighter Fly

**First Appears:** Phase 6
**Role:** Agile airborne enemy; introduces the "only flippable when touching platform" rule.

#### Behavior

- Moves by **hopping** — repeatedly jumping across the screen rather than walking continuously.
- Each hop covers approximately 2–3 tile-widths horizontally.
- **Can only be flipped when it is touching a platform or the floor** (mid-air hits from below do not flip it).
- Requires **1 hit** to flip (when grounded).
- Gets back up very quickly after being flipped — player must kick fast.
- Does **not** have an enraged faster state like Shellcreeper, and — unlike the turtle and crab — **does NOT speed up as the last enemy** (it keeps its current pace; see §0 #6). Its difficulty comes from being flippable only while grounded, not from a last-enemy speed boost.
- Can hop between platform levels (occasionally lands on a different row than where it started).

#### Speed States

| State | Color | Speed / Hop Rate |
|-------|-------|-----------------|
| Normal | Blue/dark | Standard hop cadence |
| Last Enemy | Red | Increased hop speed and distance |

#### ASCII Sprite Design

The Fighter Fly has a **fly-like body** with large **compound wings**, a round head with **visible eyes**, and small legs. The wings animate between up and down positions.

*(The existing FLY sprite from your codebase is the reference design. Reproduced here with clarified color mappings for your palette system.)*

```
// Fighter Fly (12x10). F=body (dark blue), W=eye (white), V=wing (lighter blue/grey)

const FLY_WINGS_UP: string[] = [
  '   V    V   ',
  '   VV  VV   ',
  '   FFFFFF   ',
  '  FWFFFFWF  ',  // W = eye positions
  '  FFFFFFFF  ',
  '  FFFFFFFF  ',
  '   FFFFFF   ',
  '   F    F   ',  // dangling legs
  '            ',
  '            ',
];

const FLY_WINGS_DOWN: string[] = [
  '            ',
  '   FFFFFF   ',
  '  FWFFFFWF  ',
  '  FFFFFFFF  ',
  ' VFFFFFFFFV ',
  ' VVFFFFFFVV ',
  '   FFFFFF   ',
  '   F    F   ',
  '            ',
  '            ',
];

const FLY_FLIP: string[] = [
  '   F    F   ',  // legs up
  '   FFFFFF   ',
  '  FFFFFFFF  ',
  '  FFFFFFFF  ',
  '  FWFFFFWF  ',
  '   FFFFFF   ',
  '            ',
  '            ',
  '            ',
  '            ',
];
```

**TX keys:** `flyWalk0` (wings up), `flyWalk1` (wings down), `flyFlip`
**Animation:** Alternate `flyWalk0` ↔ `flyWalk1` at ~120ms per frame. Show `flyFlip` when stunned.

> ✅ **CHECK — Jump-Only Flip Rule:** Implement a `isGrounded` boolean on Fighter Fly. A platform-hit from below should call `attemptFlip()` which checks `if (!this.isGrounded) return;` before applying the flip. Confirm with a test: hit the platform tile under a mid-air Fighter Fly — it should produce no effect.

---

### 4.4 Slipice (Freezie)

**First Appears:** Phase 9
**Role:** Environmental hazard; does not count toward phase-clear, but creates persistent difficulty by icing platforms.

#### Behavior

- Slipice is **not a target enemy** — the phase does not require killing it to advance.
- Emerges from a top pipe and walks along platforms toward the center.
- When it reaches the **center of a platform**, it coats that entire platform in ice and **destroys itself** in the process.
- A frozen platform becomes extremely slippery — the player's deceleration constant (friction) on that platform is drastically reduced (~10% of normal).
- **Three platforms** can potentially be iced (the three non-floor platforms).
- When all three platforms are iced, no more Slipice will spawn for the remainder of that phase.
- Can be killed by hitting it from below (like other enemies) — **only 1 hit** required, no kicking needed (it vanishes on flip). Worth **500 points**.
- Touching Slipice without flipping it causes the player to lose a life.
- Slipice reverses direction only when colliding with another enemy (not with the player).

#### Ice Platform Mechanics

| Platform State | Player Friction | Visual |
|----------------|----------------|--------|
| Normal | Full (standard deceleration) | Normal platform appearance |
| Iced | ~10% of normal | Platform tinted blue/white with ice pattern |

> ✅ **CHECK — Ice Physics:** Each platform tile should have an `isIced` boolean. When `true`, the player's `frictionMultiplier` when on that platform should be set to `ICE_FRICTION` (e.g., `0.02`) vs normal `GROUND_FRICTION` (e.g., `0.2`). Verify the player visibly overshoots their intended stop position on an iced platform.

#### ASCII Sprite Design

Slipice is a small blocky ice creature with a permanently puzzled/confused expression, angular icy body, and a cool blue/white color scheme.

```
// Slipice (12x10). I=ice body (light blue), C=crystal highlight (white), X=eye (dark)
const SLIPICE_WALK_0: string[] = [
  '            ',
  '   CCIICC   ',
  '  CIIIIIIC  ',
  '  IXIXIIXI  ',  // X = eyes (confused expression)
  '  IIIIIIII  ',
  '  IIIIIIIII ',
  '   IICICII  ',
  '   II  II   ',  // stubby legs
  '            ',
  '            ',
];

const SLIPICE_WALK_1: string[] = [
  '            ',
  '   CCIICC   ',
  '  CIIIIIIC  ',
  '  IXIXIIXI  ',
  '  IIIIIIII  ',
  ' IIIIIIIII  ',
  '  IICIICII  ',
  '    II II   ',
  '            ',
  '            ',
];

// No flip sprite — show a brief ICE_SHATTER particle effect on kill
```

**TX keys:** `slipiceWalk0`, `slipiceWalk1` (no flip key — use a particle/shatter effect on kill)
**Animation:** Alternate at ~180ms per frame.

> ✅ **CHECK — Slipice Non-Target Status:** Confirm that the `phase.targetEnemyCount` does NOT include Slipice. The phase completion check should only decrement when a Shellcreeper, Sidestepper, or Fighter Fly is kicked. Slipice kill should trigger its own points/effect but not advance phase completion.

---

## 5. TX (Texture Key) Registry

Below is the complete texture key registry including all enemy frames. These are the keys Claude Code should use consistently throughout the codebase.

```typescript
export const TX = {
  // Player
  marioRun0:      'mb-mario-0',
  marioRun1:      'mb-mario-1',
  marioJump:      'mb-mario-jump',

  // Shellcreeper (Turtle)
  shellWalk0:     'mb-shell-0',
  shellWalk1:     'mb-shell-1',
  shellFlip:      'mb-shell-flip',
  shellEnraged0:  'mb-shell-enraged-0',   // red color variant
  shellEnraged1:  'mb-shell-enraged-1',
  shellFast0:     'mb-shell-fast-0',      // blue/last-enemy variant
  shellFast1:     'mb-shell-fast-1',

  // Sidestepper (Crab)
  crabWalk0:      'mb-crab-0',
  crabWalk1:      'mb-crab-1',
  crabFlip:       'mb-crab-flip',
  crabEnraged0:   'mb-crab-enraged-0',    // angry face variant
  crabEnraged1:   'mb-crab-enraged-1',
  crabFast0:      'mb-crab-fast-0',
  crabFast1:      'mb-crab-fast-1',

  // Fighter Fly
  flyWalk0:       'mb-fly-0',             // wings up
  flyWalk1:       'mb-fly-1',             // wings down
  flyFlip:        'mb-fly-flip',
  flyFast0:       'mb-fly-fast-0',        // red last-enemy variant, wings up
  flyFast1:       'mb-fly-fast-1',        // red last-enemy variant, wings down

  // Slipice
  slipiceWalk0:   'mb-slipice-0',
  slipiceWalk1:   'mb-slipice-1',
  // no flip key — shatter effect only

  // Environment / UI
  powBlock:       'mb-pow',
  powBlockUsed:   'mb-pow-used',          // cracked/faded after 3 uses
  icicleForm1:    'mb-icicle-1',          // small nub
  icicleForm2:    'mb-icicle-2',          // half-formed
  icicleForm3:    'mb-icicle-3',          // full spike
  icicleHit:      'mb-icicle-hit',        // briefly visible after break
  platformIced:   'mb-platform-iced',     // iced platform tile
  coin:           'mb-coin',
  pipe:           'mb-pipe',
} as const;

export type TXKey = keyof typeof TX;
```

> ✅ **CHECK — TX Completeness:** When registering sprite frames in the renderer, verify every key in `TX` has a corresponding sprite definition registered. A missing key should throw a descriptive error at init time (not a silent undefined).

---

## 6. Phase Structure

### 6.1 Phase Progression (Phases 1–14, Arcade)

Phases are the game's levels. All target enemies must be kicked off-screen to complete a phase. Slipice does not count. Every group of phases includes a **Bonus Phase** (phases 3, 8, 13) where there are no enemies and the player collects 10 coins in 20 seconds for bonus points.

| Phase | Enemy Composition | Special Hazards | Notes |
|-------|-------------------|----------------|-------|
| 1 | Shellcreeper ×3 | — | Tutorial intro |
| 2 | Shellcreeper ×5 | — | More turtles, same mechanics |
| 3 | **BONUS** | — | 10 coins, 20-second timer |
| 4 | Sidestepper ×4 | — | First crabs; two-hit mechanic introduced |
| 5 | Shellcreeper ×2, Sidestepper ×4 | — | Mixed enemies; prioritize crabs |
| 6 | Fighter Fly ×4 | — | First flies; jump-only mechanic introduced |
| 7 | Fighter Fly ×3, Sidestepper ×2 | — | Flies + crabs mix |
| 8 | **BONUS** | — | 10 coins, 20-second timer |
| 9 | Shellcreeper ×4, Fighter Fly ×1, Slipice | Slipice | First Slipice appearance |
| 10 | Sidestepper ×4, Fighter Fly ×1, Slipice | Slipice | Crabs + Slipice |
| 11 | Sidestepper ×4, Fighter Fly ×2, Slipice | Slipice | Mixed + Slipice |
| 12 | Mixed enemies | Slipice, Icicles | Difficulty escalates |
| 13 | **BONUS** (Ice floor variant) | Ice floor, 15-second timer | Bonus on iced platforms |
| 14 | Mixed enemies | Slipice, Icicles | Final unique phase before loop |

### 6.2 Phase Looping

After Phase 14, the game loops back through a repeating set of phases (roughly Phases 10–14 repeat). Each loop iteration increases enemy base speed slightly until speeds max out (approximately by the 30s range of phases). The game is theoretically endless — play until all lives are lost.

```
Phases 1–14:   Unique compositions
Phases 15+:    Loop of phases ~10–14 with incremental speed increase
Phase 99:      Game counter wraps → displays "Phase 0", then loops as Phase 1
```

### 6.3 Bonus Phase Rules

- Same platform layout as combat phases.
- No enemies; no Slipice; no POW Block interaction needed.
- **10 coins** appear from the top pipes.
- Player has **20 seconds** (15 seconds in the Ice Bonus at Phase 13) to collect all 10 coins.
- Collecting all 10 = full bonus (**5,000 pts in the first bonus stage, 8,000 pts subsequent**; see §0 #3) — in addition to the 800 per coin.
- Timer runs out = partial bonus, no penalty beyond missed points.

> ✅ **CHECK — Bonus Phase State:** The phase manager should have a `isBonusPhase` flag. When `true`: spawn coin objects from pipes, disable enemy spawn logic, start a countdown timer, and end the phase when timer hits 0 OR all coins are collected. Verify normal enemies cannot appear during bonus phases.

---

## 7. Enemy AI Patterns

### 7.1 Spawn Sequencing

- Enemies do not all spawn simultaneously. They emerge one at a time from the top pipes, staggered by a configurable delay (approximately 1.5–2 seconds between each spawn).
- Top-Left and Top-Right pipes alternate spawns (not always the same pipe).
- Each enemy starts at the top of the screen and immediately begins walking (or hopping, for Fighter Fly) toward the opposite side.

### 7.2 Platform Traversal

```
Spawn at top pipe
  ↓
Walk along Platform Row 1 (top)
  ↓ (walk off gap at edge)
Drop to Platform Row 2 (middle)
  ↓ (walk off gap at edge)
Drop to Platform Row 3 (lower-mid)
  ↓ (walk off gap at edge)
Walk along Floor to bottom pipe
  ↓
Exit through bottom pipe → teleport back to top spawn pipe
```

- If an enemy reaches the far edge of a platform without a gap, it reverses direction (wrap-around).
- Two enemies colliding head-on **both reverse direction**.

### 7.3 Fighter Fly Special AI

- Does not walk — uses a jump arc to move.
- Hops from one position to another, covering 2–3 tile-widths per hop.
- Between hops, it briefly lands on the platform (creating the flip window).
- Can occasionally hop to a different platform level (adds unpredictability).

### 7.4 Slipice Special AI

- Moves slowly and deliberately toward the center of whichever platform it's on.
- If it reaches the center without being hit, it triggers `platform.applyIce()` and removes itself.
- Does not interact with player collision for direction reversal.
- Reverses direction only if it walks into another enemy.

---

## 8. Rendering: Improving ASCII Character Fidelity

### 8.1 Current System Limitations

The existing font-driven tile system produces legible but flat characters. The following guidelines are specifically for Claude Code to produce more game-accurate sprite art:

### 8.2 Character Design Principles (Arcade-Accurate)

**Shellcreeper:**
- Shell should be **domed** — the top row should be narrower than the middle row.
- Eyes should be **on the sides** of the head/shell (wide-set), not centered.
- Include a small **beak or snout** protruding from the front face.
- Legs should appear below the shell as small protrusions.
- Walking animation: alternate leg positions and slight body shift left/right.

**Sidestepper:**
- Much **wider** than tall — classic crab proportions.
- **Large claws** that extend beyond the body width by at least 2 tiles.
- Eyes on **stalks** above the body (2 tiles tall, not flush with body).
- Angry face variant: eyebrows slant downward (use `\` characters or a distinct eye tile).

**Fighter Fly:**
- Body is compact and oval; **wings should be wider than the body**.
- Wings animate clearly between **raised (V shape)** and **lowered (inverted V)** positions.
- Eyes are large relative to body.
- Flip state: same body, wings collapsed/hidden, legs visible pointing up.

**Slipice:**
- **Angular and blocky** — not smooth or rounded.
- Permanently **puzzled face** (wide eyes, slight open mouth suggesting confusion).
- Should clearly read as "ice" — use lighter color tokens than warm enemies.
- Smaller than other enemies overall.

### 8.3 Color Token Conventions

For your tile rendering system, use a consistent color palette per enemy type:

| Enemy | Normal Token | Enraged Token | Last-Enemy Token |
|-------|-------------|---------------|-----------------|
| Shellcreeper | `S` = green | `S` = red | `S` = blue |
| Sidestepper | `C/B` = red | `C/B` = dark orange | `C/B` = blue |
| Fighter Fly | `F` = dark blue | (no enraged) | `F` = red |
| Slipice | `I` = light blue | (no enraged) | N/A |

> ✅ **CHECK — Color Variant Rendering:** The renderer's `drawTile(char, colorState)` function should accept the enemy's current `state` and remap color palettes accordingly. Verify that `S` renders green for a normal Shellcreeper and red for an enraged one **without** requiring separate full sprite definitions — use palette-swap logic.

---

## 9. Physics Constants (Suggested Starting Values)

These values are calibrated for a ~256×240 pixel logical resolution (NES-era) and should be tuned to match arcade feel.

```typescript
export const PHYSICS = {
  gravity:              0.45,   // px per frame² downward acceleration
  playerMaxSpeedX:      3.2,    // px per frame horizontal max
  playerAccelX:         0.35,   // px per frame² horizontal acceleration
  playerJumpVelocity:  -8.5,    // px per frame initial upward velocity
  groundFriction:       0.18,   // deceleration per frame on normal floor
  iceFriction:          0.02,   // deceleration per frame on iced floor
  enemyBaseSpeed: {
    shellcreeper:       0.9,
    sidestepper:        1.4,
    fighterFly:         1.1,    // horizontal speed per hop
    slipice:            0.6,
  },
  enemyEnragedMultiplier:  1.6,
  enemyLastMultiplier:     2.2,
  flipRecoveryTimeA:    20000,  // ms (Mode A)
  flipRecoveryTimeB:    15000,  // ms (Mode B)
} as const;
```

> ✅ **CHECK — Physics Feel:** A quick smoke test: drop Mario from the top of the screen. He should reach the floor in approximately 0.5–0.8 seconds of real time. A full horizontal run across the playfield from pipe to pipe should take approximately 1.5–2 seconds. Adjust gravity and speeds accordingly.

---

## 10. LLM Self-Verification Checklist

Before considering any implementation phase complete, Claude Code should run through this checklist:

### Phase 1: Core Mechanics
- [ ] Player can run left/right with momentum-based movement (not instant stop)
- [ ] Player can jump straight up, left, and right
- [ ] Player dies on contact with un-flipped enemy
- [ ] Player dies on contact with Slipice
- [ ] Player does NOT die by jumping on top of an enemy (unless that enemy is Slipice or un-flipped)
- [ ] Screen wraps horizontally for player and all enemies
- [ ] POW Block flips all grounded enemies; disabled in air for Fighter Fly
- [ ] POW Block disappears after 3 uses

### Phase 2: Enemy Behaviors
- [ ] Shellcreeper: 1-hit flip, turns red on recovery, turns blue as last enemy
- [ ] Sidestepper: 1st hit = speed up + grimace, 2nd hit = flip, turns blue as last enemy
- [ ] Fighter Fly: Only flippable when grounded, hops to move
- [ ] Slipice: Walks to center of platform, ices it, destroys itself; no kick required; not a target enemy
- [ ] All enemies: head-on collision causes direction reversal

### Phase 3: Phase Management
- [ ] Phase clears when all target enemies (non-Slipice) are kicked off
- [ ] Bonus phases spawn 10 coins, no enemies, 20-second timer (15 for ice bonus)
- [ ] Phase counter increments correctly
- [ ] Enemy speed increases in later phases (loop multiplier)

### Phase 4: Rendering
- [ ] All TX keys have registered sprite definitions
- [ ] Sprites mirror correctly based on facing direction
- [ ] Color state changes (normal / enraged / last enemy) render correctly
- [ ] Iced platforms visually distinct from normal platforms
- [ ] Icicles animate through formation stages correctly

### Phase 5: Scoring
- [ ] Flip = 10 pts
- [ ] Kick = 800 pts (base), with combo multiplier
- [ ] Slipice hit = 500 pts
- [ ] Extra life at 20,000 pts
