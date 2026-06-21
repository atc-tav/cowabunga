import Phaser from 'phaser';
import { GRAVITY, ICICLE_FORM_MS, ICICLE_FULL_MS } from './constants';
import { TX } from './sprites';

export type IcicleState = 'forming' | 'full' | 'falling' | 'done';

/**
 * An icicle on the underside of the top platform. It grows (hidden nub → full
 * spike), hangs a beat, then drops. It is lethal to a player only while
 * `falling` — it is scenery, not an enemy, so it can't be flipped.
 */
export class Icicle {
  readonly sprite: Phaser.GameObjects.Image;
  readonly anchorX: number;
  state: IcicleState = 'forming';

  private timer = ICICLE_FORM_MS;
  private vy = 0;
  private y: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.anchorX = x;
    this.y = y;
    this.sprite = scene.add.image(x, y, TX.icicleForm0).setOrigin(0.5, 0).setDepth(8);
  }

  update(deltaMs: number, killY: number): void {
    const dt = deltaMs / 1000;
    if (this.state === 'forming') {
      this.timer -= deltaMs;
      const progress = 1 - this.timer / ICICLE_FORM_MS;
      this.sprite.setTexture(progress < 0.5 ? TX.icicleForm0 : progress < 0.85 ? TX.icicleForm1 : TX.icicleForm2);
      if (this.timer <= 0) {
        this.state = 'full';
        this.timer = ICICLE_FULL_MS;
        this.sprite.setTexture(TX.icicleForm2);
      }
    } else if (this.state === 'full') {
      this.timer -= deltaMs;
      if (this.timer <= 0) {
        this.state = 'falling';
      }
    } else if (this.state === 'falling') {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      this.sprite.y = this.y;
      if (this.y > killY) {
        this.state = 'done';
      }
    }
  }

  get lethal(): boolean {
    return this.state === 'falling';
  }

  get done(): boolean {
    return this.state === 'done';
  }
}
