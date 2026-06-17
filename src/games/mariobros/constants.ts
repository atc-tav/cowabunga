// Mario Bros. (original single-screen) tunables.

export const WIDTH = 256;
export const HEIGHT = 240;

export const GRAVITY = 700; // px/sec^2
export const JUMP_SPEED = 265; // px/sec — clears the 48px floor spacing to ascend/bump

// Run with momentum/skid (the slippery Mario Bros feel).
export const RUN_ACCEL = 650; // px/sec^2 on the ground
export const AIR_ACCEL = 320; // reduced control mid-air
export const RUN_MAX = 100; // px/sec top speed
export const GROUND_FRICTION = 520; // deceleration when not pressing
export const AIR_FRICTION = 110; // very little — you keep your momentum airborne

export const MARIO_W = 10;
export const MARIO_H = 14;
export const WALK_FRAME_MS = 100;

export const PLATFORM_THICKNESS = 10;
