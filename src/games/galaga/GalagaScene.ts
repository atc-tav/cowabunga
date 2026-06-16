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
  BEAM_HOVER_Y,
  APPROACH_SPEED,
  BEAM_GROW_MS,
  BEAM_HOLD_MS,
  BEAM_RETRACT_MS,
  BEAM_HALF_WIDTH,
  CAPTURE_CHANCE,
  DUAL_OFFSET,
  RESCUE_FLY_MS,
} from './constants';
import { COLORS } from './palette';
import { buildGalagaTextures, enemyFrame, EXPLOSION_KEYS, TX } from './sprites';
import { Starfield } from './starfield';
import { buildFormation, Enemy } from './enemies';
import { makeEntryPath, makeDivePath, makeApproachPath } from './entryPaths';

type CapturePhase = 'approach' | 'grow' | 'hold' | 'retract';

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

  private beamGfx!: Phaser.GameObjects.Graphics;
  private captor?: Enemy;
  private capturePhase: CapturePhase = 'approach';
  private captureTimer = 0;
  private captiveSprite?: Phaser.GameObjects.Image;
  private lostToCapture = false;

  private dual = false;
  private wingman?: Phaser.GameObjects.Image;

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

    this.captor = undefined;
    this.captiveSprite?.destroy();
    this.captiveSprite = undefined;
    this.lostToCapture = false;
    this.wingman?.destroy();
    this.wingman = undefined;
    this.dual = false;

    this.stars = new Starfield(this, WIDTH, HEIGHT);
    this.beamGfx = this.add.graphics().setDepth(7);
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
    this.clearActiveCapture();
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
    this.updateCapture(delta);
    this.updateCaptive();
    this.updateEnemyFire(delta);
    this.updateEnemyBullets(delta);
    this.checkHits();
    if (this.playerWasHit() && this.lethalHit(false)) {
      return;
    }
    this.checkWaveCleared();
  }

  private enterDying(): void {
    if (this.lostToCapture) {
      this.lostToCapture = false; // ship was pulled away, not blown up
    } else {
      this.audio.play('explosion');
      playFrames(this, this.player.x, this.player.y, EXPLOSION_KEYS, EXPLOSION_FRAME_MS);
    }
    this.player.setVisible(false);
    this.setDual(false);
    this.destroyAll(this.enemyBullets);
    this.recallDivers();
    this.clearActiveCapture();
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
      const maxX = WIDTH - PLAYER_MARGIN - (this.dual ? DUAL_OFFSET : 0);
      this.player.x = Phaser.Math.Clamp(this.player.x + dir * step, PLAYER_MARGIN, maxX);
    }
    if (this.wingman) {
      this.wingman.setPosition(this.player.x + DUAL_OFFSET, PLAYER_Y);
    }
  }

  private handleFire(): void {
    if (!this.controls.justPressed('fire')) {
      return;
    }
    const shipXs = this.dual && this.wingman ? [this.player.x, this.wingman.x] : [this.player.x];
    const cap = this.dual ? MAX_BULLETS * 2 : MAX_BULLETS;
    let fired = false;
    for (const x of shipXs) {
      if (this.bullets.length >= cap) {
        break;
      }
      this.bullets.push(this.add.image(x, PLAYER_Y - 8, TX.bullet).setDepth(9));
      fired = true;
    }
    if (fired) {
      this.audio.play('shoot');
    }
  }

  private setDual(on: boolean): void {
    this.dual = on;
    if (on) {
      if (!this.wingman) {
        this.wingman = this.add.image(this.player.x + DUAL_OFFSET, PLAYER_Y, TX.ship).setDepth(10);
      }
      this.wingman.setVisible(true);
    } else if (this.wingman) {
      this.wingman.destroy();
      this.wingman = undefined;
    }
  }

  /** Route a lethal event: a dual fighter sacrifices its wingman; a single ship dies. */
  private lethalHit(captured: boolean): boolean {
    if (this.dual && this.wingman) {
      playFrames(this, this.wingman.x, this.wingman.y, EXPLOSION_KEYS, EXPLOSION_FRAME_MS);
      this.audio.play('explosion');
      this.setDual(false);
      return false; // keep playing as a single ship, no life lost
    }
    this.lostToCapture = captured;
    this.flow.transition('dying');
    return true;
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
      if (enemy.state === 'capturing') {
        continue; // driven by updateCapture()
      }
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
    // A boss with no active captive may attempt a tractor-beam capture instead.
    if (
      enemy.type === 'boss' &&
      !this.captor &&
      !this.captiveSprite &&
      Math.random() < CAPTURE_CHANCE
    ) {
      this.startCapture(enemy);
      return;
    }
    enemy.state = 'diving';
    enemy.follower = new PathFollower(makeDivePath(enemy.home, this.player.x), DIVE_SPEED);
    enemy.fireTimer = ENEMY_FIRE_MS * 0.5;
    this.audio.play('dive');
  }

  // --- tractor beam (capture) ---------------------------------------------

  private startCapture(boss: Enemy): void {
    const hoverX = Phaser.Math.Clamp(this.player.x, PLAYER_MARGIN, WIDTH - PLAYER_MARGIN);
    boss.state = 'capturing';
    boss.follower = new PathFollower(makeApproachPath(boss.home, hoverX, BEAM_HOVER_Y), APPROACH_SPEED);
    this.captor = boss;
    this.capturePhase = 'approach';
    this.audio.play('beam');
  }

  private updateCapture(delta: number): void {
    const boss = this.captor;
    if (!boss) {
      return;
    }
    if (this.capturePhase === 'approach') {
      const p = boss.follower.update(delta);
      boss.sprite.setPosition(p.x, p.y);
      if (boss.follower.done) {
        this.capturePhase = 'grow';
        this.captureTimer = BEAM_GROW_MS;
      }
      return;
    }

    this.captureTimer -= delta;
    if (this.capturePhase === 'grow') {
      this.drawBeam(boss, 1 - this.captureTimer / BEAM_GROW_MS);
      if (this.captureTimer <= 0) {
        this.capturePhase = 'hold';
        this.captureTimer = BEAM_HOLD_MS;
      }
    } else if (this.capturePhase === 'hold') {
      this.drawBeam(boss, 1);
      if (this.player.visible && Math.abs(this.player.x - boss.sprite.x) < BEAM_HALF_WIDTH) {
        this.doCapture(boss);
        return;
      }
      if (this.captureTimer <= 0) {
        this.capturePhase = 'retract';
        this.captureTimer = BEAM_RETRACT_MS;
      }
    } else if (this.capturePhase === 'retract') {
      this.drawBeam(boss, this.captureTimer / BEAM_RETRACT_MS);
      if (this.captureTimer <= 0) {
        this.endCapture(boss);
      }
    }
  }

  /** Draw the cone from the boss to the bottom; `scale` in 0..1 sets opacity. */
  private drawBeam(boss: Enemy, scale: number): void {
    const s = Phaser.Math.Clamp(scale, 0, 1);
    const bx = boss.sprite.x;
    const by = boss.sprite.y + 6;
    this.beamGfx.clear();
    this.beamGfx.fillStyle(COLORS.beam, 0.28 * s);
    this.beamGfx.fillPoints(
      [
        new Phaser.Geom.Point(bx - 3, by),
        new Phaser.Geom.Point(bx + 3, by),
        new Phaser.Geom.Point(bx + BEAM_HALF_WIDTH, HEIGHT),
        new Phaser.Geom.Point(bx - BEAM_HALF_WIDTH, HEIGHT),
      ],
      true,
    );
  }

  private doCapture(boss: Enemy): void {
    this.beamGfx.clear();
    this.captor = undefined;

    // A dual fighter just loses its wingman to the beam — no capture, no life.
    if (this.dual) {
      this.setDual(false);
      this.audio.play('captured');
      this.recycleToFormation(boss);
      return;
    }

    boss.hasCaptive = true;

    // The pulled-in ship rides above its captor.
    this.captiveSprite = this.add
      .image(boss.sprite.x, boss.sprite.y - 12, TX.ship)
      .setTint(COLORS.captive)
      .setDepth(9);

    this.recycleToFormation(boss);

    this.lostToCapture = true;
    this.audio.play('captured');
    this.flow.transition('dying');
  }

  private endCapture(boss: Enemy): void {
    this.beamGfx.clear();
    this.captor = undefined;
    this.recycleToFormation(boss);
  }

  private clearActiveCapture(): void {
    if (this.captor) {
      const boss = this.captor;
      this.captor = undefined;
      this.beamGfx.clear();
      this.recycleToFormation(boss);
    }
  }

  /** Keep a captured ship glued above its captor. */
  private updateCaptive(): void {
    if (!this.captiveSprite) {
      return;
    }
    const captor = this.enemies.find((e) => e.hasCaptive);
    if (!captor) {
      this.captiveSprite.destroy();
      this.captiveSprite = undefined;
      return;
    }
    this.captiveSprite.setPosition(captor.sprite.x, captor.sprite.y - 12);
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

      // Shooting the captive ship itself loses it (the rescue risk).
      if (
        this.captiveSprite &&
        Phaser.Geom.Intersects.RectangleToRectangle(bounds, this.captiveSprite.getBounds())
      ) {
        playFrames(this, this.captiveSprite.x, this.captiveSprite.y, EXPLOSION_KEYS, EXPLOSION_FRAME_MS);
        this.audio.play('explosion');
        this.captiveSprite.destroy();
        this.captiveSprite = undefined;
        this.enemies.forEach((e) => (e.hasCaptive = false));
        bullet.destroy();
        this.bullets.splice(b, 1);
        continue;
      }

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

        if (enemy === this.captor) {
          this.captor = undefined;
          this.beamGfx.clear();
        }
        // Destroying the captor frees the captive -> rescue into a dual fighter.
        if (enemy.hasCaptive) {
          this.rescueCaptive();
        }

        enemy.sprite.destroy();
        this.enemies.splice(e, 1);
        bullet.destroy();
        this.bullets.splice(b, 1);
        break;
      }
    }
  }

  /** Free the captured ship: fly it down to the player and form a dual fighter. */
  private rescueCaptive(): void {
    if (!this.captiveSprite) {
      this.setDual(true);
      return;
    }
    const captive = this.captiveSprite;
    this.captiveSprite = undefined;
    this.audio.play('rescue');
    this.tweens.add({
      targets: captive,
      x: this.player.x + DUAL_OFFSET,
      y: PLAYER_Y,
      duration: RESCUE_FLY_MS,
      onComplete: () => {
        captive.destroy();
        this.setDual(true);
      },
    });
  }

  private playerWasHit(): boolean {
    const hitboxes = [this.player.getBounds()];
    if (this.dual && this.wingman) {
      hitboxes.push(this.wingman.getBounds());
    }
    const overlaps = (r: Phaser.Geom.Rectangle): boolean =>
      hitboxes.some((h) => Phaser.Geom.Intersects.RectangleToRectangle(h, r));

    for (const bullet of this.enemyBullets) {
      if (overlaps(bullet.getBounds())) {
        return true;
      }
    }
    for (const enemy of this.enemies) {
      if (enemy.state === 'diving' && overlaps(enemy.sprite.getBounds())) {
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
    this.captor = undefined;
    this.beamGfx.clear();
    this.captiveSprite?.destroy();
    this.captiveSprite = undefined;
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
