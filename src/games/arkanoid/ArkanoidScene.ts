import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { StateMachine } from '../../shared/StateMachine';
import { LivesManager } from '../../shared/LivesManager';
import { playFrames } from '../../shared/effects';
import { LABEL_STYLE, HUD_STYLE } from '../../shared/ui';
import {
  GAME,
  FRAME_MS,
  CellCode,
  CapsuleType,
  COLOR_BRICK_POINTS,
  CAPSULE_WEIGHTS,
  silverHitsForStage,
} from './constants';
import { COLORS } from './palette';
import {
  TX,
  buildArkanoidTextures,
  brickTexture,
  capsuleTexture,
} from './sprites';
import { stageLayout, parseStage } from './stages';
import {
  EnemyKind,
  ENEMY_SPECS,
  buildEnemyTextures,
  enemyTexture,
} from './enemies';

interface Ball {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  dirx: number;
  diry: number;
  caught: boolean;
  caughtOffset: number;
  caughtTimer: number;
}

interface Brick {
  code: CellCode;
  hits: number;
  maxHits: number;
  hasCapsule: boolean;
  img: Phaser.GameObjects.Image;
}

interface Capsule {
  type: CapsuleType;
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
}

interface Laser {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
}

interface Enemy {
  kind: EnemyKind;
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  points: number;
  laneY: number; // convoy cruise lane
  reroll: number; // unira re-aim / convoy dive-duration timer
  swoop: number; // convoy time-to-next-dive
  flap: number; // animation timer
  frame: 0 | 1;
  ballCd: number; // cooldown after deflecting a ball
}

type VausMode = 'normal' | 'laser';

const R = GAME.ballRadius;
const LEFT_BOUND = GAME.wallThickness + R;
const RIGHT_BOUND = GAME.screenWidth - GAME.wallThickness - R;
const TOP_WALL_Y = GAME.headerHeight + GAME.wallThickness; // 32
const TOP_BOUND = TOP_WALL_Y + R;
const VAUS_TOP = GAME.vausY - GAME.vausHeight / 2;
const VAUS_BOTTOM = GAME.vausY + GAME.vausHeight / 2;
const MIN_VY_FRAC = Math.sin(Phaser.Math.DegToRad(GAME.minBallAngleDeg)); // 0.5

const EXPLODE_KEYS = ['ak-exp-0', 'ak-exp-1', 'ak-exp-2', 'ak-exp-3'];

/**
 * Arkanoid — Slice 1. The playable brick-breaker core: zone-based Vaus angle
 * control, sub-stepped ball physics with angle clamping and ceiling speed-up,
 * the full brick taxonomy (color / silver / gold), staged layouts, lives, and
 * the capsule power-up system (L/E/C/S/D/P). Enemies, the Break portal, and the
 * DOH boss (stage 33) are deferred to later slices.
 */
export class ArkanoidScene extends BaseGameScene {
  private flow!: StateMachine<ArkanoidScene>;
  private lives!: LivesManager;

  private vaus!: Phaser.GameObjects.Image;
  private vausWidth: number = GAME.vausNormalWidth;
  private vausMode: VausMode = 'normal';
  private enlarged = false;
  private catchMode = false;

  private readonly balls: Ball[] = [];
  private readonly lasers: Laser[] = [];
  private readonly enemies: Enemy[] = [];
  private enemySpawnTimer = 0;
  private readonly lifeIcons: Phaser.GameObjects.Image[] = [];
  private grid: (Brick | null)[][] = [];
  private capsule?: Capsule;

  private stage = 1;
  private destroyableRemaining = 0;
  private ballSpeed: number = GAME.ballBaseSpeed;

  private capsuleInFlight = false;
  private lastCapsuleType?: CapsuleType;
  private pDroppedThisLife = false;

  private slowActive = false;
  private slowElapsed = 0;
  private laserCd = 0;

  private nextExtraLife: number = GAME.extraLifeAt;
  private readyTimer = 0;

  private banner!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;

  constructor() {
    super({
      key: 'game-arkanoid',
      gameId: 'arkanoid',
      width: GAME.screenWidth,
      height: GAME.screenHeight,
    });
  }

