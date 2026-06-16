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

// --- ghosts -------------------------------------------------------------

export type GhostName = 'blinky' | 'pinky' | 'inky' | 'clyde';

// Spawn tiles: Blinky just above the door, the others inside the house.
export const GHOST_STARTS: Record<GhostName, { col: number; row: number }> = {
  blinky: { col: 13, row: 11 },
  pinky: { col: 13, row: 14 },
  inky: { col: 11, row: 14 },
  clyde: { col: 16, row: 14 },
};

// Staggered house release (ms after round start / reset).
export const GHOST_RELEASE_MS: Record<GhostName, number> = {
  blinky: 0,
  pinky: 2000,
  inky: 4000,
  clyde: 7000,
};

// Each ghost's scatter-mode home corner (may sit outside the maze — it's only
// a distance target, movement is still wall-bound).
export const SCATTER_CORNERS: Record<GhostName, { col: number; row: number }> = {
  blinky: { col: 25, row: 0 },
  pinky: { col: 2, row: 0 },
  inky: { col: 27, row: 30 },
  clyde: { col: 0, row: 30 },
};

// While leaving the house, ghosts aim up-and-out; they're "out" at this row.
export const GHOST_EXIT_TARGET = { col: 13, row: 8 } as const;
export const GHOST_EXIT_ROW = 10;

export const PINKY_LEAD = 4; // tiles ahead of Pac-Man Pinky targets
export const INKY_LEAD = 2; // tiles ahead used in Inky's vector
export const CLYDE_SCATTER_DIST = 8; // tiles; closer than this, Clyde flees home

// Global scatter <-> chase schedule (classic-style durations, ms).
export const PHASE_SCHEDULE: { mode: 'scatter' | 'chase'; ms: number }[] = [
  { mode: 'scatter', ms: 7000 },
  { mode: 'chase', ms: 20000 },
  { mode: 'scatter', ms: 7000 },
  { mode: 'chase', ms: 20000 },
  { mode: 'scatter', ms: 5000 },
  { mode: 'chase', ms: 20000 },
  { mode: 'scatter', ms: 5000 },
  { mode: 'chase', ms: Number.POSITIVE_INFINITY },
];
