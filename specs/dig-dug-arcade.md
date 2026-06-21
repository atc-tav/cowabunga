# Dig Dug (1982 Arcade) — Clone Design Specification

> **Build target:** Browser-based clone using font/ASCII character tile rendering system (same as Mario Bros. spec).
> **Source:** Namco arcade original (1982), arcade-accurate behavior.
> **LLM verification notes** appear throughout as `> ✅ CHECK:` callouts — use these to validate implementation correctness at each stage.

---

## 1. Game Overview

- **Genre:** Single-screen strategic digging game
- **Setting:** A cross-section view of underground earth, divided into 4 distinct soil layers + sky above
- **Core loop:** Dig tunnels through the earth → locate enemies → inflate them with the air pump until they pop OR crush them under falling rocks → clear all enemies to advance to the next round
- **No screen wrap:** Unlike Mario Bros., Dig Dug's playfield has **hard edges** — Dig Dug cannot pass from one side to the other
- **Movement grid:** Dig Dug moves on an invisible tile grid and can only make **90-degree turns** at tile boundaries
- **Lives:** Player starts with 3 lives. Extra lives awarded during play (typically at certain score thresholds)
- **Game ends:** At round 256, an 8-bit integer overflow causes an unbeatable Pooka to spawn on top of Dig Dug — this is the kill screen

> ✅ **CHECK — Grid Movement:** Confirm Dig Dug's position always snaps to tile-grid coordinates when turning. A diagonal move should be impossible. The player can buffer a direction input, but the actual turn only executes when the player reaches the next tile boundary.

---

## 2. Stage Architecture

### 2.1 Playfield Dimensions

| Element | Arcade Value |
|---------|-------------|
| Playfield width | 224 px |
| Playfield height | 248 px |
| Tile size | ~8×8 px (logical grid) |
| Sky zone height | ~2 tile rows at top |
| Dirt zone | Remaining area below sky |
| Soil layers | 4 (see below) |

The top ~2 rows are open sky (no dirt, blue background). Dig Dug's starting position is in the sky at the top-center of the screen.

### 2.2 Soil Layers

The dirt area is divided into **4 horizontal layers**, each visually distinct in color. These layers determine enemy point values when killed by inflation.

```
┌──────────────────────────────────────┐  ← Sky (blue, open)
│  [START]                             │
├──────────────────────────────────────┤  ← Layer 1 (lightest — e.g. tan/yellow)
│                                      │
│  [ROCK]      [ROCK]                  │
│                                      │
├──────────────────────────────────────┤  ← Layer 2 (medium — e.g. orange/brown)
│                                      │
│          [ROCK]                      │
│                                      │
├──────────────────────────────────────┤  ← Layer 3 (darker — e.g. deep brown)
│                                      │
│  [ROCK]                              │
│                                      │
├──────────────────────────────────────┤  ← Layer 4 (darkest — e.g. near-black)
│                                      │
└──────────────────────────────────────┘
```

- Layer colors change every few rounds as the game progresses (visual variety only, no gameplay difference).
- Each layer is approximately equal height.
- Enemy spawn positions: each enemy begins in a pre-set **cave** (small pre-dug pocket) at the start of each round.
- Rocks are scattered at fixed positions within the dirt; they cannot be dug through.

> ✅ **CHECK — Layer Detection:** Each tile should store its `layerIndex` (0–3). When an enemy is killed by inflation, the point value must be looked up from the layer of the tile where the enemy is standing. Verify layer boundaries update correctly when the round changes color theme.

### 2.3 Dirt Tiles

- The entire dirt area starts as **solid tiles**. Each tile is either `solid` (brown fill) or `cleared` (black/empty).
- When Dig Dug moves through a solid tile, it becomes `cleared`, creating a tunnel.
- Tunnels persist for the entire round — they do not regenerate.
- Enemies can use cleared tunnels to move toward Dig Dug freely (no digging penalty for them).

> ✅ **CHECK — Tile State:** Use a 2D boolean grid `dirtGrid[row][col]` — `true` = solid, `false` = cleared. When Dig Dug occupies a tile, set `dirtGrid[row][col] = false` and re-render that tile. Verify the grid persists for the full round and resets fresh at round start.

---

## 3. Core Gameplay Mechanics

### 3.1 Dig Dug Movement

| Property | Behavior |
|----------|----------|
| Movement style | Grid-based, 4-directional (up/down/left/right) |
| Speed (digging) | Slower — Dig Dug moves at reduced speed when cutting through **solid** dirt tiles |
| Speed (tunnel traversal) | Faster — Dig Dug moves at full speed when walking through already-cleared tunnels |
| Speed (surface) | Full speed along the sky row |
| Turning | 90-degree turns only; only possible at tile boundaries |
| Screen edge | Hard stop — cannot leave the screen |
| Death conditions | Contact with enemy body, Fygar fire, or being crushed by a falling rock |