  protected createGame(): void {
    buildArkanoidTextures(this);
    buildEnemyTextures(this);
    this.buildExplosion();

    this.drawWalls();

    this.vaus = this.add.image(GAME.screenWidth / 2, GAME.vausY, TX.vausNormal).setDepth(10);
    this.vausWidth = GAME.vausNormalWidth;
    this.vausMode = 'normal';
    this.enlarged = false;
    this.catchMode = false;

    this.lives = new LivesManager(GAME.livesStart);
    this.refreshLives();

    this.stageText = this.add
      .text(GAME.screenWidth / 2, 4, 'STAGE 1', HUD_STYLE)
      .setOrigin(0.5, 0)
      .setDepth(1000);
    this.banner = this.add
      .text(GAME.screenWidth / 2, GAME.screenHeight / 2, '', LABEL_STYLE)
      .setOrigin(0.5)
      .setColor('#fcfc00')
      .setDepth(1500);

    this.stage = 1;
    this.ballSpeed = GAME.ballBaseSpeed;
    this.nextExtraLife = GAME.extraLifeAt;
    this.loadStage(this.stage);

    this.flow = new StateMachine<ArkanoidScene>(this)
      .add('ready', { enter: () => this.enterReady(), update: (_c, dt) => this.updateReady(dt) })
      .add('playing', { update: (_c, dt) => this.updatePlaying(dt) })
      .add('dying', { enter: () => this.enterDying() })
      .add('cleared', { enter: () => this.enterCleared() })
      .add('gameover', { enter: () => this.enterGameOver() });
    this.flow.transition('ready');
  }

  protected updateGame(_time: number, delta: number): void {
    this.flow.update(delta);
  }

  // --- flow ---------------------------------------------------------------

  private enterReady(): void {
    this.clearLasers();
    this.clearCapsule();
    this.clearBalls();
    this.clearEnemies();
    this.vaus.setPosition(GAME.screenWidth / 2, GAME.vausY);
    this.spawnBall(this.vaus.x, VAUS_TOP - R, 0, -1, true);
    this.banner.setText('READY').setVisible(true);
    this.readyTimer = GAME.readyMs;
  }

  private updateReady(delta: number): void {
    this.movePaddle(delta);
    if (this.controls.justPressed('fire')) {
      this.launchCaught();
      this.banner.setVisible(false);
      this.flow.transition('playing');
      return;
    }
    this.readyTimer -= delta;
    if (this.readyTimer <= 0) {
      this.banner.setVisible(false);
      this.flow.transition('playing');
    }
  }

  private updatePlaying(delta: number): void {
    this.movePaddle(delta);
    if (this.controls.justPressed('fire') && this.balls.some((b) => b.caught)) {
      this.launchCaught();
    }
    this.handleLaser(delta);
    this.updateBalls(delta);
    if (this.flow.state !== 'playing') {
      return; // a ball loss / stage clear took us elsewhere
    }
    this.updateCapsule(delta);
    this.updateLasers(delta);
    this.updateEnemies(delta);
    this.updateSlow(delta);
    this.updateCatchTimers(delta);
    this.checkExtraLife();
  }

  private enterDying(): void {
    this.audio.play('death');
    playFrames(this, this.vaus.x, this.vaus.y, EXPLODE_KEYS, 90);
    this.impact('heavy');
    this.vaus.setVisible(false);
    this.clearLasers();
    this.clearCapsule();
    this.clearEnemies();
    this.time.delayedCall(GAME.deathPauseMs, () => this.afterDeath());
  }

  private afterDeath(): void {
    this.vaus.setVisible(true);
    if (this.lives.lose() <= 0) {
      this.flow.transition('gameover');
      return;
    }
    this.refreshLives();
    this.resetForNewLife();
    this.flow.transition('ready');
  }

  private enterCleared(): void {
    this.audio.play('clear');
    this.clearBalls();
    this.clearCapsule();
    this.clearLasers();
    this.clearEnemies();
    this.cameras.main.flash(GAME.clearFlashMs, 255, 255, 255);
    this.time.delayedCall(GAME.clearFlashMs, () => {
      this.stage++;
      this.loadStage(this.stage);
      this.flow.transition('ready');
    });
  }

  private enterGameOver(): void {
    this.banner.setText('GAME OVER').setColor('#ff0000').setVisible(true);
    this.time.delayedCall(GAME.gameoverMs, () => this.scene.restart());
  }

  /** Reset power-ups + ball speed for a fresh ball (Section 3.1 / 3.4). */
  private resetForNewLife(): void {
    this.vausMode = 'normal';
    this.enlarged = false;
    this.catchMode = false;
    this.slowActive = false;
    this.ballSpeed = GAME.ballBaseSpeed;
    this.pDroppedThisLife = false;
    this.rebuildVaus();
  }

  // --- paddle -------------------------------------------------------------

  private movePaddle(delta: number): void {
    const dir = this.controls.direction().x;
    if (dir !== 0) {
      const step = (GAME.vausSpeed * delta) / 1000;
      this.vaus.x = Phaser.Math.Clamp(
        this.vaus.x + dir * step,
        GAME.wallThickness + this.vausWidth / 2,
        GAME.screenWidth - GAME.wallThickness - this.vausWidth / 2,
      );
    }
    // Caught balls ride the paddle.
    for (const b of this.balls) {
      if (b.caught) {
        b.x = this.vaus.x + b.caughtOffset;
        b.y = VAUS_TOP - R;
        b.img.setPosition(b.x, b.y);
      }
    }
  }

