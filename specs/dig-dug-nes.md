# Dig Dug (NES, 1985) — Clone Design Specification

> **Build target:** Browser-based clone using font/ASCII character tile rendering system.
> **Platform:** NES/Famicom version (Namco, 1985). **Note:** The NES version was released in Japan only; never officially released in North America.
> **Prior spec:** An arcade Dig Dug spec exists in this project. This document is the **NES-specific spec** and should be used as the authoritative source. Key differences from the arcade version are explicitly flagged with `⚠️ NES DIFF:`.
> **LLM verification notes** appear throughout as `> ✅ CHECK:` callouts.

---

## 1. NES vs. Arcade — Key Differences Summary

Before diving in, these are the most important ways the NES version differs from the arcade:

| Feature | Arcade | NES |
|---------|--------|-----|
| Vegetable table | Starts at Round 1, ~11 items, Galaxian at 16–17 | Starts Round 1, 13 items, Cucumber added at 4–5; rounds-per-item differ |
| Rock crush table | Up to 8 enemies, max 15,000 pts | **Only up to 5 enemies documented**, max 8,000 pts |
| Extra life threshold | 20,000 pts | **10,000 pts** |
| Speed escalation | Gradual per round | **Hard speed-up at ~30 seconds** in-round (music changes, enemies 2× speed) |
| Round looping | Loops after round 14 | **Loops rounds 8–12** after round 12 |
| Enemy count per round | Varies 5–8+ | 4–8 enemies per round (see per-round table) |
| Score persistence | Arcade: high score saved in cabinet | NES: **high score resets on power-off** |
| Kill screen | Round 256 overflow | Round 256 integer overflow (same) |

> ✅ **CHECK — Extra Life Threshold:** In the NES version, extra lives are awarded at **10,000 points**, NOT 20,000 as in the arcade. This is a significant difference — ensure `EXTRA_LIFE_THRESHOLD = 10000` in constants. Test: reach 10,000 pts and verify +1 life is awarded.

---

## 2. Game Overview

- **Genre:** Single-screen strategic digging game
- **Core loop:** Dig tunnels through underground soil → inflate enemies with the air pump or crush them with rocks → clear all enemies to advance
- **Win condition:** None — game loops indefinitely until all lives are lost or kill screen at round 256
- **Lose condition:** Contact with un-inflated enemy, Fygar fire breath, or being crushed by a rock
- **Lives:** 3 starting lives. Extra life at **10,000 pts** (NES-specific).
- **Controls:** D-pad (4-directional movement), A or B (fire pump)
- **Screen:** NES 256×240 portrait resolution

---

## 3. Playfield Architecture

The NES playfield is functionally identical to the arcade in structure. See the arcade spec for the full tile grid and zone layout. NES-specific notes:

- **Tile size:** 8×8 px (same as arcade)
- **Grid:** 28 tiles wide × ~28 tiles tall (dirt area)
- **Sky row:** Top ~2 rows open sky; Dig Dug starts here each round
- **4 soil layers:** Visually color-coded, top → bottom; layer depth determines kill points
- **Layer colors** change every few rounds (cosmetic only)

> ✅ **CHECK — Layer Boundary:** Layer 1 = rows 3–9, Layer 2 = rows 10–16, Layer 3 = rows 17–22, Layer 4 = rows 23–28 (approximate — tune to match NES visual). Verify `enemy.layerIndex` is computed from current `enemy.row` at time of death, not spawn position.

---

## 4. Core Gameplay Mechanics

All core mechanics are shared with the arcade version. Refer to the arcade Dig Dug spec for full detail on:
- Grid-based movement (4-directional, tile-snapping, speed differential digging vs. tunnels)
- Air pump latch, inflation stages (3 presses to pop), deflate grace period
- Rock fall (jitter delay, hold logic, player crushable, shatters on land)
- Bonus vegetable trigger (after any 2 rocks dropped, spawns at center stage)
- Last enemy escape/pursuit behavior
- Ghost mode (both enemies)

**NES-specific mechanic differences are documented in the sections below.**

### 4.1 30-Second Speed-Up (NES-Exclusive)

This is the most tactically significant NES-exclusive mechanic:

- Approximately **30 seconds** after a round begins, a **music change** occurs.
- All remaining enemies instantly move at **2× their previous speed**.
- This speed-up is **permanent** for the rest of that round — it does not reset.
- This applies to **both Pookas and Fygars**, including their ghost-mode movement.
- The speed-up can occur during ghost mode — a ghosting enemy will continue at 2× speed after re-solidifying.
- Players can use this strategically: rush kills early to avoid the speed-up, or use the speed-up to predict that a ghosting enemy will solidify faster and appear at a predictable location.

