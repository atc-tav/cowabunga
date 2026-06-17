import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { PlatformerBody, PlatformSegment } from '../../shared/Platformer';
import { StateMachine } from '../../shared/StateMachine';
import { LivesManager } from '../../shared/LivesManager';
import { floatingText } from '../../shared/popups';
import { LABEL_STYLE } from '../../shared/ui';
import {
  WIDTH,
  HEIGHT,
  GRAVITY,
  JUMP_SPEED,
  RUN_ACCEL,
  AIR_ACCEL,
  RUN_MAX,
  GROUND_FRICTION,
  AIR_FRICTION,
  MARIO_W,
  MARIO_H,
  SHELL_H,
  WALK_FRAME_MS,
  PLATFORM_THICKNESS,
  BUMP_AMP,
  BUMP_RECOVER,
  SHELL_STUN_MS,
  SHELL_SCORE,
  STOMP_BOUNCE,
  ENEMY_TARGET,
  ENEMY_RESPAWN_MS,
  ENEMY_GROUND_DWELL_MS,
  LIVES_START,
  READY_MS,
  DEATH_PAUSE_MS,
  GAMEOVER_MS,
} from './constants';
import { COLORS } from './palette';
import { buildMarioBrosTextures, TX } from './sprites';
import { FLOORS, PIPES, POW, MARIO_START, topPipeSpawns, bottomPipeZones } from './levels';
import { Shellcreeper } from './enemies';

interface Floor {
  seg: PlatformSegment;
  nudge: number;
}

/**
 * Mario Bros. — slice 3: the Shellcreeper. Turtles spawn from the top pipes and
 * walk the floors; bumping the platform one stands on flips it, and you kick a
 * flipped one away for points. Touching an un-flipped one costs a life. Adds a
 * round flow (shared StateMachine) + lives (shared LivesManager).
 */
export class MarioBrosScene extends BaseGameScene {
  private mario!: PlatformerBody;
  private sprite!: Phaser.GameObjects.Image;
  private vx = 0;
  private facing: 1 | -1 = 1;
  private walkTimer = 0;
  private walkFrame: 0 | 1 = 0;

  private floors: Floor[] = [];
  private groundSeg!: PlatformSegment;
  private platformGfx!: Phaser.GameObjects.Graphics;

  private flow!: StateMachine<MarioBrosScene>;
  private lives!: LivesManager;
  private readonly lifeIcons: Phaser.GameObjects.Image[] = [];
  private banner!: Phaser.GameObjects.Text;
  private readyTimer = 0;

  private readonly enemies: Shellcreeper[] = [];
  private spawnTimer = 0;

  constructor() {
    super({ key: 'game-mariobros', gameId: 'mariobros', width: WIDTH, height: HEIGHT });
  }

  protected createGame(): void {
    buildMarioBrosTextures(this);

    this.floors = FLOORS.map((f) => ({ seg: { ...f, thickness: PLATFORM_THICKNESS }, nudge: 0 }));
    this.groundSeg = this.floors.find((f) => f.seg.x1 === 0 && f.seg.x2 === WIDTH)!.seg;
    this.drawStatics();
    this.platformGfx = this.add.graphics().setDepth(1);
    this.drawPlatforms();

    this.enemies.length = 0;
    this.lifeIcons.length = 0;
    this.mario = new PlatformerBody(MARIO_START.x, 0, MARIO_W, MARIO_H);
    this.sprite = this.add.image(0, 0, TX.marioRun0).setDepth(10);

    this.lives = new LivesManager(LIVES_START);
    this.refreshLives();

    this.banner = this.add
      .text(WIDTH / 2, HEIGHT / 2, '', LABEL_STYLE)
      .setOrigin(0.5)
      .setColor('#fcfc00')
      .setDepth(1000);

    this.flow = new StateMachine<MarioBrosScene>(this)
      .add('ready', { enter: () => this.enterReady(), update: (_c, dt) => this.updateReady(dt) })
      .add('playing', { update: (_c, dt) => this.updatePlaying(dt) })
      .add('dying', { enter: () => this.enterDying() })
      .add('gameover', { enter: () => this.enterGameOver() });
    this.flow.transition('ready');
  }

  protected updateGame(_time: number, delta: number): void {
    this.flow.update(delta);
  }

  // --- flow ---------------------------------------------------------------

  private enterReady(): void {
    this.readyTimer = READY_MS;
    this.banner.setText('READY!').setColor('#fcfc00').setVisible(true);
    this.placeMarioAtStart();
    this.clearEnemies();
    this.spawnTimer = 600;
  }

  private updateReady(delta: number): void {
    this.readyTimer -= delta;
    if (this.readyTimer <= 0) {
      this.banner.setVisible(false);
      this.flow.transition('playing');
    }
  }

