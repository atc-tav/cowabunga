export interface Pt {
  x: number;
  y: number;
}

/**
 * Traverses a polyline at constant speed, segment by segment. The reusable
 * "move along a set route" primitive — Galaga's scripted enemy entrances now,
 * and handy anywhere something follows a fixed path. Pure (no engine deps), so
 * it's unit-testable.
 */
export class PathFollower {
  private readonly lengths: number[] = [];
  private seg = 0;
  private segDist = 0;
  private _done = false;

  constructor(
    private readonly points: Pt[],
    private readonly speed: number,
  ) {
    for (let i = 0; i < points.length - 1; i++) {
      this.lengths.push(Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y));
    }
    if (points.length < 2) {
      this._done = true;
    }
  }

  get done(): boolean {
    return this._done;
  }

  /** Advance along the path and return the new position. */
  update(deltaMs: number): Pt {
    let move = (this.speed * deltaMs) / 1000;
    while (move > 0 && this.seg < this.lengths.length) {
      const remain = this.lengths[this.seg] - this.segDist;
      if (move < remain) {
        this.segDist += move;
        move = 0;
      } else {
        move -= remain;
        this.seg++;
        this.segDist = 0;
      }
    }
    if (this.seg >= this.lengths.length) {
      this._done = true;
      return { ...this.points[this.points.length - 1] };
    }
    const a = this.points[this.seg];
    const b = this.points[this.seg + 1];
    const t = this.lengths[this.seg] === 0 ? 0 : this.segDist / this.lengths[this.seg];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
}
