# Arkanoid (1986 Arcade) — Clone Design Specification

> **Build target:** Browser-based clone using font/ASCII character tile rendering system (same as Mario Bros. and Dig Dug specs).
> **Source:** Taito arcade original (1986), arcade-accurate behavior. 33 stages including DOH boss fight.
> **LLM verification notes** appear throughout as `> ✅ CHECK:` callouts — use these to validate implementation correctness at each stage.

---

## 1. Game Overview

- **Genre:** Ball-and-paddle brick breaker
- **Setting:** Space — the Vaus is a spaceship paddle; bricks are "space walls" in a warped dimension
- **Core loop:** Launch ball → bounce it into bricks to destroy them → catch power-up capsules → clear all destroyable bricks → advance to next stage
- **Win condition:** Clear all 32 brick stages, then defeat DOH (stage 33) with 16 ball hits
- **Lose condition:** Ball exits below the Vaus and player has no lives remaining
- **Screen orientation:** **Vertical** (portrait) — 224×256 px logical resolution at 60 Hz
- **Control:** Single axis — paddle moves only left/right; one fire button (laser or ball release)
- **Lives:** Extra lives awarded at 20,000 pts, 60,000 pts, then every 60,000 pts thereafter

> ✅ **CHECK — Orientation:** Confirm the canvas/viewport is set to **portrait (taller than wide)** mode — 224px wide × 256px tall. All brick layout coordinates assume this orientation.

---

## 2. Playfield Architecture

### 2.1 Dimensions

| Element | Value |
|---------|-------|
| Logical width | 224 px |
| Logical height | 256 px |
| Side wall thickness | ~8 px (left and right) |
| Top wall thickness | ~8 px |
| Bottom opening | Open — ball exits here if missed |
| Brick area top | ~32 px from top (below header/score row) |
| Vaus starting Y | ~240 px from top (near bottom) |
| Ball launch Y | Just above Vaus |

### 2.2 Playfield Zones

```
┌─────────────────────────────┐  ← Top wall (solid boundary)
│  SCORE: 00000   STAGE: 01   │  ← Score/HUD row
├─────────────────────────────┤
│                             │
│  [BRICK FIELD — top area]   │  ← Bricks occupy roughly the top 60% of playfield
│                             │
│  [OPEN PLAY SPACE]          │  ← Ball bounces freely here
│                             │
│  [VAUS PADDLE]              │  ← Near bottom, moves left-right only
└──────────┴──────────────────┘  ← Bottom open (ball loss zone)
  ↑left wall              right wall↑
```

- Left wall, right wall, and top wall are all solid and reflect the ball.
- There is **no bottom wall** — the ball exits here and a life is lost.
- The Vaus cannot leave the side walls.

### 2.3 Brick Grid

Bricks are arranged in a grid of **13 columns × up to 18 rows** within the brick field area.

| Property | Value |
|----------|-------|
| Brick width | ~16 px |
| Brick height | ~8 px |
| Columns | 13 |
| Max brick rows used | 18 |
| Grid origin (x) | ~8 px from left wall |
| Grid origin (y) | ~32 px from top |

> ✅ **CHECK — Brick Grid:** Verify `GRID_COLS = 13` and `GRID_ROWS = 18`. Each brick at `grid[row][col]` should store: `type` (color|silver|gold|empty), `hitsRemaining`, `hasCapsule` (bool), and `capsuleType`. Confirm that `gold` bricks and `empty` cells are skipped in the stage-clear check.

---

## 3. Core Gameplay Mechanics

### 3.1 Ball Physics

The ball moves at a constant speed in a fixed direction vector. There is **no gravity**. All movement is angular reflection.

**Collision types:**

| Surface | Reflection Rule |
|---------|----------------|
| Left/right wall | Invert X component of velocity: `vx = -vx` |
| Top wall | Invert Y component: `vy = -vy` |
| Brick (top/bottom hit) | Invert Y component: `vy = -vy` |
| Brick (left/right hit) | Invert X component: `vx = -vx` |
| Vaus paddle | Special angle calculation (see Section 3.2) |
| Enemy entity | Invert both components (random deflection) |

**Angle clamping:**
- The ball's angle should never be within ~15° of purely horizontal. A ball traveling almost horizontally will bounce forever at the very bottom without hitting bricks.
- Minimum vertical component: enforce `|vy| >= MIN_VERTICAL_SPEED` at all times.
- Clamp reflected angle to range `[30°, 150°]` (measured from horizontal baseline).

> ✅ **CHECK — Angle Clamp:** After every Vaus paddle reflection and every wall reflection, call `clampBallAngle()`. Assert `Math.abs(ball.vy) >= MIN_VERTICAL_SPEED` after this call. Test edge case: a ball bouncing horizontally between two walls with no bricks — it should eventually escape through the angle correction, not loop forever.

