// All Pac-Man tunables live here — no magic numbers in the scene.

export const TILE = 8; // px per maze cell
export const COLS = 28;
export const ROWS = 31;

// The maze sits below the HUD score line.
export const MAZE_OFFSET_X = 0;
export const MAZE_OFFSET_Y = 24;

export const PLAYER_SPEED = 70; // px/sec
export const GHOST_SPEED = 66; // slightly slower than Pac-Man so he's beatable
export const FRIGHT_SPEED = 45; // frightened ghosts crawl
export const EYES_SPEED = 130; // eaten ghosts (eyes) dash back to the house
export const CHOMP_INTERVAL = 90; // ms between open/closed mouth frames
export const GHOST_FOOT_INTERVAL = 150; // ms between ghost foot-wobble frames

export const TUNNEL_ROW = 14; // the warp row with open left/right edges

export const SCORE_DOT = 10;
export const SCORE_ENERGIZER = 50;
export const GHOST_EAT_BASE = 200; // 200/400/800/1600 for a chain of ghost eats
export const GHOST_EAT_MAX_CHAIN = 4;

export const FRIGHT_MS = 6000; // how long an energizer keeps ghosts frightened
export const FRIGHT_BLINK_MS = 2000; // final stretch where they flash a warning
export const GHOST_EAT_PAUSE_MS = 450; // brief freeze when a ghost is eaten (juice)

// --- fruit --------------------------------------------------------------

export interface FruitDef {
  key: 'cherry' | 'strawberry' | 'orange';
  points: number;
}

// Fruit appears when this many dots have been eaten this level.
export const FRUIT_THRESHOLDS = [70, 170];
export const FRUIT_VISIBLE_MS = 9000;
export const FRUIT_TILE = { col: 13, row: 17 } as const; // below the ghost house

export const FRUIT_BY_LEVEL: FruitDef[] = [
  { key: 'cherry', points: 100 },
  { key: 'strawberry', points: 300 },
  { key: 'orange', points: 500 },
];

export function fruitForLevel(level: number): FruitDef {
  return FRUIT_BY_LEVEL[Math.min(level - 1, FRUIT_BY_LEVEL.length - 1)];
}

export const LIVES_START = 3;
export const READY_MS = 1500; // pause on "READY!" before a round
export const DEATH_SPIN_MS = 900; // Pac-Man death animation
export const GAMEOVER_MS = 2500; // "GAME OVER" hold before restart
export const LEVELCLEAR_MS = 1600; // maze-flash celebration before next level
export const CATCH_DISTANCE = TILE * 0.6; // overlap that counts as caught

// Per-level speed ramp (capped so Pac-Man stays ahead of the ghosts).
export const SPEED_RAMP_PER_LEVEL = 3;
export const MAX_SPEED_LEVELS = 5;

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
// Eaten ghosts (eyes) head back here; they revive once inside the house box.
export const GHOST_HOME_TARGET = { col: 13, row: 14 } as const;
// The house interior (where eyes revive) — must be the actual box, not just
// "the bottom half of the maze".
export const HOUSE_BOX = { colMin: 11, colMax: 16, rowMin: 13, rowMax: 15 } as const;

export function isInsideHouse(col: number, row: number): boolean {
  return (
    col >= HOUSE_BOX.colMin &&
    col <= HOUSE_BOX.colMax &&
    row >= HOUSE_BOX.rowMin &&
    row <= HOUSE_BOX.rowMax
  );
}

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