  private get vausLeft(): number {
    return this.vaus.x - this.vausWidth / 2;
  }

  private rebuildVaus(): void {
    this.vausWidth = this.enlarged ? GAME.vausEnlargedWidth : GAME.vausNormalWidth;
    let key: string;
    if (this.vausMode === 'laser') {
      key = this.enlarged ? TX.vausLaserEnlarged : TX.vausLaser;
    } else {
      key = this.enlarged ? TX.vausEnlarged : TX.vausNormal;
    }
    this.vaus.setTexture(key);
    this.vaus.x = Phaser.Math.Clamp(
      this.vaus.x,
      GAME.wallThickness + this.vausWidth / 2,
      GAME.screenWidth - GAME.wallThickness - this.vausWidth / 2,
    );
  }

  // --- balls --------------------------------------------------------------

  private spawnBall(x: number, y: number, dx: number, dy: number, caught: boolean): Ball {
    const ball: Ball = {
      img: this.add.image(x, y, caught ? TX.ballCaught : TX.ball).setDepth(11),
      x,
      y,
      dirx: dx,
      diry: dy,
      caught,
      caughtOffset: caught ? x - this.vaus.x : 0,
      caughtTimer: GAME.catchAutoReleaseMs,
    };
    this.balls.push(ball);
    return ball;
  }

  private launchCaught(): void {
    for (const b of this.balls) {
      if (b.caught) {
        this.releaseBall(b);
      }
    }
  }

  /** Release a caught ball at the angle implied by its paddle contact point. */
  private releaseBall(b: Ball): void {
    const ratio = Phaser.Math.Clamp((b.x - this.vausLeft) / this.vausWidth, 0, 1);
    const angle = Phaser.Math.DegToRad(150 - ratio * 120);
    let dx = Math.cos(angle);
    let dy = -Math.sin(angle);
    // Avoid a dead-vertical launch that just loops up and down forever.
    if (Math.abs(dx) < 0.15) {
      dx = (Math.random() < 0.5 ? -1 : 1) * 0.2;
    }
    const d = this.clampDir(dx, dy);
    b.dirx = d.x;
    b.diry = d.y;
    b.caught = false;
    b.img.setTexture(TX.ball);
    this.audio.play('launch');
  }

