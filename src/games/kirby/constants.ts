// Kirby's Adventure (NES) — first vertical slice tunables.
//
// Velocities are expressed in the spec's native unit, **px/frame** (§12), and
// gravity in **px/frame²**. To stay frame-rate independent (RL-dojo rule) we
// never advance by a fixed amount per frame: every integration multiplies by
// `f = delta / FRAME_MS` (the number of 60 Hz frames elapsed this tick). At a
// true 60 fps `f === 1`, so the numbers below match the original exactly.

/** One NES frame in milliseconds (60 Hz). The bridge from px/frame → px/ms. */
export const FRAME_MS = 1000 / 60;

// === SCREEN (§2.1) ===
export const WIDTH = 256; // px — NES hardware width
export const HEIGHT = 224; // px — active display (240 minus 8px blanking)
export const HUD_H = 16; // px — bottom HUD strip
export const PLAY_H = HEIGHT - HUD_H; // 208 px — play area above the HUD
export const HUD_Y = PLAY_H; // top of the HUD panel; Kirby never stands below this

export const GAME = {
  // === KIRBY MOVEMENT (§3.3) ===
  walkSpeed: 1.5, // px/frame
  runSpeed: 2.5, // px/frame
  runTapWindowFrames: 8, // frames — double-tap within this window starts a run
  slideSpeed: 3.5, // px/frame
  slideDurationFrames: 20, // frames
  slideIFrames: 6, // invincible frames at slide start
  jumpVelocity: -3.0, // px/frame — upward is negative (tuned for the 208px playfield)
  jumpHoldFrames: 16, // frames an A-hold keeps extending the ascent
  gravity: 0.18, // px/frame²
  maxFallSpeed: 4.5, // px/frame
  airControl: 1.2, // px/frame — horizontal speed in the air

  // === HOVER (§3.3) — indefinite; only cancelled by firing an Air Pellet ===
  hoverAscendRate: 1.1, // px/frame — gentle rise while UP is held
  hoverDrift: 0.15, // px/frame — slow sink when hovering without holding UP

  // === INHALE (§3.4) ===
  inhaleRangePx: 44, // px — pull-cone reach in the facing direction
  inhalePullSpeed: 2.5, // px/frame — how fast a caught target is reeled in
  starProjSpeed: 6.0, // px/frame — spat StarProjectile
  airPelletSpeed: 5.0, // px/frame — puff fired to cancel a hover

  // === ABILITY STAR (§3.5) ===
  abilityStarBounceDy: -3.0, // px/frame — initial upward bounce
  abilityStarBounceDx: 2.0, // px/frame — drift away from the damage source
  abilityStarLifeMs: 5000, // ms before the star shatters
  abilityStarBlinkMs: 2000, // ms of warning blink before it shatters
  maxAbilityStarsOnScreen: 1, // §3.5 — only ever one at a time

  // === HEALTH (§1) ===
  maxHP: 6, // HP pips — normal mode
  iframeDurationMs: 1800, // ms of invincibility after taking damage

  // === ABILITIES (slice subset; §5.1) ===
  beamRangePx: 40, // px — whip-crack arc reach
  beamDurationMs: 260, // ms the beam arc is live
  beamCooldownMs: 320, // ms between beam casts
  sparkRadiusPx: 26, // px — electric barrier radius while B held
  sparkTickMs: 120, // ms between spark damage ticks

  // === SCORING (§8.2, tunable) ===
  pointsBasicEnemy: 100, // Waddle Dee, Bronto Burt, …
  pointsAbilityEnemy: 300, // Waddle Doo, Sparky, …
  pointsStageClear: 5000, // reaching the goal door

  // === LIVES (§1) ===
  livesStart: 3,
} as const;

/** Copy abilities present in this slice. Star Rod etc. land in later slices. */
export type AbilityName = 'beam' | 'spark';

// === KIRBY HITBOX ===
export const KIRBY_W = 12; // px — body width (matches the 12-wide art grid)
export const KIRBY_H = 10; // px — body height

// === ANIMATION TIMING (§11) ===
export const WALK_FRAME_MS = 150; // ms/frame walking
export const RUN_FRAME_MS = 80; // ms/frame running
export const HOVER_FRAME_MS = 120; // ms/frame hovering
export const HIT_FLASH_MS = 80; // ms/frame of the i-frame blink

// === STAGE / CAMERA ===
export const PIT_DEATH_Y = HEIGHT + 24; // feet past this y = fell in a pit (§2.3)
export const STAGE_CLEAR_MS = 2000; // ms the "STAGE CLEAR" banner holds
export const GAMEOVER_MS = 2600; // ms before returning to the menu
export const RESPAWN_MS = 800; // ms between death and respawn at stage start
