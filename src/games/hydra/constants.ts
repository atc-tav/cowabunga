/**
 * HYDRA tuning constants. Mirrors `specs/hydra-original.md` §12. Units are noted
 * inline. Pixel speeds are px/second; tick rates are milliseconds.
 */

// --- Screen / grid ----------------------------------------------------------
export const WIDTH = 224; // px
export const HEIGHT = 288; // px
export const TILE = 8; // px per tile
export const COLS = WIDTH / TILE; // 28
export const ROWS = HEIGHT / TILE; // 36

// Rows reserved for HUD (top score row, bottom lives row). Play area is between.
export const PLAY_ROW_MIN = 2;
export const PLAY_ROW_MAX = 33;

// --- Player ship ------------------------------------------------------------
export const PLAYER_SPEED = 84; // px/sec (glides one tile in ~95ms — agile)
export const PLAYER_RANGE_TILES = 6; // bullet travel distance
export const MAX_BULLETS = 3;
export const BULLET_SPEED = 240; // px/sec
export const SMOKE_MAX_TILES = 5; // cosmetic trail cap
export const SMOKE_FADE_MS = 420; // per-puff fade
export const STARTING_LIVES = 3;
export const EXTRA_LIFE_AT = 10000; // pts
export const RESPAWN_INVULN_MS = 1500; // grace after losing a life

// --- Snake: movement & health ----------------------------------------------
export const SNAKE_BASE_STEP_MS = 200; // ms per tile at start (slower than ship)
export const SNAKE_MIN_STEP_MS = 90; // floor after ramp
export const SNAKE_START_LENGTH = 3;
export const SNAKE_HP = 6; // head hit points
export const AWARENESS_FACTOR = 0.5; // radius = length * factor (tiles)
export const AWARENESS_MIN = 2; // tiles, floor
export const LOSE_INTEREST_MS = 1500; // out-of-radius before chase -> forage
export const DODGE_CHANCE = 0.5; // chance a head shot misses inside awareness
export const ENRAGE_SPEED_MULT = 2; // snake step halved while enraged/chasing fast
export const SNAKE_RESPAWN_MS = 1600; // delay to spawn a fresh snake when board clears
export const MAX_SNAKES = 4; // global cap incl. cut-spawned

// --- Snake: venom (ranged) --------------------------------------------------
export const VENOM_RANGE_TILES = 3; // must be < PLAYER_RANGE_TILES
export const VENOM_SPEED = 120; // px/sec
export const VENOM_COOLDOWN_MS = 600;
export const VENOM_GREEN = 0.6;
export const VENOM_RED = 0.3;
// remainder (0.1) is BLACK

// --- Player status effects --------------------------------------------------
export const EFFECT_MIN_MS = 900;
export const EFFECT_MAX_MS = 2100;
export const INSANITY_SPEED_MULT = 2;

// --- Pellets ----------------------------------------------------------------
export const PELLET_COUNT = 3;
export const PELLET_RESPAWN_MS = 1200;

// --- Severing ---------------------------------------------------------------
export const SEVER_1_MS = 2000;
export const SEVER_2_MS = 4000;
export const SEVER_3_MS = 6000;

// --- Difficulty ramp --------------------------------------------------------
export const RAMP_INTERVAL_MS = 20000;
export const RAMP_STEP_FACTOR = 0.92; // snake base step *= this per ramp
export const RAMP_VENOM_FACTOR = 0.95; // venom cooldown *= this per ramp
export const VENOM_COOLDOWN_MIN = 350;

// --- Scoring ----------------------------------------------------------------
export const SCORE_HEAD_HIT = 25;
export const SCORE_TAIL_SEGMENT = 10;
export const SCORE_CUT = 50;
export const SCORE_SEVERED_KILL = 50;
export const SCORE_PELLET_DENIED = 15;
export const SCORE_SNAKE_KILL = 500;
export const SCORE_SURVIVE_PER_SEC = 10;

// --- Misc -------------------------------------------------------------------
export const DEATH_FREEZE_MS = 900; // brief pause on player death
export const GAMEOVER_MS = 2600;
