import { Grid } from './Grid';

export interface Vec2 {
  x: number;
  y: number;
}

export interface GridMoverConfig {
  grid: Grid;
  startCol: number;
  startRow: number;
  /** Movement speed in pixels/second. */
  speed: number;
  /** Game-supplied rule for which tiles are walkable (keeps walls out of here). */
  canEnter: (col: number, row: number) => boolean;
}

/**
 * Grid-aligned movement with wall blocking and turn buffering — the classic
 * arcade feel where a queued direction is taken the instant a corner allows it.
 * Knows nothing about walls itself; the game passes a `canEnter` predicate, so
 * the same mover drives Pac-Man, the ghosts, and Dig Dug alike.
 *
 * Pump `update(delta)` each frame, set intent with `setDesired()`, read world
 * position from `x`/`y`. Direction only changes at tile centres, which keeps
 * everything snapped to the grid.
 */
export class GridMover {
  private readonly grid: Grid;
  private readonly speed: number;
  private readonly canEnter: (col: number, row: number) => boolean;

  private _x: number;
  private _y: number;
  private _dir: Vec2 = { x: 0, y: 0 };
  private desired: Vec2 = { x: 0, y: 0 };

  constructor(cfg: GridMoverConfig) {
    this.grid = cfg.grid;
    this.speed = cfg.speed;
    this.canEnter = cfg.canEnter;
    this._x = cfg.grid.tileToWorldX(cfg.startCol);
    this._y = cfg.grid.tileToWorldY(cfg.startRow);
  }

  get x(): number {
    return this._x;
  }

  get y(): number {
    return this._y;
  }

  get dir(): Vec2 {
    return this._dir;
  }

  get moving(): boolean {
    return this._dir.x !== 0 || this._dir.y !== 0;
  }

  currentTile(): { col: number; row: number } {
    return {
      col: this.grid.worldToCol(this._x),
      row: this.grid.worldToRow(this._y),
    };
  }

  /** Queue an intended direction; applied at the next tile centre if walkable. */
  setDesired(x: number, y: number): void {
    this.desired = { x, y };
  }

  /** Hard-set world position (e.g. tunnel warp); direction is preserved. */
  teleport(x: number, y: number): void {
    this._x = x;
    this._y = y;
  }

  /** Halt movement and clear any queued turn. */
  stop(): void {
    this._dir = { x: 0, y: 0 };
    this.desired = { x: 0, y: 0 };
  }

  update(deltaMs: number): void {
    const step = (this.speed * deltaMs) / 1000;
    const col = this.grid.worldToCol(this._x);
    const row = this.grid.worldToRow(this._y);
    const centreX = this.grid.tileToWorldX(col);
    const centreY = this.grid.tileToWorldY(row);

    // At a tile centre we can change direction.
    if (Math.abs(this._x - centreX) <= step && Math.abs(this._y - centreY) <= step) {
      this._x = centreX;
      this._y = centreY;

      const wantsTurn = this.desired.x !== 0 || this.desired.y !== 0;
      if (wantsTurn && this.canEnter(col + this.desired.x, row + this.desired.y)) {
        this._dir = { ...this.desired };
      }
      // Stop if the path ahead is blocked.
      if (!this.canEnter(col + this._dir.x, row + this._dir.y)) {
        this._dir = { x: 0, y: 0 };
      }
    }

    this._x += this._dir.x * step;
    this._y += this._dir.y * step;
  }
}
