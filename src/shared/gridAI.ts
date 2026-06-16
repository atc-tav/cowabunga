import type { Vec2 } from './GridMover';

/**
 * Tie-break preference order for grid AI: up, left, down, right. This is the
 * classic arcade rule — when two routes are equally close to the target, the
 * earlier direction wins.
 */
export const PREFERRED_DIRECTIONS: Vec2[] = [
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 0 },
];

/**
 * Pick the direction that moves a grid actor closest to a target tile, the way
 * arcade ghosts decide at each intersection: never reverse, only walkable
 * tiles, choose the neighbour minimising straight-line distance to the target
 * (ties broken by PREFERRED_DIRECTIONS). Reverses only at a dead end.
 *
 * Pure and engine-free, so it's unit-testable and reusable by any chasing
 * grid enemy (Pac-Man ghosts now, Dig Dug enemies later).
 */
export function chooseDirectionToward(
  col: number,
  row: number,
  currentDir: Vec2,
  targetCol: number,
  targetRow: number,
  canEnter: (col: number, row: number) => boolean,
): Vec2 {
  const reverse = { x: -currentDir.x, y: -currentDir.y };
  let best: Vec2 | null = null;
  let bestDist = Infinity;

  for (const dir of PREFERRED_DIRECTIONS) {
    if (dir.x === reverse.x && dir.y === reverse.y) {
      continue; // never reverse mid-corridor
    }
    const nc = col + dir.x;
    const nr = row + dir.y;
    if (!canEnter(nc, nr)) {
      continue;
    }
    const dist = (nc - targetCol) ** 2 + (nr - targetRow) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = dir;
    }
  }

  if (best) {
    return best;
  }
  // Dead end: turn around if we can, otherwise stay put.
  return canEnter(col + reverse.x, row + reverse.y) ? reverse : { x: 0, y: 0 };
}

/**
 * Pick a pseudo-random walkable, non-reversing direction — the movement model
 * for frightened ghosts (and any "wandering" grid enemy). Falls back to a
 * U-turn at dead ends. `rng` is injectable for deterministic testing.
 */
export function chooseRandomDirection(
  col: number,
  row: number,
  currentDir: Vec2,
  canEnter: (col: number, row: number) => boolean,
  rng: () => number = Math.random,
): Vec2 {
  const reverse = { x: -currentDir.x, y: -currentDir.y };
  const options = PREFERRED_DIRECTIONS.filter(
    (dir) =>
      !(dir.x === reverse.x && dir.y === reverse.y) && canEnter(col + dir.x, row + dir.y),
  );
  if (options.length > 0) {
    return options[Math.floor(rng() * options.length)];
  }
  return canEnter(col + reverse.x, row + reverse.y) ? reverse : { x: 0, y: 0 };
}
