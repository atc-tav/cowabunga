import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { PlatformerBody, PlatformSegment } from '../../shared/Platformer';
import { HINT_STYLE } from '../../shared/ui';
import {
  WIDTH,
  HEIGHT,
  GRAVITY,
  JUMP_SPEED,
  WALK_SPEED,
  WALK_FRAME_MS,
  MARIO_W,
  MARIO_H,
  GIRDER_THICKNESS,
} from './constants';
import { COLORS } from './palette';
import { buildDKTextures, TX } from './sprites';
import { LEVEL1_GIRDERS, MARIO_START } from './levels';

/**
 * Donkey Kong — slice 1: the girder layout and Mario's movement (walk, gravity,
 * jump arc) on the shared PlatformerBody. Ladders, barrels, DK, and the win
 * condition come in later slices.
 */
export class DKScene extends BaseGameScene {
  private mario!: PlatformerBody;
  private sprite!: Phaser.GameObjects.Image;
  private segments: PlatformSegment[] = LEVEL1_GIRDERS;
  private facing: 1 | -1 = 1;
  private walkTimer = 0;
  private walkFrame: 0 | 1 = 0;

  constructor() {
    super({ key: 'game-dk', gameId: 'donkeykong', width: WIDTH, height: HEIGHT });
  }

  protected createGame(): void {
    buildDKTextures(this);
    this.drawGirders();

    this.mario = new PlatformerBody(MARIO_START.x, MARIO_START.y - MARIO_H / 2, MARIO_W, MARIO_H);
    this.sprite = this.add.image(this.mario.x, this.mario.y, TX.marioWalk0).setDepth(10);

    this.add
      .text(WIDTH / 2, 34, 'ARROWS MOVE   SPACE JUMP', HINT_STYLE)
      .setOrigin(0.5, 0);
  }

  protected updateGame(_time: number, delta: number): void {
    const dir = this.controls.direction().x;
    if (dir !== 0) {
      this.mario.x = Phaser.Math.Clamp(
        this.mario.x + (dir * WALK_SPEED * delta) / 1000,
        MARIO_W / 2 + 8,
        WIDTH - MARIO_W / 2 - 8,
      );
      this.facing = dir > 0 ? 1 : -1;
    }

    if (this.controls.justPressed('fire')) {
      this.mario.jump(JUMP_SPEED);
    }

    this.mario.update(delta, GRAVITY, this.segments);
    this.sprite.setPosition(this.mario.x, this.mario.y).setFlipX(this.facing < 0);
    this.animate(delta, dir !== 0);
  }

  private animate(delta: number, moving: boolean): void {
    if (!this.mario.onGround) {
      this.sprite.setTexture(TX.marioJump);
      return;
    }
    if (!moving) {
      this.sprite.setTexture(TX.marioWalk0);
      return;
    }
    this.walkTimer += delta;
    if (this.walkTimer >= WALK_FRAME_MS) {
      this.walkTimer = 0;
      this.walkFrame = this.walkFrame === 0 ? 1 : 0;
    }
    this.sprite.setTexture(this.walkFrame === 0 ? TX.marioWalk0 : TX.marioWalk1);
  }

  private drawGirders(): void {
    const g = this.add.graphics().setDepth(1);
    for (const girder of LEVEL1_GIRDERS) {
      g.fillStyle(COLORS.girder, 1);
      g.fillRect(girder.x1, girder.y, girder.x2 - girder.x1, GIRDER_THICKNESS);
      g.fillStyle(COLORS.rivet, 1);
      for (let x = girder.x1 + 3; x < girder.x2 - 1; x += 14) {
        g.fillRect(x, girder.y + 1, 2, 2);
      }
    }
  }
}
