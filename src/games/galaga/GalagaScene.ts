import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { floatingText } from '../../shared/popups';
import { playFrames } from '../../shared/effects';
import {
  WIDTH,
  HEIGHT,
  PLAYER_SPEED,
  PLAYER_Y,
  PLAYER_MARGIN,
  BULLET_SPEED,
  MAX_BULLETS,
  FLAP_MS,
  EXPLOSION_FRAME_MS,
  WAVE_RESPAWN_MS,
} from './constants';
import { buildGalagaTextures, enemyFrame, EXPLOSION_KEYS, TX } from './sprites';
import { Starfield } from './starfield';
import { buildFormation, Enemy } from './enemies';

/**
 * Galaga — slice 2: the enemy formation. Bees/butterflies/bosses sit in a
 * flapping grid; the player's bolts blow them up for points. No enemy fire or
 * dives yet, so the player is a safe turret while we validate grid + scoring.
 */
export class GalagaScene extends BaseGameScene {
  private stars!: Starfield;
  private player!: Phaser.GameObjects.Image;
  private readonly bullets: Phaser.GameObjects.Image[] = [];
  private enemies: Enemy[] = [];
  private flapTimer = 0;
  private flapFrame: 0 | 1 = 0;
  private respawning = false;

  constructor() {
    super({ key: 'game-galaga', gameId: 'galaga', width: WIDTH, height: HEIGHT });
  }

  protected createGame(): void {
    buildGalagaTextures(this);

    this.stars = new Starfield(this, WIDTH, HEIGHT);
    this.bullets.length = 0;
    this.respawning = false;

    this.player = this.add.image(WIDTH / 2, PLAYER_Y, TX.ship).setDepth(10);
    this.enemies = buildFormation(this);
  }

  protected updateGame(_time: number, delta: number): void {
    this.stars.update(delta);
    this.movePlayer(delta);
    this.handleFire();
    this.updateBullets(delta);
    this.flapEnemies(delta);
    this.checkHits();
    this.checkWaveCleared();
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

  private flapEnemies(delta: number): void {
    this.flapTimer += delta;
    if (this.flapTimer < FLAP_MS) {
      return;
    }
    this.flapTimer = 0;
    this.flapFrame = this.flapFrame === 0 ? 1 : 0;
    for (const enemy of this.enemies) {
      enemy.sprite.setTexture(enemyFrame(enemy.type, this.flapFrame));
    }
  }

  /** Bullet vs. enemy collision: destroy both, explode, score. */
  private checkHits(): void {
    for (let b = this.bullets.length - 1; b >= 0; b--) {
      const bullet = this.bullets[b];
      const bounds = bullet.getBounds();
      for (let e = this.enemies.length - 1; e >= 0; e--) {
        const enemy = this.enemies[e];
        if (!Phaser.Geom.Intersects.RectangleToRectangle(bounds, enemy.sprite.getBounds())) {
          continue;
        }
        const { x, y } = enemy.sprite;
        playFrames(this, x, y, EXPLOSION_KEYS, EXPLOSION_FRAME_MS);
        floatingText(this, x, y, String(enemy.points), { color: '#ffffff', fontSize: '8px' });
        this.addScore(enemy.points);
        this.audio.play('explosion');

        enemy.sprite.destroy();
        this.enemies.splice(e, 1);
        bullet.destroy();
        this.bullets.splice(b, 1);
        break; // this bullet is spent
      }
    }
  }

  private checkWaveCleared(): void {
    if (this.enemies.length > 0 || this.respawning) {
      return;
    }
    this.respawning = true;
    this.time.delayedCall(WAVE_RESPAWN_MS, () => {
      this.enemies = buildFormation(this);
      this.respawning = false;
    });
  }
}
