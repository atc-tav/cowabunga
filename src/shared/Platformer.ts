/**
 * A platform top surface from x1..x2, sloping linearly from y1 (at x1) to y2
 * (at x2). Horizontal platforms simply have y1 === y2.
 */
export interface PlatformSegment {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

/** Height of a segment's top surface at world x (clamped to the segment). */
export function surfaceY(s: PlatformSegment, x: number): number {
  const span = s.x2 - s.x1;
  const t = span === 0 ? 0 : Math.max(0, Math.min(1, (x - s.x1) / span));
  return s.y1 + (s.y2 - s.y1) * t;
}

const STICK = 7; // max step the body snaps to when following a sloped surface

/**
 * Minimal side-on platformer body with sloped-platform support: gravity,
 * sticking to / walking up and down slopes, landing from the air, and jumping.
 * Horizontal motion is driven by the caller (set `x`). Pure (no engine deps),
 * so it's unit-testable — reused by Donkey Kong now and Mario Bros. next.
 */
export class PlatformerBody {
  vy = 0;
  onGround = false;

  constructor(
    public x: number,
    public y: number, // centre
    public readonly width: number,
    public readonly height: number,
  ) {}

  get feet(): number {
    return this.y + this.height / 2;
  }

  setFeet(feet: number): void {
    this.y = feet - this.height / 2;
  }

  jump(speed: number): void {
    if (this.onGround) {
      this.vy = -speed;
      this.onGround = false;
    }
  }

  update(deltaMs: number, gravity: number, segments: PlatformSegment[]): void {
    const dt = deltaMs / 1000;

    // Grounded: stick to the surface under us (follows slopes), unless we've
    // walked off its end — then start falling.
    if (this.onGround) {
      const sy = this.surfaceUnder(segments);
      if (sy !== undefined && Math.abs(this.feet - sy) <= STICK) {
        this.setFeet(sy);
        this.vy = 0;
        this.onGround = true;
        return;
      }
      this.onGround = false;
    }

    // Airborne: gravity + land on any surface crossed from above.
    const prevFeet = this.feet;
    this.vy += gravity * dt;
    this.y += this.vy * dt;
    this.onGround = false;
    if (this.vy >= 0) {
      let landY: number | undefined;
      for (const s of segments) {
        if (this.x < s.x1 || this.x > s.x2) {
          continue;
        }
        const sy = surfaceY(s, this.x);
        if (prevFeet <= sy + 2 && this.feet >= sy && (landY === undefined || sy < landY)) {
          landY = sy;
        }
      }
      if (landY !== undefined) {
        this.setFeet(landY);
        this.vy = 0;
        this.onGround = true;
      }
    }
  }

  /** Nearest surface height to our feet among segments we're over (or undefined). */
  private surfaceUnder(segments: PlatformSegment[]): number | undefined {
    let best: number | undefined;
    let bestDist = Infinity;
    for (const s of segments) {
      if (this.x < s.x1 || this.x > s.x2) {
        continue;
      }
      const sy = surfaceY(s, this.x);
      const dist = Math.abs(this.feet - sy);
      if (dist < bestDist) {
        bestDist = dist;
        best = sy;
      }
    }
    return best;
  }
}
