import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { PlatformerBody, PlatformSegment } from '../../shared/Platformer';
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
  WALK_FRAME_MS,
  PLATFORM_THICKNESS,
  BUMP_AMP,
  BUMP_RECOVER,
} from './constants';
import { COLORS } from './palette';
import { buildMarioBrosTextures, TX } from './sprites';
import { FLOORS, PIPES, PIPE_WIDTH, POW, MARIO_START } from './levels';

interface Floor {
  seg: PlatformSegment;
  nudge: number; // current vertical offset (<=0 = raised) from a bump
}

/**
 * Mario Bros. — slice 2: bump-from-below. Platforms are solid; jumping into a
 * platform's underside bonks Mario and pops that platform up (the core verb
 * that will flip enemies standing on it once they arrive next slice). Also
 * carries the standard-board layout fix forward.
 */
export class MarioBrosScene extends BaseGameScene {
  private mario!: PlatformerBody;
  private sprite!: Phaser.GameObjects.Image;
  private vx = 0;
  private facing: 1 | -1 = 1;
  private walkTimer = 0;
  private walkFrame: 0 | 1 = 0;

  private floors: Floor[] = [];
  private platformGfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'game-mariobros', gameId: 'mariobros', width: WIDTH, height: HEIGHT });
  }

  protected createGame(): void {
    buildMarioBrosTextures(this);

    // Solid floors (thickness enables underside bonks).
    this.floors = FLOORS.map((f) => ({ seg: { ...f, thickness: PLATFORM_THICKNESS }, nudge: 0 }));
    this.drawStatics();
    this.platformGfx = this.add.graphics().setDepth(1);
    this.drawPlatforms();

    this.vx = 0;
    this.mario = new PlatformerBody(MARIO_START.x, 0, MARIO_W, MARIO_H);
    this.mario.setFeet(MARIO_START.y);
    this.mario.onGround = true;
    this.sprite = this.add.image(this.mario.x, this.mario.y, TX.marioRun0).setDepth(10);
  }

  protected updateGame(_time: number, delta: number): void {
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
    this.wrap();

    if (this.controls.justPressed('fire')) {
      this.mario.jump(JUMP_SPEED);
    }
    this.mario.update(delta, GRAVITY, this.floorSegments());

    if (this.mario.bumped) {
      this.onBump(this.mario.bumped);
    }
    this.settleBumps(delta);

    this.sprite.setPosition(this.mario.x, this.mario.y).setFlipX(this.facing < 0);
    this.animate(delta, dir !== 0);
  }

  private floorSegments(): PlatformSegment[] {
    return this.floors.map((f) => f.seg);
  }

  /** A platform was bonked: pop it up and play the thud. */
  private onBump(seg: PlatformSegment): void {
    const floor = this.floors.find((f) => f.seg === seg);
    if (floor) {
      floor.nudge = -BUMP_AMP;
      this.audio.play('bump');
    }
  }

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

  private wrap(): void {
    if (this.mario.x < 0) {
      this.mario.x += WIDTH;
    } else if (this.mario.x > WIDTH) {
      this.mario.x -= WIDTH;
    }
  }

  private animate(delta: number, moving: boolean): void {
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

  // --- rendering ----------------------------------------------------------

  /** Platforms are redrawn each frame so a bumped one can ride its nudge. */
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
      g.fillStyle(COLORS.pipe, 1);
      g.fillRect(pipe.x, pipe.y1, PIPE_WIDTH, pipe.y2 - pipe.y1);
      g.fillStyle(COLORS.pipeRim, 1);
      const rimY = pipe.opening === 'down' ? pipe.y2 - 6 : pipe.y1;
      g.fillRect(pipe.x - 3, rimY, PIPE_WIDTH + 6, 6);
    }
    g.fillStyle(COLORS.pow, 1);
    g.fillRect(POW.x - 12, POW.y - 8, 24, 14);
    this.add
      .text(POW.x, POW.y - 1, 'POW', { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(2);
  }
}
