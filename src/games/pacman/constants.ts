// All Pac-Man tunables live here — no magic numbers in the scene.

export const TILE = 8; // px per maze cell
export const COLS = 28;
export const ROWS = 31;

// The maze sits below the HUD score line.
export const MAZE_OFFSET_X = 0;
export const MAZE_OFFSET_Y = 24;

export const PLAYER_SPEED = 70; // px/sec
export const CHOMP_INTERVAL = 90; // ms between open/closed mouth frames

export const TUNNEL_ROW = 14; // the warp row with open left/right edges

export const SCORE_DOT = 10;
export const SCORE_ENERGIZER = 50;

// Pac-Man's starting tile (bottom-centre of the maze).
export const PLAYER_START = { col: 13, row: 23 } as const;
