import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { StateMachine } from '../../shared/StateMachine';
import { LivesManager } from '../../shared/LivesManager';
import { floatingText } from '../../shared/popups';
import { playFrames } from '../../shared/effects';
import { PathFollower } from '../../shared/PathFollower';
import { LABEL_STYLE } from '../../shared/ui';
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
  SWAY_AMP,
  SWAY_FREQ,
  DIVE_SPEED,
  DIVE_INTERVAL_MS,
  MAX_DIVERS,
  ENEMY_BULLET_SPEED,
  ENEMY_FIRE_MS,
  LIVES_START,
  READY_MS,
  DEATH_PAUSE_MS,
  GAMEOVER_MS,
} from './constants';
import { buildGalagaTextures, enemyFrame, EXPLOSION_KEYS, TX } from './sprites';
import { Starfield } from './starfield';
import { buildFormation, Enemy } from './enemies';
import { makeEntryPath, makeDivePath } from './entryPaths';

/**
 * Galaga — slice 4: dives, enemy fire, and player death. Enemies peel off the
 * formation to dive and shoot; getting hit (by a bolt or a diver) costs a life.
 * Round flow runs through the shared StateMachine (ready/playing/dying/
 * gameover), reusing LivesManager just like Pac-Man.
 */
export class GalagaScene extends BaseGameScene {
  private stars!: Starfield;
  private player!: Phaser.GameObjects.Image;
  private lives!: LivesManager;
  private flow!: StateMachine<GalagaScene>;

  private readonly bullets: Phaser.GameObjects.Image[] = [];
  private readonly enemyBullets: Phaser.GameObjects.Image[] = [];
  private readonly lifeIcons: Phaser.GameObjects.Image[] = [];
  private enemies: Enemy[] = [];

  private flapTimer = 0;
  private flapFrame: 0 | 1 = 0;
  private swayClock = 0;
  private diveTimer = 0;
  private readyTimer = 0;
  private respawning = false;

