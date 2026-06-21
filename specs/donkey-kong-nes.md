# Donkey Kong (NES, 1983) — Clone Design Specification

> **Build target:** Browser-based clone using font/ASCII character tile rendering system.
> **Platform:** NES version (1983) — NOT the arcade original.
> **NES-specific notes:** The NES port **omits the 50m (Conveyor Belt) stage** present in the arcade. The NES has three stages per loop: 25m → 75m → 100m. This is the authentic NES experience; 50m was cut due to ROM space constraints.
> **LLM verification notes** appear throughout as `> ✅ CHECK:` callouts.

---

## 1. Game Overview

- **Genre:** Single-screen platformer / obstacle course
- **Setting:** A New York City construction site. Donkey Kong has kidnapped Pauline and climbed to the top; Mario must reach her.
- **Core loop:** Navigate Mario up the screen through platforms and ladders → avoid or defeat obstacles → reach Pauline at the top → repeat across 3 stages → loop back with increased difficulty
- **Win condition:** There is no true end screen in the NES version. The game loops indefinitely with increasing speed until Mario dies.
- **Lose condition:** Mario contacts any hazard, falls from a fatal height, or the bonus timer reaches zero
- **Lives:** Mario starts with 3 lives. Extra life awarded at 20,000 points, then every 60,000 points thereafter.
- **Modes:** Mode A (default) and Mode B (faster enemies/barrels from the start)

> ✅ **CHECK — Three-Stage Loop:** Confirm the NES stage order is: 25m (barrels) → 75m (elevators) → 100m (rivets). There is NO 50m stage in the NES version. Stage completion triggers an advance to the next stage in the loop. After 100m, loop back to 25m with increased difficulty.

---

## 2. Shared Gameplay Mechanics

### 2.1 Mario Movement

| Property | Behavior |
|----------|----------|
| Horizontal | Runs left/right on girders and the floor |
| Jump | Fixed-arc jump; height and horizontal distance are constant; direction committed at takeoff |
| Jump height | Approximately 1.5× Mario's height — enough to clear a barrel |
| Mid-air control | Mario can adjust horizontal direction slightly mid-air (NES-authentic feel) |
| Climbing | Climb ladders by pressing up/down while overlapping a ladder |
| Climb restriction | Mario CANNOT jump while on a ladder |
| Hammer restriction | Mario CANNOT climb ladders while holding a hammer |
| Fatal fall | Mario dies if he falls more than approximately **his own height** (~1 tile) |
| Safe drop | Stepping off a platform onto a lower one that is only 1 tile below is safe |
| Contact death | Touching any enemy, barrel, spring, or fireball = instant death |

> ✅ **CHECK — Fatal Fall Distance:** Define `FATAL_FALL_HEIGHT` as approximately the height of one girder row. If `fallDistance > FATAL_FALL_HEIGHT`, call `mario.die()`. This means Mario can safely step off the edge of a girder to the floor directly below, but cannot fall two girder levels. Test: drop Mario from two rows up with no ladder — he should die on landing.

> ✅ **CHECK — Jump on Ladder:** While `mario.isOnLadder === true`, the jump input should be ignored. Verify: pressing jump while climbing does nothing. Mario must step off the ladder onto a girder before jumping.

### 2.2 Bonus Timer

- Each stage begins with a **Bonus** counter (typically starts at 5,000–5,800 pts depending on difficulty).
- The counter **decreases continuously** during gameplay.
- When Mario reaches Pauline (stage complete), the remaining Bonus value is added to the score.
- If the Bonus timer reaches **0**: Mario instantly dies (even with no obstacles nearby).
- The Bonus timer is visible on-screen at all times.

> ✅ **CHECK — Bonus Timer Death:** Implement `bonusTimer` decrementing each frame. When `bonusTimer <= 0`, call `mario.die()`. Verify the timer is clearly visible in the HUD and updates every frame (or every N frames for a visible tick-down effect matching NES speed).

### 2.3 Hammer Power-Up

- Two hammers appear per stage (exact positions vary by stage — see stage layouts).
- Mario picks up a hammer by walking into it.
- **While holding hammer:**
  - Mario raises and lowers the hammer automatically in a swinging animation (alternating frames)
  - Any barrel, fireball, or spring the hammer touches is **destroyed** for points
  - Mario **cannot climb ladders** (he drops the hammer if he touches a ladder — or simply cannot enter ladder state)
  - Mario **cannot jump** (NES version: hammer prevents jumping — verify this behavior)
  - The hammer lasts approximately **10–14 seconds** (timer-based, not hit-based)
