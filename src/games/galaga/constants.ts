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
export const BEAM_GROW_MS = 450;
export const BEAM_HOLD_MS = 1500;
export const BEAM_RETRACT_MS = 400;
export const BEAM_HALF_WIDTH = 24; // capture window at the bottom of the cone
export const CAPTURE_CHANCE = 0.5; // chance a boss dive becomes a capture run

// --- enemy formation ----------------------------------------------------

export type EnemyType = 'bee' | 'butterfly' | 'boss';

export const FORM_COLS = 8;
export const FORM_COL_GAP = 22;
export const FORM_ROW_GAP = 18;
export const FORM_TOP = 46;
export const FLAP_MS = 420; // wing-flap cadence (whole formation in unison)

export const ENEMY_SCORE: Record<EnemyType, number> = {
  bee: 50,
  butterfly: 80,
  boss: 150,
};

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

export const LIVES_START = 3;
export const READY_MS = 1500;
export const DEATH_PAUSE_MS = 1100;
export const GAMEOVER_MS = 2500;

export const DUAL_OFFSET = 14; // gap between the two ships of a dual fighter
export const RESCUE_FLY_MS = 450; // captive's fly-down-to-player animation