> ✅ **CHECK — Speed Toggle:** When Dig Dug's leading edge enters a `solid` tile, switch to `SPEED_DIG`. When moving through a `cleared` tile or on the surface, switch to `SPEED_WALK`. Test: traversing an already-dug horizontal tunnel should visibly faster than digging a new path.

### 3.2 Air Pump (Primary Attack)

The pump is Dig Dug's only direct weapon.

**Firing sequence:**
```
1. Player presses PUMP button
2. Dig Dug stops moving and extends pump nozzle in the direction currently facing
3. If an enemy is within range of the nozzle (1 tile ahead, or through a thin dirt wall):
   → Nozzle LATCHES onto the enemy
   → Enemy is frozen in place
   → Player repeatedly presses PUMP to inflate enemy
4. Each pump press adds one inflation stage
5. At the maximum inflation stage: enemy POPS (killed)
6. If player moves OR stops pumping → pump disconnects
   → Enemy begins to DEFLATE back to normal over a few seconds
   → During deflation, enemy is stunned and safe to walk through
```

**Pump range:** The pump nozzle can pass through a thin dirt wall (one tile thick) to hit an enemy on the other side. It cannot penetrate two or more tiles of solid dirt.

**Inflation stages per enemy:**

| Enemy | Pump presses to pop |
|-------|-------------------|
| Pooka | 3 presses |
| Fygar | 3 presses |

> ✅ **CHECK — Pump Latch:** When the pump fires, raycast 1 tile ahead (and optionally through 1 solid tile) for an enemy hitbox. On contact: set `enemy.inflationStage = 1`, freeze enemy movement, begin inflate animation. Each subsequent pump press increments `inflationStage`. At `inflationStage === MAX_INFLATION`, call `enemy.pop()`. If player moves OR no pump press within `DEFLATE_GRACE_MS`, begin decrementing `inflationStage` over time.

> ✅ **CHECK — Pump Stall:** If a player inflates an enemy to stage 2 and disconnects, the enemy should hold that inflation for a moment before deflating. Two enemies can be alternately stalled (partially inflate one, switch to other) — verify both enemies individually track their own `inflationStage` and `deflateTimer`.

### 3.3 Rocks (Environmental Weapon)

Rocks are indestructible objects embedded in the dirt. They are the key strategic element of Dig Dug.

**Rock fall mechanics:**
```
1. Rock sits idle in solid dirt (supported by dirt below it)
2. Player digs the tile DIRECTLY BENEATH the rock
3. Rock begins to "jitter" / vibrate (short delay — ~0.5 seconds)
4. After jitter delay, player moves away → rock FALLS
   OR player stays directly underneath → rock is held in place (player "holding" it)
5. Rock falls at high speed, passing through cleared tunnels
6. Rock destroys any enemy it contacts during fall
7. Rock SHATTERS and disappears when it hits solid ground or the bottom of the screen
```

**Key rules:**
- Dig Dug can be directly beneath a rock indefinitely — it will not fall while he occupies that tile.
- However, if a rock is in a **horizontal** tunnel (to the side of Dig Dug), it WILL fall and crush him if he moves under it.
- Rocks can break through a single-tile-thick dirt wall if falling, continuing their path.
- After any two rocks are dropped in a round, a **bonus vegetable** spawns at center stage.

> ✅ **CHECK — Rock Hold Logic:** Implement `rock.isHeld = (digDugPosition.col === rock.col && digDugPosition.row === rock.row - 1)`. When `isHeld === true`, cancel fall. When player moves away, start `jitterTimer`. After `JITTER_DURATION_MS`, set `rock.falling = true`. Verify the rock does not fall while directly held, but does fall the instant Dig Dug steps left or right.

> ✅ **CHECK — Rock Crush Player:** During rock fall, check collision against Dig Dug's position each frame. If hit, trigger `player.die()`. This means the player CAN die from their own rocks — test this edge case explicitly.

**Rock crush scoring (number of enemies hit by one rock):**

| Enemies Crushed | Points |
|----------------|--------|
| 1 | 1,000 |
| 2 | 2,500 |
| 3 | 4,000 |
| 4 | 6,000 |
| 5 | 8,000 |
| 6 | 10,000 |
| 7 | 12,000 |
| 8 | 15,000 |

The point multiplier is not linear — it jumps sharply. Crushing 4+ enemies with a single rock is a major scoring opportunity.

### 3.4 Bonus Vegetables

- Triggered when **any two rocks** are dropped in a single round (regardless of whether they crush enemies).
- Only **one vegetable spawns per round**.
- The vegetable appears at the **center starting position** of the stage (where Dig Dug begins each round).
- Player has approximately **10 seconds** to touch it before it disappears.
- Vegetable type depends on the current round number (see full table in Section 5).

> ✅ **CHECK — Vegetable Trigger:** Maintain a `rocksDroppedThisRound` counter. When it reaches 2, spawn the vegetable at the stage center. Ensure only one vegetable spawns regardless of additional rocks dropped. Reset counter at round start.