- When the hammer timer expires, Mario's regular sprite returns and he drops the hammer
- Points per hammer kill: see scoring table in Section 6

> ✅ **CHECK — Hammer Ladder Interaction:** In NES Donkey Kong, entering a ladder while holding the hammer drops the hammer. Implement: when Mario's hitbox overlaps a ladder while `mario.hasHammer === true`, set `mario.hasHammer = false` and restore normal movement. Verify Mario cannot use ladders while hammering.

> ✅ **CHECK — Hammer Jump Restriction:** Confirm whether Mario can jump during hammer mode in the NES version. The NES version **prevents jumping** while hammering. Implement `if (mario.hasHammer) return;` at the start of jump input handling.

### 2.4 Pauline's Lost Items

Pauline's hat, parasol, and handbag appear scattered on platforms in stages 75m and 100m (NOT on 25m — that stage has no items). Mario can collect them by walking over them for bonus points.

| Item | Points |
|------|--------|
| Parasol | 500 |
| Hat | 300 |
| Handbag/Bag | 800 |

- Items appear in fixed positions on the platforms.
- Items disappear if Mario does not collect them before advancing (stage ends).
- Collecting all three items in a single run is a meaningful bonus opportunity.

---

## 3. Stage 1 — 25m (Barrel Stage)

**Label:** "25m" in the NES version
**Goal:** Climb from the bottom girder to the top and reach Pauline
**Unique hazard:** Donkey Kong continuously throws barrels from the top

### 3.1 Platform Layout

```
┌──────────────────────────────────────────────────────────┐
│  [DK]                                          [PAULINE] │  ← Top level (fixed platform, no tilt)
│                                                          │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                                        │  ← Girder 5 (tilts left-down)
│            L                                             │    L = ladder
│         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                         │  ← Girder 4 (tilts right-down)
│  ═══════════════[HAMMER]══════════                       │
│  L                                        L              │    L = broken ladder (cannot use)
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                                       │  ← Girder 3 (tilts left-down)
│                       L                                  │
│         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                      │  ← Girder 2 (tilts right-down)
│  ═══════════════════[HAMMER]══════════════════           │
│  L                                        L              │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                    │  ← Girder 1 (slight tilt right)
│                                                          │
│  [OIL DRUM] [MARIO START]                                │  ← Floor
└──────────────────────────────────────────────────────────┘
```

**Key layout details:**
- Girders are **slanted/bent** — not perfectly horizontal. They tilt alternately left and right so barrels roll in a consistent zig-zag path down the screen.
- Some ladders are **broken** (visual only — Mario cannot use them). Intact ladders are the only valid climbing routes.
- **Hammer locations:** One on Girder 2 (left side), one on Girder 4 (center area — exact position varies).
- **Oil drum** is at the bottom-left of the floor. Blue barrels that reach it produce a Fireball.
- Mario's starting position: bottom-left floor area.

### 3.2 Barrel Mechanics

**Two barrel types:**

| Type | Color | Behavior |
|------|-------|----------|
| Brown barrel | Brown/red | Rolls along the current girder. When it reaches a ladder, there is a ~50% random chance it will roll down the ladder to the next girder, or continue rolling off the edge and fall to the floor. After reaching the floor, it rolls to the right and exits the screen. |
| Blue barrel | Blue | Rolls the same as a brown barrel, but when it enters the **Oil Drum**, it creates a **Fireball**. DK always throws the first barrel of each life as a blue barrel. |

**Barrel spawn:**
- DK throws one barrel at a time from the top of the screen.
- There is a short delay between barrel throws.
- As difficulty increases (later loops), DK throws barrels faster and the inter-barrel delay shrinks.
- Barrel roll speed increases with each loop.
- **Barrel ladder logic:** A barrel at the top of a ladder has a random 50% chance of rolling down the ladder. If it does, it transfers to the next girder below at the ladder exit position. This creates unpredictable paths.

> ✅ **CHECK — Barrel Ladder Probability:** Each time a barrel reaches a ladder position (top edge of ladder), roll `Math.random() < 0.5`. If true, barrel enters ladder descent animation and exits onto the lower girder. If false, barrel continues rolling past the ladder on the current girder. Verify this creates genuinely varied paths and not all barrels taking the same route.

**Fireball creation:**
- When a **blue barrel** reaches the **oil drum** at the bottom floor: the barrel disappears, and a Fireball enemy spawns from the drum.
- Up to **5 Fireballs** can be on screen simultaneously. When 5 are present, DK stops throwing blue barrels until the count drops below 5.

### 3.3 Oil Drum (Fire Source)

