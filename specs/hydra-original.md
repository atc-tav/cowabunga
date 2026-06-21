# HYDRA (2026, Original) — Game Design Specification

> **Build target:** Browser-based original game using Phaser 3 + TypeScript; all
> sprites drawn programmatically from ASCII grids via `drawPixelArt()`; sound
> procedural (deferred per `CLAUDE.md`).
> **Source / canon:** Original game — there is no original to clone. Influences:
> classic *Snake* (the snake's own behavior) and twin-stick / fixed shooters
> (the player). Where this spec and any future build differ, this spec is the
> design target.
> **Working title:** "HYDRA" is a placeholder (chosen because a snake cut into a
> long-enough piece spawns a *new* snake — it multiplies when struck). Rename
> freely; it changes nothing below.
> **Scope (v1):** Single playfield, endless score-attack. Full game.
> **LLM verification notes** appear throughout as `> ✅ CHECK:` callouts — use
> them to validate your implementation at each step.

---

## 1. Game Overview

- **Genre:** Single-screen grid arena shooter with an AI antagonist that is
  literally playing *Snake*.
- **Setting:** A neon grid arena. A serpent forages for pellets, growing as it
  eats; you pilot a small ship hunting it.
- **The hook (role inversion):** *Snake* is the game you think you're playing —
  but you're not the snake. The snake is an AI quietly playing classic Snake.
  You're the predator interrupting it. A short, harmless **smoke trail** behind
  your ship (max 5 tiles) seeds the familiar Snake feel before you realize you're
  hunting one.
- **Core loop:** Hunt the snake → shoot its head (HP) or sever its tail
  (length) → manage the venom it spits when it spots you → deny or exploit its
  pellets → survive escalating chaos as severed pieces and new snakes appear →
  rack up score.
- **Win condition:** None — **endless score-attack.** Play until out of lives.
- **Lose condition:** Lives reach 0. A life is lost to BLACK venom, or to the
  snake's head/body touching you (especially while paralyzed).
- **Lives:** 3. Extra life at 10,000 pts.
- **Screen:** Portrait, 224×288 logical px, 8px tiles → 28×36 grid (top 2 rows
  are HUD).
- **Modes:** Single mode for v1 (difficulty ramps over time).

> ✅ **CHECK — Role legibility:** On first spawn, before the player fires a shot,
> the snake should already be foraging pellets on its own (visibly playing
> Snake) and ignore the player until provoked. Verify the snake takes at least
> one pellet unprompted if the player stays outside its awareness radius.

---

## 2. Playfield Architecture

### 2.1 Dimensions

| Element | Value |
|---------|-------|
| Logical width | 224 px |
| Logical height | 288 px |
| Tile size | 8 px |
| Grid columns | 28 |
| Grid rows | 36 |
| HUD band | Top 2 rows (rows 0–1), 16 px |
| Play area | Rows 2–35, cols 0–27 |
| Arena edges | Hard walls (no wrap) — see §3.5 |

### 2.2 Layout

```
┌────────────────────────────┐
│ SCORE 000000   LIVES ♦ ♦ ♦ │  ← HUD band (rows 0–1)
├────────────────────────────┤
│  ·          ●              │  ← play area; · pellets, ● snake head
│      ███████                │    ███ = snake body
│     █                       │
│            ▲  (you)         │  ← ▲ = player ship, with a short smoke trail
│         ~~~                 │    ~~~ = smoke trail (cosmetic, ≤5 tiles)
│                            │
└────────────────────────────┘
```

- All four arena edges are solid walls. Neither ship nor snake wraps.
- The HUD band is not part of the playfield grid — nothing moves into it.

> ✅ **CHECK — Grid containment:** Every moving entity's tile coords stay within
> `cols [0,27]`, `rows [2,35]`. Assert no entity ever occupies a HUD row or a
> coordinate outside the arena.

---

## 3. Core Gameplay Mechanics

### 3.1 The grid model (the load-bearing decision)

Both the **player ship** and the **snake** live on the same tile grid and move
**4-directionally** (up/down/left/right), one tile per movement tick. This is
what makes every downstream rule unambiguous: "the tiles directly in front of
the snake," "shot from behind vs. from the side," and where a cut lands are all
defined by grid orientation.

- Each entity has a `facing` (one of 4 directions) and a discrete `tile` position.
- Movement is tick-based: an entity advances one tile every `STEP_MS` for its
  type. The player ticks faster than the snake's base rate (the player is more
  agile; the snake's threat is venom + length, not raw speed).

> ✅ **CHECK — Discrete movement:** Positions snap to tile centers between steps
> (render may interpolate for smoothness, but logic is per-tile). Verify no
> diagonal logical movement is possible.

### 3.2 Player ship — movement, facing, firing

| Property | Behavior |
|----------|----------|
| Movement | 4-dir, one tile per `PLAYER_STEP_MS`; direction set by held input |
| Facing | Equals last movement direction; **persists when stopped** |
| Firing | Fires a bullet in the current `facing` (works while stopped) |
| Range | Bullets travel up to `PLAYER_RANGE_TILES` then despawn |
| Fire cap | At most `MAX_BULLETS` player bullets on screen at once |
| Death | Snake head/body contact = lose a life; BLACK venom = lose a life |

**Facing persistence** is deliberate: a stationary player can still aim and
shoot the last-faced direction. This also defines aim under status effects (§3.6).

> ✅ **CHECK — Idle aim:** Stop the ship, release all movement keys, press fire —
> a bullet must leave in the direction the ship last faced. Verify firing does
> not require movement.

### 3.3 The smoke trail (familiarity device)

- The ship leaves a fading **smoke trail** of its last visited tiles.
- The trail is capped at `SMOKE_MAX_TILES` (5). The oldest tile drops as a new
  one is added.
- **Purely cosmetic:** the trail has no collision and no gameplay effect. It
  exists only to evoke the Snake feel.

> ✅ **CHECK — Trail cap & inertness:** Move continuously — the trail never
> exceeds 5 tiles. Drive the snake or a bullet through the trail — nothing
> happens. The trail must never be mistaken for a collidable body.

### 3.4 Pellets (the snake's food — and your tool)

- `PELLET_COUNT` pellets exist on the play area at once; eaten/destroyed pellets
  respawn at random free tiles after `PELLET_RESPAWN_MS`.
- **Snake eats a pellet:** snake length +1 (see §4), pellet respawns elsewhere.
- **Player shoots a pellet:** the pellet is **destroyed** (denying the snake that
  growth) **and** the snake is immediately **enraged** — it learns the pellet's
  position and chases the player at `ENRAGE_SPEED_MULT` for a random
  `EFFECT_MIN..EFFECT_MAX`. Risk/reward: stunt its growth, draw its aggro.

> ✅ **CHECK — Pellet denial + enrage:** Shoot a pellet — it disappears, the
> snake's `length` does not increase from it, and the snake enters enraged chase
> for a randomized duration. Verify the destroyed pellet later respawns so the
> board never runs dry.

### 3.5 Arena walls

- Walls block both entities. The **player** simply cannot move into a wall.
- The **snake** treats walls as obstacles to route around (it never dies on a
  wall in v1 — it is the antagonist, a competent forager). See §7.

### 3.6 Player status effects (from venom)

Venom hits apply one of three effects. **Effects are mutually exclusive** — a new
effect replaces any active one and refreshes its timer. Durations are a random
`EFFECT_MIN..EFFECT_MAX` (0.9–2.1 s) unless noted.

| Venom | Weight | Effect |
|-------|--------|--------|
| **GREEN** — paralyzing goop | 60% | Player frozen (cannot move). Facing/aim retained, but movement disabled. This is the snake's window to reach and eat you. |
| **RED** — insanity | 30% | Player moves at `INSANITY_SPEED_MULT` (2×) and **inverts** input: pressing a direction moves the opposite way. Firing still uses actual facing. |
| **BLACK** — death poison | 10% | Player immediately loses a life (no duration). |

> ✅ **CHECK — Venom distribution:** Over a large sample, venom types resolve to
> ≈60/30/10. Implement as a single weighted roll. Verify the three weights sum
> to exactly 1.0.

> ✅ **CHECK — Effect exclusivity:** Apply GREEN, then RED before GREEN expires —
> the player must be insane (not paralyzed), with the timer reset. Only one
> effect is ever active.

> ✅ **CHECK — Paralysis is lethal bait:** While GREEN-paralyzed, if the snake
> head reaches the player's tile, the player dies. Verify paralysis genuinely
> exposes the player to being eaten.

---

## 4. The Snake (Entities)

> **Implementation pattern:** A `Snake` has: `segments` (ordered tiles, head
> first), `facing`, `hp`, `length` (= `segments.length`), `state`
> (`forage | chase | enraged | severed`), `stepMs`, `venomCooldownMs`, and
> `awarenessRadius` (derived). Multiple `Snake` instances can coexist (§4.4).

### 4.1 Length, HP, and what "kill" means

The snake has **two layered health systems**:

- **Head HP (`hp`)** — the actual kill. Direct hits to the head reduce HP; at 0
  the snake dies. HP does not regenerate.
- **Length (`length`)** — the snake's *power*, not its life. Length grows by
  eating pellets and drives the awareness radius (§4.2) and venom reach. Length
  is reduced by severing the tail (§5). A snake at length 1 is still alive if it
  has HP; it's just weak.

> ✅ **CHECK — Two systems:** Reduce a snake's length to 1 by tail shots — it is
> still alive (foraging to regrow) as long as `hp > 0`. Reduce `hp` to 0 by head
> shots — it dies regardless of length. Verify the two are independent.

### 4.2 Awareness radius (proximity sense)

- `awarenessRadius = max(AWARENESS_MIN, length * AWARENESS_FACTOR)` tiles
  (`AWARENESS_FACTOR = 0.5`). It **grows as the snake eats** — its own success
  sharpens its senses.
- Measured as Euclidean distance (in tiles) from the head to the player.
- **If the player is within the awareness radius**, the snake switches from
  `forage` to `chase`: it pathfinds toward the player instead of the nearest
  pellet.

> ✅ **CHECK — Awareness scales with length:** A length-4 snake's radius is ~2
> tiles; a length-12 snake's is ~6. Verify entering the radius flips the snake to
> `chase` and leaving it (for `LOSE_INTEREST_MS`) returns it to `forage`.

### 4.3 Line-of-sight venom (the ranged threat)

Independent of the awareness radius, the snake spits venom when it **sees** the
player straight ahead:

- "Sees" = the player occupies **any tile directly in front of the head**, along
  its current `facing`, within `VENOM_RANGE_TILES`.
- `VENOM_RANGE_TILES` is **shorter than the player's range** — it is
  `clamp(PLAYER_RANGE_TILES * 1/3 .. PLAYER_RANGE_TILES * 1/2)`. You out-range
  the snake head-on, so disciplined sniping from beyond venom reach is rewarded.
- On sight, and if `venomCooldownMs` has elapsed, the snake fires one venom
  projectile down its facing line; type is the weighted roll from §3.6.

> ✅ **CHECK — LOS gating:** Place the player one tile to the side of the snake's
> facing line — no venom. Place the player directly ahead within range — venom
> fires (subject to cooldown). Verify venom only travels straight along facing.

> ✅ **CHECK — Out-ranging:** With the snake facing the player, verify the player
> can sit at a distance > `VENOM_RANGE_TILES` but ≤ `PLAYER_RANGE_TILES` and land
> head shots without being hit by venom.

> **Open interpretation flag:** The brief said venom at "1/2 to 1/3 the player's
> shooting range." This spec reads that as **range** (distance), and adds a
> separate `VENOM_COOLDOWN_MS` for fire *rate*. If "rate" was meant instead, move
> the 1/3–1/2 factor onto the cooldown. Both are tunable (§13); confirm intent.

### 4.4 Player bullets vs. the snake

| Hit location | Effect |
|--------------|--------|
| **Head, direct** | −1 HP per hit. The snake can **dodge** if the shot enters its awareness radius (it may juke). At HP 0 → dies (§6 scoring). |
| **Pellet** | Pellet destroyed + snake enraged (§3.4). |
| **Tail, from directly behind** | The struck segment (and everything behind it) is removed cleanly — it simply disappears. Length drops accordingly. |
| **Tail, from the side (mid-body)** | A **cut** (§5): the struck segment is destroyed and the body splits; the rear portion becomes a severed piece with length-dependent behavior. |

> ✅ **CHECK — Dodge window:** Fire at the head from outside the awareness radius
> — it lands. Fire from inside the radius — the snake gets a chance to dodge
> (verify a dodge can cause a miss; it need not always succeed).

---

## 5. Severing the tail (the signature mechanic)

When a player bullet strikes a **body** segment (not the head):

- **From directly behind** (bullet travels along the snake's body axis, into the
  rear): the hit segment and all segments behind it are removed cleanly. No
  severed entity is created. Length drops.
- **From the side** (bullet crosses the body perpendicular to its local
  direction): a **cut**. The struck segment is destroyed; the snake keeps the
  front portion (head side); the **rear portion becomes a severed piece**. The
  main snake's length = front portion length.

The severed piece's fate depends on **its own length** at the moment of cutting:

| Severed length | Behavior |
|----------------|----------|
| 1 | Dies after `SEVER_1_MS` (2 s) |
| 2 | Dies after `SEVER_2_MS` (4 s) |
| 3 | Chases the player at 2× for `SEVER_3_MS` (6 s), then dies |
| ≥ main snake's current length | **Becomes a new snake** (full antagonist: forages, grows, spits venom) |

New snakes from cuts are subject to a global cap (§9) so the board stays
playable.

> ✅ **CHECK — Behind vs. side:** Shoot a straight horizontal snake from directly
> behind — the rear vanishes, no severed entity. Shoot the same snake from above
> mid-body — a cut occurs and a severed piece spawns. Verify the front portion
> remains attached to the head.

> ✅ **CHECK — Sever outcomes by length:** Construct cuts producing rear pieces of
> length 1, 2, 3, and ≥ main. Verify: 1→dies @2s, 2→dies @4s, 3→2× chase 6s then
> dies, ≥main→promotes to a full new `Snake` (counts against the cap).

> ✅ **CHECK — Length bookkeeping:** After any sever, `mainSnake.length` equals
> the front (head-side) segment count, and `mainSnake.hp` is unchanged (cutting
> never directly kills the head).

---

## 6. Scoring

| Action | Points |
|--------|--------|
| Direct head hit (per HP) | 25 |
| Tail segment removed (from behind) | 10 each |
| Cut a snake (the cut itself) | 50 |
| Kill a severed piece (1/2/3-length) | 50 |
| Pellet denied (shot) | 15 |
| Kill a snake (HP → 0) | 500 |
| Survival | 10 / second alive |
| Extra life | at 10,000 pts |

- Killing a snake that grew from a cut scores the same 500 (chaos is rewarded,
  not punished).

> ✅ **CHECK — Score events:** Each listed action emits its score exactly once.
> Verify a single head shot that takes the last HP awards both the 25 (the hit)
> and the 500 (the kill).

---

## 7. AI Patterns

### 7.1 Snake state machine

Use the shared `StateMachine` primitive. States: `forage`, `chase`, `enraged`,
`severed` (for promoted/severed entities the playable subset applies).

```
forage:
  target = nearest pellet
  step toward target along grid (4-dir), routing around walls and own body
  if player within awarenessRadius      -> chase
  if enrageTrigger (pellet shot)         -> enraged
  on each step: if player on facing line within VENOM_RANGE and cooldown ready
                -> spit venom (stay in forage)

chase:
  target = player tile
  step toward player (4-dir)
  spit venom on LOS as above
  if player outside awarenessRadius for LOSE_INTEREST_MS -> forage

enraged:
  target = player tile; stepMs *= 1/ENRAGE_SPEED_MULT (moves at 2x)
  duration = random EFFECT_MIN..EFFECT_MAX
  on expiry -> (player in radius ? chase : forage)
```

- **Pathfinding:** grid BFS/greedy step toward the target tile is sufficient —
  no A* needed. The snake avoids walls and its own body when choosing the next
  tile; if boxed in, it takes the least-bad legal tile (it does not self-destruct
  in v1).

> ✅ **CHECK — Forage competence:** With the player far away, the snake reaches
> and eats pellets reliably and does not trap itself against a wall or its own
> body.

> ✅ **CHECK — State transitions:** Walk the player into the radius (→chase), out
> of it (→forage after delay); shoot a pellet (→enraged 2× for a random
> duration, then back). Verify venom can fire from any non-dead movement state on
> a valid LOS.

### 7.2 Venom projectiles

- Travel straight along the firing direction at `VENOM_SPEED`, up to
  `VENOM_RANGE_TILES`, then despawn.
- On hitting the player: apply the rolled effect (§3.6). Player bullets and venom
  pass through each other (no projectile-vs-projectile).

---

## 8. Sprites

All sprites are ASCII grids for `drawPixelArt()`. Facing variants are produced by
**rotation** of the base (upward) frame; venom colors are **palette swaps** of
one shape (so no separate art per color/direction is needed).

```typescript
// Player ship, facing up (8x8). P=hull, C=cockpit, E=engine glow
const SHIP_UP: string[] = [
  '   PP   ',
  '  PPPP  ',
  '  PCCP  ',
  ' PPCCPP ',
  ' PPPPPP ',
  'PP PP PP',
  'P  PP  P',
  '   EE   ',
];

// Snake head (8x8). H=head (green), E=eye, F=fang/mouth
const SNAKE_HEAD: string[] = [
  ' HHHHHH ',
  'HHHHHHHH',
  'HEEHHEEH',
  'HEEHHEEH',
  'HHHHHHHH',
  'HHFFFFHH',
  'HHHHHHHH',
  ' HHHHHH ',
];

// Snake body segment (8x8). B=scale outer (green), S=scale inner (light)
const SNAKE_BODY: string[] = [
  '        ',
  ' BBBBBB ',
  'BBSSSSBB',
  'BBSSSSBB',
  'BBSSSSBB',
  'BBSSSSBB',
  ' BBBBBB ',
  '        ',
];

// Pellet (8x8). P=pellet (amber)
const PELLET: string[] = [
  '        ',
  '  PPPP  ',
  ' PPPPPP ',
  ' PPPPPP ',
  ' PPPPPP ',
  ' PPPPPP ',
  '  PPPP  ',
  '        ',
];

// Venom blob (6x6). V=venom (color set by type: green/red/black via palette)
const VENOM: string[] = [
  '  VV  ',
  ' VVVV ',
  'VVVVVV',
  'VVVVVV',
  ' VVVV ',
  '  VV  ',
];

// Smoke puff (8x8), cosmetic, faded. S=smoke (dim grey, low alpha)
const SMOKE: string[] = [
  '        ',
  '  SS S  ',
  ' S SS S ',
  'S S  SS ',
  ' SS S S ',
  '  S SS  ',
  ' S  S   ',
  '        ',
];
```

**TX keys:** `shipUp`, `snakeHead`, `snakeBody`, `pellet`, `venom`, `smoke`
**Animation:** ship/head rotate to `facing`; body is static; venom tints by type
(`venomGreen`/`venomRed`/`venomBlack` are palette swaps of `venom`); smoke fades
its alpha to 0 over its lifetime.

> ✅ **CHECK — Sprite grids:** Every grid above is rectangular and matches its
> `(WxH)` label. Run `npm run lint:specs specs/hydra-original.md` — it must pass
> with no `sprite-*` errors.

---

## 9. TX (Texture Key) Registry

```typescript
export const TX = {
  // Player
  shipUp:      'hy-ship',        // rotated by facing
  smoke:       'hy-smoke',
  playerBullet:'hy-bullet',

  // Snake
  snakeHead:   'hy-head',        // rotated by facing
  snakeBody:   'hy-body',

  // Pellets & venom
  pellet:      'hy-pellet',
  venom:       'hy-venom',       // tinted per type (green/red/black)

  // UI
  lifeIcon:    'hy-life',        // small ship glyph
} as const;

export type TXKey = keyof typeof TX;
```

> ✅ **CHECK — TX completeness:** Every key has a sprite definition (or a stated
> derivation: `shipUp`/`snakeHead` rotate; `venom` tints; `lifeIcon` reuses the
> ship). A missing definition throws at init, never renders empty.

---

## 10. Player Sprite

The player ship is `SHIP_UP` (§8), rendered rotated to its `facing`. Death plays
a brief expanding-burst flash (reuse a generic explosion from shared FX rather
than a bespoke frame). No walk animation — grid steps move the whole sprite one
tile.

**TX keys:** `shipUp`
**Animation:** rotate to `facing`; on death, camera flash + particle burst.

---

## 11. AI Difficulty Ramp (overview)

Because the game is endless, difficulty escalates with time and the snake's own
growth. See §14 for the concrete ramp table. Summary: the snake's `stepMs`
shrinks (it speeds up), venom cooldown shortens, and the pellet supply keeps the
snake growing — which in turn widens its awareness radius. The player's pressure
valve is denying pellets and severing length, at the cost of aggro.

---

## 12. Physics & Constants

```typescript
export const GAME = {
  // Screen / grid
  screenWidth:        224,    // px
  screenHeight:       288,    // px
  tileSize:           8,      // px
  gridCols:           28,
  gridRows:           36,
  hudRows:            2,      // top rows reserved for HUD

  // Player
  playerStepMs:       110,    // ms per tile (player is agile)
  playerRangeTiles:   6,      // bullet travel distance in tiles
  maxBullets:         3,      // player bullets on screen
  bulletSpeed:        240,    // px per second
  smokeMaxTiles:      5,      // cosmetic trail cap
  startingLives:      3,
  extraLifeAt:        10000,  // pts

  // Snake — movement & health
  snakeBaseStepMs:    160,    // ms per tile at game start (slower than player)
  snakeHp:            6,      // head hit points
  awarenessFactor:    0.5,    // radius = length * factor (tiles)
  awarenessMin:       2,      // tiles, floor for short snakes
  loseInterestMs:     1500,   // out-of-radius time before chase -> forage

  // Snake — venom (ranged)
  venomRangeTiles:    3,      // ~ playerRangeTiles * (1/3..1/2); must be < player range
  venomSpeed:         120,    // px per second
  venomCooldownMs:    600,    // min time between venom shots
  venomWeights:       { green: 0.6, red: 0.3, black: 0.1 }, // sums to 1.0

  // Status effects (player)
  effectMinMs:        900,    // 0.9 s
  effectMaxMs:        2100,   // 2.1 s
  insanitySpeedMult:  2,      // RED: 2x speed, inverted input
  enrageSpeedMult:    2,      // snake 2x while enraged

  // Pellets
  pelletCount:        3,      // simultaneous pellets
  pelletRespawnMs:    1200,   // delay before an eaten/destroyed pellet returns

  // Severing
  sever1Ms:           2000,   // length-1 piece lifetime
  sever2Ms:           4000,   // length-2 piece lifetime
  sever3Ms:           6000,   // length-3 piece: 2x chase then die
  // length >= main snake length -> promote to new Snake

  // Spawning / chaos cap
  maxSnakes:          4,      // global cap incl. main + cut-spawned

  // Difficulty ramp (see §14 for schedule)
  rampIntervalMs:     20000,  // every 20 s, apply one ramp step
  rampStepFactor:     0.92,   // snakeBaseStepMs *= this per ramp (caps out)
  snakeMinStepMs:     90,     // floor: snake never faster than this

  // Scoring
  scoreHeadHit:       25,
  scoreTailSegment:   10,
  scoreCut:           50,
  scoreSeveredKill:   50,
  scorePelletDenied:  15,
  scoreSnakeKill:     500,
  scoreSurvivePerSec: 10,
} as const;
```

> ✅ **CHECK — Range relationship:** Assert `venomRangeTiles < playerRangeTiles`
> at startup. If this ever flips, the "out-range the snake" design breaks.

---

## 13. Canonical vs. Tunable Values

(For an original game, "Canonical" = **identity invariants** — the decisions that
*are* HYDRA. Changing them makes it a different game. "Tunable" = feel values,
free to adjust, defaults given.)

### 13.1 Identity invariants — do not change

| Invariant | Setting |
|-----------|---------|
| The antagonist is an AI playing Snake (forages, grows on pellets) | yes |
| Player hunts the snake; grid-locked 4-dir for both | yes |
| Two-layer snake health: head HP = kill, length = power | yes |
| Awareness radius grows with length | yes |
| Venom range strictly shorter than player range | yes |
| Venom types & weights: GREEN 60 / RED 30 / BLACK 10 | yes |
| GREEN paralyzes, RED inverts+speeds, BLACK costs a life | yes |
| Severing by length: 1/2/3 fates; ≥ main → new snake | yes |
| Shooting a pellet destroys it + enrages the snake | yes |
| Smoke trail is cosmetic, ≤ 5 tiles | yes |
| Endless score-attack (no win state) | yes |

### 13.2 Tunable — adjust for feel (defaults in §12)

| Value | Default | Suggested range |
|-------|---------|-----------------|
| `playerStepMs` | 110 | 80–140 |
| `snakeBaseStepMs` | 160 | 130–200 |
| `snakeHp` | 6 | 4–10 |
| `awarenessFactor` | 0.5 | 0.4–0.7 |
| `playerRangeTiles` | 6 | 5–8 |
| `venomRangeTiles` | 3 | 2–3 (keep < player range) |
| `venomCooldownMs` | 600 | 400–900 |
| effect duration | 900–2100 ms | keep min ≥ 700 |
| `maxSnakes` | 4 | 3–6 (perf-bound) |
| ramp step / interval | 0.92 / 20 s | tune for curve |

---

## 14. Content Data — Spawn Tables, Ramps & Probabilities

(No authored levels — this is the procedural content that drives the endless run.)

### 14.1 Venom roll (single weighted draw)

```
roll r in [0,1):
  r < 0.60            -> GREEN (paralyze)
  0.60 <= r < 0.90    -> RED   (insanity)
  r >= 0.90           -> BLACK (death poison)
```

### 14.2 Severed-piece outcome (by rear-piece length L at cut time)

```
L == 1            -> timed death @ 2000 ms
L == 2            -> timed death @ 4000 ms
L == 3            -> 2x chase 6000 ms, then death
L >= mainLength   -> promote to new Snake (if total snakes < maxSnakes;
                     otherwise treat as L==3)
```

### 14.3 Difficulty ramp schedule

Every `rampIntervalMs` (20 s) of run time, apply one step:

```
snakeBaseStepMs = max(snakeMinStepMs, snakeBaseStepMs * rampStepFactor)
venomCooldownMs = max(350, venomCooldownMs * 0.95)
(pellet supply unchanged; snake growth naturally widens awareness)
```

Cut-spawned snakes inherit the *current* ramped `snakeBaseStepMs`.

### 14.4 Pellet spawning

- Maintain `pelletCount` pellets at all times. On eat/destroy, schedule a respawn
  after `pelletRespawnMs` at a uniformly random **free** tile (not on a wall, the
  HUD, a snake segment, or another pellet).

### 14.5 Palette (token → hex)

| Token | Used by | Name | Hex |
|-------|---------|------|-----|
| P | ship | Hull steel | `#c8d0e0` |
| C | ship | Cockpit cyan | `#3cbcfc` |
| E | ship | Engine glow | `#fca800` |
| H | snake head | Serpent green | `#5ec43a` |
| E | snake head | Eye red | `#d1232a` |
| F | snake head | Fang bone | `#f4f0d8` |
| B | snake body | Scale green | `#4a9e2c` |
| S | snake body | Scale light | `#9be86a` |
| P | pellet | Pellet amber | `#ffd23c` |
| V | venom green | Paralyze green | `#3adb5a` |
| V | venom red | Insanity red | `#e23c3c` |
| V | venom black | Death poison | `#202028` |
| S | smoke | Smoke grey | `#8890a0` |

---

## 15. LLM Self-Verification Checklist

### Phase 1: Grid, ship, smoke
- [ ] Both entities move 4-dir, one tile per their `STEP_MS`; no diagonals
- [ ] Player faces last move direction; facing persists when stopped
- [ ] Player fires in facing while moving AND while stopped
- [ ] Bullets despawn after `playerRangeTiles`; at most `maxBullets` on screen
- [ ] Smoke trail ≤ 5 tiles, cosmetic, no collision
- [ ] Entities stay within the play area; never enter HUD/walls

### Phase 2: Snake core (Snake-the-game)
- [ ] Snake forages: pathfinds to nearest pellet, eats, grows length +1
- [ ] Snake routes around walls and its own body; does not self-destruct
- [ ] Pellets maintained at `pelletCount`; respawn at random free tiles

### Phase 3: Awareness & venom
- [ ] `awarenessRadius = max(awarenessMin, length*0.5)`; grows as it eats
- [ ] Player in radius → `chase`; out for `loseInterestMs` → `forage`
- [ ] Venom fires only on straight LOS within `venomRangeTiles`, off cooldown
- [ ] `venomRangeTiles < playerRangeTiles` (out-ranging works)
- [ ] Venom weights resolve ≈ 60/30/10; GREEN/RED/BLACK effects correct
- [ ] Effects mutually exclusive; new effect refreshes timer
- [ ] Paralyzed player eaten on head contact = death

### Phase 4: Player offense
- [ ] Head hit −1 HP; HP 0 → snake dies (+500, +25)
- [ ] Snake can dodge shots that enter its awareness radius
- [ ] Shooting a pellet destroys it + enrages snake (2× chase, random duration)
- [ ] Tail-from-behind removes rear cleanly (no severed entity)

### Phase 5: Severing
- [ ] Side hit mid-body = cut; front stays on head, rear becomes severed piece
- [ ] Severed L1→die 2s, L2→die 4s, L3→2× chase 6s then die
- [ ] Severed L ≥ main length → new full Snake (respects `maxSnakes`)
- [ ] After any sever, main length = front count; main HP unchanged

### Phase 6: Endless loop, scoring, ramp
- [ ] No win state; lives drive game over; extra life at 10,000
- [ ] All score events fire once, correct values
- [ ] Ramp every 20 s speeds the snake (floor at `snakeMinStepMs`)
- [ ] Total concurrent snakes never exceeds `maxSnakes`

### Phase 7: Rendering & TX
- [ ] All sprite grids rectangular, dimension-labeled, ASCII-only (linter clean)
- [ ] Ship/head rotate to facing; venom tints by type; smoke fades alpha
- [ ] Every referenced TX key exists in the registry

---

## 16. Reference Sources & Influences

Original game — nothing to clone. Design influences:

- **Classic *Snake*** (Nokia / Blockade lineage) — the antagonist's entire
  behavior: grid movement, pellet-eating growth, self-avoidance.
- **Fixed/twin-stick shooters** — the player's hunt-and-shoot loop and the
  facing-based firing.
- **Cowabunga Arcade shared layer** (`src/shared/`) — `StateMachine` (snake AI),
  `InputManager` (4-dir + fire), `drawPixelArt` (all sprites), `ScoreManager`,
  `BaseGameScene`, registry. This game is intended to be ~mostly shared
  primitives plus snake-specific AI and the severing system.
