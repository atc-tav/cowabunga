// Super Mario Bros. 2 tunables.
//
// The spec (§12) expresses physics in px/FRAME at 60fps. The shared
// PlatformerBody integrates in seconds (dt = delta/1000), as do all other games
// here, so we convert once at the boundary: velocity ×60, acceleration ×3600.
// Keeping the spec's per-frame numbers visible in the comments makes the
// conversion auditable against §13.

const FPS = 60;
const vel = (perFrame: number): number => perFrame * FPS; // px/frame -> px/sec
const acc = (perFrame: number): number => perFrame * FPS * FPS; // px/frame^2 -> px/sec^2

// === SCREEN (spec §12) ===
export const WIDTH = 256; // NES hardware width
export const HEIGHT = 224; // active display (240 minus 8px blanking top+bottom)
export const HUD_H = 16; // top HUD strip
export const TILE = 16; // SMB2 metatile unit

// === SHARED PHYSICS ===
export const GRAVITY = acc(0.4); // 1440 px/sec^2
export const LUIGI_GRAVITY = acc(0.28); // 1008 — floatier descent
export const MAX_FALL = vel(8.0); // 480 px/sec
export const RUN_SPEED = vel(2.5); // 150 px/sec — same for all chars, unloaded
export const JUMP_CUT = 0.4; // releasing jump early while rising scrubs upward vel
export const FLOAT_HORIZ = vel(0.9); // 54 px/sec — Peach drift while floating
export const FLOAT_DURATION_MS = 1500;
export const TOAD_CHARGE_MULT = 1.4; // crouch+jump bonus
export const TOAD_CHARGE_FRAMES = 4; // crouch frames required to charge

// === PER-CHARACTER JUMP (px/sec; upward = negative) ===
export const JUMP = {
  marioUnloaded: vel(7.0),
  marioCarrying: vel(6.0),
  luigiUnloaded: vel(10.0),
  luigiCarrying: vel(6.8),
  toadUnloaded: vel(5.5),
  toadCarrying: vel(5.3),
  peachUnloaded: vel(6.5),
  peachCarrying: vel(5.8),
} as const;

// === PICK-UP / CARRY / THROW ===
export const THROW_VX = vel(6.0); // 360 px/sec
export const THROW_VY = vel(4.0); // 240 px/sec upward (negated on launch)
export const ITEM_BOUNCE_DECAY = 0.6; // vy multiplier each floor bounce
export const ITEM_FRICTION = 0.9; // per-frame vx decay while rolling (applied ^frames)
export const ITEM_STOP_SPEED = vel(0.5); // below this a rolling item is inert
export const PLUCK_RANGE = 14; // px to the nearest grass tuft to pluck it
export const PICKUP_RANGE = 12; // px overlap to grab an enemy/item

// === HEALTH ===
export const START_HP = 2; // hearts at level start
export const MAX_HP = 4;
export const HEART_PER_ENEMIES = 8; // kills on a screen before a heart drops
export const DAMAGE_INVULN_MS = 1200; // i-frames after taking a hit

// === CHERRY / STARMAN ===
export const CHERRY_FOR_STARMAN = 5;
export const STARMAN_MS = 10000;

// === SPAWN JAR (spec §10.1) ===
export const JAR_SPAWN_MS = 1800;
export const JAR_MAX_ALIVE = 3; // cap concurrent jar-spawned enemies

// === SCORING (spec §6) ===
export const SCORE = {
  shyGuy: 200,
  tweeter: 200,
  cherry: 0,
} as const;

// === DIMENSIONS ===
export const PLAYER_W = 12;
export const PLAYER_H = 20; // normal form (small form is visual-only)
export const SHYGUY_W = 14;
export const SHYGUY_H = 14;
export const TWEETER_W = 14;
export const TWEETER_H = 12;
export const PLATFORM_THICKNESS = 16;

// === FLOW / LIVES ===
export const LIVES_START = 3;
export const READY_MS = 1100; // "WORLD 1-1" intro card
export const DEATH_PAUSE_MS = 1100;
export const WIN_MS = 2400;
export const GAMEOVER_MS = 2600;
export const WALK_FRAME_MS = 120; // run-cycle frame swap

// Enemy patrol speeds (px/sec, from spec §4.2 per-frame values).
export const SHYGUY_SPEED = vel(0.8); // 48 px/sec
export const TWEETER_SPEED = vel(1.2); // 72 px/sec
export const TWEETER_HOP = vel(4.0); // arc hop launch