**Ball speed progression:**
- Ball starts at `BASE_SPEED` each life.
- Speed increases when the ball hits the **top wall** (ceiling) — this is the trigger, not a timer.
- Additional speed boost after a certain number of Vaus-paddle hits within a stage.
- Ball speed resets to `BASE_SPEED` at each new life (not each stage).
- Slow (S) capsule reduces speed to below `BASE_SPEED`; speed gradually creeps back up over time.

> ✅ **CHECK — Speed Creep:** After the Slow capsule is collected, implement a `speedCreepTimer` that gradually increments ball speed back toward `BASE_SPEED` and eventually past it. Verify that multiple S capsules stack (each one resets the creep timer and re-applies the slow factor).

**Brick corner hits:**
- When the ball hits the corner of a brick (both X and Y are touching), invert both components.
- This is rare but causes unpredictable "trick shot" bounces — preserve this authentic behavior.

### 3.2 Vaus Paddle Physics (Angle Control)

The position where the ball contacts the Vaus determines the outgoing angle. This is the primary player skill mechanic.

**Vaus zones (left to right):**

```
|←red→|←————————— white ——————————→|←red→|
  edge         center zones           edge
```

| Zone | Width (approx) | Outgoing angle |
|------|---------------|---------------|
| Left red edge | ~6px | ~150° (steep left, ~30° from vertical) |
| Left inner | ~20px | ~120–140° (moderate left) |
| Center | ~60px | ~90° (straight up, modified by ball's incoming X) |
| Right inner | ~20px | ~40–60° (moderate right) |
| Right red edge | ~6px | ~30° (steep right, ~30° from vertical) |

**Implementation formula (continuous zone calculation):**
```typescript
// paddle contact position: 0 (left edge) to 1 (right edge)
const contactRatio = (ball.x - vaus.x) / vaus.width;  // 0..1
// Map to angle range 150° (left) → 30° (right)
const angle = 150 - (contactRatio * 120);
const clampedAngle = clampBallAngle(angle);  // enforce min vertical
ball.vx = ballSpeed * Math.cos(degToRad(clampedAngle));
ball.vy = -ballSpeed * Math.sin(degToRad(clampedAngle));  // negative = upward
```

> ✅ **CHECK — Paddle Zones:** Test: hitting the leftmost pixel of the Vaus should send the ball at ~150° from horizontal (steep leftward). Hitting dead center should send the ball almost straight up. Hitting the rightmost pixel should send the ball at ~30° (steep rightward). Visualize all three cases in a debug mode.

### 3.3 Stage Clear Condition

- A stage is **cleared** when all bricks with `type !== 'gold'` and `type !== 'empty'` have `hitsRemaining === 0`.
- Gold bricks and empty cells do NOT count toward the clear condition.
- On clear: brief flash animation, then advance to next stage.

> ✅ **CHECK — Clear Condition:** Implement `getDestroyableBrickCount()` at stage load. Decrement a counter on each brick destruction. Stage clears when `destroyableBricksRemaining === 0`. Verify gold bricks are excluded from this count at initialization.

### 3.4 Ball Loss

- Ball exits below the Vaus bottom boundary → life lost.
- If `livesRemaining > 0`: brief death animation, ball resets to Vaus launch position, player presses fire to launch.
- If `livesRemaining === 0` and stage < 33: game over, but player can **continue** by inserting another credit within a time limit (restarts at current stage).
- Stage 33 (DOH): **no continue** permitted. Death on stage 33 = game over, no retry.

### 3.5 Multi-Ball (Disruption)

- The D (Disruption) capsule splits the current ball into 3 balls simultaneously.
- All 3 balls are independently tracked.
- A life is only lost when **all** balls have exited below the Vaus.
- Only **one capsule can be on screen at a time** — new capsules cannot fall while one is mid-air.
- While 2+ balls are active: no additional capsules will drop from bricks.

> ✅ **CHECK — Multi-Ball Life Rule:** Maintain `activeBallCount`. Decrement on each ball loss. Only trigger `loseLife()` when `activeBallCount === 0`. Verify: in a 3-ball scenario, losing 2 balls while the 3rd stays in play does NOT cost a life.

---

## 4. Brick Types

### 4.1 Color Bricks (1 hit to destroy)

| Color | Points | Notes |
|-------|--------|-------|
| White | 50 | Most common in early stages |
| Orange | 60 | |
| Cyan | 70 | |
| Green | 90 | |
| Red | 100 | |
| Blue | 110 | |
| Violet/Purple | 120 | Highest scoring standard brick |
| Yellow | 50 | Same as white for scoring |

All color bricks are destroyed by 1 ball hit. Any may contain a hidden capsule (see Section 5).

### 4.2 Silver Bricks (multi-hit)

- Require **multiple hits** to destroy, increasing every 8 stages:
  - Stages 1–7: **2 hits**
  - Stages 8–15: **3 hits**
  - Stages 16–23: **4 hits**
  - Stages 24–31: **5 hits**
  - Stage 32: **6 hits**
- Points: `50 × stage_number` (e.g., stage 10 = 500 pts per silver brick)
- Visual cue: brick lightens/flashes on each hit to show damage
- Silver bricks CAN be destroyed by the laser (each laser shot = 1 hit)
- Silver bricks CAN contain capsules (released when finally destroyed)

> ✅ **CHECK — Silver Hits:** At stage load, compute `silverHitsRequired = Math.floor(stageNumber / 8) + 2` (capped at the above table). Store per-brick. Verify on a stage 9 silver brick: it takes exactly 3 hits. Verify the visual damage frame updates correctly after each hit.

### 4.3 Gold Bricks (indestructible)

- **Cannot be destroyed** by ball or laser — ever.
- Do not contain capsules.
- Do not count toward stage clear.
- Serve purely as permanent obstacles/redirectors.
- Ball and laser projectiles reflect off gold bricks normally.

### 4.4 Brick Visual States

| State | Rendering |
|-------|-----------|
| Intact | Full color fill |
| Silver hit 1 | Bright crack pattern visible |
| Silver hit 2+ | Progressive darkening / crack deepening |
| Destroyed | Cell becomes empty (transparent), brief flash particle |

---

## 5. Power-Up Capsules

### 5.1 Capsule Drop Mechanics

- Capsules are hidden inside certain bricks; the player does not know which bricks contain them.
- When a capsule-containing brick is destroyed, the capsule begins **falling** from the brick's position at a constant speed toward the Vaus.
- Player collects capsule by touching it with the Vaus.
- **Only one capsule can be in play at a time** — if another brick is destroyed while a capsule is falling, no new capsule drops.
- **Capsule randomization:** pseudo-random, seeded by current score. Player can theoretically predict drops by controlling score.
- **Duplicate prevention:** if the randomizer would produce the same type as the last capsule dropped, the game substitutes a D (Disruption) capsule instead. Therefore, D is the only capsule that can appear twice in a row.
- **P (Extra Life) cap:** only one P capsule can be awarded per life (per Vaus instance).
- **B (Break) and P capsules** are half as likely to appear as other capsules.

> ✅ **CHECK — One Capsule Rule:** Maintain `capsuleInFlight` boolean. On brick destruction: if `capsuleInFlight === true`, skip capsule drop even if the brick had one flagged. Set `capsuleInFlight = false` when capsule is collected OR exits the bottom of the screen uncollected.

### 5.2 Capsule Types

| Letter | Color | Name | Effect |
|--------|-------|------|--------|
| **L** | Red | Laser | Vaus transforms; fires twin upward laser beams from fire button. Lasers destroy color bricks in 1 hit, silver bricks require multiple laser hits. Cancels Catch mode. |
| **E** | Blue | Enlarge | Vaus width approximately doubles. Stacks — collecting a second E during Enlarge has no additional effect (already max size). |
| **C** | Green | Catch | Ball sticks to Vaus on contact instead of bouncing. Player aims and presses fire to release. Ball auto-releases after ~5 seconds if not manually fired. Cancels Laser mode. |
| **S** | Orange | Slow | Ball speed drops to below base speed. Multiple S capsules stack (each resets slow timer). Speed gradually creeps back up. |
| **B** | Violet | Break | Opens a "break-out" portal on the right side wall. If ball passes through it: +10,000 pts and auto-advance to next stage. Rare — appears only while portal is not already open. |
| **D** | Cyan | Disruption | Current ball splits into 3. All 3 balls active simultaneously. Life lost only when all 3 are gone. Capsules stop dropping while 2+ balls active. |
| **P** | Silver/Gray | Player | Extra life (+1 Vaus). Max one per life. Half as likely to appear as standard capsules. |

**Power-up interaction rules:**
- L (Laser) and C (Catch) are **mutually exclusive** — collecting one cancels the other.
- E (Enlarge) applies alongside any other active power-up.
- S (Slow) applies alongside any active power-up.
- B (Break) has no special interaction with other power-ups.

> ✅ **CHECK — L/C Mutual Exclusion:** When L capsule collected: set `vaus.mode = 'laser'`, clear any `catch` flag. When C capsule collected: set `vaus.mode = 'catch'`, clear any `laser` flag. Verify that collecting C after L correctly removes the laser wing sprites and vice versa.

### 5.3 Laser Behavior (L Capsule)

- Vaus gains two laser emitter wings (visual transformation).
- Fire button fires two thin vertical laser beams, one from each emitter wing.
- Lasers travel upward at a fixed speed.
- Lasers can be fired continuously (auto-fire while button held, or tap for single shots).
- Each laser beam destroys one color brick on contact (1 hit per beam).
- Each laser beam deals 1 hit to silver bricks.
- Lasers do **not** affect gold bricks — they reflect off (or are destroyed by contact, depending on variant — suggest: lasers are destroyed on gold brick contact).
- Laser mode ends when the player loses a ball (life).

> ✅ **CHECK — Laser Projectile Lifecycle:** Each laser beam is a separate entity with its own Y-position. Beam is destroyed when it hits a brick OR reaches the top wall. Multiple beams can be on screen simultaneously. Verify beam does not interact with the ball (they pass through each other).

### 5.4 Catch Behavior (C Capsule)

- On next ball-Vaus contact: ball adheres to Vaus surface (no bounce).
- Ball travels with the Vaus left/right while stuck.
- Player presses fire to release the ball, which launches upward at the angle corresponding to the contact position on the Vaus (same zone logic as section 3.2).
- If the player does nothing for ~5 seconds, ball auto-releases from the current Vaus position.
- After releasing, Catch mode remains active (ball will stick again on next contact).
- Catch mode ends when the player loses a ball (life).

---

## 6. Enemy Entities

Arkanoid spawns small geometric enemy entities in the play area on certain stages. These enemies:
- **Cannot be killed by the ball** (ball deflects off them, potentially in unexpected directions)
- **Can be destroyed by laser fire** (worth points)
- **Can be destroyed by the Vaus paddle** on direct contact (Vaus runs into them while they are low on screen)
- Drift around the open space between the bricks and the Vaus
- Their primary hazard is **unpredictably deflecting the ball** at odd angles

> ✅ **CHECK — Enemy Ball Deflection:** When a ball contacts an enemy entity, invert both `vx` and `vy` (not just one component). This creates the "random bounce" feel. After deflection, verify the angle clamp is still applied.

### 6.1 Unira (Hedgehog/Spiny Ball)

**Appearance:** Small spiky ball, roughly circular with visible spines.
**Behavior:** Slowly drifts around the play area in a semi-random path. Can pass through brick gaps but prefers open space. Changes direction when hitting walls or the Vaus area.
**Points (laser kill):** 100 pts
**Notes:** Most common enemy type. Appears from stage 2 onward on most stages.

```
// Unira (8x8). U=body (white/grey), S=spine (sharp protrusions)
const UNIRA: string[] = [
  ' S S S  ',   // S = spine tips
  'SUUUUUS ',
  'SUUUUUUS',   // U = round body
  ' UUUUUU ',
  ' UUUUUU ',
  'SUUUUUUS',
  ' S   S  ',
];
```

### 6.2 ConvoyMover (UFO)

**Appearance:** Small saucer/UFO shape.
**Behavior:** Moves in straight horizontal lines, bouncing off the side walls. Occasionally swoops downward before returning to its lane. Faster than Unira.
**Points (laser kill):** 200 pts
**Notes:** Appears in mid-game stages. The horizontal sweeping path is more predictable than Unira, but the occasional dip is dangerous.

```
// ConvoyMover (10x6). V=hull (silver), C=cockpit (blue/dark), T=thruster
const CONVOY: string[] = [
  '  CCCCC   ',
  ' VVVVVVVV ',
  'VVVVVVVVVV',
  ' VVVVVVVV ',
  ' TT    TT ',   // T = thruster glow
  '          ',
];
```

### 6.3 MoleSter (Drill Enemy)

**Appearance:** Small drilling machine, roughly rectangular with a pointed drill front.
**Behavior:** Moves diagonally, bouncing off all walls including the top. Changes angle more aggressively than Unira. Can pass through the brick field.
**Points (laser kill):** 300 pts
**Notes:** Appears in later stages (20+). The diagonal movement + brick field traversal makes it hardest to avoid.

```
// MoleSter (10x8). M=body (brown), D=drill tip (silver), W=wheel
const MOLESTER_0: string[] = [
  'DDDMMMMM  ',
  'DDMMMMMMM ',   // D = drill tip (left-facing)
  'DDDMMMMM  ',
  ' WWMMMWW  ',   // W = wheels
  '  WW WW   ',
  '          ',
  '          ',
  '          ',
];
```

---

## 7. DOH — Final Boss (Stage 33)

DOH is a giant **Moai statue head** that fills most of the upper area of the playfield. There are no bricks in stage 33 — only DOH and open space.

### 7.1 DOH Appearance

DOH occupies approximately the top 40% of the playfield. He is a large Easter Island head: flat top, prominent brow, heavy rectangular jaw, closed lips with a small opening from which he spits projectiles.

```
// DOH is built from a large multi-row ASCII grid. D=stone body (grey-brown),
// B=brow (darker), E=eye (hollow/dark), M=mouth opening, P=lip, T=top-flat

// Simplified representation (actual in-game DOH should be ~28 cols × 12-14 rows):
// Row 0:  TTTTTTTTTTTTTTTTTTTTTTTTTTTT
// Row 1:  DDDDDDDDDDDDDDDDDDDDDDDDDDD
// Row 2:  BBBBBBBBBBBBBBBBBBBBBBBBBBB  ← brow ridge
// Row 3:  DD EEEEE DD EEEEE DD        ← eye sockets
// Row 4:  DD EEEEE DD EEEEE DD
// Row 5:  DDDDDDDDDDDDDDDDDDDDDDDDDDD
// Row 6:  DDDDDDDDDDDDDDDDDDDDDDDDDDD
// Row 7:  DDDDDPPPPPPPPPPPPPPDDDDDDD   ← mouth lips
// Row 8:  DDDDDP   MMMMM   PDDDDDD    ← mouth opening (M = where projectiles exit)
// Row 9:  DDDDDPPPPPPPPPPPPPPDDDDDDD
// Row 10: DDDDDDDDDDDDDDDDDDDDDDDDDDD
```

### 7.2 DOH Behavior

- **Hit points:** 16 ball hits to defeat.
- **Invulnerability:** DOH is only vulnerable to the **ball** — lasers have no effect on him.
- **Damage indicator:** DOH's color changes with each hit: neutral grey → increasingly red → bright red/purple when 1 hit remaining.
- **Projectiles:** DOH continually spits diamond-shaped projectiles from his mouth downward.
  - Projectiles travel at a moderate speed, slightly angled left or right.
  - If a projectile hits the Vaus → **instant death** (no partial damage).
  - Projectiles can be destroyed by laser fire.
  - Projectiles count does not increase with hits (consistent rate throughout).
- **No movement:** DOH does not move. He is stationary.
- **Stage 33 no-continue rule:** If all lives are lost on stage 33, no continue is permitted.

> ✅ **CHECK — DOH Invulnerability to Laser:** In the collision system, add a check: `if (entity.type === 'DOH' && projectile.type === 'laser') return; // no damage`. Verify laser beams hit DOH's hitbox and are destroyed without dealing damage.

> ✅ **CHECK — DOH Death Sequence:** At `doh.hitsRemaining === 0`, trigger the victory sequence: DOH explodes with a large particle burst, victory jingle plays, final score tally screen appears. Verify this sequence only plays when the 16th hit is by the ball (not a laser).

**DOH scoring:**
- Each ball hit on DOH = **1,000 pts**
- Total maximum DOH points (16 hits) = **16,000 pts** (plus any accumulated multi-hit milking)
- This makes having many lives entering stage 33 extremely valuable for score grinding.

**DOH projectile sprite:**
```
// Diamond projectile (6x6). K=core (bright white/yellow)
const DOH_PROJECTILE: string[] = [
  '  KK  ',
  ' KKKK ',
  'KKKKKK',
  ' KKKK ',
  '  KK  ',
  '      ',
];
```

---

## 8. TX (Texture Key) Registry

```typescript
export const TX = {
  // Vaus (Paddle)
  vausNormal:         'ak-vaus-normal',
  vausEnlarged:       'ak-vaus-enlarged',
  vausLaser:          'ak-vaus-laser',       // laser wings attached
  vausLaserEnlarged:  'ak-vaus-laser-lg',    // laser + enlarged combo
  vausDead0:          'ak-vaus-dead-0',       // death animation frame
  vausDead1:          'ak-vaus-dead-1',
  vausDead2:          'ak-vaus-dead-2',

  // Ball
  ball:               'ak-ball',
  ballCaught:         'ak-ball-caught',       // slightly different tint when caught

  // Bricks (by color)
  brickWhite:         'ak-brick-white',
  brickOrange:        'ak-brick-orange',
  brickCyan:          'ak-brick-cyan',
  brickGreen:         'ak-brick-green',
  brickRed:           'ak-brick-red',
  brickBlue:          'ak-brick-blue',
  brickViolet:        'ak-brick-violet',
  brickYellow:        'ak-brick-yellow',
  brickSilver:        'ak-brick-silver',
  brickSilverHit:     'ak-brick-silver-hit',  // cracked variant
  brickGold:          'ak-brick-gold',
  brickDestroy:       'ak-brick-destroy',     // brief flash frame on destruction

  // Capsules
  capsuleL:           'ak-cap-l',
  capsuleE:           'ak-cap-e',
  capsuleC:           'ak-cap-c',
  capsuleS:           'ak-cap-s',
  capsuleB:           'ak-cap-b',
  capsuleD:           'ak-cap-d',
  capsuleP:           'ak-cap-p',

  // Laser projectile
  laserBeam:          'ak-laser',

  // Break portal
  breakPortal0:       'ak-portal-0',          // animated portal on right wall
  breakPortal1:       'ak-portal-1',

  // Enemies
  unira:              'ak-unira',
  convoyMover0:       'ak-convoy-0',
  convoyMover1:       'ak-convoy-1',
  molester0:          'ak-mole-0',            // facing left
  molester1:          'ak-mole-1',            // facing right

  // DOH
  dohNeutral:         'ak-doh-0',
  dohHit1:            'ak-doh-1',             // slight red tinge
  dohHit2:            'ak-doh-2',
  dohHit3:            'ak-doh-3',             // near-death (bright red)
  dohProjectile:      'ak-doh-proj',
  dohExplode0:        'ak-doh-exp-0',
  dohExplode1:        'ak-doh-exp-1',

  // UI
  lifeIcon:           'ak-life',              // small Vaus icon for life display
  stageNumber:        'ak-stage-num',         // stage label
} as const;

export type TXKey = keyof typeof TX;
```

> ✅ **CHECK — TX Completeness:** At renderer initialization, verify every key in `TX` has a registered sprite definition. A missing key should `throw new Error(\`Missing sprite definition for key: \${key}\`)` at startup, not silently render empty.

---

## 9. Stage Structure

### 9.1 Overview

- **33 total stages** in the arcade original.
- Stages 1–32: brick-clearing levels with varied brick layouts.
- Stage 33: DOH boss fight (no bricks).
- After completing the game, arcade version shows an ending screen — there is no loop.

### 9.2 Stage Progression and Theming

Each stage has a unique brick layout encoded as a 13×18 grid of cell types. The general difficulty arc:

| Stage Range | Characteristics |
|-------------|----------------|
| 1–5 | Simple formations; mostly white/orange/cyan bricks; 1–2 silver bricks; few/no gold bricks |
| 6–12 | More complex layouts; introduce red and blue bricks; gold bricks appear as obstacles |
| 13–20 | Dense formations; silver bricks require 3 hits; enemies appear frequently |
| 21–28 | Complex maze-like layouts; heavy gold brick use; silver at 4–5 hits |
| 29–32 | Near-maximum density; silver bricks require 5–6 hits; all enemy types active |
| 33 | DOH boss fight; no bricks |

### 9.3 Brick Layout Data Format

Stage layouts should be stored as a 2D array of cell type codes for easy LLM generation and verification:

```typescript
// Cell type codes:
// '.' = empty (no brick)
// 'W' = White   'O' = Orange  'C' = Cyan   'G' = Green
// 'R' = Red     'B' = Blue    'V' = Violet  'Y' = Yellow
// 'S' = Silver  'X' = Gold (indestructible)

// Example: Stage 1 (simplified, 13 cols × 11 rows used)
const STAGE_01: string[] = [
  '.............',  // row 0 (top) — empty
  '.............',
  '.OOOOOOOOOOO.',  // row 2
  '.CCCCCCCCCCC.',
  '.GGGGGGGGGGG.',
  '.RRRRRRRRRRR.',
  '.BBBBBBBBBBB.',
  '.VVVVVVVVVVV.',
  '.............',
  '.............',
  '.............',  // row 10 (bottom of brick area)
];
```

> ✅ **CHECK — Stage Data Integrity:** At stage load, validate that `stage.length <= GRID_ROWS` and `stage[i].length === GRID_COLS` for all rows. Count non-`'.'` non-`'X'` cells to initialize `destroyableBricksRemaining`. Assert this count is > 0 for all stages 1–32.

### 9.4 Capsule Seeding in Bricks

Not every brick contains a capsule. On stage load, iterate over all color and silver bricks and pseudo-randomly mark some as `hasCapsule = true` using the current score as a seed (authentic arcade behavior). A reasonable approximation is to seed approximately 20–30% of bricks with capsules.

> ✅ **CHECK — Capsule Density:** Log `capsuleBrickCount / totalDestroyableBricks` at stage load. This ratio should be between 0.15 and 0.35 for all stages. If below 0.15, the stage will feel dry; if above 0.35, the stage will be trivially easy.

---

## 10. Vaus Sprite Design

The Vaus is a sleek, compact **spacecraft** — not a generic rectangle. It has a flat body with a pointed nose at the front, engine wings/fins on the sides, and a visible cockpit dome at center.

```
// Vaus Normal (28x6). V=hull (white/grey), C=cockpit (blue), F=fin, E=engine glow
const VAUS_NORMAL: string[] = [
  '           CCCC            ',   // C = cockpit dome
  '     VVVVVCCCCCVVVVV       ',
  'FFFVVVVVVVVVVVVVVVVVVVFFF  ',   // F = fin tips
  'FFFVVVVVVVVVVVVVVVVVVVFFF  ',
  '     VVVVVVVVVVVVVVV       ',
  '          EEEEE            ',   // E = engine glow (bottom center)
];

// Vaus Enlarged (44x6) — same design, wider footprint
const VAUS_ENLARGED: string[] = [
  '                CCCC                ',
  '       VVVVVVVVCCCCCVVVVVVVV        ',
  'FFFVVVVVVVVVVVVVVVVVVVVVVVVVVVVFFF  ',
  'FFFVVVVVVVVVVVVVVVVVVVVVVVVVVVVFFF  ',
  '       VVVVVVVVVVVVVVVVVVV         ',
  '               EEEEE               ',
];

// Vaus Laser (28x8) — laser emitter pods added to each side
const VAUS_LASER: string[] = [
  '  LL       CCCC       LL  ',   // L = laser pods
  '  LL VVVVVCCCCCVVVVV  LL  ',
  'LLLVVVVVVVVVVVVVVVVVVVLLL ',
  'LLLVVVVVVVVVVVVVVVVVVVLLL ',
  '  LL VVVVVVVVVVVVVVV  LL  ',
  '  LL       EEEEE      LL  ',
  '  ||                  ||  ',   // | = laser barrel
  '  ..                  ..  ',   // . = laser emitter tip
];
```

**TX keys:** `vausNormal`, `vausEnlarged`, `vausLaser`, `vausLaserEnlarged`
**Animation:** No walk animation — Vaus is always the same frame. Death animation: 3-frame burst expanding outward from center.

---

## 11. Physics & Constants

```typescript
export const GAME = {
  // Screen
  screenWidth:          224,
  screenHeight:         256,
  wallThickness:        8,
  headerHeight:         24,        // score/HUD area at top

  // Brick grid
  gridCols:             13,
  gridRows:             18,
  brickWidth:           16,
  brickHeight:          8,
  brickGridOriginX:     8,         // left wall offset
  brickGridOriginY:     32,        // below header

  // Ball
  ballRadius:           4,         // px
  ballBaseSpeed:        3.0,       // px per frame
  ballMaxSpeed:         7.0,       // px per frame (after ceiling hits)
  ballSpeedIncrement:   0.25,      // speed boost per ceiling hit
  minVerticalSpeed:     1.0,       // |vy| never below this
  minBallAngleDeg:      30,        // from horizontal baseline
  maxBallAngleDeg:      150,

  // Vaus
  vausNormalWidth:      28,        // px
  vausEnlargedWidth:    44,        // px
  vausHeight:           6,         // px
  vausY:                240,       // starting Y position
  vausEdgeZoneWidth:    6,         // px — red edge zone each side
  vausEdgeAngleDeg:     30,        // angle from horizontal when ball hits edge

  // Capsules
  capsuleFallSpeed:     1.5,       // px per frame
  capsuleWidth:         16,
  capsuleHeight:        8,

  // Laser
  laserSpeed:           6.0,       // px per frame upward
  laserWidth:           2,

  // Slow capsule
  slowSpeedMultiplier:  0.5,       // fraction of base speed
  slowCreepRateMs:      8000,      // time to return to base speed after Slow

  // Catch capsule
  catchAutoReleaseMs:   5000,      // auto-release if player doesn't fire

  // Break portal
  breakBonusPoints:     10000,

  // Enemies
  uniraSpeed:           0.8,
  convoySpeed:          1.5,
  molesterSpeed:        1.2,
  uniraPoints:          100,
  convoyPoints:         200,
  molesterPoints:       300,

  // DOH
  dohHitsRequired:      16,
  dohHitPoints:         1000,      // per hit
  dohProjectileSpeed:   2.0,

  // Scoring
  capsuleCollectPoints: 1000,      // any capsule caught = 1000 pts
  extraLifeAt:          20000,
  extraLifeEvery:       60000,     // after 60k threshold

  // Silver brick hits by stage group
  silverHitsTable:      [2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3,
                         4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5],
                        // index = stage - 1
} as const;
```

> ✅ **CHECK — Physics Feel:** Ball at base speed should cross the full screen height in approximately 85 frames (~1.4 seconds at 60fps). At max speed, approximately 37 frames (~0.6 seconds). Run a timing test: drop a ball straight down from the top wall at base speed and measure frames to exit the bottom — should be ~85 frames.

---

## 12. LLM Self-Verification Checklist

### Phase 1: Ball & Paddle Core
- [ ] Ball reflects correctly off left wall, right wall, and top wall (single-component inversion)
- [ ] Ball angle never falls below `minVerticalSpeed` — angle clamp applied after every reflection
- [ ] Ball corner hits (touching two brick faces simultaneously) invert both vx and vy
- [ ] Vaus edge zone sends ball at ~30° from horizontal (steep)
- [ ] Vaus center sends ball nearly straight up
- [ ] Ball speed increases on ceiling hit; resets to base speed on new life
- [ ] Ball does not clip through bricks at any speed — verify with sub-step collision

### Phase 2: Bricks
- [ ] All color bricks destroyed in 1 hit
- [ ] Silver bricks use `silverHitsTable[stageIndex]` for hit count
- [ ] Gold bricks are never destroyed (ball reflects, laser reflects/absorbs)
- [ ] `destroyableBricksRemaining` correctly excludes gold bricks at stage load
- [ ] Stage clears exactly when `destroyableBricksRemaining === 0`
- [ ] Silver brick damage frame renders correctly on each hit

### Phase 3: Capsules
- [ ] Only one capsule on screen at a time
- [ ] While 2+ balls active (Disruption), capsules do not drop
- [ ] P capsule capped at one per life
- [ ] B and P capsules are half as likely (implement weighted random)
- [ ] Duplicate prevention: same capsule twice in a row → substitute D capsule
- [ ] Score-seeded RNG produces consistent results for same score

### Phase 4: Power-Ups
- [ ] L (Laser): Vaus transforms, fire button shoots beams, ends on ball loss
- [ ] E (Enlarge): Vaus width increases; second E has no additional effect
- [ ] C (Catch): Ball sticks to Vaus; fire to release; auto-releases after 5 seconds
- [ ] S (Slow): Speed drops; creeps back up over 8 seconds; stackable
- [ ] B (Break): Portal opens on right wall; ball through portal = +10,000 + advance
- [ ] D (Disruption): 3 balls active; life only lost when all 3 gone; no capsule drops
- [ ] P (Extra Life): +1 life, max one per life instance
- [ ] L and C are mutually exclusive — verify each cancels the other

### Phase 5: Enemies & DOH
- [ ] Enemy ball deflection inverts both vx and vy (random feel)
- [ ] Enemies are destroyed by laser; NOT destroyed by ball contact
- [ ] Enemies can be killed by Vaus contact at bottom of play area
- [ ] DOH: ball hits deal 1,000 pts each; requires 16 hits
- [ ] DOH: lasers have NO effect on DOH
- [ ] DOH: projectile instant-kills Vaus on contact
- [ ] DOH: projectiles can be destroyed by laser
- [ ] Stage 33 does NOT permit continue on game over

### Phase 6: Rendering & TX
- [ ] All TX keys have registered sprite definitions — missing key throws at init
- [ ] Vaus renders correct variant based on active power-ups (normal / enlarged / laser / laser+enlarged)
- [ ] DOH damage state renders correct color tint variant per hit count
- [ ] Capsule sprites render with correct letter and color for each type
- [ ] Silver bricks show progressive damage visual with each hit

### Phase 7: Scoring
- [ ] Color brick points: White=50, Orange=60, Cyan=70, Green=90, Red=100, Blue=110, Violet=120, Yellow=50
- [ ] Silver brick points: `50 × stage_number`
- [ ] Rock crush: use table — 1 enemy=1000, 2=2500, ..., 8=15000
- [ ] Capsule collected: +1,000 pts
- [ ] Break portal used: +10,000 pts
- [ ] DOH hit: +1,000 pts per hit
- [ ] Extra life at 20,000 pts, then every 60,000 pts

---

## 13. Reference Sources

- Wikipedia — *Arkanoid* (1986): core mechanics, screen resolution (224×256), stage count, DOH description
- Yum Yum Matt / WordPress — Complete power-up table, complete brick color/points table, capsule rarity rules, silver brick scaling formula, DOH hit count, stage count
- PrimeTime Amusements / Stephen Krogman guide — Capsule drop mechanics (one at a time, score seed, duplicate prevention), DOH scoring strategy, stage 33 no-continue rule, Vaus edge zone behavior
- StrategyWiki — Extra life thresholds (20k/60k/+60k), stage 33 rules, continue mechanics
- Asteroid G — Enemy deflection behavior, speed escalation trigger (ceiling hits), enemy immunity to ball damage
- Smiling Cat Entertainment physics article — Ball angle reflection math, paddle zone implementation, angle clamping best practices
- Community forums (Allegro, Unity, GameMaker) — Paddle angle control implementation patterns, anti-tunneling recommendations
