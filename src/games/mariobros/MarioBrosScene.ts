import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { PlatformerBody } from '../../shared/Platformer';
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
} from './constants';
import { COLORS } from './palette';
import { buildMarioBrosTextures, TX } from './sprites';
import { FLOORS, PIPES, POW, MARIO_START } from './levels';

/**
 * Mario Bros. (original single-screen) — slice 1: the floor layout and Mario's
 * movement. Run has momentum/skid, jumps are floaty, and walking off a screen
 * edge wraps you to the other side. Built on the shared PlatformerBody.
 * (Bump-from-below, enemies, and the POW block come in later slices.)
 */
export class MarioBrosScene extends BaseGameScene {
  private mario!: PlatformerBody;
  private sprite!: Phaser.GameObjects.Image;
  private vx = 0;
  private facing: 1 | -1 = 1;
  private walkTimer = 0;
  private walkFrame: 0 | 1 = 0;

  constructor() {
    super({ key: 'game-mariobros', gameId: 'mariobros', width: WIDTH, height: HEIGHT });
  }

  protected createGame(): void {
    buildMarioBrosTextures(this);
    this.drawLevel();

    this.vx = 0;
    this.mario = new PlatformerBody(MARIO_START.x, 0, MARIO_W, MARIO_H);
    this.mario.setFeet(MARIO_START.y);
    this.mario.onGround = true;
    this.sprite = this.add.image(this.mario.x, this.mario.y, TX.marioRun0).setDepth(10);
  }

  protected updateGame(_time: number, delta: number): void {
    const dt = delta / 1000;
    const dir = (this.controls.isDown('left') ? -1 : 0) + (this.controls.isDown('right') ? 1 : 0);

    // Horizontal momentum: accelerate toward input, otherwise coast to a stop.
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
    this.mario.update(delta, GRAVITY, FLOORS);

    this.sprite.setPosition(this.mario.x, this.mario.y).setFlipX(this.facing < 0);
    this.animate(delta, dir !== 0);
  }

  /** Walk off one side of the screen, reappear on the other. */
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

  private drawLevel(): void {
    const g = this.add.graphics().setDepth(1);
    for (const f of FLOORS) {
      g.fillStyle(COLORS.platform, 1);
      g.fillRect(f.x1, f.y1, f.x2 - f.x1, PLATFORM_THICKNESS);
      g.fillStyle(COLORS.platformTop, 1);
      g.fillRect(f.x1, f.y1, f.x2 - f.x1, 2);
    }

    for (const pipe of PIPES) {
      g.fillStyle(COLORS.pipe, 1);
      g.fillRect(pipe.x, pipe.y, 24, 18);
      g.fillStyle(COLORS.pipeRim, 1);
      g.fillRect(pipe.x - 2, pipe.y + 14, 28, 4);
    }

    g.fillStyle(COLORS.pow, 1);
    g.fillRect(POW.x - 12, POW.y - 8, 24, 14);
    this.add
      .text(POW.x, POW.y - 1, 'POW', { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(2);
  }
}
