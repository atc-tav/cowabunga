import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import {
  WIDTH,
  HEIGHT,
  PLAYER_SPEED,
  PLAYER_Y,
  PLAYER_MARGIN,
  BULLET_SPEED,
  MAX_BULLETS,
} from './constants';
import { buildGalagaTextures, TX } from './sprites';
import { Starfield } from './starfield';

/**
 * Galaga — slice 1: the player fighter and shooting, over a scrolling
 * starfield. Fixed horizontal movement, up to two bolts in flight (classic
 * limit). Enemies, formations, and dives come in later slices.
 */
export class GalagaScene extends BaseGameScene {
  private stars!: Starfield;
  private player!: Phaser.GameObjects.Image;
  private readonly bullets: Phaser.GameObjects.Image[] = [];

  constructor() {
    super({ key: 'game-galaga', gameId: 'galaga', width: WIDTH, height: HEIGHT });
  }

  protected createGame(): void {
    buildGalagaTextures(this);

    this.stars = new Starfield(this, WIDTH, HEIGHT);
    this.bullets.length = 0;

    this.player = this.add.image(WIDTH / 2, PLAYER_Y, TX.ship).setDepth(10);
  }

  protected updateGame(_time: number, delta: number): void {
    this.stars.update(delta);
    this.movePlayer(delta);
    this.handleFire();
    this.updateBullets(delta);
  }

  private movePlayer(delta: number): void {
    const dir = this.controls.direction().x;
    if (dir !== 0) {
      const step = (PLAYER_SPEED * delta) / 1000;
      this.player.x = Phaser.Math.Clamp(
        this.player.x + dir * step,
        PLAYER_MARGIN,
        WIDTH - PLAYER_MARGIN,
      );
    }
  }

  private handleFire(): void {
    if (this.controls.justPressed('fire') && this.bullets.length < MAX_BULLETS) {
      const bullet = this.add.image(this.player.x, PLAYER_Y - 8, TX.bullet).setDepth(9);
      this.bullets.push(bullet);
      this.audio.play('shoot');
    }
  }

  private updateBullets(delta: number): void {
    const step = (BULLET_SPEED * delta) / 1000;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.y -= step;
      if (bullet.y < -4) {
        bullet.destroy();
        this.bullets.splice(i, 1);
      }
    }
  }
}
