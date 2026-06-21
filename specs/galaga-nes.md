# Galaga (NES, 1985) — Clone Design Specification

> **Build target:** Browser-based clone using font/ASCII character tile rendering system.
> **Platform:** NES version (Bandai, 1985) — based on the arcade original (Namco, 1981).
> **LLM verification notes** appear throughout as `> ✅ CHECK:` callouts.

---

## 1. Game Overview

- **Genre:** Fixed vertical shooter (shoot-'em-up)
- **Setting:** Deep space — the player defends Earth against waves of insectoid alien fighters
- **Core loop:** Survive the enemy fly-in formation phase → clear all enemies by shooting while dodging dive attacks and projectiles → advance to next stage
- **Win condition:** None — the game loops indefinitely until all lives are lost
- **Lose condition:** Fighter is hit by an enemy projectile, collides with a diving enemy, or is captured by a tractor beam and no lives remain
- **Screen orientation:** Vertical (portrait) — NES 256×240 resolution
- **Player movement:** Horizontal only — Fighter moves left and right along the bottom of the screen
- **Max bullets on screen:** 2 (player) at any time — this is a core constraint
- **Lives:** 3 starting lives. Extra life at 20,000 pts, then every 70,000 pts thereafter. Max 18 lives total (stops awarding after 1,000,000 pts)

> ✅ **CHECK — Two Bullet Cap:** Maintain `playerBulletsActive` counter. When `playerBulletsActive >= 2`, pressing fire does nothing. Decrement on bullet destruction (hit or exit top). Verify: rapid-fire spam with 2 bullets in flight produces no third bullet.

---

## 2. Playfield Architecture

### 2.1 Dimensions

| Element | Value |
|---------|-------|
| Screen width | 256 px |
| Screen height | 240 px |
| Player Y position | ~210 px (near bottom) |
| Player X range | 16 px to 240 px (wall boundaries) |
| Formation area top | ~20 px from top |
| Formation area bottom | ~90 px from top |
| Starfield background | Scrolling vertically downward (cosmetic only) |

### 2.2 Playfield Zones

```
┌──────────────────────────────────┐
│  [FORMATION ZONE — rows 1-4]     │  ← Enemy formation occupies top ~40% of screen
│  Boss Galaga row                 │    Row 1 (top): 4 Boss Galagas
│  Butterfly/Goei row              │    Row 2: 8 Butterflies (Goeis)
│  Butterfly/Goei row              │    Row 3: 8 Butterflies (Goeis)
│  Bee/Zako row                    │    Row 4: 10 Bees (Zakos)
│  Bee/Zako row                    │    Row 5: 10 Bees (Zakos)
│                                  │
│  [OPEN COMBAT ZONE]              │  ← Enemies dive through this space; bullets travel up
│                                  │
│  [PLAYER ZONE]                   │  ← Fighter moves left/right at bottom
│  [FIGHTER]        ←→             │
└──────────────────────────────────┘
```

### 2.3 Formation Grid

The formation holds **40 enemies** per standard wave:
- **4 Boss Galagas** — top row, center
- **16 Butterflies (Goeis)** — rows 2–3, spread across formation
- **20 Bees (Zakos)** — rows 4–5 (bottom of formation)

Formation grid cell size: approximately 16×16 px. Formation is centered horizontally. Enemies occupy their grid cell and animate (oscillating left/right slowly) while in formation.

> ✅ **CHECK — Formation Position:** Each enemy stores `formationRow` and `formationCol` as their home position. When not diving, they should drift slowly left/right with the formation. Verify: killing one enemy does not shift the others — the formation maintains its shape with gaps.

---

## 3. Core Gameplay Mechanics

### 3.1 Fighter Controls

| Input | Action |
|-------|--------|
| Left/Right D-pad | Move Fighter horizontally |
| A or B button | Fire missile (up to 2 on screen simultaneously) |
| Screen wrap | Fighter wraps from left edge to right edge and vice versa |

> ✅ **CHECK — Fighter Screen Wrap:** When `fighter.x < LEFT_BOUNDARY`, set `fighter.x = RIGHT_BOUNDARY`. When `fighter.x > RIGHT_BOUNDARY`, set `fighter.x = LEFT_BOUNDARY`. Verify the Fighter teleports edge-to-edge instantly (no transition animation).

### 3.2 Stage Structure

Each stage has two phases:

**Phase 1 — Fly-In (Formation Phase):**
- All enemies fly onto the screen from the top and/or sides in single-file lines along pre-scripted flight paths.
- Enemies can shoot at the Fighter during fly-in.
- Player can shoot enemies during fly-in (worth attacking points — same as "charging" value).
- Enemies that survive fly-in take their designated seat in the formation.
- Fly-in is complete when all remaining enemies are in formation.

**Phase 2 — Attack Phase:**
- Enemies dive from the formation toward the Fighter in ones, twos, or threes.
- A Zako dives, attacks, then either returns to formation (if it survives) or exits the bottom.
- **End-stage behavior:** When few enemies remain (approximately 5 or fewer), remaining enemies **abandon formation** and begin constant looping dives. They no longer return to formation — they loop continuously until killed.
- Stage ends when all enemies are destroyed.

> ✅ **CHECK — End-Stage Aggressive Mode:** Maintain `enemiesAlive` counter. When `enemiesAlive <= AGGRESSIVE_THRESHOLD` (suggest: 5), set all remaining enemies to `state = 'looping'`. In looping state, after each dive attempt, enemy immediately begins another dive rather than returning to formation. Verify enemies in looping state stop shooting (they only dive).

### 3.3 Enemy Fly-In Flight Paths

Enemies fly onto screen in groups along curved or looping paths. These are scripted spline/waypoint paths — not AI. The paths vary by enemy type and stage number.

**General fly-in patterns:**
- Enemies enter from the **top-left, top-right, left side, or right side** of the screen.
- They follow a looping arc before curving into their formation position.
- Multiple enemies follow the same path in a single-file "snake" line, staggered by approximately 0.5 seconds between each.
- Later stages introduce more complex/looping approach paths.

**Fly-in path types (waypoint-based):**
```
Type A (Top-Left Entry):
  Start: (-20, 40) → arc right and down → loop → settle into formation position

Type B (Top-Right Entry):  
  Start: (276, 40) → arc left and down → loop → settle into formation position

Type C (Side Entry Left):
  Start: (-20, 120) → curve right → loop up → settle into formation position

Type D (Side Entry Right):
  Start: (276, 120) → curve left → loop up → settle into formation position
```

> ✅ **CHECK — Fly-In Sequencing:** Store fly-in as an array of waypoints per path type. Enemy interpolates position along the path using a `t` parameter (0.0 to 1.0). When `t >= 1.0`, snap enemy to `formationPosition` and set `state = 'inFormation'`. Verify enemies follow smooth curved paths, not straight lines between waypoints (use Bezier or Catmull-Rom splines).

### 3.4 Enemy Shooting

- Enemies in formation and during dives can fire projectile bullets downward.
- **Formation firing rate:** Low — enemies fire infrequently while sitting in formation.
- **Dive firing rate:** Medium — enemies fire more often during dive attacks.
- Bullet speed increases with stage progression.
- Enemy bullets travel **straight down** (not aimed at Fighter's current position).
- Multiple enemy bullets can be on screen simultaneously (no cap on enemy bullets).

> ✅ **CHECK — Enemy Bullet Direction:** Enemy bullets always travel straight down (velocity = `{x: 0, y: BULLET_SPEED}`). They do NOT track the Fighter. This is intentional — it makes the player dodge a bullet curtain rather than targeted fire. Verify by positioning Fighter at an extreme left edge: bullets from a right-side enemy should still fall straight down, not angled toward the player.

---

## 4. Enemy Specifications

### 4.1 Zako (Bee) — Standard Drone

**Quantity:** 20 per wave (10 per row, 2 rows)
**Role:** Most common enemy; establishes the basic dive/return loop
**Formation position:** Bottom two rows

#### Point Values

| State | Points |
|-------|--------|
| In formation (convoy) | 50 |
| Diving/attacking | 100 |
| During fly-in | 100 (same as attacking) |

#### Behavior

- In formation: slow left-right oscillation, occasionally fires straight down.
- Dive attack: flies toward the Fighter's position at moment of dive initiation, then **dives straight down**. Does NOT track Fighter continuously.
- After dive: loops around the bottom of the screen and returns to formation position from below.
- End-stage mode: continuously loops, diving without returning to formation.
- Requires **1 hit** to destroy.

#### ASCII Sprite Design

The Zako/Bee is a small, round insectoid ship with wing-like protrusions on both sides, resembling a bee or scarab. Primary color: blue/yellow.

```
// Zako Frame 0 (12x10). Z=body (blue), W=wing (yellow), E=eye (white/red)
const ZAKO_0: string[] = [
  '   WZZZW    ',
  '  WWZZZWW   ',  // W = wings spread
  ' WZZEZZZZW  ',  // E = eye/cockpit
  'WZZZZZZZZZZW',
  ' ZZZZZZZZZ  ',
  '  ZZ   ZZ   ',
  '            ',
  '            ',
  '            ',
  '            ',
];

const ZAKO_1: string[] = [
  '    ZZZ     ',
  '  WWZZZWW   ',
  ' WZZEEZZZW  ',
  'WZZZZZZZZW  ',
  ' ZZZZZZZZ   ',
  '  ZZ   ZZ   ',
  '            ',
  '            ',
  '            ',
  '            ',
];
```

**TX keys:** `zako0`, `zako1`
**Animation:** Alternate at ~200ms per frame. Mirror horizontally when flying left.

---

### 4.2 Goei (Butterfly) — Mid-Rank Enemy

**Quantity:** 16 per wave (8 per row, 2 rows)
**Role:** Intermediate enemy; more aggressive dive pattern than Zako
**Formation position:** Middle two rows (rows 2–3)

#### Point Values

| State | Points |
|-------|--------|
| In formation (convoy) | 80 |
| Diving/attacking | 160 |
| Escorting Boss Galaga | 160 (per Goei) |
| During fly-in | 160 |

#### Behavior

- Dive pattern: **zig-zag** — veers toward the Fighter's approximate position with a looping, weaving path (more erratic than Zako's straight dive).
- When escorting a Boss Galaga on a dive, the Goei **assumes Boss Galaga behavior** (loop dive, not zig-zag). It continues this behavior even if the Boss Galaga it was escorting is destroyed.
- Returns to formation after a completed dive.
- Requires **1 hit** to destroy.

#### ASCII Sprite Design

The Goei/Butterfly is slightly larger than the Zako, more elongated, with prominent wing-like extensions. Primary color: red/white (butterfly wing pattern).

```
// Goei Frame 0 (12x10). G=body (red), W=wing (white/light), E=eye, T=tail
const GOEI_0: string[] = [
  '  WGGGGGW   ',
  ' WWGEEGWWW  ',  // E = eye/cockpit
  'WWGGGGGGGWW ',
  'WWGGGGGGGWW ',
  ' WGGGGGGGW  ',
  '   GGGGG    ',
  '   GG GG    ',  // T = tail fins
  '   G   G    ',
  '            ',
  '            ',
];

const GOEI_1: string[] = [
  '  WGGGGGW   ',
  ' WGEEGGGWW  ',
  'WGGGGGGGGGW ',
  'WGGGGGGGGGW ',
  ' WGGGGGGGW  ',
  '   GGGGG    ',
  '   G   G    ',
  '            ',
  '            ',
  '            ',
];
```

**TX keys:** `goei0`, `goei1`
**Animation:** Alternate at ~180ms per frame.

---

### 4.3 Boss Galaga — Squad Leader

**Quantity:** 4 per wave
**Role:** Elite enemy; 2-hit kill; tractor beam capture mechanic; dive escort leader
**Formation position:** Top row (row 1), center 4 positions

#### Point Values

| State | Points |
|-------|--------|
| In formation (convoy) | 150 |
| Diving alone | 400 |
| Diving with 1 Goei escort | 800 (Boss only) |
| Diving with 2 Goei escorts | 1,600 (Boss only) |
| Captured Fighter | 500 (for the captured Fighter entity) |
| Captured Fighter (while diving) | 1,000 |

*Note: Escorting Goeis score independently (160 each) in addition to the Boss Galaga score.*

#### Behavior — Two Dive Types

**Type 1 — Loop Dive:**
- Boss Galaga flies in a wide loop before diving toward Fighter's position.
- May bring **1 or 2 Goei escorts** along. When escorts are present, they flank the Boss.
- Defeating a Boss Galaga mid-dive causes all on-screen enemies to **temporarily stop firing** for ~2 seconds.
- After the dive, returns to formation position.

**Type 2 — Tractor Beam Attack:**
- Boss Galaga flies **diagonally** to a point roughly above the Fighter, then **stops mid-air**.
- Deploys a **tractor beam** (large triangular beam downward from the Boss).
- If Fighter enters the beam: Fighter is pulled upward and captured. Player loses a life.
- Boss Galaga then returns to formation carrying the captured Fighter.
- **Never brings Goei escorts** on a tractor beam run.
- Boss Galaga will **only perform tractor beam attack** if: no Fighter is currently captured AND the player does not have a Dual Fighter already.

> ✅ **CHECK — Tractor Beam Conditions:** Check `capturedFighterExists` and `isDualFighter` before allowing a Boss Galaga to perform the tractor beam behavior. If either is true, the Boss Galaga should always perform Type 1 (loop dive) instead.

#### Hit Points

- Requires **2 hits** to destroy.
- **After 1st hit:** Boss Galaga changes color (blue → red/darker variant). No speed or behavior change.
- **On 2nd hit:** destroyed.

> ✅ **CHECK — Boss Galaga Color Change:** Boss Galaga has `hitsRemaining = 2`. On first hit: decrement to 1, switch sprite to `bossGalagaHit`. On second hit: destroy. Verify a partially-hit Boss Galaga is still worth full points when destroyed.

#### ASCII Sprite Design

The Boss Galaga is the largest standard enemy — a prominent double-winged flagship. Primary color: green with red/yellow accents.

```
// Boss Galaga Frame 0 (16x12). B=body (green), W=wing, E=eye/lens, A=accent (red)
const BOSS_0: string[] = [
  '    BBBBBBBB    ',
  '   BEEBBBBEEBB  ',  // E = eye sensors
  '  WBBBBBBBBBBW  ',  // W = wing base
  ' WWBBAAAAAABBWW ',  // A = red accent band
  'WWWBBBBBBBBBBWWW',
  'WWWBBBBBBBBBBBWW',
  ' WWBBBBBBBBBBWW ',
  '  WBBBBBBBBBW   ',
  '   BBBB BBBB    ',
  '   BB     BB    ',  // engine pods
  '            ',
  '            ',
];

const BOSS_1: string[] = [
  '    BBBBBBBB    ',
  '   BBBEEBEBB    ',
  '  WBBBBBBBBBBW  ',
  ' WWBBAAAAAABWWW ',
  'WWWBBBBBBBBBWWWW',
  'WWWBBBBBBBBBBWWW',
  ' WWBBBBBBBBBWW  ',
  '  WBBBBBBBBW    ',
  '   BBBB BBBB    ',
  '   BB     BB    ',
  '                ',
  '                ',
];

// After 1st hit — darker/reddish color variant
const BOSS_HIT: string[] = [
  '    DDDDDDDD    ',  // D = damaged (darker/red-tinted version of B)
  '   DEEDDDDEEDД  ',
  '  WDDDDDDDDDDW  ',
  ' WWDDAAAAAADDWW ',
  'WWWDDDDDDDDDDWWW',
  'WWWDDDDDDDDDDDWW',
  ' WWDDDDDDDDDDWW ',
  '  WDDDDDDDDDW   ',
  '   DDDD DDDD    ',
  '   DD     DD    ',
  '                ',
  '                ',
];

// Tractor beam (separate entity rendered below Boss Galaga)
const TRACTOR_BEAM: string[] = [
  '      BB      ',  // narrow at top (Boss)
  '     BBBB     ',
  '    BBBBBB    ',
  '   BBBBBBBB   ',  // B = beam (blue/cyan, semi-transparent)
  '  BBBBBBBBBB  ',
  ' BBBBBBBBBBBB ',
  'BBBBBBBBBBBBBB',  // wide at bottom
];
```

**TX keys:** `boss0`, `boss1`, `bossHit`, `tractorBeam0`, `tractorBeam1`
**Tractor beam animation:** Alternate `tractorBeam0` ↔ `tractorBeam1` at ~80ms (fast flicker/pulse).

---

## 5. Special Mechanics

### 5.1 Tractor Beam Capture Sequence

```
1. Boss Galaga breaks from formation
2. Flies diagonally to above-center position
3. Stops at TRACTOR_BEAM_Y (~80px from top)
4. Tractor beam deploys downward (growing cone shape)
5. If Fighter enters beam:
   a. Fighter control is removed (`fighter.isCaptured = true`)
   b. Fighter slowly rises upward (pulled by beam)
   c. Fighter collides with Boss Galaga at top
   d. Captured Fighter is now bound to the Boss — appears as red Fighter alongside Boss
   e. Player respawns with a new (white) Fighter if lives remain
6. If Fighter is not in beam for ~3 seconds:
   a. Boss Galaga retracts beam
   b. Returns to formation (Type 1 dive behavior resumes on next attack)
```

> ✅ **CHECK — Capture While Being Captured:** The spec notes an important edge case — since shooting is NOT disabled during capture, a skilled player can shoot the Boss Galaga during tractor beam ascent. If the Boss Galaga is destroyed mid-capture, the captured Fighter is released and falls to the bottom as a freed ship.

### 5.2 Dual Fighter (Double Ship)

When the Boss Galaga that holds the captured Fighter is **shot down while diving**, the captured Fighter is freed and merges with the active Fighter:

- Freed Fighter descends from top and joins the active Fighter horizontally.
- Player now controls the **Dual Fighter**: two ships side by side.
- **Dual Fighter properties:**
  - Fires **4 bullets** (2 from each Fighter) — max 2 per Fighter = 4 simultaneous bullets
  - Hitbox is twice as wide — harder to dodge enemy fire
  - Has an extra effective hit point: one hit destroys one Fighter, leaving a single Fighter
  - When one Fighter is hit, it explodes; the other continues as a normal single Fighter
  - Player score carries over; no life is lost when one Dual Fighter component is destroyed
- The freed Fighter can also be shot down by the player mid-descent — this destroys it (equivalent to losing a life). Be careful.

> ✅ **CHECK — Dual Fighter Bullet Count:** When `isDualFighter === true`, the max bullets cap should be `4` not `2`. Each "sub-Fighter" has its own independent `bulletsActive` counter (max 2 each). Verify that rapid fire with Dual Fighter produces at most 4 bullets, not more.

> ✅ **CHECK — Dual Fighter Hit:** When a bullet hits the Dual Fighter, determine which sub-Fighter was hit by comparing bullet X position to each sub-Fighter's hitbox. Destroy that sub-Fighter, leave the other. Set `isDualFighter = false` and continue with the surviving single Fighter.

### 5.3 Captured Fighter Entity

Once a Fighter is captured, it lives in the formation attached to its Boss Galaga:
- Renders as a **red Fighter sprite** (not white) alongside the Boss Galaga
- Has its own point value: 500 (in formation) or 1,000 (during Boss Galaga dive)
- If the Boss Galaga is shot while **in formation** (not diving), the captured Fighter acts as an enemy (scores points if killed — but costs the player effectively a life)
- Only descends as a rescue opportunity when its Boss Galaga dives
- If not rescued during a dive, it returns to formation with the Boss
- Carries over to the next stage if not freed

> ✅ **CHECK — Captured Fighter Stage Carry-Over:** Store `capturedFighter` state persistently across stage transitions. At the start of the new stage, the captured Fighter should still be visible in the formation attached to its Boss Galaga (a new Boss Galaga if the original was destroyed in formation).

---

## 6. Transformed Enemies (Morph Groups)

Starting at Stage 4, one Zako (or Goei if few Zakos remain) in the formation will **transform** mid-stage into a group of three new enemy types. These transformed groups:
- Are always in "attacking" state (score attacking points, not formation points)
- Do not return to formation
- If the player dies while a morph group is active, one member returns to formation and transforms back into the Zako/Goei it came from

The type of morph enemy encountered rotates on a cycle after each Challenging Stage:

| Morph Stages | Morph Type | Behavior | Per-Kill | Bonus (all 3) |
|-------------|-----------|----------|---------|---------------|
| 4, 5, 6 | Ogawamushi (Scorpion) | Fly in single-file line; descend left or right, then fly straight down; exit opposite side | 160 | 1,000 |
| 8, 9, 10 | Ei (Diagonal) | Form diagonal line; fans outward on turns; harder to shoot all 3 | 160 | 2,000 |
| 12, 13, 14 | Galboss | 1 appears, 2 pop out mid-flight at different angles; hardest to clear | 160 | 3,000 |

> ✅ **CHECK — Morph Rotation:** Track `morphCycleIndex` (0=Ogawamushi, 1=Ei, 2=Galboss). Increment after each Challenging Stage. Use `morphCycleIndex % 3` to determine current morph type. Verify: Stage 4, 5, 6 → Ogawamushi; Stage 8, 9, 10 → Ei; Stage 12, 13, 14 → Galboss; Stage 16, 17, 18 → Ogawamushi again.

---

## 7. Challenging Stages (Bonus Rounds)

Challenging Stages occur at Stage **3, 7, 11, 15, 19, 23, 27, 31** — every 4 stages after stage 3. After Stage 31, they repeat from the beginning.

### 7.1 Rules

- All 40 enemies fly across the screen in scripted paths — **no formation, no shooting, no diving**.
- Player cannot die during a Challenging Stage (enemies cannot harm the player).
- Goal: shoot as many as possible before they exit the screen.
- Each Challenging Stage has **5 waves of 8 enemies** = 40 total.
- Stage advances when all enemies have either been shot or exited.

### 7.2 Challenging Stage Types

| # | Stage | Enemy Type | Per-Wave Clear Bonus |
|---|-------|-----------|---------------------|
| 1 | 3 | Zako (Bee) | 1,000 |
| 2 | 7 | Goei (Butterfly) | 1,000 |
| 3 | 11 | Tonbo (Dragonfly) | 1,500 |
| 4 | 15 | Ogawamushi (Scorpion) | 1,500 |
| 5 | 19 | Momiji (Satellite-like) | 2,000 |
| 6 | 23 | Ei | 2,000 |
| 7 | 27 | Galboss | 3,000 |
| 8 | 31 | Spaceship (Enterprise reference) | 3,000 |

### 7.3 Challenging Stage Scoring

- Each enemy killed = **160 points**
- Each wave cleared = **per-wave clear bonus** (from table above)
- All 40 enemies killed: **10,000 bonus points** (replaces per-kill tally — a flat reward for perfection)

> ✅ **CHECK — Perfect Bonus:** Track `challengeKillCount`. If `challengeKillCount === 40` at stage end, award 10,000 pts flat (not 40 × 160 = 6,400). Verify: killing all 40 earns 10,000, NOT 6,400. This is a critical scoring rule that's easy to get wrong.

### 7.4 "PERFECT" Display

- If all 40 enemies are destroyed, display the word **"PERFECT"** on screen with a flash effect before awarding the 10,000 point bonus.
- This is a beloved visual reward — include it.

> ✅ **CHECK — PERFECT Display:** After `challengeKillCount === 40` is confirmed at stage end, show `PERFECT` text overlay for approximately 2 seconds before transitioning. This must happen BEFORE the score is awarded so the player can see the achievement.

---

## 8. Fighter Sprite

The Fighter is a sleek, symmetrical spacecraft with a pointed nose and swept-back wings. It is the player's avatar.

```
// Fighter Normal (12x10). F=hull (white/grey), C=cockpit (blue), E=engine glow
const FIGHTER_NORMAL: string[] = [
  '     FF     ',
  '    FFFF    ',
  '   FFFFFF   ',
  '  FCCCCCF   ',  // C = cockpit
  ' FFFFFFFFF  ',
  'FFFFFFFFFFF ',
  ' FFFFFFFFF  ',
  '  FFF FFF   ',  // engine pods
  '  FEE EEF   ',  // E = engine glow
  '            ',
];

// Captured/Red variant
const FIGHTER_CAPTURED: string[] = [
  '     RR     ',  // R = red hull (captured state)
  '    RRRR    ',
  '   RRRRRR   ',
  '  RCCCCCR   ',
  ' RRRRRRRRR  ',
  'RRRRRRRRRR  ',
  ' RRRRRRRRR  ',
  '  RRR RRR   ',
  '  REE EER   ',
  '            ',
];

// Dual Fighter — two side-by-side (rendered as two FIGHTER_NORMAL sprites ~12px apart)
// No separate sprite needed; render two instances

// Death animation frame
const FIGHTER_DEAD: string[] = [
  '  F      F  ',
  ' FFF    FFF ',
  'F  FF  FF  F',  // explosion burst outward
  '    F  F    ',
  '   FFFFFF   ',
  '    F  F    ',
  'F  FF  FF  F',
  ' FFF    FFF ',
  '  F      F  ',
  '            ',
];
```

**TX keys:** `fighterNormal`, `fighterCaptured`, `fighterDead`, `fighterRespawn` (brief flash on respawn)

---

## 9. TX (Texture Key) Registry

```typescript
export const TX = {
  // Player
  fighterNormal:      'gal-fighter',
  fighterCaptured:    'gal-fighter-cap',    // red — captured state
  fighterDead:        'gal-fighter-dead',
  fighterRespawn:     'gal-fighter-spawn',  // flash on entry
  playerBullet:       'gal-bullet',

  // Zako (Bee)
  zako0:              'gal-zako-0',
  zako1:              'gal-zako-1',

  // Goei (Butterfly)
  goei0:              'gal-goei-0',
  goei1:              'gal-goei-1',

  // Boss Galaga
  boss0:              'gal-boss-0',
  boss1:              'gal-boss-1',
  bossHit:            'gal-boss-hit',       // after 1st hit, color change
  tractorBeam0:       'gal-tbeam-0',
  tractorBeam1:       'gal-tbeam-1',

  // Transformed enemies
  ogawamushi0:        'gal-oga-0',
  ogawamushi1:        'gal-oga-1',
  ei0:                'gal-ei-0',
  ei1:                'gal-ei-1',
  galboss0:           'gal-galboss-0',
  galboss1:           'gal-galboss-1',

  // Challenge stage special enemies
  tonbo0:             'gal-tonbo-0',        // Dragonfly (stage 3 challenge)
  tonbo1:             'gal-tonbo-1',
  momiji0:            'gal-momiji-0',       // Satellite (stage 5 challenge)
  momiji1:            'gal-momiji-1',
  spaceship0:         'gal-ship-0',         // Star Trek reference (stage 8 challenge)
  spaceship1:         'gal-ship-1',

  // Enemy bullet
  enemyBullet:        'gal-ebullet',

  // UI
  lifeIcon:           'gal-life',           // small Fighter icon for lives display
  perfectText:        'gal-perfect',        // PERFECT overlay for challenge stage
  starfield:          'gal-star',           // scrolling star tile (background)
} as const;

export type TXKey = keyof typeof TX;
```

---

## 10. Scoring System

### 10.1 Standard Enemy Points

| Enemy | In Formation | Attacking/Diving |
|-------|-------------|-----------------|
| Zako (Bee) | 50 | 100 |
| Goei (Butterfly) | 80 | 160 |
| Boss Galaga (solo) | 150 | 400 |
| Boss Galaga (1 Goei escort) | 150 | 800 |
| Boss Galaga (2 Goei escorts) | 150 | 1,600 |
| Captured Fighter | 500 | 1,000 |
| Transformed enemies | 160 | 160 (always attacking) |
| Challenge stage enemies | 160 | 160 (always attacking) |

### 10.2 Morph Group Bonuses

| Group Type | Bonus for All 3 Killed |
|-----------|------------------------|
| Ogawamushi | 1,000 |
| Ei | 2,000 |
| Galboss | 3,000 |

### 10.3 Challenge Stage Scoring

| Achievement | Points |
|-------------|--------|
| Each enemy killed | 160 |
| Each wave fully cleared | 1,000–3,000 (varies by challenge #) |
| All 40 killed (PERFECT) | 10,000 flat (replaces individual kills) |

### 10.4 Extra Lives

| Threshold | Award |
|-----------|-------|
| 20,000 pts | +1 Fighter |
| 70,000 pts | +1 Fighter |
| Every 70,000 pts after | +1 Fighter |
| After 1,000,000 pts | No more extra lives |
| Maximum lives | 18 |

---

## 11. Physics & Constants

```typescript
export const GAME = {
  // Screen
  screenWidth:          256,
  screenHeight:         240,

  // Fighter
  fighterSpeed:         3.0,          // px per frame horizontal
  fighterY:             210,          // fixed Y position
  fighterBulletSpeed:   8.0,          // px per frame upward
  maxPlayerBullets:     2,            // per single Fighter
  maxDualBullets:       4,            // per Dual Fighter (2 per sub)

  // Formation
  formationCols:        10,           // bees use full 10; boss uses center 4
  formationRows:        5,
  formationCellSize:    16,           // px per cell
  formationOriginX:     28,           // left edge of formation
  formationOriginY:     24,           // top of formation
  formationOscillateAmt: 3,           // px left/right drift per frame cycle

  // Enemy behavior
  enemyBulletSpeed:     3.0,          // px per frame downward
  aggressiveThreshold:  5,            // enemies remaining before looping mode
  bossTrackerBeamY:     80,           // Y position where Boss stops for tractor beam
  tractorBeamDuration:  3000,         // ms before beam retracts if no capture
  freezeDurationMs:     2000,         // all enemies stop firing after Boss Galaga dive kill

  // Tractor beam
  captureRiseSpeed:     1.2,          // px per frame upward during capture

  // Challenging stage
  perfectKillCount:     40,
  challengePerfectBonus: 10000,

  // Extra lives
  extraLife1:           20000,
  extraLife2:           70000,
  extraLifeEvery:       70000,
  extraLifeMaxScore:    1000000,

  // Difficulty scaling (each stage)
  bulletSpeedIncrement: 0.05,         // enemy bullets get slightly faster each stage
  diveSpeedIncrement:   0.03,         // dive speed increases each stage

  // Fly-in timing
  flyInStagger:         500,          // ms delay between enemies in the same fly-in group
} as const;
```

---

## 12. Stage Progression Summary

| Stage # | Type | Notes |
|---------|------|-------|
| 1 | Normal | Tutorial speed; Zakos, Goeis, 4 Boss Galagas |
| 2 | Normal | Slightly faster |
| 3 | **Challenging** | Zako only; wave bonus 1,000; PERFECT = 10,000 |
| 4 | Normal | First morph appearance (Ogawamushi) |
| 5–6 | Normal | Ogawamushi morph continues |
| 7 | **Challenging** | Goei only; wave bonus 1,000 |
| 8–10 | Normal | Ei morph |
| 11 | **Challenging** | Tonbo; wave bonus 1,500 |
| 12–14 | Normal | Galboss morph |
| 15 | **Challenging** | Ogawamushi; wave bonus 1,500 |
| 16–18 | Normal | Ogawamushi morph (2nd cycle) |
| 19 | **Challenging** | Momiji; wave bonus 2,000 |
| 23 | **Challenging** | Ei; wave bonus 2,000 |
| 27 | **Challenging** | Galboss; wave bonus 3,000 |
| 31 | **Challenging** | Spaceship; wave bonus 3,000 |
| 32+ | Loop | Challenging stages repeat from stage 3 pattern |

---

## 13. LLM Self-Verification Checklist

### Phase 1: Fighter & Bullets
- [ ] Fighter moves left/right only; wraps screen edge-to-edge
- [ ] Max 2 player bullets on screen simultaneously (single Fighter)
- [ ] Max 4 player bullets on screen simultaneously (Dual Fighter)
- [ ] Bullets travel straight up at fixed speed
- [ ] Enemy bullets travel straight down (NOT homing)
- [ ] Enemy bullet count is unlimited (no enemy bullet cap)

### Phase 2: Formation & Fly-In
- [ ] 40 enemies per wave: 20 Zakos, 16 Goeis, 4 Boss Galagas
- [ ] Enemies fly in along scripted curved paths (not straight lines)
- [ ] Formation oscillates slowly left/right
- [ ] Killing formation enemies leaves gaps (formation does not compress)
- [ ] When ≤5 enemies remain, all switch to looping aggressive mode (no return to formation)

### Phase 3: Dive Attacks
- [ ] Zakos dive toward Fighter position, then straight down, then loop back
- [ ] Goeis zig-zag toward Fighter during dive
- [ ] Boss Galaga alternates between loop-dive and tractor beam behaviors
- [ ] Boss Galaga with Goei escorts: Goeis adopt Boss behavior
- [ ] Shooting Boss Galaga mid-dive freezes enemy fire for ~2 seconds

### Phase 4: Boss Galaga & Tractor Beam
- [ ] Boss Galaga requires 2 hits; changes color/sprite after hit 1
- [ ] Tractor beam only deployed when no capture exists AND no Dual Fighter
- [ ] Fighter loses control when entering tractor beam
- [ ] Fighter can still fire during capture sequence
- [ ] Shooting Boss during capture attempt frees the Fighter
- [ ] Rescued Fighter merges to form Dual Fighter
- [ ] Captured Fighter persists across stage transitions

### Phase 5: Challenging Stages
- [ ] Challenging Stage at rounds 3, 7, 11, 15, 19, 23, 27, 31
- [ ] No enemy fire, no formation, no deaths possible
- [ ] All 40 enemies killed = PERFECT + 10,000 pts flat
- [ ] "PERFECT" text displayed before score award
- [ ] Correct bonus per-wave for each challenge stage type

### Phase 6: Morph Enemies
- [ ] Morph appears starting Stage 4 (never earlier)
- [ ] Morph cycle: Ogawamushi (4–6) → Ei (8–10) → Galboss (12–14) → repeat
- [ ] Morph group bonus: 1,000 / 2,000 / 3,000 for all 3 killed
- [ ] One morph group member returns to formation if player dies mid-group

### Phase 7: Scoring & TX
- [ ] Boss Galaga solo dive = 400; with 1 escort = 800; with 2 = 1,600
- [ ] In-formation vs attacking multiplier applied correctly for all enemy types
- [ ] Extra life at 20k, 70k, every 70k after; stops at 1,000,000
- [ ] All TX keys have registered sprite definitions — missing key throws at init

---

## 14. Reference Sources

- Namco Wiki / Fandom — Complete and definitive source: all enemy types (Zako/Goei/Boss Galaga), all point values table, transformed enemy rotation schedule, all 8 Challenging Stage types, morph bonuses, Dual Fighter mechanics, extra life thresholds, Galaga max lives (18)
- Arcade Quartermaster — Formation composition (20 Bees, 16 Butterflies, 4 Boss Galagas), tractor beam mechanics, Dual Fighter description
- Silverball Museum — Formation zone layout (Boss top row, Butterflies middle, Bees bottom rows), tractor beam capture sequence description
- Hoz's 8-bit NES Quest — NES version confirmation (Bandai 1985), 2-hit Boss Galaga behavior, color change on hit, firerate and difficulty progression
- Classic Arcade Gaming community — PERFECT bonus challenge round scoring confirmation (10,000 flat)
- NESDev Forum — NES-specific implementation notes (enemy path data structure)
