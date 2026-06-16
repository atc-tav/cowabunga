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

export const BARREL_SPEED = 72; // px/sec rolling
export const BARREL_FALL_SPEED = 95; // px/sec dropping between girders
export const BARREL_INTERVAL_MS = 1700; // DK's throw cadence
export const BARREL_FRAME_MS = 90;
export const BARREL_DESCEND_CHANCE = 0.6; // chance a barrel takes a ladder down
export const BARREL_RIDE = 5; // how far the barrel centre sits above a girder top
export const BARREL_HIT_DIST = 10; // collision radius vs Mario
export const BARREL_FRAMES = 4;

export const LIVES_START = 3;
export const READY_MS = 1200;
export const COUNTDOWN_STEP_MS = 800; // per "3"/"2"/"1"/"GO!" beat at level start
export const DEATH_PAUSE_MS = 900;
export const WIN_MS = 2600;
export const GAMEOVER_MS = 2600;
