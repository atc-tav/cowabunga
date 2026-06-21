import { TileSolids } from './TileWorld';

/** Which faces of the body touched solid tiles on the most recent `update()`. */
export interface TileContacts {
  onGround: boolean;
  ceiling: boolean;
  left: boolean;
  right: boolean;
}

// Shrinks the perpendicular span when scanning tiles so a body flush against a
// floor doesn't register a phantom side-collision with that same floor.
const EDGE_EPSILON = 0.01;

/**
 * An axis-aligned body that moves through a `TileSolids` map under gravity, with
 * swept per-axis collision resolution (X first, then Y — the standard order that
 * avoids snagging on tile seams). This is the scrolling-platformer counterpart
 * to the single-screen, segment-based `PlatformerBody`.
 *
 * Engine-free and deterministic: the caller drives horizontal intent via `vx`
 * and calls `update(deltaMs, gravity, world)`. Position is the centre of the
 * body. Because there are no Phaser deps, the collision maths is unit-tested in
 * plain Node.
 *
 * Note: horizontal motion is not sub-stepped, so (like `PlatformerBody`) a body
 * should not move more than ~one tile per frame; sub-stepping can be layered on
 * later for very high speeds.
 */
export class TileBody {
  vx = 0;
  vy = 0;
  onGround = false;
  contacts: TileContacts = { onGround: false, ceiling: false, left: false, right: false };

  constructor(
    public x: number, // centre
    public y: number, // centre
    public readonly width: number,
    public readonly height: number,
  ) {}

  get left(): number {
    return this.x - this.width / 2;
  }
  get right(): number {
    return this.x + this.width / 2;
  }
  get top(): number {
    return this.y - this.height / 2;
  }
  get bottom(): number {
    return this.y + this.height / 2;
  }

  /** Launch upward only when standing on something. */
  jump(speed: number): void {
    if (this.onGround) {
      this.vy = -speed;
      this.onGround = false;
    }
  }

  update(deltaMs: number, gravity: number, world: TileSolids): void {
    const dt = deltaMs / 1000;
    this.vy += gravity * dt;

    const contacts: TileContacts = {
      onGround: false,
      ceiling: false,
      left: false,
      right: false,
    };
    this.moveX(this.vx * dt, world, contacts);
    this.moveY(this.vy * dt, world, contacts);

    this.onGround = contacts.onGround;
    this.contacts = contacts;
  }

  private moveX(dx: number, world: TileSolids, contacts: TileContacts): void {
    if (dx === 0) {
      return;
    }
    this.x += dx;
    const { tileSize: ts, offsetX: ox, offsetY: oy } = world;
    const rowStart = Math.floor((this.top + EDGE_EPSILON - oy) / ts);
    const rowEnd = Math.floor((this.bottom - EDGE_EPSILON - oy) / ts);

    if (dx > 0) {
      const col = Math.floor((this.right - ox) / ts);
      for (let row = rowStart; row <= rowEnd; row++) {
        if (world.isSolid(col, row)) {
          this.x = ox + col * ts - this.width / 2;
          this.vx = 0;
          contacts.right = true;
          return;
        }
      }
    } else {
      const col = Math.floor((this.left - ox) / ts);
      for (let row = rowStart; row <= rowEnd; row++) {
        if (world.isSolid(col, row)) {
          this.x = ox + (col + 1) * ts + this.width / 2;
          this.vx = 0;
          contacts.left = true;
          return;
        }
      }
    }
  }

  private moveY(dy: number, world: TileSolids, contacts: TileContacts): void {
    if (dy === 0) {
      return;
    }
    this.y += dy;
    const { tileSize: ts, offsetX: ox, offsetY: oy } = world;
    const colStart = Math.floor((this.left + EDGE_EPSILON - ox) / ts);
    const colEnd = Math.floor((this.right - EDGE_EPSILON - ox) / ts);

    if (dy > 0) {
      const row = Math.floor((this.bottom - oy) / ts);
      for (let col = colStart; col <= colEnd; col++) {
        if (world.isSolid(col, row)) {
          this.y = oy + row * ts - this.height / 2;
          this.vy = 0;
          contacts.onGround = true;
          return;
        }
      }
    } else {
      const row = Math.floor((this.top - oy) / ts);
      for (let col = colStart; col <= colEnd; col++) {
        if (world.isSolid(col, row)) {
          this.y = oy + (row + 1) * ts + this.height / 2;
          this.vy = 0;
          contacts.ceiling = true;
          return;
        }
      }
    }
  }
}
