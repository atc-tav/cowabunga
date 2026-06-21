import { Grid } from '../Grid';

/**
 * The minimal solidity view a moving body needs to collide against a tile map.
 * Deliberately engine-free: `TileBody` (and its unit tests) depend on this
 * interface, not on Phaser or on `Grid` directly, so the collision maths runs
 * in plain Node.
 */
export interface TileSolids {
  /** Side of one square tile, in world (pre-upscale) pixels. */
  readonly tileSize: number;
  /** World-space position of the grid's top-left corner. */
  readonly offsetX: number;
  readonly offsetY: number;
  /** True when the tile at (col,row) blocks movement. Out-of-range ⇒ false. */
  isSolid(col: number, row: number): boolean;
}

/**
 * A scrolling tile world: a `Grid` of single-character tile codes plus the set
 * of codes that are solid. It's the spatial backbone of a scrolling platformer
 * — what `Grid` is to Pac-Man, `TileWorld` is to a Mario/Kirby-scale level.
 *
 * Built by `parseAsciiLevel()`; consumed by `TileBody` (collision),
 * `WorldCamera` (bounds) and `TileRenderer` (drawing).
 */
export class TileWorld implements TileSolids {
  readonly tileSize: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly cols: number;
  readonly rows: number;

  constructor(
    private readonly grid: Grid<string>,
    private readonly solidChars: ReadonlySet<string>,
    private readonly emptyChar = ' ',
  ) {
    this.tileSize = grid.tileSize;
    this.offsetX = grid.offsetX;
    this.offsetY = grid.offsetY;
    this.cols = grid.cols;
    this.rows = grid.rows;
  }

  /** Total level size in world pixels — feed straight to `WorldCamera.bindTo`. */
  get pixelWidth(): number {
    return this.cols * this.tileSize;
  }
  get pixelHeight(): number {
    return this.rows * this.tileSize;
  }

  /** Raw tile code at a cell (or `undefined` out of bounds). */
  tileAt(col: number, row: number): string | undefined {
    return this.grid.get(col, row);
  }

  isSolid(col: number, row: number): boolean {
    const code = this.grid.get(col, row);
    return code !== undefined && this.solidChars.has(code);
  }

  /** Carve a tile out (Dig Dug digging, a smashed Mario block, etc.). */
  clear(col: number, row: number): void {
    this.grid.set(col, row, this.emptyChar);
  }

  worldToCol(x: number): number {
    return Math.floor((x - this.offsetX) / this.tileSize);
  }
  worldToRow(y: number): number {
    return Math.floor((y - this.offsetY) / this.tileSize);
  }

  /** Iterate every cell (row-major) for rendering. */
  forEach(cb: (code: string, col: number, row: number) => void): void {
    this.grid.forEach(cb);
  }
}
