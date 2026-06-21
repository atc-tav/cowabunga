// Privacy Policy (easter egg) — a Star Wars-flavoured Galaga riff. Tunables
// mirror Galaga so the ship, bullets, and starfield feel identical.

export const WIDTH = 224;
export const HEIGHT = 288;

// --- player + bullets (identical to Galaga) ------------------------------
export const PLAYER_SPEED = 120; // px/sec, horizontal only
export const PLAYER_Y = HEIGHT - 22;
export const PLAYER_MARGIN = 12;
export const BULLET_SPEED = 320; // px/sec, upward
export const MAX_BULLETS = 2;

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

// --- cookie enemy (Galaga-style, after 1000 pts) -------------------------
export const COOKIE_TRIGGER_SCORE = 1000; // first cookie appears here
export const COOKIE_RESPAWN_MIN = 200; // next cookie after this many more pts...
export const COOKIE_RESPAWN_MAX = 500; // ...up to this many (random)
export const COOKIE_SPIN = 42; // deg/sec, slow spin
export const COOKIE_HOVER_Y = 54;
export const COOKIE_DESCEND_SPEED = 70; // px/sec dropping into the hover band
export const COOKIE_SWAY_AMP = 72; // hover sway amplitude (px)
export const COOKIE_SWAY_FREQ = 1.4; // hover sway speed (rad/sec)
export const COOKIE_DIVE_SPEED = 96; // px/sec for the dive-bomb run
export const COOKIE_DIVE_AMP = 72; // dive weave amplitude (px)
export const COOKIE_SCORE = 150;

// --- boss (every 2500 pts) ----------------------------------------------
export const BOSS_SCORE_INTERVAL = 2500;
// Colours the boss steps through as it is shot: blue -> yellow -> orange -> red.
export const BOSS_COLORS = [0x3cbcfc, 0xfcfc00, 0xffa020, 0xd82800];
// Laser bursts per volley at each colour (red is the death flash; see scene).
export const BOSS_BURSTS = [3, 4, 5, 6];
export const BOSS_HITS_TO_KILL = 3; // blue->yellow->orange->(red + explode)
export const BOSS_PATROL_Y = 46;
export const BOSS_MOVE_SPEED = 62; // px/sec side to side
export const BOSS_MARGIN = 26;
export const BOSS_SHOT_GAP = 130; // ms between lasers within a volley
export const BOSS_BURST_GAP = 1050; // ms between volleys
export const BOSS_LASER_SPEED = 132; // px/sec
export const BOSS_LASER_COLOR = 0xff5050;
export const BOSS_SCORE = 500;

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
