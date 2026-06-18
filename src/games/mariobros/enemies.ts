import Phaser from 'phaser';
import { PlatformerBody, PlatformSegment, surfaceY } from '../../shared/Platformer';
import {
  GRAVITY,
  SHELL_W,
  SHELL_H,
  SHELL_SPEED,
  SHELL_RECOVER_SPEED,
  SHELL_PROJECTILE_SPEED,
  SHELL_SPIN_DEG,
  SHELL_GRACE_MS,
  SHELL_FRAME_MS,
  SHELL_STUN_BLINK_MS,
} from './constants';
import { TX } from './sprites';

export type ShellState = 'walk' | 'flipped' | 'shell';

/**
 * Shellcreeper — the turtle. Walks the floors (falling through gaps to the
 * floor below, wrapping at the screen edges) on a shared PlatformerBody. A bump
 * to the platform it's standing on flips it onto its back; while flipped it's
 * helpless until it recovers (then walks faster). Kicked away while flipped.
 */
export class Shellcreeper {
  readonly body: PlatformerBody;
  readonly sprite: Phaser.GameObjects.Image;
  state: ShellState = 'walk';
  dir: 1 | -1 = 1;
  stun = 0;
  grace = 0; // a freshly kicked shell ignores Mario this long
  floorSeg: PlatformSegment | null = null;

  private speed = SHELL_SPEED;
  private frameTimer = 0;
  private frame = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, dir: 1 | -1) {
    this.body = new PlatformerBody(x, y, SHELL_W, SHELL_H);
    this.dir = dir;
    this.sprite = scene.add.image(x, y, TX.shellWalk0).setDepth(9);
  }

  update(deltaMs: number, floors: PlatformSegment[]): void {
    const dt = deltaMs / 1000;
    if (this.grace > 0) {
      this.grace -= deltaMs;
    }
    if (this.state === 'flipped') {
      this.stun -= deltaMs;
    } else {
      const sp = this.state === 'shell' ? SHELL_PROJECTILE_SPEED : this.speed;
      this.body.x += this.dir * sp * dt;
    }

    this.body.update(deltaMs, GRAVITY, floors);
    this.floorSeg = this.body.onGround ? this.findFloor(floors) : null;

    this.sprite.setPosition(this.body.x, this.body.y);
    this.animate(deltaMs);
  }

  /** Flip onto its back (bumped from below), helpless for `ms`. */
  flipFor(ms: number): void {
    this.state = 'flipped';
    this.stun = ms;
  }

  /** Recover from a flip: back on its feet, faster, heading a fresh direction. */
  recover(): void {
    this.state = 'walk';
    this.speed = SHELL_RECOVER_SPEED;
    this.dir = Math.random() < 0.5 ? 1 : -1;
  }

  get readyToRecover(): boolean {
    return this.state === 'flipped' && this.stun <= 0;
  }

  /** Kick a flipped shell into a projectile sliding in `dir`. */
  kick(dir: 1 | -1): void {
    this.state = 'shell';
    this.dir = dir;
    this.grace = SHELL_GRACE_MS;
  }

  get isShell(): boolean {
    return this.state === 'shell';
  }

  /** A kicked shell is lethal to Mario once its brief grace has elapsed. */
  get lethalShell(): boolean {
    return this.state === 'shell' && this.grace <= 0;
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
    if (this.state === 'shell') {
      // Stays upside-down and spins until it leaves the screen.
      this.sprite.setTexture(TX.shellFlip).setAlpha(1).setFlipX(false);
      this.sprite.angle += (SHELL_SPIN_DEG * deltaMs) / 1000;
      return;
    }
    if (this.state === 'flipped') {
      const blink = this.stun < SHELL_STUN_BLINK_MS && Math.floor(this.stun / 150) % 2 === 0;
      this.sprite.setTexture(TX.shellFlip).setAngle(0).setAlpha(blink ? 0.4 : 1);
      return;
    }
    this.sprite.setAngle(0).setAlpha(1).setFlipX(this.dir < 0);
    this.frameTimer += deltaMs;
    if (this.frameTimer >= SHELL_FRAME_MS) {
      this.frameTimer = 0;
      this.frame ^= 1;
    }
    this.sprite.setTexture(this.frame === 0 ? TX.shellWalk0 : TX.shellWalk1);
  }
}