> ✅ **CHECK — Speed-Up Timer:** Implement `roundSpeedUpTimer` counting up from round start. When `roundSpeedUpTimer >= SPEED_UP_THRESHOLD_MS` (≈30,000ms), set `speedMultiplier = 2.0` for all enemies and trigger the music track change. Verify: enemies visibly move faster and the music audibly changes at the same moment. Verify: dying and respawning mid-round does NOT reset the speedUpTimer — the 30 seconds counts from round start, not from player respawn.

### 4.2 Round Looping (NES-Specific)

- The NES version has **12 unique rounds**.
- After Round 12, the game **loops back to Round 8** and repeats rounds 8–12 indefinitely.
- Enemy and rock positions in each repeated round are the same as the original round.
- Layer colors change on each loop to provide visual variety.
- Enemy speed increases incrementally with each loop pass.

> ✅ **CHECK — Loop Logic:** After Round 12, set `currentRound = 8`. The vegetable table should continue using the actual loop-adjusted round number (not reset to 1) — so if this is the 2nd pass through round 8, it is effectively "Round 13" for vegetable purposes. Use `absoluteRoundNumber` for the vegetable table and scoring; use `displayRound` (1–12, then 8–12) for the screen display.

---

## 5. Enemy Specifications

Both enemies are identical to the arcade in behavior. The NES version has slightly adjusted parameters:

### 5.1 Pooka

**Description:** Red round monster with yellow goggles. No attack — only contact damage.

| Property | Value |
|----------|-------|
| Speed (pre-speedup) | Slightly slower than arcade |
| Speed (post-speedup) | 2× pre-speedup speed |
| Ghost trigger delay | ~2 seconds without viable tunnel path |
| Ghost speed | Slower than tunnel walk speed |
| Inflation presses to pop | 3 |

**Behavior notes:**
- Pookas in ghost form travel through solid dirt as floating goggles.
- Re-solidify only on cleared tiles.
- Will attempt to "box in" Dig Dug in conjunction with other Pookas — they don't purely chase, they spread out when possible to cut off escape routes. *(This appears to be semi-intentional emergent behavior from their pathfinding, not explicit AI.)*
- Cannot be attacked while ghosting.

### 5.2 Fygar

**Description:** Green dragon with red spines on back. Has fire breath.

| Property | Value |
|----------|-------|
| Speed | Slightly **faster** than Pooka (NES FAQ notes this explicitly) |
| Fire range | Approximately **4 Dig Dug widths** horizontally (~4 tiles) |
| Fire warning | Spines on Fygar's back **glow** just before firing (1-frame charge) |
| Inflation presses to pop | 3 |
| Horizontal kill bonus | Yes — 2× points when killed from the side (fire-line) |
| Vertical kill | ½ point value (above/below — no fire risk) |

> ✅ **CHECK — Fygar Speed vs. Pooka:** Fygar `baseSpeed` should be ~10–15% higher than Pooka `baseSpeed`. Verify: in a round with both enemy types, a Fygar and Pooka starting equidistant from Dig Dug — the Fygar should reach him first. This is noted explicitly in the NES FAQ.

> ✅ **CHECK — Spine Glow Warning:** One frame before Fygar fires, render the `fygarFireCharge` sprite (spines highlighted). This gives a 1-frame visual warning. Ensure the fire entity spawns the following frame — not the same frame as the charge sprite.