- Static object at bottom-left of the floor.
- Animates with a small flame on top (idle state).
- On blue barrel contact: flash animation → Fireball emerges.
- Mario touching the oil drum = instant death.

---

## 4. Stage 2 — 75m (Elevator Stage)

**Label:** "75m" in the NES version
**Goal:** Ride elevators and navigate step-platforms to reach the top
**Unique hazard:** Bouncing springs falling from the top; no Donkey Kong throwing anything; 2 Fireballs patrol

> **NES NOTE:** This is the SECOND stage in the NES version (replacing the missing 50m conveyor belt stage). The player goes 25m → 75m, skipping 50m entirely.

### 4.1 Platform Layout

```
┌──────────────────────────────────────────────────────────┐
│  [DK]  [PAULINE]                                         │  ← Top (DK + Pauline)
│                                                          │
│  ══════════════════════════════════════════════          │  ← Step platforms (right side, ascending)
│         L                                                │
│  ══════════════════════════════════════════════          │
│         L                                                │
│  ══════════════════════════════════════════════          │
│         L                                                │
│  ══════╗                            ══════╗              │  ← Mid landing platforms
│   [▲]  ║                             [▼] ║              │    ▲ = up-elevator  ▼ = down-elevator
│  ══════╝                            ══════╝              │
│                                                          │
│  [START][UMBRELLA]                                       │  ← Floor/start (bottom-left)
└──────────────────────────────────────────────────────────┘
```

**Key layout details:**
- Two elevator tracks: one on the left going **upward**, one on the right going **downward**.
- Elevators are platforms that oscillate up and down. Mario rides on top of them.
- Mario can be crushed if an elevator reaches the top/bottom wall while he is on it.
- The right side has a series of **step-platforms** — staircase-like fixed platforms that ascend left-to-right.
- **Springs** fall from the top of the screen, bouncing down the step-platforms, posing the primary hazard.
- **2 Fireballs** patrol this stage (vs. potentially many on 25m). They climb ladders and move toward Mario.
- **Pauline's items** (hat, parasol, bag) appear on platforms here.
- **Umbrella** is near the start position and can be collected for 300 pts.

### 4.2 Spring Mechanics

- Springs drop from an off-screen spawn point at the top, bouncing down the step platforms.
- Each spring follows the angle of the steps — it bounces further right with each step.
- Springs exit at the right edge of the screen and do not return.
- Mario must jump over springs as they approach him on the steps.
- Later loops: springs bounce faster and appear more frequently.
- **Mario can be hit by a spring regardless of jump state** — he must clear the spring completely (jump over, not through it).

> ✅ **CHECK — Spring Bounce Physics:** Each spring has a `velocityY` that inverts on platform contact and a constant `velocityX` (rightward). On each bounce, the spring gains a slight horizontal distance increment. Springs do not use the `grappling ladder` logic — they only bounce on solid platform surfaces. Verify springs cannot travel upward through the stair-steps.

### 4.3 Elevator Mechanics

- Two elevator platforms oscillate along fixed vertical tracks.
- Left elevator travels **upward** (starts at bottom, moves to top, resets to bottom).
- Right elevator travels **downward** (starts at top, moves to bottom, resets to top).
- Mario stands on top of an elevator and is carried with it.
- **Crush hazard:** If Mario is on an elevator and it reaches the extreme top position, Mario is crushed against the ceiling = instant death.
- If Mario jumps off the elevator at the right moment, he can land on adjacent platforms.

> ✅ **CHECK — Elevator Crush:** When `elevator.y <= ELEVATOR_TOP_LIMIT` and `mario.isOnElevator === true`, call `mario.die()`. The collision detection must check this condition before moving Mario with the elevator. Test: ride an elevator all the way to the top — Mario should die.

---

## 5. Stage 3 — 100m (Rivet Stage)

**Label:** "100m" in the NES version
**Goal:** Remove all 8 rivets from the structure to make Donkey Kong fall
**Unique mechanic:** No barrels; rivets are the win condition; the structure collapses on completion

### 5.1 Platform Layout

```
┌──────────────────────────────────────────────────────────┐
│                    [DK]  [PAULINE]                       │  ← DK platform (top center)
│                                                          │
│  ══[ R ]══════════════════════════[ R ]══                │  ← Top bar (rivet at each end)
│  L                                      L                │
│  ══[ R ]══════════════════════════[ R ]══                │  ← Second bar
│  L                                      L                │
│  ══[ R ]══════════════════════════[ R ]══                │  ← Third bar
│  L                                      L                │
│  ══[ R ]══════════════════════════[ R ]══                │  ← Bottom bar (rivet at each end)
│  L                                      L                │
│  [START]                                                 │  ← Floor
└──────────────────────────────────────────────────────────┘
  [ R ] = Rivet (one on each end of each of the 4 bars = 8 total)
```

