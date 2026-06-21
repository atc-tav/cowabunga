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
