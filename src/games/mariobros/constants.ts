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

// Bump-from-below: how far the bonked platform pops up, and how fast it settles.
export const BUMP_AMP = 4; // px the platform rises
export const BUMP_RECOVER = 36; // px/sec settling back down

// --- enemies & round flow ----------------------------------------------

export const SHELL_W = 12;
export const SHELL_H = 10;
export const SHELL_SPEED = 42; // px/sec walking
export const SHELL_RECOVER_SPEED = 60; // faster after recovering from a flip
export const SHELL_STUN_MS = 4200; // time flipped before recovering
export const SHELL_STOP_WAKE_MS = 3000; // a stomped speeding shell waits 3s, then wakes
export const SHELL_STUN_BLINK_MS = 1500; // flashes when about to recover
export const SHELL_FRAME_MS = 160;
export const SHELL_SCORE = 800; // stomping a turtle / a kicked shell defeating one
export const SHELL_PROJECTILE_SPEED = 84; // 2x walk speed when kicked
export const SHELL_SPIN_DEG = 600; // spin rate (deg/sec) of a sliding shell
export const SHELL_GRACE_MS = 250; // a kicked shell ignores Mario briefly
export const SHELL_BUMP_HOP = 180; // px/sec a sliding shell pops up when bumped from below

// Sidestepper (crab): takes two bumps — the first only angers (+speed), the
// second flips it. Can't be stomped while active; only killable once flipped.
export const CRAB_W = 14;
export const CRAB_H = 10;
export const CRAB_SPEED = 38; // px/sec walking
export const CRAB_ANGRY_SPEED = 74; // sped-up after the first bump
export const CRAB_RECOVER_SPEED = 74; // stays mad/fast after recovering from a flip
export const CRAB_SCORE = 1200;

// Fighter Fly: hops along the floors and is only flippable during the brief
// grounded window between hops. Can be stomped (like the turtle).
export const FLY_W = 12;
export const FLY_H = 10;
export const FLY_SPEED = 40; // px/sec horizontal drift
export const FLY_RECOVER_SPEED = 64;
export const FLY_SCORE = 1000;
export const FLY_HOP_SPEED = 210; // px/sec launch of each hop
export const FLY_GROUND_MS = 200; // grounded (flippable) dwell between hops
export const FLY_FRAME_MS = 90; // wing flap

export const STOMP_BOUNCE = 160; // Mario's hop after a stomp
export const ENEMY_TARGET = 2; // keep this many on the board
export const ENEMY_RESPAWN_MS = 1600;

export const LIVES_START = 3;
export const READY_MS = 1300;
export const DEATH_PAUSE_MS = 1000;
export const RESPAWN_MS = 900; // a dead player (with lives left) returns after this
export const GAMEOVER_MS = 2800;

// --- two-player ---------------------------------------------------------

export type GameMode = 'solo' | 'coop' | 'versus';

// In versus, bumping the platform another player stands on knocks them over.
export const VS_STUN_MS = 1400;

// POW block: bonk from below to flip every grounded enemy; limited uses.
export const POW_USES = 3;
export const POW_W = 24;
export const POW_H = 14;