  private updatePlaying(delta: number): void {
    this.moveMario(delta);
    this.settleBumps(delta);

    for (const e of this.enemies) {
      e.update(delta, this.floorSegments());
    }
    if (this.mario.bumped) {
      this.onBump(this.mario.bumped);
    }
    this.recoverAndRecycle(delta);
    this.shellsHitEnemies();
    this.despawnShellsAtPipes();
    this.maintainEnemies(delta);

    if (this.resolveEnemyContact()) {
      this.flow.transition('dying');
    }
  }

  private enterDying(): void {
    this.audio.play('death');
    this.cameras.main.flash(180, 255, 80, 80);
    this.tweens.add({ targets: this.sprite, alpha: 0.2, duration: 120, yoyo: true, repeat: 3 });
    this.time.delayedCall(DEATH_PAUSE_MS, () => this.afterDeath());
  }

  private afterDeath(): void {
    this.sprite.setAlpha(1);
    if (this.lives.lose() <= 0) {
      this.flow.transition('gameover');
      return;
    }
    this.refreshLives();
    this.flow.transition('ready');
  }

  private enterGameOver(): void {
    this.banner.setText('GAME OVER').setColor('#ff0000').setVisible(true);
    this.time.delayedCall(GAMEOVER_MS, () => this.scene.restart());
  }

  // --- mario --------------------------------------------------------------

  private moveMario(delta: number): void {
    const dt = delta / 1000;
    const dir = (this.controls.isDown('left') ? -1 : 0) + (this.controls.isDown('right') ? 1 : 0);

    const accel = this.mario.onGround ? RUN_ACCEL : AIR_ACCEL;
    if (dir !== 0) {
      this.vx += dir * accel * dt;
      this.facing = dir > 0 ? 1 : -1;
    } else {
      const friction = (this.mario.onGround ? GROUND_FRICTION : AIR_FRICTION) * dt;
      this.vx = this.vx > 0 ? Math.max(0, this.vx - friction) : Math.min(0, this.vx + friction);
    }
    this.vx = Phaser.Math.Clamp(this.vx, -RUN_MAX, RUN_MAX);
    this.mario.x += this.vx * dt;
    if (this.mario.x < 0) {
      this.mario.x += WIDTH;
    } else if (this.mario.x > WIDTH) {
      this.mario.x -= WIDTH;
    }

    if (this.controls.justPressed('fire')) {
      this.mario.jump(JUMP_SPEED);
    }
    this.mario.update(delta, GRAVITY, this.floorSegments());
    this.sprite.setPosition(this.mario.x, this.mario.y).setFlipX(this.facing < 0);
    this.animateMario(delta, dir !== 0);
  }

  private placeMarioAtStart(): void {
    this.vx = 0;
    this.mario.x = MARIO_START.x;
    this.mario.setFeet(MARIO_START.y);
    this.mario.vy = 0;
    this.mario.onGround = true;
    this.facing = 1;
    this.sprite.setAlpha(1).setFlipX(false).setTexture(TX.marioRun0).setPosition(this.mario.x, this.mario.y);
  }

  private animateMario(delta: number, moving: boolean): void {
    if (!this.mario.onGround) {
      this.sprite.setTexture(TX.marioJump);
      return;
    }
    if (!moving && Math.abs(this.vx) < 5) {
      this.sprite.setTexture(TX.marioRun0);
      return;
    }
    this.walkTimer += delta;
    if (this.walkTimer >= WALK_FRAME_MS) {
      this.walkTimer = 0;
      this.walkFrame = this.walkFrame === 0 ? 1 : 0;
    }
    this.sprite.setTexture(this.walkFrame === 0 ? TX.marioRun0 : TX.marioRun1);
  }

  // --- enemies ------------------------------------------------------------

  private maintainEnemies(delta: number): void {
    this.spawnTimer -= delta;
    if (this.enemies.length < ENEMY_TARGET && this.spawnTimer <= 0) {
      this.spawnShell();
      this.spawnTimer = ENEMY_RESPAWN_MS;
    }
  }

  private spawnShell(): void {
    const spawn = Phaser.Utils.Array.GetRandom(topPipeSpawns());
    const shell = new Shellcreeper(this, spawn.x, spawn.feetY - SHELL_H / 2, spawn.dir);
    shell.body.onGround = true; // walks out horizontally onto the top floor
    this.enemies.push(shell);
  }

  /** A bumped platform pops up and flips any Shellcreeper standing on it. */
  private onBump(seg: PlatformSegment): void {
    const floor = this.floors.find((f) => f.seg === seg);
    if (floor) {
      floor.nudge = -BUMP_AMP;
      this.audio.play('bump');
    }
    for (const e of this.enemies) {
      if (e.state === 'walk' && e.floorSeg === seg) {
        e.flipFor(SHELL_STUN_MS);
      }
    }
  }

