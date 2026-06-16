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