### 3.5 Last Enemy Escape

- When only **one enemy remains** on the screen, it becomes the "last enemy" and attempts to escape.
- Escape path: the enemy travels **straight up** through any solid dirt tiles (as a ghost), surfaces at the top, then walks toward the **left edge** of the screen.
- Once off the left edge, the enemy is gone. The round still ends — there is no penalty beyond losing potential points.
- Exception: in **higher rounds**, if the remaining enemy is a **Fygar**, it switches to **pursuit mode** — instead of fleeing, it aggressively chases Dig Dug.

> ✅ **CHECK — Last Enemy State:** When `enemiesRemaining === 1`, call `enemy.becomeLastEnemy()`. This sets `enemy.fleeMode = true` (or for Fygar in later rounds, `enemy.pursuitMode = true`). In flee mode: pathfind straight up through tiles to the sky, then traverse left. Verify this movement bypasses normal tunnel/dirt rules.

---

## 4. Enemy Specifications

> **Implementation pattern:** Both enemies share a base `Enemy` class with: `state` (normal | ghosting | inflating | deflating | fleeing | dead), `inflationStage` (0–3), `deflateTimer`, `ghostTimer`, `position`, `facingDirection`, `currentFrame`, `speed`, and `layerIndex`.

---

### 4.1 Pooka

**First Appears:** Round 1 (3 Pookas, 1 Fygar at start)
**Role:** Basic enemy; establishes the core pump-and-pop loop. Attacks by contact only.

#### Behavior

- Walks through existing tunnels toward Dig Dug.
- When it cannot reach Dig Dug via cleared tunnels, it occasionally **phases through solid dirt** as a ghost.
- Ghost mode: appears as only **floating goggles** / eyes drifting through the dirt; cannot be attacked in this state.
- Returns to solid form when it enters a cleared tunnel or reaches its target.
- Does NOT attack — it simply tries to touch Dig Dug for a kill.
- Speed increases as the round number increases.

#### Ghost Mode (Phasing)

```
Normal Pooka in tunnel
  ↓ (cannot find path to Dig Dug after ~2 seconds)
Ghost mode triggered → appears as floating eyes
  ↓ (travels diagonally and through solid tiles, slower)
Reaches cleared tunnel → snaps back to solid form
  ↓ (resumes walking toward Dig Dug at normal speed)
```

- Pookas in ghost form are **invulnerable** — pump does not connect; they pass through rocks.
- They can only reappear as solid in a **cleared tile**, never mid-solid-dirt.

> ✅ **CHECK — Ghost Invulnerability:** In `enemy.state === 'ghosting'`, the pump raycast and rock collision checks should both return early without effect. Verify a Pooka mid-ghost cannot be latched by the pump.

#### ASCII Sprite Design

The Pooka is a small, round, red/orange ball with large **yellow goggles** and stubby arms. It is compact and spherical.

```
// Pooka Walk Frame 0 (10x8). P=body (red/orange), G=goggle (yellow), E=eye (black), A=arm
const POOKA_WALK_0: string[] = [
  '  PPPPPP  ',
  ' PGGPPGGP ',  // G = goggle frames (yellow)
  ' PGEPEGGP ',  // E = eye pupils (black)
  ' PPPPPPPP ',
  '  PPPPPP  ',
  ' AP    PA ',  // A = arm stubs
  '          ',
  '          ',
];

const POOKA_WALK_1: string[] = [
  '  PPPPPP  ',
  ' PGGPPGGP ',
  ' PGEPEGGP ',
  ' PPPPPPPP ',
  '  PPPPPP  ',
  '  AP  PA  ',
  '          ',
  '          ',
];

// Ghost form — only goggles visible, faint outline
const POOKA_GHOST: string[] = [
  '          ',
  '   GGGG   ',
  '  GEGEG   ',  // just the goggles floating
  '   GGGG   ',
  '          ',
  '          ',
  '          ',
  '          ',
];

// Being inflated — body stretches/puffs outward
const POOKA_INFLATE_1: string[] = [
  ' PPPPPPPP ',
  'PGGPPPPGGP',
  'PGEPEGGEP ',
  'PPPPPPPPPP',
  ' PPPPPPPP ',
  '  AP  PA  ',
  '          ',
  '          ',
];

const POOKA_INFLATE_2: string[] = [
  'PPPPPPPPPP',
  'PGGPPPPGGP',
  'PGEPEGEEP ',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  ' AP    PA ',
  '          ',
  '          ',
];

// Pop — brief burst frame before disappearing
const POOKA_POP: string[] = [
  ' P  PP  P ',
  'P  PPPP  P',
  '  P    P  ',
  ' P      P ',
  '  P    P  ',
  'P  PPPP  P',
  ' P  PP  P ',
  '          ',
];
```

**TX keys:** `pookaWalk0`, `pookaWalk1`, `pookaGhost`, `pookaInflate1`, `pookaInflate2`, `pookaPop`
**Animation:** Alternate `pookaWalk0` ↔ `pookaWalk1` at ~180ms per frame. Show ghost sprite when `state === 'ghosting'`. Advance inflation frames on each pump press.

