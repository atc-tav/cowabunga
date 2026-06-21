// Privacy Policy (easter egg) — a Star Wars-flavoured Galaga riff. Tunables
// mirror Galaga so the ship, bullets, and starfield feel identical.

export const WIDTH = 224;
export const HEIGHT = 288;

// --- player + bullets (identical to Galaga) ------------------------------
export const PLAYER_SPEED = 120; // px/sec, horizontal only
export const PLAYER_Y = HEIGHT - 42; // raised to leave room for the stats bar
export const PLAYER_MARGIN = 12;
export const BULLET_SPEED = 320; // px/sec, upward
export const MAX_BULLETS = 2;
export const DESPAWN_Y = HEIGHT - 24; // words "slip past" (and vanish) here
export const STATS_Y = HEIGHT - 3; // bottom stats bar baseline

// --- starfield (identical to Galaga) -------------------------------------
export const STAR_COUNT = 60;
export const STAR_SPEEDS = [16, 30, 48];
export const STAR_ALPHA = 0.5;

// --- intro crawl ---------------------------------------------------------
export const INTRO_MS = 4200; // logo zoom-out duration

// --- falling words -------------------------------------------------------
export const WORD_SPEED_BASE = 26; // px/sec at the start
export const WORD_SPEED_RAMP = 2.4; // +px/sec for every second survived
export const WORD_SPEED_MAX = 165;
export const WORD_SPAWN_MS = 900; // initial gap between words
export const WORD_SPAWN_MIN_MS = 360;
export const WORD_SPAWN_RAMP = 9; // ms shaved off the gap per second survived
export const WORD_SCORE = 20;
export const BEAT_MS = 700; // extra pause after a sentence-ending word (a breather)

// --- cookie enemy (Galaga-style) ----------------------------------------
export const COOKIE_FIRST_MIN = 450; // first cookie appears between these...
export const COOKIE_FIRST_MAX = 550; // ...scores (random)
export const COOKIE_RESPAWN_MIN = 200; // next cookie after this many more pts...
export const COOKIE_RESPAWN_MAX = 500; // ...up to this many (random)
export const COOKIE_SPIN = 42; // deg/sec, slow spin
export const COOKIE_HOVER_Y = 54;
export const COOKIE_DESCEND_SPEED = 70; // px/sec dropping into the hover band
export const COOKIE_SWAY_AMP = 46; // hover sway amplitude (px)
export const COOKIE_SWAY_FREQ = 1.4; // hover sway speed (rad/sec)
export const COOKIE_DIVE_SPEED = 96; // px/sec for the dive-bomb run
export const COOKIE_DIVE_AMP = 64; // dive weave amplitude (px)
export const COOKIE_SCORE = 150;
// Standard (hovering) cookies shoot; max on screen = floor(score / this).
export const COOKIE_PER_SCORE = 1000;
export const COOKIE_FIRE_MS = 1600; // base gap between a cookie's shots
export const COOKIE_FIRE_JITTER = 900; // randomised on top of the base gap
export const COOKIE_BULLET_SPEED = 108; // px/sec, aimed at the player
export const COOKIE_BULLET_COLOR = 0xff8a3c;

// --- boss (~ every 1250-1550 pts) ---------------------------------------
export const BOSS_INTERVAL_MIN = 1250;
export const BOSS_INTERVAL_MAX = 1550;
// Colours the boss steps through as it is shot: blue -> yellow -> orange -> red.
export const BOSS_COLORS = [0x3cbcfc, 0xfcfc00, 0xffa020, 0xd82800];
// Laser bursts per volley at each colour (red is the death flash; see scene).
export const BOSS_BURSTS = [3, 4, 5, 6];
export const BOSS_HITS_TO_KILL = 3; // blue->yellow->orange->(red + explode)
export const BOSS_SIZE = 2; // scale it expands to on the first hit
export const BOSS_GROW = 1.1; // +10% size each subsequent colour change
export const BOSS_SPEED_GROW = 1.1; // +10% move speed each colour change
export const BOSS_PATROL_Y = 46;
export const BOSS_MOVE_SPEED = 50; // px/sec side to side (base)
export const BOSS_MARGIN = 26;
export const BOSS_SHOT_GAP = 130; // ms between lasers within a volley
export const BOSS_BURST_GAP = 1050; // ms between volleys
export const BOSS_LASER_SPEED = 132; // px/sec
export const BOSS_LASER_COLOR = 0xff5050;
export const BOSS_SCORE = 500;

// --- levels -------------------------------------------------------------
export const LEVEL_BANNER_MS = 1900; // "LEVEL N" breather after a boss

// The "policy" the player shoots their way through. Split into words at runtime.
export const POLICY_TEXT = `This Privacy Policy explains how we collect, use,
store, and disclose your personal information when you play our games. We may
collect device identifiers, gameplay statistics, high scores, approximate
location, and cookies. We use this data to operate, maintain, and improve the
service, to personalize content, and to comply with our legal obligations. We do
not sell your personal information to third parties. We may share data with
service providers who process it on our behalf under strict confidentiality. You
have the right to access, correct, or delete your data at any time. By continuing
to play, you consent to the terms described in this policy.`;
