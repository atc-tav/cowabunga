// Galaga tunables — no magic numbers in the scene.

export const WIDTH = 224;
export const HEIGHT = 288;

export const PLAYER_SPEED = 120; // px/sec, horizontal only
export const PLAYER_Y = HEIGHT - 22; // fixed firing line near the bottom
export const PLAYER_MARGIN = 12; // keep the ship fully on screen

export const BULLET_SPEED = 320; // px/sec, upward
export const MAX_BULLETS = 2; // classic Galaga only allows two shots in flight

// Scrolling starfield (parallax tiers).
export const STAR_COUNT = 60;
export const STAR_SPEEDS = [16, 30, 48];
export const STAR_ALPHA = 0.5; // dimmed so enemy bolts stay readable

// --- tractor beam (capture) ---------------------------------------------

export const BEAM_HOVER_Y = 118; // where the capturing boss hovers
export const APPROACH_SPEED = 110;
export const BEAM_GROW_MS = 600;
export const BEAM_HOLD_MS = 1900;
export const BEAM_RETRACT_MS = 450;
export const BEAM_HALF_WIDTH = 24; // capture window at the bottom of the cone
export const BEAM_LOCK_MS = 850; // time in-beam before the beam locks and captures
export const PULL_MS = 1000; // caught ship spins/rises into the boss
export const TOW_MS = 750; // boss tows the captured ship up off the top
export const CAPTURE_INTERVAL_MS = 5000; // how often a boss attempts a capture run

// --- enemy formation ----------------------------------------------------

export type EnemyType = 'bee' | 'butterfly' | 'boss';

export const FORM_COLS = 8;
export const FORM_COL_GAP = 22;
export const FORM_ROW_GAP = 18;
export const FORM_TOP = 46;
export const FLAP_MS = 420; // wing-flap cadence (whole formation in unison)

export const ENEMY_SCORE_FORMATION: Record<EnemyType, number> = {
  bee: 50,
  butterfly: 80,
  boss: 150,
};

// Diving / flying-in (i.e. not seated in formation) is worth more.
export const ENEMY_SCORE_ATTACK: Record<EnemyType, number> = {
  bee: 100,
  butterfly: 160,
  boss: 400,
};

/** Alias used by the challenge stage, where enemies are always "attacking". */
export const ENEMY_SCORE = ENEMY_SCORE_FORMATION;

export const BOSS_HITS = 2; // Boss Galaga takes two hits (color change after one)

export const EXPLOSION_FRAME_MS = 55;
export const WAVE_RESPAWN_MS = 1200;

// --- formation fly-in ---------------------------------------------------

export const ENTRY_SPEED = 95; // px/sec along the entry path
export const ENTRY_STAGGER_MS = 160; // delay between successive enemies launching
export const ENTRY_STEPS = 20; // points sampled along each entry curve
export const SWAY_AMP = 6; // formation "breathing" horizontal amplitude (px)
export const SWAY_FREQ = 1.6; // breathing speed (rad/sec)

// --- dives, enemy fire, lives -------------------------------------------
// Keep DIVE_SPEED < ENEMY_BULLET_SPEED so ships never outrun their own bolts.
export const DIVE_SPEED = 105; // px/sec along a dive path
export const DIVE_STEPS = 24; // points sampled along each dive curve
export const DIVE_INTERVAL_MS = 2200; // gap between launching dives
export const MAX_DIVERS = 2; // simultaneous divers

export const ENEMY_BULLET_SPEED = 175;
export const ENEMY_FIRE_MS = 800; // per-diver fire cadence
export const ENEMY_FIRE_MIN_MS = 440; // floor at high waves

export const LIVES_START = 3;
export const MAX_LIVES = 18;
// Extra fighter at 20k, then every 70k (70k, 140k, ...); none past 1,000,000.
export const EXTRA_LIFE_FIRST = 20000;
export const EXTRA_LIFE_REPEAT = 70000;
export const EXTRA_LIFE_MAX_SCORE = 1000000;
export const READY_MS = 1500;
export const DEATH_PAUSE_MS = 1100;
export const GAMEOVER_MS = 2500;

// Dual-fighter ships sit exactly one formation column apart, so the twin shots
// line up with two adjacent enemies (the whole point of doubling up).
export const DUAL_OFFSET = FORM_COL_GAP;
export const RESCUE_FLY_MS = 1000; // captive's fly-down (match the capture length)
export const INVULN_MS = 1000; // brief i-frames after losing a wingman
export const DIVE_GRACE_MS = 800; // breathing space before diving starts each stage

// --- waves & difficulty ramp --------------------------------------------

export const WAVE_SPEED_RAMP = 8; // px/sec added to entry+dive per wave
export const MAX_WAVE_RAMP = 6; // cap the ramp
export const DIVE_INTERVAL_MIN_MS = 1000;
export const STAGE_BANNER_MS = 1400;

// --- challenge (bonus) stage --------------------------------------------

export const CHALLENGE_EVERY = 4; // every Nth wave is a no-fire bonus stage
export const CHALLENGE_BONUS_PER = 100; // per enemy shot
export const CHALLENGE_PERFECT_BONUS = 1000; // shooting the whole stage
export const CHALLENGE_SPEED = 125; // px/sec along a flythrough chain
export const CHAIN_STAGGER_MS = 130; // gap between enemies in a chain
export const CHALLENGE_SAFETY_MS = 30000; // hard cap on a challenge stage
export const CHALLENGE_PATTERN_COUNT = 6; // number of distinct chain patterns
export const CHAIN_FIRST_AT_MS = 700; // breathing space before the first chain
export const CHAIN_GAP_MS = 1200; // empty-screen gap between chains (>=1s)
export const CHALLENGE_BASE_CHAINS = 4; // chains in the first challenge stage
export const CHALLENGE_CHAIN_COUNT = 6; // enemies per chain