**Key layout details:**
- 4 horizontal bars with a **rivet at each end** = **8 rivets total**.
- Mario removes a rivet by walking over it.
- Ladders connect each bar level.
- **No barrels** in this stage. The hazard is **Fireballs only** (2–4 depending on loop).
- **Pauline's items** appear on the platforms.
- **No hammer** on the 100m stage in the NES version.

### 5.2 Rivet Mechanics

- Mario automatically removes a rivet when his sprite overlaps it while walking.
- Visual cue: the rivet "pops" off the platform, leaving a gap where it was.
- After a rivet is removed, the gap where it was is passable (no collision).
- Rivets are removed one at a time as Mario traverses them.
- When all **8 rivets** are removed: the bars collapse, DK tumbles down, brief cutscene plays, stage complete.

> ✅ **CHECK — Rivet Removal:** Each rivet is a sprite entity with `isRemoved = false`. When `mario.hitbox` overlaps `rivet.hitbox` and `mario.isWalking`, set `rivet.isRemoved = true`, render the gap, and decrement `rivetsRemaining`. When `rivetsRemaining === 0`, trigger stage clear sequence. Verify Mario must be **walking** to collect a rivet (jumping over it does not remove it).

### 5.3 Stage Clear Sequence

When all 8 rivets are removed:
1. Short pause
2. DK stumbles and falls from the top platform (multi-frame fall animation)
3. Hearts appear between Mario and Pauline (brief reunion animation)
4. Screen transitions to the next stage in the loop

---

## 6. Enemies

### 6.1 Fireball

**Appears in:** All 3 stages (spawns from the oil drum on 25m; pre-placed on 75m and 100m)
**Role:** Persistent chasing hazard. Does not interact with barrels or springs.

#### Behavior

