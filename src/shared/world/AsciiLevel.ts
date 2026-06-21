import { Grid } from '../Grid';
import { TileWorld } from './TileWorld';

/**
 * What a single legend character means. A char can be a solid tile, an entity
 * spawn marker, or both-absent (decorative/empty). The specs author levels as
 * ASCII art, so this is the natural ingestion format for a clone.
 */
export interface TileLegendEntry {
  /** Blocks movement (wall, floor, block). */
  solid?: boolean;
  /**
   * An entity spawn marker. The cell is recorded as a `Spawn` and then erased
   * from the tile grid, so a 'P' or 'E' neither renders as a tile nor collides.
   */
  spawn?: boolean;
}

export type TileLegend = Record<string, TileLegendEntry>;

export interface Spawn {
  /** The legend character that produced this spawn (e.g. 'P', 'E', '$'). */
  char: string;
  col: number;
  row: number;
  /** World-space centre of the tile — ready to position a sprite. */
  x: number;
  y: number;
}

export interface ParsedLevel {
  world: TileWorld;
  /** Spawn markers in reading order (top-to-bottom, left-to-right). */
  spawns: Spawn[];
  cols: number;
  rows: number;
  pixelWidth: number;
  pixelHeight: number;
}

export interface AsciiLevelOptions {
  /** Side of one tile in world pixels. */
  tileSize: number;
  /** World position of the level's top-left corner (default 0,0). */
  offsetX?: number;
  offsetY?: number;
  /** Tile code a spawn marker leaves behind (default ' ', i.e. empty). */
  emptyChar?: string;
}

/**
 * Parse an ASCII level (an array of equal-or-ragged rows) into a `TileWorld`
 * plus its entity spawn points, using a legend that says which characters are
 * solid and which are spawn markers. Pure — no engine, no globals — so it's the
 * cheapest possible thing to unit-test.
 *
 *   const { world, spawns } = parseAsciiLevel(
 *     ['          ', '   P      ', 'XXXX  XXXX'],
 *     { X: { solid: true }, P: { spawn: true } },
 *     { tileSize: 16 },
 *   );
 *
 * Rows may be ragged; short rows are padded with `emptyChar` to the widest row.
 */
export function parseAsciiLevel(
  rows: string[],
  legend: TileLegend,
  opts: AsciiLevelOptions,
): ParsedLevel {
  const { tileSize, offsetX = 0, offsetY = 0, emptyChar = ' ' } = opts;
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);

  const solidChars = new Set<string>();
  for (const [char, entry] of Object.entries(legend)) {
    if (entry.solid) {
      solidChars.add(char);
    }
  }

  const cells: string[][] = [];
  const spawns: Spawn[] = [];

  for (let row = 0; row < rows.length; row++) {
    const line = rows[row];
    const cellRow: string[] = [];
    for (let col = 0; col < width; col++) {
      const char = col < line.length ? line[col] : emptyChar;
      if (legend[char]?.spawn) {
        spawns.push({
          char,
          col,
          row,
          x: offsetX + col * tileSize + tileSize / 2,
          y: offsetY + row * tileSize + tileSize / 2,
        });
        cellRow.push(emptyChar);
      } else {
        cellRow.push(char);
      }
    }
    cells.push(cellRow);
  }

  const grid = new Grid<string>(cells, tileSize, offsetX, offsetY);
  const world = new TileWorld(grid, solidChars, emptyChar);

  return {
    world,
    spawns,
    cols: width,
    rows: rows.length,
    pixelWidth: width * tileSize,
    pixelHeight: rows.length * tileSize,
  };
}