> ✅ **CHECK — Inflate Animation Sync:** `inflationStage` (0, 1, 2, 3) should map to sprites: 0=`pookaWalk`, 1=`pookaInflate1`, 2=`pookaInflate2`, 3=`pookaPop`+die. Verify the sprite updates immediately on each pump press, not with a delay.

---

### 4.2 Fygar

**First Appears:** Round 1 (1 Fygar alongside 3 Pookas)
**Role:** Advanced enemy; introduces the fire attack mechanic. Worth more points than Pooka when killed horizontally.

#### Behavior

- Moves like a Pooka — walks through tunnels, phases through solid dirt as a ghost.
- Has an additional **fire breath** attack:
  - Fygar **stops**, faces horizontally (left or right), and exhales a burst of flame.
  - Fire travels horizontally, 2–3 tiles in length.
  - Fire can penetrate a single-tile-thick wall of dirt to hit Dig Dug on the other side.
  - Fygar can ONLY fire **horizontally** — never up or down.
  - After firing, there is a short cooldown before it can fire again.
- Fygar's ghost form works identically to Pooka's.
- In later rounds (when acting as the last enemy), Fygar switches to **pursuit mode** (chases Dig Dug) rather than fleeing.

#### Fire Breath Sequence

```
Fygar detects Dig Dug within horizontal range (same row, within 3–4 tiles)
  ↓
Fygar STOPS movement, faces toward Dig Dug
  ↓
Fire charge-up animation (1 frame)
  ↓
Fire projectile EMITTED — travels horizontally
  ↓ (if not blocked by 2+ tiles of solid dirt)
Fire active for ~0.5 seconds, then extinguishes
  ↓
Cooldown before next fire (~2–3 seconds)
  ↓
Resume normal movement
```

> ✅ **CHECK — Fire Horizontal Only:** Fygar's `attemptFire()` method should check if `digDug.row === fygar.row` (same horizontal layer). Only fire when this condition is met. Firing up or down should never occur. Test: place Fygar directly below Dig Dug — no fire should trigger.

> ✅ **CHECK — Fire Through Thin Wall:** Fire hitbox raycast should pass through exactly 1 solid tile before being blocked. Test case: Dig Dug on other side of one-tile-thick wall should be hit. Two solid tiles between them = no hit.

#### ASCII Sprite Design

Fygar is a small green dragon with stubby legs, an angular snout/jaw, small wings, and a fierce expression. It is slightly wider than Pooka and more elongated.

```
// Fygar Walk Frame 0 (12x8). F=body (green), E=eye (red), W=wing, J=jaw, S=spine/ridge
const FYGAR_WALK_0: string[] = [
  '  SFFFFF    ',  // S = spine ridge (darker green)
  ' FFEFFFFF   ',  // E = eye
  'JJFFFFFFFFW ',  // J = jaw left, W = wing nub
  'JFFFFFFFFFWW',
  ' FFFFFFFFFFF',
  '  FF  FF    ',  // stubby legs
  '            ',
  '            ',
];

const FYGAR_WALK_1: string[] = [
  '  SFFFFF    ',
  ' FFEFFFFF   ',
  'JJFFFFFFFFW ',
  'JFFFFFFFFFWW',
  ' FFFFFFFFFFF',
  '   FF FF    ',
  '            ',
  '            ',
];

// Fire breath — flame extends from Fygar's mouth
const FYGAR_FIRE: string[] = [
  '  SFFFFF    ',
  ' FFEFFFFF   ',
  'OOFFFFFFFFW ',  // O = fire coming from mouth (orange/yellow)
  'OOFFFFFFFWWW',
  'OOOFFFFFFFF ',
  '  FF  FF    ',
  '            ',
  '            ',
];

// Fire projectile tile (separate entity, animated)
const FIRE_FRAME_0: string[] = [
  '    ',
  ' OO ',  // O = fire (orange)
  'OOOO',
  ' OO ',
  '    ',
];

const FIRE_FRAME_1: string[] = [
  ' YY ',  // Y = fire (yellow core)
  'YOOY',
  'OOOO',
  'YOOY',
  ' YY ',
];

// Ghost form (same as Pooka — just floating eyes/silhouette)
const FYGAR_GHOST: string[] = [
  '          ',
  '   FFFF   ',
  '  FEFFFF  ',  // E = eye only
  '   FFFF   ',
  '          ',
  '          ',
  '          ',
  '          ',
];

// Inflate stages
const FYGAR_INFLATE_1: string[] = [
  '  SFFFFFFF  ',
  ' FFEFFFFFF  ',
  'JJFFFFFFFFFWW',
  'JFFFFFFFFFFWW',
  ' FFFFFFFFFFF',
  '  FF    FF  ',
  '            ',
  '            ',
];

const FYGAR_INFLATE_2: string[] = [
  ' SFFFFFFFFF ',
  'FFFEFFFFFFF ',
  'JJFFFFFFFFWWW',
  'JFFFFFFFFFWWW',
  'FFFFFFFFFFFF',
  ' FF      FF ',
  '            ',
  '            ',
];

const FYGAR_POP: string[] = [
  'F  FF  F    ',
  'F FFFF F    ',
  ' F    F     ',
  'F      F    ',
  ' F    F     ',
  'F  FF  F    ',
  '            ',
  '            ',
];
```

