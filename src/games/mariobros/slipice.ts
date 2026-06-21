import Phaser from 'phaser';
import { PlatformerBody, PlatformSegment, surfaceY } from '../../shared/Platformer';
import { GRAVITY, SLIPICE_W, SLIPICE_H, SLIPICE_SPEED, SLIPICE_FRAME_MS } from './constants';
import { TX } from './sprites';

/**
 * Slipice (Freezie) — a non-target hazard. It walks the platforms looking for an
 * un-iced one; when it reaches that platform's centre it freezes it and melts
 * away. It only turns around on contact with another creature, never the player.
 * Lethal to touch; killed outright by a single bump from below (no kick).
 */
export class Slipice {
  readonly body: PlatformerBody;
  readonly sprite: Phaser.GameObjects.Image;
  dir: 1 | -1;
  floorSeg: PlatformSegment | null = null;

  private frameTimer = 0;
  private frame = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, dir: 1 | -1) {
    this.body = new PlatformerBody(x, y, SLIPICE_W, SLIPICE_H);
    this.dir = dir;
    this.sprite = scene.add.image(x, y, TX.slipiceWalk0).setDepth(9);
  }

  update(deltaMs: number, floors: PlatformSegment[]): void {
    const dt = deltaMs / 1000;
    this.body.x += this.dir * SLIPICE_SPEED * dt;
    this.body.update(deltaMs, GRAVITY, floors);
    this.floorSeg = this.body.onGround ? this.findFloor(floors) : null;
    this.sprite.setPosition(this.body.x, this.body.y).setFlipX(this.dir < 0);
    this.animate(deltaMs);
  }

  reverse(): void {
    this.dir = this.dir === 1 ? -1 : 1;
  }

  private findFloor(floors: PlatformSegment[]): PlatformSegment | null {
    for (const s of floors) {
      if (this.body.x >= s.x1 && this.body.x <= s.x2 && Math.abs(this.body.feet - surfaceY(s, this.body.x)) < 3) {
        return s;
      }
    }
    return null;
  }

  private animate(deltaMs: number): void {
    this.frameTimer += deltaMs;
    if (this.frameTimer >= SLIPICE_FRAME_MS) {
      this.frameTimer = 0;
      this.frame ^= 1;
    }
    this.sprite.setTexture(this.frame === 0 ? TX.slipiceWalk0 : TX.slipiceWalk1);
  }
}