  private recoverAndRecycle(delta: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.readyToRecover) {
        e.recover();
      }
      // Loop ground-dwellers back to a pipe so they don't camp the bottom.
      if (e.state === 'walk' && e.floorSeg === this.groundSeg) {
        e.groundDwell += delta;
        if (e.groundDwell >= ENEMY_GROUND_DWELL_MS) {
          e.sprite.destroy();
          this.enemies.splice(i, 1);
        }
      } else {
        e.groundDwell = 0;
      }
    }
  }

  /**
   * Mario vs turtles. Stomp a walker to defeat it; kick a flipped shell into a
   * projectile; a side hit from a walker (or any lethal shell) kills Mario.
   * Returns true if Mario died.
   */
  private resolveEnemyContact(): boolean {
    const mb = this.sprite.getBounds();
    for (const e of this.enemies) {
      if (!Phaser.Geom.Intersects.RectangleToRectangle(mb, e.sprite.getBounds())) {
        continue;
      }
      const stomping = this.mario.vy > 0 && this.mario.feet <= e.body.y + 4;

      if (e.state === 'walk') {
        if (stomping) {
          this.defeat(e, e.sprite.x, e.sprite.y);
          this.mario.vy = -STOMP_BOUNCE;
        } else {
          return true;
        }
      } else if (e.state === 'flipped') {
        e.kick(e.body.x >= this.mario.x ? 1 : -1);
        this.audio.play('kick');
        if (stomping) {
          this.mario.vy = -STOMP_BOUNCE;
        }
      } else if (e.lethalShell) {
        return true; // your own kicked shell can come back to bite you
      }
    }
    return false;
  }

  /** A sliding shell mows down other turtles in its path. */
  private shellsHitEnemies(): void {
    for (const shell of this.enemies) {
      if (!shell.isShell) {
        continue;
      }
      const sb = shell.sprite.getBounds();
      for (const e of this.enemies) {
        if (e === shell || e.isShell) {
          continue;
        }
        if (Phaser.Geom.Intersects.RectangleToRectangle(sb, e.sprite.getBounds())) {
          this.defeat(e, e.sprite.x, e.sprite.y);
        }
      }
    }
  }

  /** A kicked shell that reaches a bottom pipe leaves the game. */
  private despawnShellsAtPipes(): void {
    const zones = bottomPipeZones();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.isShell && e.body.onGround && zones.some(([a, b]) => e.body.x >= a && e.body.x <= b)) {
        e.sprite.destroy();
        this.enemies.splice(i, 1);
      }
    }
  }

  private defeat(e: Shellcreeper, x: number, y: number): void {
    this.addScore(SHELL_SCORE);
    floatingText(this, x, y, String(SHELL_SCORE), { color: '#ffffff', fontSize: '8px' });
    this.audio.play('kick');
    e.sprite.destroy();
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) {
      this.enemies.splice(idx, 1);
    }
  }

  private clearEnemies(): void {
    for (const e of this.enemies) {
      e.sprite.destroy();
    }
    this.enemies.length = 0;
  }

  private floorSegments(): PlatformSegment[] {
    return this.floors.map((f) => f.seg);
  }

  // --- bumps / rendering --------------------------------------------------

  private settleBumps(delta: number): void {
    const step = (BUMP_RECOVER * delta) / 1000;
    let dirty = false;
    for (const f of this.floors) {
      if (f.nudge < 0) {
        f.nudge = Math.min(0, f.nudge + step);
        dirty = true;
      }
    }
    if (dirty) {
      this.drawPlatforms();
    }
  }

  private drawPlatforms(): void {
    const g = this.platformGfx;
    g.clear();
    for (const f of this.floors) {
      const y = f.seg.y1 + f.nudge;
      g.fillStyle(COLORS.platform, 1);
      g.fillRect(f.seg.x1, y, f.seg.x2 - f.seg.x1, PLATFORM_THICKNESS);
      g.fillStyle(COLORS.platformTop, 1);
      g.fillRect(f.seg.x1, y, f.seg.x2 - f.seg.x1, 2);
    }
  }

  private drawStatics(): void {
    const g = this.add.graphics().setDepth(0);
    for (const pipe of PIPES) {
      const h = pipe.y2 - pipe.y1;
      g.fillStyle(COLORS.pipe, 1);
      g.fillRect(pipe.x1, pipe.y1, pipe.x2 - pipe.x1, h);
      // Lighter rim (the mouth) is a vertical bar at the centre-facing end.
      g.fillStyle(COLORS.pipeRim, 1);
      const rimX = pipe.open === 'right' ? pipe.x2 - 5 : pipe.x1;
      g.fillRect(rimX, pipe.y1 - 2, 5, h + 4);
    }
    g.fillStyle(COLORS.pow, 1);
    g.fillRect(POW.x - 12, POW.y - 8, 24, 14);
    this.add
      .text(POW.x, POW.y - 1, 'POW', { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(2);
  }

  private refreshLives(): void {
    for (const icon of this.lifeIcons) {
      icon.destroy();
    }
    this.lifeIcons.length = 0;
    for (let i = 0; i < this.lives.count; i++) {
      this.lifeIcons.push(this.add.image(8 + i * 11, 22, TX.marioRun0).setScale(0.7).setDepth(1000));
    }
  }
}
