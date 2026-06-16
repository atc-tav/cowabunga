/** A horizontal platform top surface spanning [x1, x2] at height `y`. */
export interface PlatformSegment {
  x1: number;
  x2: number;
  y: number;
}

/**
 * Minimal side-on platformer body: gravity, landing on one-way platform tops,
 * and jumping. Horizontal motion is driven by the caller (set `x`); this owns
 * vertical physics and ground detection. Pure (no engine deps) so it's
 * unit-testable — reused by Donkey Kong now and Mario Bros. next.
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

  jump(speed: number): void {
    if (this.onGround) {
      this.vy = -speed;
      this.onGround = false;
    }
  }

  /** Apply gravity, move vertically, and land on any platform crossed from above. */
  update(deltaMs: number, gravity: number, segments: PlatformSegment[]): void {
    const dt = deltaMs / 1000;
    const prevFeet = this.feet;
    this.vy += gravity * dt;
    this.y += this.vy * dt;
    this.onGround = false;

    if (this.vy >= 0) {
      const feet = this.feet;
      for (const s of segments) {
        if (this.x >= s.x1 && this.x <= s.x2 && prevFeet <= s.y + 2 && feet >= s.y) {
          this.y = s.y - this.height / 2;
          this.vy = 0;
          this.onGround = true;
          break;
        }
      }
    }
  }
}
