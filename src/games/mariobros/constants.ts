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
// Speed ordering is the binding faithfulness constraint (spec §0 #8): the
// Shellcreeper is the SLOWEST target, the Sidestepper the FASTEST, the
// Fighterfly in between (turtle < fly < crab). Exact numbers are feel-tuned.
export const SHELL_SPEED = 36; // px/sec walking — slowest target
export const SHELL_RECOVER_SPEED = 60; // faster after recovering from a flip
export const SHELL_STUN_MS = 4200; // time flipped before recovering
export const SHELL_STOP_WAKE_MS = 3000; // a stomped speeding shell waits 3s, then wakes
export const SHELL_STUN_BLINK_MS = 1500; // flashes when about to recover
export const SHELL_FRAME_MS = 160;
export const KICK_SCORE = 800; // kicking ANY flipped enemy off (spec §3.4 — flat 800)
export const SHELL_SCORE = KICK_SCORE; // kept for back-compat references
export const SHELL_PROJECTILE_SPEED = 84; // 2x walk speed when kicked
export const SHELL_SPIN_DEG = 600; // spin rate (deg/sec) of a sliding shell
export const SHELL_GRACE_MS = 250; // a kicked shell ignores Mario briefly
export const SHELL_BUMP_HOP = 180; // px/sec a sliding shell pops up when bumped from below

// Sidestepper (crab): takes two bumps — the first only angers (+speed), the
// second flips it. Can't be stomped while active; only killable once flipped.
export const CRAB_W = 14;
export const CRAB_H = 10;
export const CRAB_SPEED = 46; // px/sec walking — fastest target (spec §0 #8)
export const CRAB_ANGRY_SPEED = 74; // sped-up after the first bump
export const CRAB_RECOVER_SPEED = 74; // stays mad/fast after recovering from a flip
export const CRAB_SCORE = KICK_SCORE; // kick = 800 for ALL enemies (spec §3.4)

// Fighter Fly: hops along the floors and is only flippable during the brief
// grounded window between hops. Can be stomped (like the turtle).
export const FLY_W = 12;
export const FLY_H = 10;
export const FLY_SPEED = 40; // px/sec horizontal drift — between turtle & crab
export const FLY_RECOVER_SPEED = 40; // no enraged faster state (spec §4.3)
export const FLY_SCORE = KICK_SCORE; // kick = 800 for ALL enemies (spec §3.4)
export const FLY_HOP_SPEED = 210; // px/sec launch of each hop
export const FLY_GROUND_MS = 200; // grounded (flippable) dwell between hops
export const FLY_FRAME_MS = 90; // wing flap
// The fly "gets back up very quickly" after a flip (spec §4.3) — a much shorter
// flipped window than the turtle/crab (SHELL_STUN_MS), so it must be kicked fast.
export const FLY_STUN_MS = 1600;

// Slipice (Freezie): non-target hazard. Walks to a platform's centre and ices
// it. Killed by a single bump from below (no kick). Touching it kills you.
export const SLIPICE_W = 12;
export const SLIPICE_H = 10;
export const SLIPICE_SPEED = 34;
export const SLIPICE_SCORE = 500;
export const SLIPICE_FRAME_MS = 180;
export const SLIPICE_SPAWN_MS = 4500; // gap between Slipice emerging in an ice phase
export const SLIPICE_PER_PHASE = 3; // how many a phase will send out
export const ICE_FRICTION_SCALE = 0.12; // an iced platform keeps ~12% of normal friction

// Icicles: form on the underside of the top platform, then drop. Lethal only
// while falling; not enemies (can't be flipped).
export const ICICLE_W = 6;
export const ICICLE_H = 12;
export const ICICLE_FORM_MS = 2600; // hidden nub → full spike
export const ICICLE_FULL_MS = 500; // hangs full for a beat before it drops
export const ICICLE_SPAWN_MS = 1700; // gap between new icicles forming
export const ICICLE_MAX = 3; // concurrent icicles in an icicle phase

// Bonus phases: no enemies — grab all the coins before the clock runs out.
export const COIN_W = 6;
export const COIN_H = 6;
export const COIN_SCORE = 800; // per coin (spec §3.4)
export const BONUS_TIME_MS = 20000; // 20 seconds to collect them all
export const BONUS_COMPLETE_FIRST = 5000; // grabbing every coin (first bonus stage, §0 #3)
export const BONUS_COMPLETE_REPEAT = 8000; // ...and on subsequent bonus phases (§0 #3)

export const STOMP_BOUNCE = 160; // Mario's hop after a stomp
export const ENEMY_TARGET = 2; // baseline number on the board at once
export const ENEMY_LAST_MULT = 2.0; // the final enemy of a phase turns blue & super-fast

// --- phases & scoring ---------------------------------------------------

export const SPAWN_STAGGER_MS = 1500; // gap between enemies emerging from pipes
export const PHASE_INTRO_MS = 1500; // "PHASE n" banner before a phase begins
export const LOOP_SPEED_STEP = 0.12; // enemy speed bump per completed loop of phases
export const COMBO_WINDOW_MS = 1100; // chain kicks within this window add to the combo
export const COMBO_STEP = 800; // additive per chained kick (spec §0 #2)
export const COMBO_CAP = 3200; // 800/1600/2400/3200, capped (spec §0 #2)

// Extra life: granted once when the player's score first crosses this (US DIP
// factory default — spec §0 #5).
export const EXTRA_LIFE_AT = 20000;

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