- Moves toward Mario's position in a semi-random manner.
- Can climb **any ladder** — both broken and intact. This is important: Fireballs are not restricted to usable ladders.
- Cannot fall off platform edges (they stop at the edge and reverse, or go down ladders).
- Fireball movement is **not deterministic** — the blog source is clear: all movement except the two documented cases is random. Do not attempt to implement perfect AI.
- **Spawn rule:** Fireballs always spawn on the **opposite side of the screen** from Mario's current horizontal position.
- **Vertical rule:** Fireballs will not climb a ladder to descend to a level **below Mario** (they can only ascend above Mario's level). However, if Mario is on a sloped girder and technically slightly below the fireball, they may "descend" due to the slope.
- **Speed** increases each loop.
- Max 5 Fireballs on screen at once (25m stage). 75m and 100m stages have 2–4 Fireballs pre-placed.

> ✅ **CHECK — Fireball Spawn Side:** When a Fireball spawns (from oil drum or stage load), check `mario.x < SCREEN_CENTER`. If Mario is on the left half, spawn Fireball on the right. If on the right, spawn on the left. Verify by repositioning Mario before a barrel triggers the drum.

> ✅ **CHECK — Ladder Restriction (Fireballs):** Unlike Mario (who can only use intact ladders), Fireballs can traverse ALL ladder positions — including broken ones. Implement a separate `fireballs_can_use_broken_ladders = true` flag in the ladder data.

#### ASCII Sprite Design

Fireballs are small, roughly spherical flame creatures with two dot-like eyes. They are compact and flickery.

```
// Fireball Frame 0 (8x8). F=flame (orange/red), E=eye (black), Y=yellow core
const FIREBALL_0: string[] = [
  ' FFFF   ',
  'FFFFFFY ',   // Y = bright yellow center tip
  'FEFFEFY ',   // E = eyes
  'FFFFFFFF',
  ' FFFFFF ',
  '  FFFF  ',
  '   FF   ',
  '        ',
];

const FIREBALL_1: string[] = [
  '  FFFF  ',
  ' FFFFFY ',
  'FFEFFEF ',
  'FFFFFFFF',
  'FFFFFFF ',
  ' FFFFF  ',
  '  FFF   ',
  '        ',
];
```

**TX keys:** `fireball0`, `fireball1`
**Animation:** Alternate `fireball0` ↔ `fireball1` at ~100ms per frame (fast flicker). Mirror based on direction of movement.

### 6.2 Brown Barrel

Not an "enemy" per se, but treated as a hazardous entity.

```
// Brown Barrel (10x10). B=wood stave (brown), R=ring (dark), H=highlight
const BARREL_ROLL_0: string[] = [
  '  BBBBBB  ',
  ' RBBBBBBR ',   // R = metal ring
  ' BBHBBBBB ',   // H = highlight line
  'RBBBBBBBBR',
  'RBBBBBBBBR',
  ' BBBBHBBB ',
  ' RBBBBBBR ',
  '  BBBBBB  ',
  '          ',
  '          ',
];

const BARREL_ROLL_1: string[] = [
  '  BBBBBB  ',
  ' RBBBBBHR ',
  ' BBBBBBB  ',
  'RBBBBBBBBR',
  'RHBBBBBBBR',
  ' BBBBBBB  ',
  ' RBBBBBBR ',
  '  BBBBBB  ',
  '          ',
  '          ',
];
```

**TX keys:** `barrelRoll0`, `barrelRoll1`, `barrelFall` (tumbling variant for falling off edges), `barrelBlue0`, `barrelBlue1` (blue variant)
**Animation:** Alternate at ~150ms per frame. Rotate direction based on roll direction. For falling barrels, use `barrelFall` with spin animation.

### 6.3 Spring (75m only)

```
// Spring (8x10). S=coil (silver/grey), T=top plate, B=bottom plate
const SPRING_BOUNCE_0: string[] = [
  ' TTTTTT ',   // T = top plate
  'SSSSSSSS',   // S = coil
  'S      S',
  'SSSSSSSS',
  'S      S',
  'SSSSSSSS',
  ' BBBBBB ',   // B = bottom plate
  '        ',
  '        ',
  '        ',
];

const SPRING_BOUNCE_1: string[] = [
  '  TTTT  ',   // compressed top
  ' SSSSSS ',
  'SSSSSSSS',
  'SSSSSSSS',
  ' SSSSSS ',
  ' BBBBBB ',
  '        ',
  '        ',
  '        ',
  '        ',
];
```

**TX keys:** `springBounce0`, `springBounce1`
**Animation:** Show `springBounce1` (compressed) on platform contact frame, then `springBounce0` (extended) when in flight.

---

## 7. Donkey Kong Sprite

DK is a large gorilla. He sits at the top of each stage (except 100m where he stands on the top platform with Pauline). He only moves to throw barrels.

```
// DK Throw Frame 0 (20x16). G=gorilla body (dark brown), E=eye (white), 
// N=nose/snout, C=chest (lighter), A=arm extended, T=teeth
const DK_IDLE: string[] = [
  '    GGGGGGGGGGGG    ',
  '   GEGGGGGGGGGE G   ',   // E = eyes
  '  GGGNNNNNNNNNGGG   ',   // N = snout/nose region
  '  GGGGTTTTTTGGGGG   ',   // T = teeth strip
  ' CCCCCCCCCCCCCCCCC  ',   // C = lighter chest area
  ' GCCCCCCCCCCCCCCCG  ',
  ' GCCCCCCCCCCCCCCGG  ',
  'GGGGGGGGGGGGGGGGGG  ',
  ' AGGGGGGGGGGGGGGG   ',   // A = arm stub
  '  GGGGGGGGGGGGGG    ',
  '  GG          GG    ',   // legs
  '  GG          GG    ',
  '  GG          GG    ',
  '   G           G    ',
  '                    ',
  '                    ',
];

const DK_THROW: string[] = [
  '    GGGGGGGGGGGG    ',
  '   GEGGGGGGGGGE G   ',
  '  GGGNNNNNNNNNGGG   ',
  '  GGGGTTTTTTGGGGG   ',
  ' CCCCCCCCCCCCCCCCC  ',
  ' GCCCCCCCCCCCCCCCG  ',
  'AGCCCCCCCCCCCCCCGGA ',   // A = both arms raised for throw
  'AAGGGGGGGGGGGGGGGA  ',
  '  GGGGGGGGGGGGGG    ',
  '  GG          GG    ',
  '  GG          GG    ',
  '  GG          GG    ',
  '   G           G    ',
  '                    ',
  '                    ',
  '                    ',
];
```

**TX keys:** `dkIdle`, `dkThrow`, `dkFall0`, `dkFall1` (100m stage collapse animation)

---

## 8. Mario Sprite

Mario is a small plumber in red overalls and cap. His sprites must convey:
- **Running left/right** (leg movement alternate)
- **Jumping** (legs tucked or extended)
- **Climbing** (arms alternating on ladder)
- **Hammer** (arm raised overhead)
- **Death** (rotating/falling animation)

```
// Mario Run Frame 0 (10x12). M=overalls (red), S=skin, H=hat (red),
// B=boot (brown), W=white glove
const MARIO_RUN_0: string[] = [
  '   HHHH   ',   // H = red cap
  '  HSSHH   ',   // S = skin (face)
  '  MMMMMM  ',   // M = red overalls (top/shirt)
  ' MMMMMMM  ',
  ' MMMMMMM  ',
  ' WMMMMW   ',   // W = gloves (white)
  '  MM MM   ',   // legs split
  '  BB BB   ',   // B = boots
  '  BB BB   ',
  '          ',
  '          ',
  '          ',
];

const MARIO_RUN_1: string[] = [
  '   HHHH   ',
  '  HSSHH   ',
  '  MMMMMM  ',
  ' MMMMMMM  ',
  ' MMMMMMM  ',
  '  WMMW    ',
  '  M   M   ',
  '  B   B   ',
  '   B B    ',
  '          ',
  '          ',
  '          ',
];

const MARIO_JUMP: string[] = [
  '   HHHH   ',
  '  HSSHH   ',
  ' WMMMMMW  ',   // arms spread during jump
  ' MMMMMMM  ',
  '  MMMMM   ',
  '  BMMB    ',
  '  B  B    ',   // legs tucked
  '          ',
  '          ',
  '          ',
  '          ',
  '          ',
];

const MARIO_CLIMB_0: string[] = [
  '   HHHH   ',
  '  HSSHH   ',
  ' WMMMMMM  ',   // left arm raised
  '  MMMMMM  ',
  '  MMMMM   ',
  '   WMMM   ',   // right arm lower
  '   MM     ',
  '   BB     ',
  '    B     ',
  '          ',
  '          ',
  '          ',
];

const MARIO_CLIMB_1: string[] = [
  '   HHHH   ',
  '  HSSHH   ',
  '  MMMMMW  ',   // right arm raised
  '  MMMMMM  ',
  '  MMMMM   ',
  '  MMMW    ',
  '    MM    ',
  '    BB    ',
  '    B     ',
  '          ',
  '          ',
  '          ',
];

const MARIO_HAMMER_0: string[] = [
  '  [HAMMER]',   // [ ] = hammer sprite above
  '   HHHH   ',
  '  HSSHH   ',
  '  WMMMMM  ',   // W = arm up holding hammer
  '  MMMMM   ',
  '  MMMMM   ',
  '  MM MM   ',
  '  BB BB   ',
  '          ',
  '          ',
  '          ',
  '          ',
];

const MARIO_DEAD: string[] = [
  '          ',
  '  BBBBBB  ',   // death flash frame — flattened/scattered
  ' MHSSHHM  ',
  'MMMMSMMM  ',
  ' MMBMMB   ',
  '  B   B   ',
  '          ',
  '          ',
  '          ',
  '          ',
  '          ',
  '          ',
];
```

**TX keys:** `marioRun0`, `marioRun1`, `marioJump`, `marioClimb0`, `marioClimb1`, `marioHammer0`, `marioHammer1`, `marioDead`
**Animation rules:**
- Running: alternate `marioRun0` ↔ `marioRun1` at ~120ms per frame
- Jumping: single `marioJump` frame (no animation mid-air)
- Climbing: alternate `marioClimb0` ↔ `marioClimb1` at ~200ms per frame (slower)
- Hammer: alternate `marioHammer0` ↔ `marioHammer1` at ~80ms per frame (fast swing)
- Death: `marioDead` with brief flash effect

---

## 9. TX (Texture Key) Registry

```typescript
export const TX = {
  // Mario
  marioRun0:        'dk-mario-run-0',
  marioRun1:        'dk-mario-run-1',
  marioJump:        'dk-mario-jump',
  marioClimb0:      'dk-mario-climb-0',
  marioClimb1:      'dk-mario-climb-1',
  marioHammer0:     'dk-mario-hammer-0',
  marioHammer1:     'dk-mario-hammer-1',
  marioDead:        'dk-mario-dead',

  // Donkey Kong
  dkIdle:           'dk-dk-idle',
  dkThrow:          'dk-dk-throw',
  dkFall0:          'dk-dk-fall-0',
  dkFall1:          'dk-dk-fall-1',

  // Pauline
  paulineIdle:      'dk-pauline-idle',
  paulineScream:    'dk-pauline-scream',   // arms raised, captured pose

  // Barrels
  barrelRoll0:      'dk-barrel-0',
  barrelRoll1:      'dk-barrel-1',
  barrelFall:       'dk-barrel-fall',
  barrelBlue0:      'dk-barrel-blue-0',   // barrel that spawns fireballs
  barrelBlue1:      'dk-barrel-blue-1',

  // Fireball
  fireball0:        'dk-fire-0',
  fireball1:        'dk-fire-1',

  // Spring (75m)
  springBounce0:    'dk-spring-0',
  springBounce1:    'dk-spring-1',

  // Oil Drum (25m)
  oilDrumIdle:      'dk-oildrum',
  oilDrumFlash:     'dk-oildrum-flash',   // brief animation when spawning fireball

  // Hammer (pickup)
  hammerPickup:     'dk-hammer',

  // Rivets (100m)
  rivetIntact:      'dk-rivet',
  rivetRemoved:     'dk-rivet-gone',      // visual gap after removal

  // Pauline items
  parasol:          'dk-parasol',
  hat:              'dk-hat',
  handbag:          'dk-bag',

  // Environment
  girder:           'dk-girder',
  ladderIntact:     'dk-ladder',
  ladderBroken:     'dk-ladder-broken',
  floor:            'dk-floor',

  // UI
  lifeIcon:         'dk-life-icon',       // small Mario icon for lives display
  bonusCounter:     'dk-bonus',           // bonus timer HUD element
} as const;

export type TXKey = keyof typeof TX;
```

> ✅ **CHECK — TX Completeness:** Every key in `TX` must have a registered sprite. A missing key throws at init time. Verify `ladderBroken` renders visually but has `isUsable = false` in the ladder data structure.

---

## 10. Scoring System

| Action | Points |
|--------|--------|
| Jump over barrel | 100 pts |
| Jump over 2 obstacles | 300 pts |
| Jump over 3 obstacles | 500 pts |
| Hammer kill (barrel, fireball, spring) | 300, 500, or 800 pts (random) |
| Collect parasol | 500 pts |
| Collect hat | 300 pts |
| Collect handbag | 800 pts |
| Remove rivet (100m stage) | 100 pts each |
| Complete stage (bonus counter remaining) | Remaining Bonus counter value |
| Extra life | At 20,000 pts; then every 60,000 pts |

**Jump scoring logic:**
- The game awards points based on how many obstacles were "in flight" when Mario jumped.
- If Mario jumps over a barrel and a nearby fireball at the same time (both in the air simultaneously below his jump arc), he earns 300 instead of 100.
- This is an advanced scoring mechanic and can be approximated by checking how many hazard entities Mario's jump cleared simultaneously.

**Hammer kill randomization:**
- Hammer kills award either 300, 500, or 800 points — chosen at random.
- This is authentic arcade/NES behavior; no skill-based modifier.

---

## 11. Level Progression & Difficulty Scaling

### 11.1 Loop Structure (NES Version)

The NES game does not use "levels" in a numbered sense. Instead it uses **loops**. A loop is one completion of all 3 stages (25m → 75m → 100m).

| Loop | 25m Stages | 75m | 100m | Notes |
|------|-----------|-----|------|-------|
| 1 | 25m only | 75m | 100m | Introductory speeds |
| 2+ | All 3 stages | 75m | 100m | Speeds increase each loop |

### 11.2 Difficulty Increases Each Loop

- **Barrel speed** increases (barrels roll faster)
- **Barrel throw rate** increases (DK throws more frequently)
- **Fireball speed** increases
- **Spring speed** increases (75m)
- **Bonus timer starting value** may decrease

> ✅ **CHECK — Loop Speed Multiplier:** Maintain `loopCount` (increments after each 100m completion). Apply `speedMultiplier = BASE_SPEED * (1 + loopCount * SPEED_INCREMENT)` to all moving hazards. Cap at a `MAX_SPEED` so the game remains theoretically playable. Define `SPEED_INCREMENT = 0.1` as a starting point and tune.

### 11.3 Kill Screen

The NES version of Donkey Kong does not have a kill screen in the same way as the arcade (which kills Mario on stage 117 or 133 depending on version). The NES version will theoretically run indefinitely, but the game becomes unbeatable due to speed at very high loop counts.

---

## 12. Physics Constants

```typescript
export const PHYSICS = {
  // Screen
  screenWidth:        256,      // NES logical width
  screenHeight:       240,      // NES logical height

  // Mario movement
  marioMoveSpeed:     2.5,      // px per frame horizontal
  marioJumpVelocityY: -8.0,     // px per frame initial jump velocity
  marioClimbSpeed:    1.8,      // px per frame on ladder
  gravity:            0.5,      // px per frame² downward
  fatalFallHeight:    16,       // px — falling more than this = death (~1 tile)

  // Barrel
  barrelBaseSpeed:    1.8,      // px per frame (rolling)
  barrelFallSpeed:    4.0,      // px per frame (falling off girder edge)
  barrelLadderChance: 0.5,      // probability barrel takes a ladder down

  // Fireball
  fireballBaseSpeed:  1.2,      // px per frame

  // Spring (75m)
  springBounceVelY:  -7.0,      // px per frame initial upward velocity on bounce
  springMoveVelX:    2.5,       // px per frame rightward

  // Elevator (75m)
  elevatorSpeed:      1.5,      // px per frame

  // Bonus timer
  bonusStartValue:    5000,     // pts (decrements at 100 pts per second)
  bonusDecayRate:     100,      // pts per second

  // Hammer
  hammerDurationMs:   10000,    // ms (10 seconds)

  // DK throw delay
  dkThrowIntervalMs:  2000,     // ms between barrel throws (loop 1)

  // Difficulty scaling
  speedIncrement:     0.12,     // multiplier per loop
  maxSpeedMultiplier: 2.5,      // cap on speed increases
} as const;
```

---

## 13. LLM Self-Verification Checklist

### Phase 1: Core Mario Movement
- [ ] Mario runs left/right at constant speed
- [ ] Jump has fixed arc; direction committed at takeoff; slight mid-air adjustment allowed
- [ ] Mario dies if he falls more than `fatalFallHeight` pixels
- [ ] Mario can only climb intact ladders (not broken ones)
- [ ] Mario cannot jump while on a ladder
- [ ] Mario drops/loses hammer when entering a ladder
- [ ] Mario cannot jump while holding hammer (NES behavior)
- [ ] Bonus timer counts down and kills Mario at zero
- [ ] Extra life awarded at 20,000 pts

### Phase 2: 25m Stage (Barrels)
- [ ] DK throws barrel → barrel rolls down slanted girder
- [ ] At each ladder position, barrel has 50% chance to descend vs. continue
- [ ] Blue barrel on first throw; rest are brown (random mix in higher loops)
- [ ] Blue barrel entering oil drum = Fireball spawns
- [ ] Max 5 Fireballs; DK stops throwing blue barrels at max count
- [ ] 2 hammers placed on correct girders

### Phase 3: 75m Stage (Elevators)
- [ ] Left elevator goes up; right elevator goes down
- [ ] Mario rides elevator and is carried with it
- [ ] Mario crushed when elevator hits top wall
- [ ] Springs spawn from top, bounce down stair-steps rightward
- [ ] Springs exit at right edge and despawn
- [ ] 2 Fireballs patrol this stage (not spawned from oil drum)

### Phase 4: 100m Stage (Rivets)
- [ ] 8 rivets positioned at ends of 4 bars
- [ ] Walking over rivet removes it (not jumping over it)
- [ ] `rivetsRemaining` counter decrements on each removal
- [ ] When `rivetsRemaining === 0`, trigger DK fall sequence
- [ ] No barrels in this stage; Fireballs only
- [ ] No hammer in this stage

### Phase 5: Enemies
- [ ] Fireballs spawn on opposite side from Mario
- [ ] Fireballs can use ALL ladders (broken and intact)
- [ ] Fireballs do NOT descend to levels below Mario
- [ ] Fireball movement is randomized (not deterministic AI)

### Phase 6: Scoring & Loop
- [ ] Jump over barrel = 100 pts
- [ ] Hammer kill = 300/500/800 pts random
- [ ] Items: parasol=500, hat=300, bag=800
- [ ] Rivet = 100 pts each
- [ ] Stage completion = remaining bonus value
- [ ] Speed multiplier increments correctly each loop
- [ ] Max speed cap enforced

### Phase 7: Rendering & TX
- [ ] All TX keys have registered sprite definitions
- [ ] Intact vs broken ladders render differently; only intact are climbable
- [ ] Barrel rotation animation syncs with roll direction
- [ ] DK alternates between `dkIdle` and `dkThrow` during barrel throw sequence
- [ ] Fireball animation flickers fast (100ms per frame)

---

## 14. Reference Sources

- Wikipedia — *Donkey Kong* (1981): NES port details, cement factory omission, stage list, extra life threshold, loop structure
- Super Mario Wiki / mariowiki.com — 25m, 75m, 100m stage details; oil drum/fireball spawn mechanics; max fireball count (5)
- The Donkey Kong Blog / donkeykongblog.blogspot.com — Definitive resource on fireball AI: movement is random except for two documented cases (spawn side = opposite of Mario; vertical movement = never descend below Mario)
- Classic Gaming / classicgaming.cc — Stage platform layout descriptions; hammer behavior (300 pts per kill); item locations
- TakeOnTheNESLibrary — NES-specific: no 50m stage, three stages per loop, NES was cut to three stages due to ROM constraints