**Fygar fire range in NES (4 tiles):**
The NES FAQ specifies fire range of "about 4 Dig Dugs" — slightly shorter than the arcade version. Update `FYGAR_FIRE_RANGE = 4` in constants (vs. arcade's 3–4; NES is firmly 4).

---

## 6. Scoring System

### 6.1 Inflation Kill Points (NES)

Identical structure to arcade — layer depth × direction multiplier:

| Layer | Pooka | Fygar (horizontal — from side) | Fygar (vertical — from above/below) |
|-------|-------|--------------------------------|--------------------------------------|
| Layer 1 | 200 | 400 | 200 |
| Layer 2 | 300 | 600 | 300 |
| Layer 3 | 400 | 800 | 400 |
| Layer 4 | 500 | 1,000 | 500 |

**Key rule:** Fygar horizontal = 2× Pooka value at that layer. Fygar vertical = same as Pooka value (½ of horizontal Fygar). The NES FAQ confirms this explicitly: "you get 1/2 the amount of points for inflating a Fygar if you do it under him or above him."

### 6.2 Rock Crush Points (NES)

⚠️ **NES DIFF:** The NES version documents only up to 5 enemies crushed (max 8,000 pts). The arcade has an 8-enemy table. Do not assume the higher values carry over.

| Enemies Crushed (one rock) | Points |
|---------------------------|--------|
| 1 | 1,000 |
| 2 | 2,500 |
| 3 | 4,000 |
| 4 | 6,000 |
| 5 | 8,000 |

### 6.3 Dirt Digging Points (NES)

⚠️ **NES DIFF:** The NES FAQ specifies **10 points per dirt piece the size of 2 Dig Dugs** — meaning every 2 tiles cleared = 10 pts. This is slightly different phrasing from the arcade's flat 10 pts per tile. Implement as: every 2 tiles cleared = award 10 pts (i.e., 5 pts per tile, batched in pairs), OR simply 10 pts per tile cleared as a simpler approximation.

### 6.4 Extra Life

⚠️ **NES DIFF:** Extra life at **10,000 pts** (arcade is 20,000).

### 6.5 Bonus Vegetable Table (NES)

⚠️ **NES DIFF:** The NES vegetable table differs from the arcade in item order and which rounds share items. This is the authoritative NES table:

| Round(s) | Vegetable / Item | Points |
|----------|-----------------|--------|
| 1 | Carrot | 400 |
| 2 | Turnip | 600 |
| 3 | Mushroom | 800 |
| 4–5 | Cucumber | 1,000 |
| 6–7 | Eggplant | 2,000 |
| 8–9 | Pepper | 3,000 |
| 10–11 | Tomato | 4,000 |
| 12–13 | Onion | 5,000 |
| 14–15 | Watermelon | 6,000 |
| 16–17 | Galaxian | 7,000 |
| 18+ | Pineapple | 8,000 |

Vegetable trigger: same as arcade — after **any 2 rocks dropped** in a round, vegetable spawns at the center starting position. Disappears after ~10 seconds if not collected.

> ✅ **CHECK — NES Vegetable Table:** Use `absoluteRoundNumber` (not the display round) to look up the vegetable. During the loop (rounds repeating 8–12), absolute round 13 = Onion, round 14 = Watermelon, etc. Verify Round 1 gives Carrot (400 pts), Round 18+ gives Pineapple (8,000 pts). The Galaxian item at rounds 16–17 should use a distinctive sprite (it's a Galaxian spaceship, a Namco cross-promotion).

---

## 7. Round-by-Round Enemy Composition (NES)

The NES has 12 unique rounds before looping back to Round 8. This is the complete per-round guide:

| Round | Pooka | Fygar | Total | Notes |
|-------|-------|-------|-------|-------|
| 1 | 3 | 1 | 4 | Spread out, one per tunnel. Easy intro. |
| 2 | 3 | 2 | 5 | Everyone has own tunnel but closer together |
| 3 | 3 | 2 | 5 | Pooka to northeast tends to ghost quickly |
| 4 | 4 | 2 | 6 | Two Pookas in northern tunnel (deceptive layout) |
| 5 | 3 | 3 | 6 | Back to own tunnels; all near starting point |
| 6 | 2 | 4 | 6 | Heavy Fygar presence — attack vertically |
| 7 | 4 | 3 | 7 | Heavy grouping in tunnels |
| 8 | 4 | 4 | 8 | Pookas NW, tightly clumped; rocks at layers 2–3 |
| 9 | 4 | 3 | 7 | All Fygars below — clear top Pookas first |
| 10 | 4 | 4 | 8 | Spread out; good multi-rock crush opportunity |
| 11 | 3 | 4 | 7 | Layer 4 empty — retreat zone available |
| 12 | 4 | 4 | 8 | Fast enemies; very spread out; repeat cycle start |

**Loop behavior:** After Round 12, rounds 8–12 repeat. Enemy layout is the same as the original round 8–12, but enemy base speed increases each pass through the loop.

---

## 8. TX (Texture Key) Registry

The NES version uses the same sprites as the arcade spec, with one addition for the Fygar fire-charge warning. Reference the arcade Dig Dug TX registry and add:

```typescript
// NES additions / overrides on top of arcade TX registry
export const TX_NES_ADDITIONS = {
  // Fygar fire charge warning (1 frame before fire spawns)
  fygarFireCharge:    'dd-fygar-charge',   // spines glowing

  // NES-specific vegetables (additions to arcade table)
  vegCucumber:        'dd-veg-cucumber',
  vegPepper:          'dd-veg-pepper',
  vegOnion:           'dd-veg-onion',
} as const;
```

The full TX registry is: all keys from the arcade Dig Dug spec PLUS the above additions.

> ✅ **CHECK — TX NES Merge:** At renderer init, merge `TX_ARCADE` and `TX_NES_ADDITIONS` into a single registry. Verify no key collisions. The combined registry should have every sprite needed for both arcade and NES variants if you choose to support both.

---

## 9. Physics & Constants (NES Deltas)

Only values that differ from the arcade spec are listed here. Use arcade constants for everything not listed.

```typescript
// NES-specific overrides (apply on top of arcade GAME constants)
export const GAME_NES = {
  ...GAME_ARCADE,    // inherit all arcade values

  // NES-specific overrides
  extraLifeAt:          10000,     // NES: 10k (arcade: 20k)
  fygarFireRange:       4,         // NES: 4 tiles (arcade: 3–4)
  fygarSpeedMultiplier: 1.12,      // Fygar slightly faster than Pooka in NES

  // 30-second speed-up
  speedUpThresholdMs:   30000,     // ms from round start
  speedUpMultiplier:    2.0,       // all enemy speeds × 2.0 at threshold

  // Round looping
  uniqueRoundsCount:    12,
  loopBackToRound:      8,         // after round 12, loop back here

  // Rock crush table (NES caps at 5 enemies)
  rockCrushTable:       [0, 1000, 2500, 4000, 6000, 8000],
                        // index = number of enemies crushed

  // High score
  defaultHighScore:     10000,     // NES default high score displayed on title
  highScorePersists:    false,     // NES: score resets on power-off
} as const;
```

---

## 10. LLM Self-Verification Checklist (NES-Specific)

The arcade Dig Dug checklist covers all shared mechanics. These are NES-specific additions:

### NES-Specific Checks
- [ ] Extra life awarded at **10,000 pts**, not 20,000
- [ ] `fygar.baseSpeed > pooka.baseSpeed` by ~10–15%
- [ ] Fygar fire range = exactly **4 tiles** (not 3)
- [ ] Fygar spine-glow charge frame shows 1 frame before fire spawns
- [ ] **30-second speed-up** triggers correctly: `roundSpeedUpTimer >= 30000ms`
- [ ] Speed-up is permanent for the rest of the round after triggering
- [ ] Speed-up timer does NOT reset on player death/respawn mid-round
- [ ] Music track changes simultaneously with speed-up
- [ ] Rounds loop back to **Round 8** after Round 12 (not Round 1)
- [ ] `absoluteRoundNumber` used for vegetable table (not display round)
- [ ] Vegetable table matches NES table: Carrot(1), Turnip(2), Mushroom(3), Cucumber(4–5)...
- [ ] Cucumber sprite exists in TX (not in arcade version)
- [ ] Rock crush table caps at 5 enemies / 8,000 pts (not 8 enemies)
- [ ] Default high score = 10,000 pts
- [ ] High score resets on "power cycle" (page reload / new game)

### Shared Mechanics (confirm via arcade checklist)
- [ ] Grid movement with speed differential (digging vs. tunnels)
- [ ] Pump latch, 3 presses to pop, deflate grace period
- [ ] Rock hold logic (player directly below = no fall)
- [ ] Rock crushes player (own rock is lethal)
- [ ] Ghost mode: invulnerable, re-solidify in cleared tiles only
- [ ] Last enemy flees upward then left off screen
- [ ] Vegetable triggers after any 2 rocks dropped, 1 per round
- [ ] `dirtGrid[row][col]` persists all round, resets at round start
- [ ] Fygar fires horizontally only; passes through 1 solid tile; blocked by 2+

---

## 11. Reference Sources

- GameFAQs FAQ by Raging_DemonTEN (NES) — Definitive NES source: all 12 round walkthroughs with exact enemy counts, complete NES vegetable table (13 items, confirmed different from arcade), NES rock crush table (5-enemy cap), 10,000 pt extra life threshold, 30-second speed-up mechanic ("After about 30 seconds, there will be a change in the music and the enemies will move twice as fast"), rounds 8–12 loop after round 12, Fygar speed advantage over Pooka, fire range "about 4 Dig Dugs"
- Nintendo Fandom Wiki — NES/Famicom release confirmation (Japan only, never North American release)
- NamCompendium — "Slower playing version of arcade Dig Dug" comparison note; NES-specific gameplay tempo differences
- Arcade Dig Dug Spec (this project) — All shared mechanics; this spec is a delta document on top of that foundation