**TX keys:** `fygarWalk0`, `fygarWalk1`, `fygarFire`, `fygarGhost`, `fygarInflate1`, `fygarInflate2`, `fygarPop`, `firePuff0`, `firePuff1`
**Animation:** Walk frames at ~160ms. Fire animation on `firePuff0`/`firePuff1` alternating at ~80ms. Fire entity is a separate sprite entity spawned in front of Fygar.

> ✅ **CHECK — Fire Entity Lifecycle:** When Fygar fires, spawn a `FireProjectile` entity at Fygar's tile position, moving horizontally at `FIRE_SPEED`. The fire entity should be destroyed after `FIRE_DURATION_MS` OR when it collides with 2+ tiles of solid dirt. Fire collision with player = `player.die()`.

---

## 5. Scoring System

### 5.1 Inflation Kill Points (by layer + direction)

The playfield's 4 color layers determine base kill value. Deeper = more points.

| Layer | Pooka (any direction) | Fygar (vertical) | Fygar (horizontal) |
|-------|-----------------------|------------------|--------------------|
| Layer 1 (top) | 200 | 200 | 400 |
| Layer 2 | 300 | 300 | 600 |
| Layer 3 | 400 | 400 | 800 |
| Layer 4 (bottom) | 500 | 500 | 1,000 |

- **Fygar horizontal bonus:** killing a Fygar by pumping while facing left or right (approaching it from the side) doubles the base value. This is because horizontal approach means you're in Fygar's fire line — higher risk, higher reward.
- Pooka has no directional modifier.

### 5.2 Rock Crush Points

| Enemies Crushed (one rock) | Points |
|---------------------------|--------|
| 1 | 1,000 |
| 2 | 2,500 |
| 3 | 4,000 |
| 4 | 6,000 |
| 5 | 8,000 |
| 6 | 10,000 |
| 7 | 12,000 |
| 8 | 15,000 |

> ✅ **CHECK — Rock Kill Counter:** When a rock begins falling, track `enemiesHitByThisRock = 0`. Each collision with an enemy during the fall increments the counter and kills the enemy. When the rock lands (stops), look up `ROCK_POINTS[enemiesHitByThisRock]` and award those points in one batch.

### 5.3 Digging Points

- Each tile of dirt Dig Dug clears = **10 points**
- These are minor bonus points; do not impact strategy significantly

### 5.4 Bonus Vegetable Points (by Round)

| Vegetable | Rounds | Points |
|-----------|--------|--------|
| Carrot | 1 | 400 |
| Turnip | 2 | 600 |
| Mushroom | 3 | 800 |
| Pickle | 4 | 1,000 |
| Eggplant | 5 | 2,000 |
| Bell Pepper | 6 | 3,000 |
| Tomato | 7 | 4,000 |
| Garlic | 8 | 5,000 |
| Watermelon | 9 | 6,000 |
| Galaxian Logo | 10–16 | 7,000 |
| Pineapple | 17+ | 8,000 |

- Vegetable appears at center for approximately **10 seconds** before disappearing.

> ✅ **CHECK — Vegetable Lookup:** Store `VEGETABLE_TABLE[roundNumber]` mapping each round to a vegetable type + point value. For rounds beyond 17, always use Pineapple (8,000). Verify the vegetable appears at the exact center tile of the stage, not a random position.

---

## 6. TX (Texture Key) Registry

Complete texture key registry. Every key must have a registered sprite definition; a missing key should throw at init time.

