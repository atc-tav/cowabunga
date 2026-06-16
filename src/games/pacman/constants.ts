// All Pac-Man tunables live here — no magic numbers in the scene.

export const TILE = 8; // px per maze cell
export const COLS = 28;
export const ROWS = 31;

// The maze sits below the HUD score line.
export const MAZE_OFFSET_X = 0;
export const MAZE_OFFSET_Y = 24;

export const PLAYER_SPEED = 70; // px/sec
export const GHOST_SPEED = 66; // slightly slower than Pac-Man so he's beatable
export const CHOMP_INTERVAL = 90; // ms between open/closed mouth frames
export const GHOST_FOOT_INTERVAL = 150; // ms between ghost foot-wobble frames

export const TUNNEL_ROW = 14; // the warp row with open left/right edges

export const SCORE_DOT = 10;
export const SCORE_ENERGIZER = 50;

export const LIVES_START = 3;
export const READY_MS = 1500; // pause on "READY!" before a round
export const DEATH_SPIN_MS = 900; // Pac-Man death animation
export const GAMEOVER_MS = 2500; // "GAME OVER" hold before restart
export const CATCH_DISTANCE = TILE * 0.6; // overlap that counts as caught

// Pac-Man's starting tile (bottom-centre of the maze).
export const PLAYER_START = { col: 13, row: 23 } as const;
// Blinky starts on an open central corridor; a proper ghost-house exit
// arrives with the full ghost quartet in the next slice.
export const BLINKY_START = { col: 13, row: 5 } as const;