  private banner!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'game-galaga', gameId: 'galaga', width: WIDTH, height: HEIGHT });
  }

  protected createGame(): void {
    buildGalagaTextures(this);

    // Full reset (createGame re-runs on every entry; the constructor does not).
    this.destroyAll(this.bullets);
    this.destroyAll(this.enemyBullets);
    this.destroyAll(this.lifeIcons);
    this.enemies.forEach((e) => e.sprite.destroy());
    this.enemies = [];
    this.respawning = false;
    this.diveTimer = DIVE_INTERVAL_MS;

    this.stars = new Starfield(this, WIDTH, HEIGHT);
    this.player = this.add.image(WIDTH / 2, PLAYER_Y, TX.ship).setDepth(10);
    this.enemies = buildFormation(this);

    this.lives = new LivesManager(LIVES_START);
    this.refreshLives();

    this.banner = this.add
      .text(WIDTH / 2, HEIGHT / 2, '', LABEL_STYLE)
      .setOrigin(0.5)
      .setColor('#fcfc00')
      .setDepth(1000);

    this.flow = new StateMachine<GalagaScene>(this)
      .add('ready', { enter: () => this.enterReady(), update: (_c, dt) => this.updateReady(dt) })
      .add('playing', { update: (_c, dt) => this.updatePlaying(dt) })
      .add('dying', { enter: () => this.enterDying() })
      .add('gameover', { enter: () => this.enterGameOver() });
    this.flow.transition('ready');
  }

  protected updateGame(_time: number, delta: number): void {
    this.stars.update(delta);
    this.flow.update(delta);
  }

  // --- flow ---------------------------------------------------------------

  private enterReady(): void {
    this.readyTimer = READY_MS;
    this.banner.setText('READY!').setColor('#fcfc00').setVisible(true);
    this.player.setPosition(WIDTH / 2, PLAYER_Y).setVisible(true);
    this.destroyAll(this.enemyBullets);
    this.recallDivers();
  }

  private updateReady(delta: number): void {
    this.advanceFormation(delta, false);
    this.readyTimer -= delta;
    if (this.readyTimer <= 0) {
      this.banner.setVisible(false);
      this.flow.transition('playing');
    }
  }

  private updatePlaying(delta: number): void {
    this.movePlayer(delta);
    this.handleFire();
    this.updateBullets(delta);
    this.advanceFormation(delta, true);
    this.updateEnemyFire(delta);
    this.updateEnemyBullets(delta);
    this.checkHits();
    if (this.playerWasHit()) {
      this.flow.transition('dying');
      return;
    }
    this.checkWaveCleared();
  }

  private enterDying(): void {
    this.audio.play('explosion');
    playFrames(this, this.player.x, this.player.y, EXPLOSION_KEYS, EXPLOSION_FRAME_MS);
    this.player.setVisible(false);
    this.destroyAll(this.enemyBullets);
    this.recallDivers();
    this.time.delayedCall(DEATH_PAUSE_MS, () => this.afterDeath());
  }

  private afterDeath(): void {
    if (this.lives.lose() <= 0) {
      this.flow.transition('gameover');
      return;
    }
    this.refreshLives();
    this.flow.transition('ready');
  }

  private enterGameOver(): void {
    this.refreshLives();
    this.banner.setText('GAME OVER').setColor('#ff0000').setVisible(true);
    this.time.delayedCall(GAMEOVER_MS, () => this.scene.restart());
  }

  // --- player -------------------------------------------------------------

  private movePlayer(delta: number): void {
    const dir = this.controls.direction().x;
    if (dir !== 0) {
      const step = (PLAYER_SPEED * delta) / 1000;
      this.player.x = Phaser.Math.Clamp(this.player.x + dir * step, PLAYER_MARGIN, WIDTH - PLAYER_MARGIN);
    }
  }

  private handleFire(): void {
    if (this.controls.justPressed('fire') && this.bullets.length < MAX_BULLETS) {
      this.bullets.push(this.add.image(this.player.x, PLAYER_Y - 8, TX.bullet).setDepth(9));
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

  // --- enemies ------------------------------------------------------------

  private advanceFormation(delta: number, allowDive: boolean): void {
    this.swayClock += delta;
    const sway = Math.sin((this.swayClock / 1000) * SWAY_FREQ) * SWAY_AMP;

    for (const enemy of this.enemies) {
      if (enemy.state === 'entering') {
        enemy.elapsed += delta;
        if (enemy.elapsed < enemy.startDelay) {
          continue;
        }
        const p = enemy.follower.update(delta);
        enemy.sprite.setPosition(p.x, p.y);
        if (enemy.follower.done) {
          enemy.state = 'formed';
        }
      } else if (enemy.state === 'diving') {
        const p = enemy.follower.update(delta);
        enemy.sprite.setPosition(p.x, p.y);
        if (enemy.follower.done) {
          this.recycleToFormation(enemy);
        }
      } else {
        enemy.sprite.setPosition(enemy.home.x + sway, enemy.home.y);
      }
    }

    this.flapEnemies(delta);
    if (allowDive) {
      this.scheduleDives(delta);
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

  private scheduleDives(delta: number): void {
    this.diveTimer -= delta;
    if (this.diveTimer > 0) {
      return;
    }
    this.diveTimer = DIVE_INTERVAL_MS;
    if (this.enemies.filter((e) => e.state === 'diving').length >= MAX_DIVERS) {
      return;
    }
    const formed = this.enemies.filter((e) => e.state === 'formed');
    if (formed.length === 0) {
      return;
    }
    const enemy = Phaser.Utils.Array.GetRandom(formed);
    enemy.state = 'diving';
    enemy.follower = new PathFollower(makeDivePath(enemy.home, this.player.x), DIVE_SPEED);
    enemy.fireTimer = ENEMY_FIRE_MS * 0.5;
    this.audio.play('dive');
  }

  private recycleToFormation(enemy: Enemy): void {
    const fromLeft = enemy.home.x < WIDTH / 2;
    const points = makeEntryPath(enemy.home, fromLeft);
    enemy.sprite.setPosition(points[0].x, points[0].y);
    enemy.follower = new PathFollower(points, DIVE_SPEED);
    enemy.elapsed = enemy.startDelay; // re-enter immediately, no stagger
    enemy.state = 'entering';
  }

  private recallDivers(): void {
    for (const enemy of this.enemies) {
      if (enemy.state === 'diving') {
        this.recycleToFormation(enemy);
      }
    }
  }

  private updateEnemyFire(delta: number): void {
    for (const enemy of this.enemies) {
      if (enemy.state !== 'diving' || enemy.sprite.y > HEIGHT - 40) {
        continue;
      }
      enemy.fireTimer -= delta;
      if (enemy.fireTimer <= 0) {
        enemy.fireTimer = ENEMY_FIRE_MS;
        this.enemyBullets.push(
          this.add.image(enemy.sprite.x, enemy.sprite.y + 6, TX.enemyBullet).setDepth(9),
        );
      }
    }
  }

  private updateEnemyBullets(delta: number): void {
    const step = (ENEMY_BULLET_SPEED * delta) / 1000;
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const bullet = this.enemyBullets[i];
      bullet.y += step;
      if (bullet.y > HEIGHT + 4) {
        bullet.destroy();
        this.enemyBullets.splice(i, 1);
      }
    }
  }

  // --- collisions ---------------------------------------------------------

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
        break;
      }
    }
  }

  private playerWasHit(): boolean {
    const pb = this.player.getBounds();
    for (const bullet of this.enemyBullets) {
      if (Phaser.Geom.Intersects.RectangleToRectangle(pb, bullet.getBounds())) {
        return true;
      }
    }
    for (const enemy of this.enemies) {
      if (
        enemy.state === 'diving' &&
        Phaser.Geom.Intersects.RectangleToRectangle(pb, enemy.sprite.getBounds())
      ) {
        return true;
      }
    }
    return false;
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

  // --- hud -----------------------------------------------------------------

  private refreshLives(): void {
    this.destroyAll(this.lifeIcons);
    for (let i = 0; i < this.lives.count; i++) {
      this.lifeIcons.push(
        this.add.image(10 + i * 14, HEIGHT - 8, TX.ship).setScale(0.7).setDepth(1000),
      );
    }
  }

  private destroyAll(list: Phaser.GameObjects.GameObject[]): void {
    for (const obj of list) {
      obj.destroy();
    }
    list.length = 0;
  }
}