```typescript
export const TX = {
  // Player
  digdugWalk0:      'dd-player-0',
  digdugWalk1:      'dd-player-1',
  digdugDig0:       'dd-player-dig-0',    // digging animation frame
  digdugDig1:       'dd-player-dig-1',
  digdugPump:       'dd-player-pump',     // pump extended
  digdugDead0:      'dd-player-dead-0',   // death animation
  digdugDead1:      'dd-player-dead-1',

  // Pooka
  pookaWalk0:       'dd-pooka-0',
  pookaWalk1:       'dd-pooka-1',
  pookaGhost:       'dd-pooka-ghost',
  pookaInflate1:    'dd-pooka-inflate-1',
  pookaInflate2:    'dd-pooka-inflate-2',
  pookaPop:         'dd-pooka-pop',

  // Fygar
  fygarWalk0:       'dd-fygar-0',
  fygarWalk1:       'dd-fygar-1',
  fygarFire:        'dd-fygar-fire',      // Fygar with mouth open
  fygarGhost:       'dd-fygar-ghost',
  fygarInflate1:    'dd-fygar-inflate-1',
  fygarInflate2:    'dd-fygar-inflate-2',
  fygarPop:         'dd-fygar-pop',

  // Fire projectile (standalone entity)
  firePuff0:        'dd-fire-0',
  firePuff1:        'dd-fire-1',

  // Rock
  rock:             'dd-rock',
  rockFall:         'dd-rock-fall',       // optional blur/motion frame
  rockShatter:      'dd-rock-shatter',    // brief burst on impact

  // Environment
  dirtLayer1:       'dd-dirt-1',          // lightest layer tile
  dirtLayer2:       'dd-dirt-2',
  dirtLayer3:       'dd-dirt-3',
  dirtLayer4:       'dd-dirt-4',          // darkest layer tile
  dirtCleared:      'dd-dirt-cleared',    // empty/black tile
  sky:              'dd-sky',

  // Pump hose (connector line from Dig Dug to enemy)
  pumpHose:         'dd-pump-hose',

  // Vegetables
  vegCarrot:        'dd-veg-carrot',
  vegTurnip:        'dd-veg-turnip',
  vegMushroom:      'dd-veg-mushroom',
  vegPickle:        'dd-veg-pickle',
  vegEggplant:      'dd-veg-eggplant',
  vegBellPepper:    'dd-veg-bellpepper',
  vegTomato:        'dd-veg-tomato',
  vegGarlic:        'dd-veg-garlic',
  vegWatermelon:    'dd-veg-watermelon',
  vegGalaxian:      'dd-veg-galaxian',    // special bonus item
  vegPineapple:     'dd-veg-pineapple',

  // UI
  flowerIndicator:  'dd-flower',          // round counter indicator (1 flower per round)
} as const;

export type TXKey = keyof typeof TX;
```

---

## 7. Round Progression

### 7.1 Enemy Composition by Round

Round 1 starts with 4 enemies total: 3 Pookas + 1 Fygar, and 3 rocks.

```
Round 1:  3 Pookas + 1 Fygar,  3 rocks
Round 2:  3 Pookas + 2 Fygars, 3 rocks
Round 3:  2 Pookas + 3 Fygars, 3 rocks
Round 4+: Mixed compositions; enemy count may increase; speeds increase
```

In general, the Fygar-to-Pooka ratio increases as rounds progress. By later rounds the enemy set may be all Fygars, and the fire + pursuit behavior makes survival extremely difficult.

### 7.2 Difficulty Scaling

Each round increases enemy speed slightly. There is no published exact formula, but the practical effect:

| Round Range | Enemy Speed | Fygar Behavior |
|-------------|------------|----------------|
| 1–4 | Slow | Fire only when Dig Dug is nearby |
| 5–8 | Medium | Fire more frequently |
| 9–15 | Fast | Fire aggressively; ghost phase more often |
| 16+ | Very fast | Last Fygar pursues instead of fleeing |

### 7.3 Round Indicator (Flowers)

- The number of flowers displayed in the top-right of the screen = the current round number.
- Round 1 = 1 flower, Round 5 = 5 flowers, etc.
- After Round 8+, the display can no longer show all flowers; flowers are compressed or symbolized.

### 7.4 Kill Screen

- At Round 256, an 8-bit integer overflow causes the game to load Round 0.
- Round 0 generation misbehaves and spawns a Pooka on top of Dig Dug at the start position.
- Since Dig Dug starts at that position, instant death occurs repeatedly until all lives are gone.
- This is the canonical end of the game in the original arcade version.

> ✅ **CHECK — Round Counter Overflow:** Cap the round counter at 255 (or handle overflow gracefully). For a browser clone, choose one of: (a) implement the authentic kill screen at round 256, or (b) loop back to round 1 with max speed as an "infinite" mode. Document the chosen behavior clearly in constants.

---

## 8. Enemy AI Detail

### 8.1 Normal Movement (Both Enemies)

```
1. Pathfind through cleared tunnels toward Dig Dug
2. If no viable tunnel path exists within ~2 seconds of attempts:
   → Trigger ghost mode
3. Ghost mode: move toward Dig Dug's position via direct path (diagonals allowed)
   → Re-solidify when entering a cleared tile
4. If direct path is a cleared tunnel, skip ghost mode and just walk
```

**Tunnel pathfinding:** A simple BFS or flood-fill through the `dirtGrid` cleared tiles is sufficient. Enemies do not need A* — they just need to find Dig Dug via walkable tiles and take the shortest available route.

### 8.2 Ghost Mode Details

- Ghost mode activation: enemy has been unable to reach Dig Dug through tunnels for a threshold time.
- Ghost movement: travels toward Dig Dug directly, passing through solid tiles.
- Ghost speed: slightly **slower** than tunnel walk speed.
- Ghost visuals: only eyes/goggles visible; body faded or invisible.
- Ghost vulnerability: **none** — pump and rocks have no effect.
- Re-solidification: the moment the ghost's center reaches a cleared tile, it snaps back to solid form.
- Ghost can only re-solidify in a cleared tile or the sky row. Never mid-solid-dirt.

