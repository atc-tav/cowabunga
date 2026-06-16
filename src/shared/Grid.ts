/**
 * A generic 2D tile grid with world<->tile coordinate conversion. The reusable
 * spatial backbone for every grid-based game (Pac-Man maze, Dig Dug terrain,
 * Donkey Kong / Mario Bros. platforms). Holds cell data of type `T` (defaults
 * to the single-character codes used by ASCII maps) and knows where each tile
 * sits in world space via tile size + offset.
 */
export class Grid<T = string> {
  readonly cols: number;
  readonly rows: number;

  constructor(
    private readonly cells: T[][],
    readonly tileSize: number,
    readonly offsetX = 0,
    readonly offsetY = 0,
  ) {
    this.rows = cells.length;
    this.cols = cells.reduce((max, row) => Math.max(max, row.length), 0);
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  get(col: number, row: number): T | undefined {
    return this.inBounds(col, row) ? this.cells[row][col] : undefined;
  }

  set(col: number, row: number, value: T): void {
    if (this.inBounds(col, row)) {
      this.cells[row][col] = value;
    }
  }

  /** World-space X of the centre of a tile column. */
  tileToWorldX(col: number): number {
    return this.offsetX + col * this.tileSize + this.tileSize / 2;
  }

  /** World-space Y of the centre of a tile row. */
  tileToWorldY(row: number): number {
    return this.offsetY + row * this.tileSize + this.tileSize / 2;
  }

  worldToCol(x: number): number {
    return Math.floor((x - this.offsetX) / this.tileSize);
  }

  worldToRow(y: number): number {
    return Math.floor((y - this.offsetY) / this.tileSize);
  }

  forEach(cb: (value: T, col: number, row: number) => void): void {
    for (let row = 0; row < this.cells.length; row++) {
      const line = this.cells[row];
      for (let col = 0; col < line.length; col++) {
        cb(line[col], col, row);
      }
    }
  }
}