  private updateBalls(delta: number): void {
    const dist = (this.ballSpeed * delta) / FRAME_MS;
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (b.caught) {
        continue;
      }
      if (this.stepBall(b, dist)) {
        b.img.destroy();
        this.balls.splice(i, 1);
      }
    }
    if (this.balls.length === 0) {
      this.flow.transition('dying');
    }
  }

  /** Move one ball `dist` px, sub-stepped so it never tunnels a brick. */
  private stepBall(b: Ball, dist: number): boolean {
    const steps = Math.max(1, Math.ceil(dist / R));
    const per = dist / steps;
    for (let s = 0; s < steps; s++) {
      b.x += b.dirx * per;
      b.y += b.diry * per;
      this.resolveWalls(b);
      this.resolveBricks(b);
      this.resolveEnemies(b);
      this.resolvePaddle(b);
      if (b.y - R > GAME.screenHeight) {
        return true; // fell out the bottom
      }
    }
    b.img.setPosition(b.x, b.y);
    return false;
  }

  private resolveWalls(b: Ball): void {
    if (b.x < LEFT_BOUND) {
      b.x = LEFT_BOUND;
      b.dirx = Math.abs(b.dirx);
      this.applyDir(b);
    } else if (b.x > RIGHT_BOUND) {
      b.x = RIGHT_BOUND;
      b.dirx = -Math.abs(b.dirx);
      this.applyDir(b);
    }
    if (b.y < TOP_BOUND) {
      b.y = TOP_BOUND;
      b.diry = Math.abs(b.diry);
      this.onCeilingHit();
      this.applyDir(b);
    }
  }

  private onCeilingHit(): void {
    if (this.slowActive) {
      return; // speed is being managed by the slow creep
    }
    this.ballSpeed = Math.min(this.ballSpeed + GAME.ballSpeedIncrement, GAME.ballMaxSpeed);
  }

  private resolveBricks(b: Ball): void {
    if (this.grid.length === 0) {
      return;
    }
    const bx0 = b.x - R;
    const bx1 = b.x + R;
    const by0 = b.y - R;
    const by1 = b.y + R;
    const c0 = Math.floor((bx0 - GAME.brickGridOriginX) / GAME.brickWidth);
    const c1 = Math.floor((bx1 - GAME.brickGridOriginX) / GAME.brickWidth);
    const r0 = Math.floor((by0 - GAME.brickGridOriginY) / GAME.brickHeight);
    const r1 = Math.floor((by1 - GAME.brickGridOriginY) / GAME.brickHeight);

    for (let row = r0; row <= r1; row++) {
      if (row < 0 || row >= this.grid.length) {
        continue;
      }
      for (let col = c0; col <= c1; col++) {
        if (col < 0 || col >= this.grid[row].length) {
          continue;
        }
        const brick = this.grid[row][col];
        if (!brick) {
          continue;
        }
        const bxL = GAME.brickGridOriginX + col * GAME.brickWidth;
        const bxR = bxL + GAME.brickWidth;
        const byT = GAME.brickGridOriginY + row * GAME.brickHeight;
        const byB = byT + GAME.brickHeight;
        const overlapX = Math.min(bx1, bxR) - Math.max(bx0, bxL);
        const overlapY = Math.min(by1, byB) - Math.max(by0, byT);
        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }
        // Reflect on the axis of least penetration (corner = both).
        if (overlapX < overlapY) {
          b.dirx = -b.dirx;
          b.x += b.x < (bxL + bxR) / 2 ? -overlapX : overlapX;
        } else if (overlapY < overlapX) {
          b.diry = -b.diry;
          b.y += b.y < (byT + byB) / 2 ? -overlapY : overlapY;
        } else {
          b.dirx = -b.dirx;
          b.diry = -b.diry;
        }
        this.applyDir(b);
        if (brick.code !== 'X') {
          this.damageBrick(row, col, false);
        }
        return; // one brick per sub-step
      }
    }
  }

  private resolvePaddle(b: Ball): void {
    if (b.diry <= 0) {
      return; // moving up
    }
    if (b.y + R < VAUS_TOP || b.y - R > VAUS_BOTTOM) {
      return;
    }
    if (b.x < this.vausLeft - R || b.x > this.vausLeft + this.vausWidth + R) {
      return;
    }
    if (this.catchMode) {
      this.catchBall(b);
      return;
    }
    const ratio = Phaser.Math.Clamp((b.x - this.vausLeft) / this.vausWidth, 0, 1);
    const angle = Phaser.Math.DegToRad(150 - ratio * 120);
    let dx = Math.cos(angle);
    const dy = -Math.sin(angle);
    if (Math.abs(dx) < 0.12) {
      dx = (Math.random() < 0.5 ? -1 : 1) * 0.15;
    }
    const d = this.clampDir(dx, dy);
    b.dirx = d.x;
    b.diry = d.y;
    b.y = VAUS_TOP - R;
    this.audio.play('paddle');
  }

  private catchBall(b: Ball): void {
    b.caught = true;
    b.caughtOffset = Phaser.Math.Clamp(b.x - this.vaus.x, -(this.vausWidth / 2 - 2), this.vausWidth / 2 - 2);
    b.caughtTimer = GAME.catchAutoReleaseMs;
    b.y = VAUS_TOP - R;
    b.img.setTexture(TX.ballCaught);
    this.audio.play('catch');
  }

  private updateCatchTimers(delta: number): void {
    for (const b of this.balls) {
      if (!b.caught) {
        continue;
      }
      b.caughtTimer -= delta;
      if (b.caughtTimer <= 0) {
        this.releaseBall(b);
      }
    }
  }

  /** Normalize a direction and enforce the [30°,150°] angle clamp. */
  private clampDir(x: number, y: number): { x: number; y: number } {
    const len = Math.hypot(x, y) || 1;
    let nx = x / len;
    let ny = y / len;
    if (Math.abs(ny) < MIN_VY_FRAC) {
      const sy = ny < 0 ? -1 : ny > 0 ? 1 : -1; // bias to upward if exactly flat
      const sx = nx < 0 ? -1 : 1;
      ny = sy * MIN_VY_FRAC;
      nx = sx * Math.sqrt(1 - MIN_VY_FRAC * MIN_VY_FRAC);
    }
    return { x: nx, y: ny };
  }

  private applyDir(b: Ball): void {
    const d = this.clampDir(b.dirx, b.diry);
    b.dirx = d.x;
    b.diry = d.y;
  }

  // --- bricks -------------------------------------------------------------

  private loadStage(stage: number): void {
    // Clear any previous grid.
    for (const row of this.grid) {
      for (const brick of row) {
        brick?.img.destroy();
      }
    }
    const layout = stageLayout(stage);
    const parsed = parseStage(layout);
    const silverMax = silverHitsForStage(stage);
    this.grid = [];
    this.destroyableRemaining = 0;

    for (let r = 0; r < parsed.grid.length; r++) {
      const gridRow: (Brick | null)[] = [];
      for (let c = 0; c < parsed.grid[r].length; c++) {
        const code = parsed.grid[r][c];
        if (code === '.') {
          gridRow.push(null);
          continue;
        }
        const cx = GAME.brickGridOriginX + c * GAME.brickWidth + GAME.brickWidth / 2;
        const cy = GAME.brickGridOriginY + r * GAME.brickHeight + GAME.brickHeight / 2;
        const img = this.add.image(cx, cy, brickTexture(code)).setDepth(5);
        let hits = 1;
        let maxHits = 1;
        if (code === 'S') {
          hits = silverMax;
          maxHits = silverMax;
        } else if (code === 'X') {
          hits = Number.POSITIVE_INFINITY;
          maxHits = hits;
        }
        const hasCapsule = code !== 'X' && Math.random() < GAME.capsuleSpawnChance;
        gridRow.push({ code, hits, maxHits, hasCapsule, img });
        if (code !== 'X') {
          this.destroyableRemaining++;
        }
      }
      this.grid.push(gridRow);
    }
    this.stageText.setText(`STAGE ${stage}`);
    this.enemySpawnTimer = Phaser.Math.Between(GAME.enemySpawnMinMs, GAME.enemySpawnMaxMs);
  }

  private brickAtPoint(x: number, y: number): { row: number; col: number; brick: Brick } | null {
    const col = Math.floor((x - GAME.brickGridOriginX) / GAME.brickWidth);
    const row = Math.floor((y - GAME.brickGridOriginY) / GAME.brickHeight);
    if (row < 0 || row >= this.grid.length || col < 0 || col >= this.grid[row].length) {
      return null;
    }
    const brick = this.grid[row][col];
    return brick ? { row, col, brick } : null;
  }

  private damageBrick(row: number, col: number, fromLaser: boolean): void {
    const brick = this.grid[row][col];
    if (!brick || brick.code === 'X') {
      return;
    }
    brick.hits--;
    if (brick.hits > 0) {
      // Silver brick took a hit but survives — show progressive damage.
      brick.img.setTexture(TX.brickSilverHit);
      const level = brick.hits / brick.maxHits;
      const v = Math.floor(110 + 120 * level);
      brick.img.setTint((v << 16) | (v << 8) | v);
      this.audio.play('brickHit');
      return;
    }
    // Destroyed.
    const cx = brick.img.x;
    const cy = brick.img.y;
    const points = brick.code === 'S' ? 50 * this.stage : COLOR_BRICK_POINTS[brick.code] ?? 0;
    this.popScore(cx, cy, points, { fontSize: '7px' });
    this.audio.play(fromLaser ? 'laserHit' : 'brick');
    this.maybeDropCapsule(brick, cx, cy);
    brick.img.destroy();
    this.grid[row][col] = null;
    this.destroyableRemaining--;
    if (this.destroyableRemaining <= 0) {
      this.flow.transition('cleared');
    }
  }

  // --- capsules -----------------------------------------------------------

  private maybeDropCapsule(brick: Brick, x: number, y: number): void {
    if (!brick.hasCapsule || this.capsuleInFlight || this.balls.length >= 2) {
      return;
    }
    const type = this.rollCapsuleType();
    const img = this.add.image(x, y, capsuleTexture(type)).setDepth(9);
    this.capsule = { type, img, x, y };
    this.capsuleInFlight = true;
  }

  /** Weighted capsule roll with duplicate-prevention + P-once-per-life rules. */
  private rollCapsuleType(): CapsuleType {
    const pool: CapsuleType[] = [];
    for (const [type, weight] of Object.entries(CAPSULE_WEIGHTS) as [CapsuleType, number][]) {
      if (type === 'P' && this.pDroppedThisLife) {
        continue;
      }
      for (let i = 0; i < weight; i++) {
        pool.push(type);
      }
    }
    let pick = pool[Math.floor(Math.random() * pool.length)] ?? 'D';
    // Same type twice in a row is substituted with D (the only repeatable one).
    if (pick === this.lastCapsuleType) {
      pick = 'D';
    }
    this.lastCapsuleType = pick;
    if (pick === 'P') {
      this.pDroppedThisLife = true;
    }
    return pick;
  }

  private updateCapsule(delta: number): void {
    const c = this.capsule;
    if (!c) {
      return;
    }
    c.y += (GAME.capsuleFallSpeed * delta) / FRAME_MS;
    c.img.setPosition(c.x, c.y);

    const caught =
      c.y + GAME.capsuleHeight / 2 >= VAUS_TOP &&
      c.y - GAME.capsuleHeight / 2 <= VAUS_BOTTOM &&
      c.x >= this.vausLeft - GAME.capsuleWidth / 2 &&
      c.x <= this.vausLeft + this.vausWidth + GAME.capsuleWidth / 2;

    if (caught) {
      this.popScore(c.x, c.y, GAME.capsuleCollectPoints, { color: '#fcfc00', fontSize: '7px' });
      this.applyCapsule(c.type);
      this.audio.play('capsule');
      this.clearCapsule();
    } else if (c.y - GAME.capsuleHeight / 2 > GAME.screenHeight) {
      this.clearCapsule();
    }
  }

  private clearCapsule(): void {
    this.capsule?.img.destroy();
    this.capsule = undefined;
    this.capsuleInFlight = false;
  }

  private applyCapsule(type: CapsuleType): void {
    switch (type) {
      case 'L':
        this.vausMode = 'laser';
        this.catchMode = false;
        this.launchCaught(); // catch cancelled — let any stuck ball go
        this.rebuildVaus();
        break;
      case 'E':
        if (!this.enlarged) {
          this.enlarged = true;
          this.rebuildVaus();
        }
        break;
      case 'C':
        this.catchMode = true;
        this.vausMode = 'normal';
        this.rebuildVaus();
        break;
      case 'S':
        this.applySlow();
        break;
      case 'D':
        this.disrupt();
        break;
      case 'P':
        this.lives.gain(1);
        this.refreshLives();
        break;
      case 'B':
        // Break portal deferred to a later slice — collect awards points only.
        break;
    }
  }

  private applySlow(): void {
    this.slowActive = true;
    this.slowElapsed = 0;
    this.ballSpeed = GAME.ballBaseSpeed * GAME.slowSpeedMultiplier;
  }

  private updateSlow(delta: number): void {
    if (!this.slowActive) {
      return;
    }
    this.slowElapsed += delta;
    const t = Phaser.Math.Clamp(this.slowElapsed / GAME.slowCreepRateMs, 0, 1);
    this.ballSpeed = Phaser.Math.Linear(
      GAME.ballBaseSpeed * GAME.slowSpeedMultiplier,
      GAME.ballBaseSpeed,
      t,
    );
    if (t >= 1) {
      this.slowActive = false;
    }
  }

  /** Disruption: split a live ball into three (Section 3.5). */
  private disrupt(): void {
    const src = this.balls.find((b) => !b.caught) ?? this.balls[0];
    if (!src) {
      return;
    }
    for (const offsetDeg of [-25, 25]) {
      const a = Phaser.Math.DegToRad(offsetDeg);
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const dx = src.dirx * cos - src.diry * sin;
      const dy = src.dirx * sin + src.diry * cos;
      const d = this.clampDir(dx, dy);
      this.spawnBall(src.x, src.y, d.x, d.y, false);
    }
  }

  // --- laser --------------------------------------------------------------

  private handleLaser(delta: number): void {
    if (this.vausMode !== 'laser') {
      return;
    }
    this.laserCd -= delta;
    if (this.laserCd > 0 || !this.controls.isDown('fire')) {
      return;
    }
    this.laserCd = GAME.laserCooldownMs;
    const inset = this.vausWidth / 2 - 3;
    for (const sx of [this.vaus.x - inset, this.vaus.x + inset]) {
      this.lasers.push({
        img: this.add.image(sx, VAUS_TOP - 4, TX.laserBeam).setDepth(8),
        x: sx,
        y: VAUS_TOP - 4,
      });
    }
    this.audio.play('laser');
  }

  private updateLasers(delta: number): void {
    const step = (GAME.laserSpeed * delta) / FRAME_MS;
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const beam = this.lasers[i];
      beam.y -= step;
      const enemyIdx = this.enemyAtPoint(beam.x, beam.y);
      if (enemyIdx >= 0) {
        this.killEnemy(enemyIdx);
        this.removeLaser(i);
        continue;
      }
      const hit = this.brickAtPoint(beam.x, beam.y);
      if (hit) {
        if (hit.brick.code !== 'X') {
          this.damageBrick(hit.row, hit.col, true);
        }
        this.removeLaser(i);
        continue;
      }
      if (beam.y < TOP_WALL_Y) {
        this.removeLaser(i);
        continue;
      }
      beam.img.setPosition(beam.x, beam.y);
    }
  }

  private removeLaser(i: number): void {
    this.lasers[i].img.destroy();
    this.lasers.splice(i, 1);
  }

  private clearLasers(): void {
    for (const beam of this.lasers) {
      beam.img.destroy();
    }
    this.lasers.length = 0;
    this.laserCd = 0;
  }

  private clearBalls(): void {
    for (const b of this.balls) {
      b.img.destroy();
    }
    this.balls.length = 0;
  }

  // --- enemies ------------------------------------------------------------

  private updateEnemies(delta: number): void {
    this.spawnEnemies(delta);
    const f = delta / FRAME_MS;
    const leftWall = GAME.wallThickness;
    const rightWall = GAME.screenWidth - GAME.wallThickness;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.ballCd = Math.max(0, e.ballCd - delta);
      this.moveEnemy(e, f, leftWall, rightWall);
      this.animateEnemy(e, delta);
      e.img.setPosition(e.x, e.y);
      // Killed by running into the Vaus, or gone off the bottom.
      if (this.enemyHitsVaus(e)) {
        this.killEnemy(i);
        continue;
      }
      if (e.y - e.radius > GAME.screenHeight) {
        e.img.destroy();
        this.enemies.splice(i, 1);
      }
    }
  }

  private moveEnemy(e: Enemy, f: number, leftWall: number, rightWall: number): void {
    e.x += e.vx * f;
    e.y += e.vy * f;
    // Side walls reflect every kind.
    if (e.x < leftWall + e.radius) {
      e.x = leftWall + e.radius;
      e.vx = Math.abs(e.vx);
    } else if (e.x > rightWall - e.radius) {
      e.x = rightWall - e.radius;
      e.vx = -Math.abs(e.vx);
    }
    if (e.kind === 'unira') {
      if (e.y < TOP_WALL_Y + e.radius) {
        e.y = TOP_WALL_Y + e.radius;
        e.vy = Math.abs(e.vy);
      }
      e.reroll -= f * FRAME_MS;
      if (e.reroll <= 0) {
        this.aimUnira(e);
      }
    } else if (e.kind === 'molester') {
      if (e.y < TOP_WALL_Y + e.radius) {
        e.y = TOP_WALL_Y + e.radius;
        e.vy = Math.abs(e.vy);
      }
    } else {
      this.cruiseConvoy(e, f * FRAME_MS);
    }
  }

  private aimUnira(e: Enemy): void {
    const spec = ENEMY_SPECS.unira;
    const ang = Phaser.Math.FloatBetween(0.3, Math.PI - 0.3); // bias downward
    e.vx = Math.cos(ang) * spec.speed;
    e.vy = Math.sin(ang) * spec.speed;
    e.reroll = Phaser.Math.Between(900, 1800);
  }

  /** Convoy cruises in its lane and occasionally dives, then climbs back. */
  private cruiseConvoy(e: Enemy, dtMs: number): void {
    const spec = ENEMY_SPECS.convoy;
    if (e.vy === 0) {
      e.swoop -= dtMs;
      if (e.swoop <= 0) {
        e.vy = spec.speed; // start dive
        e.reroll = GAME.convoyDiveMs;
      }
    } else if (e.vy > 0) {
      e.reroll -= dtMs;
      if (e.reroll <= 0) {
        e.vy = -spec.speed; // climb back
      }
    } else if (e.y <= e.laneY) {
      e.y = e.laneY;
      e.vy = 0;
      e.swoop = Phaser.Math.Between(2500, 4500);
    }
  }

  private animateEnemy(e: Enemy, delta: number): void {
    if (e.kind === 'molester') {
      e.frame = e.vx < 0 ? 0 : 1;
      e.img.setTexture(enemyTexture('molester', e.frame));
      return;
    }
    if (e.kind !== 'convoy') {
      return;
    }
    e.flap -= delta;
    if (e.flap <= 0) {
      e.flap = GAME.enemyFlapMs;
      e.frame = e.frame === 0 ? 1 : 0;
      e.img.setTexture(enemyTexture('convoy', e.frame));
    }
  }

  private spawnEnemies(delta: number): void {
    this.enemySpawnTimer -= delta;
    if (this.enemySpawnTimer > 0 || this.enemies.length >= GAME.enemyMaxOnscreen) {
      return;
    }
    this.enemySpawnTimer = Phaser.Math.Between(GAME.enemySpawnMinMs, GAME.enemySpawnMaxMs);
    const eligible = (Object.keys(ENEMY_SPECS) as EnemyKind[]).filter(
      (k) => this.stage >= ENEMY_SPECS[k].fromStage,
    );
    if (eligible.length === 0) {
      return;
    }
    this.spawnEnemy(Phaser.Utils.Array.GetRandom(eligible));
  }

  private spawnEnemy(kind: EnemyKind): void {
    const spec = ENEMY_SPECS[kind];
    const x = Phaser.Math.Between(GAME.wallThickness + 12, GAME.screenWidth - GAME.wallThickness - 12);
    const y = TOP_WALL_Y + 10;
    const e: Enemy = {
      kind,
      img: this.add.image(x, y, enemyTexture(kind, 0)).setDepth(7),
      x,
      y,
      vx: (Math.random() < 0.5 ? -1 : 1) * spec.speed,
      vy: kind === 'convoy' ? 0 : spec.speed * 0.6,
      radius: spec.radius,
      points: spec.points,
      laneY: y,
      reroll: Phaser.Math.Between(900, 1800),
      swoop: Phaser.Math.Between(2000, 3800),
      flap: GAME.enemyFlapMs,
      frame: 0,
      ballCd: 0,
    };
    if (kind === 'unira') {
      this.aimUnira(e);
    }
    if (kind === 'molester') {
      e.vy = spec.speed; // committed diagonal
    }
    this.enemies.push(e);
  }

  /** Ball ↔ enemy: deflect the ball (invert BOTH components, Section 6 check). */
  private resolveEnemies(b: Ball): void {
    for (const e of this.enemies) {
      if (e.ballCd > 0) {
        continue;
      }
      const dx = b.x - e.x;
      const dy = b.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= R + e.radius) {
        continue;
      }
      b.dirx = -b.dirx;
      b.diry = -b.diry;
      this.applyDir(b);
      const n = dist || 1;
      const push = R + e.radius - dist + 0.5;
      b.x += (dx / n) * push;
      b.y += (dy / n) * push;
      e.ballCd = GAME.enemyBallCooldownMs;
      this.audio.play('enemyHit');
      return;
    }
  }

  private enemyAtPoint(x: number, y: number): number {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (Math.abs(e.x - x) <= e.radius + 1 && Math.abs(e.y - y) <= e.radius + 3) {
        return i;
      }
    }
    return -1;
  }

  private enemyHitsVaus(e: Enemy): boolean {
    return (
      e.y + e.radius >= VAUS_TOP &&
      e.y - e.radius <= VAUS_BOTTOM &&
      e.x >= this.vausLeft - e.radius &&
      e.x <= this.vausLeft + this.vausWidth + e.radius
    );
  }

  private killEnemy(index: number): void {
    const e = this.enemies[index];
    playFrames(this, e.x, e.y, EXPLODE_KEYS, 70);
    this.popScore(e.x, e.y, e.points, { color: '#ffffff', fontSize: '7px' });
    this.audio.play('enemyKill');
    e.img.destroy();
    this.enemies.splice(index, 1);
  }

  private clearEnemies(): void {
    for (const e of this.enemies) {
      e.img.destroy();
    }
    this.enemies.length = 0;
  }

  // --- scoring / lives ----------------------------------------------------

  private checkExtraLife(): void {
    // First award at 20k, then 60k, then every +60k thereafter.
    while (this.scores.score >= this.nextExtraLife) {
      this.lives.gain(1);
      this.refreshLives();
      this.audio.play('extra');
      this.nextExtraLife =
        this.nextExtraLife === GAME.extraLifeAt
          ? GAME.extraLifeEvery
          : this.nextExtraLife + GAME.extraLifeEvery;
    }
  }

  private refreshLives(): void {
    for (const icon of this.lifeIcons) {
      icon.destroy();
    }
    this.lifeIcons.length = 0;
    for (let i = 0; i < this.lives.count - 1; i++) {
      this.lifeIcons.push(
        this.add.image(14 + i * 18, GAME.screenHeight - 8, TX.vausNormal).setScale(0.6).setDepth(1000),
      );
    }
  }

  // --- scenery ------------------------------------------------------------

  private drawWalls(): void {
    const g = this.add.graphics().setDepth(1);
    const t = GAME.wallThickness;
    const w = GAME.screenWidth;
    const h = GAME.screenHeight;
    g.fillStyle(COLORS.wall, 1);
    g.fillRect(0, GAME.headerHeight, t, h - GAME.headerHeight); // left
    g.fillRect(w - t, GAME.headerHeight, t, h - GAME.headerHeight); // right
    g.fillRect(0, GAME.headerHeight, w, t); // top
    // inner highlight bevel
    g.fillStyle(COLORS.wallHi, 1);
    g.fillRect(t - 1, GAME.headerHeight + t, 1, h - GAME.headerHeight - t);
    g.fillRect(w - t, GAME.headerHeight + t, 1, h - GAME.headerHeight - t);
    g.fillRect(t, TOP_WALL_Y - 1, w - 2 * t, 1);
  }

  private buildExplosion(): void {
    const c = 8;
    const radii = [3, 5, 6, 7];
    const colors = [0xffffff, 0xfcd8a8, COLORS.vausEdge, 0x6868d8];
    for (let i = 0; i < EXPLODE_KEYS.length; i++) {
      if (this.textures.exists(EXPLODE_KEYS[i])) {
        continue;
      }
      const gfx = this.make.graphics({ x: 0, y: 0 }, false);
      gfx.fillStyle(colors[i], 1);
      gfx.fillCircle(c, c, radii[i]);
      gfx.fillStyle(0x000000, 1);
      if (i >= 2) {
        gfx.fillCircle(c, c, radii[i] - 3);
      }
      gfx.generateTexture(EXPLODE_KEYS[i], 16, 16);
      gfx.destroy();
    }
  }
}
