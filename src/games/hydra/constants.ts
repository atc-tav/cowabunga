/**
 * HYDRA tuning constants (v2). Units noted inline; px speeds are px/sec, tick
 * rates are ms. All speed multipliers are capped at 1.5×.
 */

// --- Screen / grid ----------------------------------------------------------
export const WIDTH = 224;
export const HEIGHT = 288;
export const TILE = 8;
export const COLS = WIDTH / TILE; // 28
export const ROWS = HEIGHT / TILE; // 36
export const PLAY_ROW_MIN = 2;
export const PLAY_ROW_MAX = 33;

// --- Player -----------------------------------------------------------------
export const PLAYER_SPEED = 84; // px/sec
export const MAX_BULLETS = 3;
export const BULLET_SPEED = 240; // px/sec
export const SMOKE_FADE_MS = 420;
export const STARTING_LIVES = 3;
export const EXTRA_LIFE_AT = 10000;
export const RESPAWN_INVULN_MS = 1500;

// --- Speed multipliers (HARD CAP 1.5) ---------------------------------------
export const SNAKE_FAST_MULT = 1.5; // chase / enrage (was 2)
export const RED_SPEED_MULT = 1.15; // red venom: faster + reversed controls
export const GREEN_SPEED_MULT = 0.85; // green venom: slower + exposed
export const FIRE_SPEED_MULT = 1.2; // fire-infected lone snake
export const ICE_SPEED_MULT = 0.8; // ice-infected snake

// --- Snake: movement & health ----------------------------------------------
export const SNAKE_BASE_STEP_MS = 200;
export const SNAKE_MIN_STEP_MS = 90;
export const SNAKE_START_LENGTH = 3;
export const SNAKE_HP = 6;
export const BLUE_HP = 1; // weak snakes die in one shot
export const AWARENESS_FACTOR = 0.5;
export const AWARENESS_MIN = 2;
export const LOSE_INTEREST_MS = 1500;
export const DODGE_CHANCE = 0.5;
export const SNAKE_SPLIT_LENGTH = 10; // at 10 long, split into two of five
export const SNAKE_RESPAWN_MS = 1600; // spawn a fresh green if the board clears
export const MAX_SNAKES = 14; // global cap (greens + blues) for perf

// --- Snake: venom -----------------------------------------------------------
export const VENOM_SPEED = 120;
export const VENOM_COOLDOWN_MS = 600;
export const VENOM_GREEN = 0.5; // weights; blue = remainder (0.15)
export const VENOM_RED = 0.35;

// --- Player status effects --------------------------------------------------
export const EFFECT_MIN_MS = 900;
export const EFFECT_MAX_MS = 2100;
export const BLUE_FORM_MS = 5000; // time spent transformed into a blue snake
export const EGG_HATCH_MS = 1000; // egg → blue snake

// --- Pellets (auto-spawn, accelerating) -------------------------------------
export const PELLET_START_COUNT = 3;
export const PELLET_MAX = 14; // soft on-board cap
export const PELLET_INTERVAL_START = 2500; // ms between auto-spawns
export const PELLET_INTERVAL_MIN = 600;
export const PELLET_INTERVAL_DECAY = 0.97; // per spawn

// --- Infections (from player fire/ice shots) --------------------------------
export const FIRE_INFECT_MS = 6000;
export const ICE_INFECT_MS = 5000;

// --- Difficulty ramp --------------------------------------------------------
export const RAMP_INTERVAL_MS = 20000;
export const RAMP_STEP_FACTOR = 0.92;
export const RAMP_VENOM_FACTOR = 0.95;
export const VENOM_COOLDOWN_MIN = 350;

// --- Powerups ---------------------------------------------------------------
export const METER_START = 5; // pellets to first powerup
export const METER_GROW = 2; // meter size grows each fill
export const PU_MINE = 0.5; // probabilities (wingman = remainder 0.05)
export const PU_FIRE = 0.25;
export const PU_ICE = 0.2;
export const FIRE_AMMO = 3; // shots granted
export const ICE_AMMO = 3;
export const WINGMAN_MS = 5000;
export const WINGMAN_FIRE_MS = 480;
export const WINGMAN_OFFSET = 16; // px to the side of the player

// --- Scoring ----------------------------------------------------------------
export const SCORE_HEAD_HIT = 25;
export const SCORE_CUT = 50;
export const SCORE_SNAKE_KILL = 500;
export const SCORE_BLUE_KILL = 50;
export const SCORE_PELLET_DENIED = 15;
export const SCORE_MINE_KILL = 75;
export const SCORE_SURVIVE_PER_SEC = 10;

// --- Misc -------------------------------------------------------------------
export const GAMEOVER_MS = 2600;