> ✅ **CHECK — Ghost Re-solidify:** On each frame during ghost mode, check if `dirtGrid[enemy.row][enemy.col] === false` (cleared). If so, call `enemy.solidify()` immediately. Verify the visual instantly switches from ghost to solid sprite on that same frame.

### 8.3 Fygar Fire AI

```
Each frame Fygar is in normal (non-ghost) state:
  1. Check if Dig Dug is on same row (same Y tile)
  2. Check if Dig Dug is within FIRE_RANGE tiles horizontally
  3. Check if fewer than 2 solid dirt tiles block the line of sight
  4. If all conditions met AND cooldown expired:
     → Trigger fire sequence
```

`FIRE_RANGE` = approximately 3–4 tiles. In practice, Fygar can fire just slightly farther than Dig Dug's pump range, making the horizontal approach high-risk.

### 8.4 Last Enemy Behavior

```
if (enemiesAlive === 1) {
  enemy.isLastEnemy = true;
  
  if (enemy.type === 'Pooka' || (enemy.type === 'Fygar' && round < PURSUIT_THRESHOLD)) {
    // Flee mode
    enemy.moveDirectlyUp();          // ghost-phase upward through dirt
    enemy.traverseLeftOnSurface();   // walk left along sky row until off screen
  } else if (enemy.type === 'Fygar' && round >= PURSUIT_THRESHOLD) {
    // Pursuit mode
    enemy.setTarget(digDug.position);  // actively chase Dig Dug
    enemy.fireMoreFrequently = true;
  }
}
```

`PURSUIT_THRESHOLD` ≈ round 9–12 (tunable). Higher rounds = Fygar always pursues.

---

## 9. Dig Dug Player Sprite Design

Dig Dug (Taizo Hori) is a small figure in a **white jumpsuit with blue trim** and a distinctive red drill/spade cap.

```
// Dig Dug Walk Frame 0 (10x12). W=white suit, B=blue trim, H=head (skin), C=cap (red), T=tool
const DIGDUG_WALK_0: string[] = [
  '  CCCCC   ',  // C = red cap
  '  CHHCC   ',  // H = skin/face
  ' BWWWWWB  ',  // B = blue trim at shoulders
  ' WWWWWWW  ',  // W = white suit
  ' WWWWWWW  ',
  ' BWWWWWB  ',  // B = blue waist trim
  '  WW WW   ',  // legs split
  '  BW BW   ',  // B = blue boot tops
  '  WW WW   ',
  '          ',
  '          ',
  '          ',
];

const DIGDUG_WALK_1: string[] = [
  '  CCCCC   ',
  '  CHHCC   ',
  ' BWWWWWB  ',
  ' WWWWWWW  ',
  ' WWWWWWW  ',
  ' BWWWWWB  ',
  '  WW WW   ',
  '  WB WB   ',
  '   W  W   ',
  '          ',
  '          ',
  '          ',
];

// Digging — body leans forward, arms extended with drill
const DIGDUG_DIG_0: string[] = [
  '   CCCC   ',
  '  CHWWCC  ',
  ' BWWWWWWB ',
  'TWWWWWWWWW',  // T = drill tip
  ' BWWWWWB  ',
  '  WW WW   ',
  '  BW BW   ',
  '          ',
  '          ',
  '          ',
  '          ',
  '          ',
];

// Pump extended (pump nozzle shoots forward)
const DIGDUG_PUMP: string[] = [
  '  CCCCC   ',
  '  CHHCC   ',
  ' BWWWWWB  ',
  'PPPWWWWWW ',  // P = pump nozzle
  ' WWWWWWW  ',
  ' BWWWWWB  ',
  '  WW WW   ',
  '  BW BW   ',
  '          ',
  '          ',
  '          ',
  '          ',
];
```

**TX keys:** `digdugWalk0`, `digdugWalk1`, `digdugDig0`, `digdugDig1`, `digdugPump`
**Animation:** Alternate walk frames at ~150ms. Show dig frames when moving through solid tiles. Show pump frame when pump button held.

---

## 10. Physics & Constants

