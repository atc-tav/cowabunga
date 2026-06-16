// Tile codes used by the maze map.
export const WALL = '#';
export const DOOR = '-'; // ghost-house door (impassable for Pac-Man)
export const DOT = '.';
export const ENERGIZER = 'o';
export const EMPTY = ' '; // walkable, no pellet (tunnels, ghost house)

/**
 * 28x31 Pac-Man-style maze. Pure data: it feeds the shared Grid + the scene's
 * outline renderer, so swapping in the exact arcade layout later is a data-only
 * change. Every row is exactly 28 characters (validated at build time).
 */
export const MAZE: string[] = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '######.##### ## #####.######',
  '######.##          ##.######',
  '######.## ###--### ##.######',
  '######.## #      # ##.######',
  '          #      #          ',
  '######.## #      # ##.######',
  '######.## ######## ##.######',
  '######.##          ##.######',
  '######.##### ## #####.######',
  '######.##### ## #####.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##................##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
];

/** Fresh mutable copy of the maze as a 2D char array (for the Grid). */
export function toCells(): string[][] {
  return MAZE.map((row) => row.split(''));
}
