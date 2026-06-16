// Donkey Kong tunables.

export const WIDTH = 224;
export const HEIGHT = 240;

export const GRAVITY = 700; // px/sec^2
export const JUMP_SPEED = 150; // px/sec — clears barrels but NOT a girder gap (use ladders)
export const WALK_SPEED = 72; // px/sec
export const CLIMB_SPEED = 60; // px/sec on ladders
export const WALK_FRAME_MS = 120;
export const CLIMB_FRAME_MS = 130;
export const LADDER_GRAB_X = 6; // how close to a ladder's centre to mount it

export const MARIO_W = 10;
export const MARIO_H = 14;
export const GIRDER_THICKNESS = 5;

// --- barrels ------------------------------------------------------------

export const BARREL_SPEED = 46; // px/sec rolling
export const BARREL_FALL_SPEED = 95; // px/sec dropping between girders
export const BARREL_INTERVAL_MS = 2600; // DK's throw cadence
export const BARREL_FRAME_MS = 90;
export const BARREL_DESCEND_CHANCE = 0.6; // chance a barrel takes a ladder down
export const BARREL_RIDE = 5; // how far the barrel centre sits above a girder top
export const BARREL_HIT_DIST = 10; // collision radius vs Mario
export const BARREL_FRAMES = 4;

export const DK_POS = { x: 42, y: 64 } as const; // sits on the top girder
export const DEATH_PAUSE_MS = 900;