```typescript
export const GAME = {
  // Playfield
  tileSize:             8,        // px per tile
  tilesWide:            28,       // 224px / 8px
  tilesHigh:            31,       // 248px / 8px
  skyRows:              2,        // top rows are open sky
  soilLayers:           4,        // dirt divided into 4 scoring layers

  // Player speeds (tiles per second)
  playerSpeedDig:       4.0,      // speed when cutting through solid dirt
  playerSpeedWalk:      7.0,      // speed in cleared tunnels / sky
  
  // Rock mechanics
  rockFallSpeed:        12.0,     // tiles per second during fall
  rockJitterDurationMs: 500,      // delay before rock falls after digging below it

  // Pump mechanics
  pumpRange:            1,        // tiles: pump can hit enemy 1 tile ahead
  pumpThinWallPenetrate:true,     // pump passes through 1 solid tile
  inflationPressesMax:  3,        // presses to pop an enemy
  deflateGraceMs:       800,      // time before enemy starts deflating after pump disconnects
  deflateRateMs:        2000,     // total time to fully deflate from max inflation

  // Enemy AI
  ghostTriggerDelayMs:  2000,     // time enemy searches tunnel before ghosting
  ghostSpeed:           4.5,      // tiles per second in ghost mode (slower than walk)
  
  // Fygar fire
  fygarFireRange:       3,        // tiles horizontal range for fire trigger
  fygarFireDurationMs:  500,      // how long fire is active
  fygarFireCooldownMs:  2500,     // time between fire attempts
  
  // Last enemy
  lastEnemyPursuitRound: 9,       // round at which Fygar pursues instead of flees

  // Vegetable
  vegetableDurationMs:  10000,    // 10 seconds before vegetable disappears

  // Scoring
  dirtDigPoints:        10,
} as const;
```

> ✅ **CHECK — Physics Feel:** Dig Dug should visibly move ~1.7× faster in a cleared tunnel than when digging a new path. A full diagonal ghost path from bottom-right to top-left should take approximately 3–4 seconds. A rock dropped from layer 1 should reach the bottom of the screen in approximately 0.5 seconds.

---

## 11. LLM Self-Verification Checklist

Before considering any implementation phase complete, Claude Code should run through this checklist:

### Phase 1: Core Movement
- [ ] Dig Dug moves on a tile grid — no diagonal movement, 90-degree turns only
- [ ] Speed is lower when digging through solid tiles vs. traversing cleared tiles
- [ ] Turning only happens at tile boundaries (no mid-tile turns)
- [ ] Hard screen edges — Dig Dug cannot leave the playfield
- [ ] Cleared tiles persist for the entire round and reset at round start
- [ ] `dirtGrid[row][col]` correctly set to `false` as Dig Dug passes through each tile

### Phase 2: Pump Weapon
- [ ] Pump fires in Dig Dug's facing direction
- [ ] Pump latches onto enemy within 1 tile (or through 1 solid tile)
- [ ] Each pump press increments `inflationStage`
- [ ] At `inflationStage === 3`, enemy dies (pop)
- [ ] Moving away disconnects pump → enemy begins deflating
- [ ] Partially-inflated/deflating enemy is safe to walk through
- [ ] Two enemies can be alternately stalled independently

### Phase 3: Rocks
- [ ] Rock does NOT fall while Dig Dug occupies tile directly below it
- [ ] Rock falls after Dig Dug moves away and jitter delay expires
- [ ] Rock can crush Dig Dug (player's own rock is lethal)
- [ ] Rock crushes all enemies in vertical path
- [ ] Crush scoring uses correct multi-enemy table
- [ ] After any 2 rocks dropped, one vegetable spawns at center
- [ ] Only one vegetable per round regardless of additional rocks

### Phase 4: Enemy AI
- [ ] Pookas and Fygars pathfind through cleared tunnels toward Dig Dug
- [ ] Ghost mode triggers when no path found after threshold time
- [ ] Ghost is invulnerable to pump and rocks
- [ ] Ghost re-solidifies only in cleared tiles
- [ ] Fygar fires only horizontally, only when same row, only within fire range
- [ ] Fire passes through 1 solid tile but is blocked by 2+
- [ ] Last enemy flees (or pursues for Fygar in later rounds)

### Phase 5: Scoring
- [ ] Inflation kill points use correct layer × direction table
- [ ] Rock crush points use correct multi-enemy table
- [ ] Digging yields 10 pts per tile
- [ ] Vegetable points match round number from table
- [ ] Round counter increments correctly

### Phase 6: Rendering
- [ ] All TX keys have registered sprite definitions — missing key throws at init
- [ ] Sprites mirror correctly based on facing direction
- [ ] Ghost sprites use goggle-only or faded representation
- [ ] Inflate stages display in correct order on pump press
- [ ] Layer dirt tiles render with distinct colors per layer
- [ ] Cleared tiles render as black/empty
- [ ] Pump hose renders as a line/connector between Dig Dug and latched enemy

---

## 12. Reference Sources

- Wikipedia — *Dig Dug* (1982): core mechanics, screen dimensions, enemy behaviors, round progression, kill screen
- Pookapedia / Dig Dug Fandom Wiki — enemy types, scoring table, vegetable table
- StrategyWiki — *Dig Dug/Gameplay*: detailed pump mechanics, ghost behavior, rock rules, layer scoring
- GameFAQs / RetroGaming community — pump stall strategy, fire penetration behavior, last enemy rules
- Data Driven Gamer blog — depth-based scoring confirmation, vegetable trigger rules
- PlayCanvas Forum / MonoGame Community — tile-based grid implementation notes for the dig mechanic
