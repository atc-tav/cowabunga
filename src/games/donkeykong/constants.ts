// Donkey Kong tunables.

export const WIDTH = 224;
export const HEIGHT = 240;

export const GRAVITY = 700; // px/sec^2
export const JUMP_SPEED = 140; // apex ~14px — clears barrels, under every girder gap (~20px min)
export const WALK_SPEED = 72; // px/sec
export const CLIMB_SPEED = 60; // px/sec on ladders
export const WALK_FRAME_MS = 120;
export const CLIMB_FRAME_MS = 130;
export const LADDER_GRAB_X = 6; // how close to a ladder's centre to mount it

export const MARIO_W = 10;
export const MARIO_H = 14;
export const GIRDER_THICKNESS = 5;

// --- barrels ------------------------------------------------------------

export const BARREL_SPEED = 46; // px/sec rolling (a faster coloured variant comes later)
export const BARREL_FALL_SPEED = 95; // px/sec dropping between girders
export const BARREL_INTERVAL_MS = 2000; // DK's base throw cadence
export const BARREL_INTERVAL_JITTER = 350; // +/- randomisation on the cadence
export const BARREL_FRAME_MS = 90;
export const BARREL_DESCEND_CHANCE = 0.6; // chance a barrel takes a ladder down
export const BARREL_RIDE = 5; // how far the barrel centre sits above a girder top
export const BARREL_HIT_DIST = 10; // collision radius vs Mario
export const BARREL_FRAMES = 4;

export const LIVES_START = 3;
export const COUNTDOWN_STEP_MS = 800; // per "3"/"2"/"1"/"GO!" beat
export const HELP_FLASH_MS = 220; // one HELP! on/off beat
export const HELP_PERIOD_MIN_MS = 5000; // periodic HELP! flash window
export const HELP_PERIOD_MAX_MS = 15000;
export const DEATH_PAUSE_MS = 900;
export const WIN_MS = 2600;
export const GAMEOVER_MS = 2600;

// --- hammer power-up ----------------------------------------------------

export const HAMMER_DURATION_MS = 6500;
export const HAMMER_BLINK_MS = 2000; // flash near the end
export const HAMMER_SWING_MS = 170; // up/down swing beat
export const HAMMER_SMASH_DIST = 13; // hammer-head reach
export const HAMMER_PICKUP_DIST = 11;
export const SCORE_SMASH = 300; // points per smashed barrel

// Hammer pickups by girder index + x (float just above the girder).
export const HAMMER_SPOTS: { g: number; x: number }[] = [
  { g: 4, x: 90 },
  { g: 2, x: 132 },
];

// --- fireball enemy -----------------------------------------------------

export const FIRE_SPEED = 40; // px/sec roaming
export const FIRE_CLIMB_SPEED = 40;
export const FIRE_RIDE = 5; // centre above the girder
export const FIRE_HIT_DIST = 10;
export const FIRE_FRAME_MS = 130;
export const FIRE_LADDER_CHANCE = 0.5; // chance to switch platform at the ladder
export const FIRE_RESPAWN_MS = 3500; // after being smashed
export const SCORE_SMASH_FIRE = 500;
// Keep the fireball patrolling the 2nd & 3rd platforms (girder indices 1-2)
// so it's always a mid-level threat that lets barrels catch up.
export const FIRE_BAND_TOP = 1;
export const FIRE_BAND_BOTTOM = 2;
