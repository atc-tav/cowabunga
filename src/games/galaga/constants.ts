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
