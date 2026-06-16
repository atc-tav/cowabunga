import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { PlatformerBody, PlatformSegment } from '../../shared/Platformer';
import {
  WIDTH,
  HEIGHT,
  GRAVITY,
  JUMP_SPEED,
  WALK_SPEED,
  CLIMB_SPEED,
  WALK_FRAME_MS,
  CLIMB_FRAME_MS,
  LADDER_GRAB_X,
  MARIO_W,
  MARIO_H,
  GIRDER_THICKNESS,
} from './constants';
import { COLORS } from './palette';
import { buildDKTextures, TX } from './sprites';
import { LEVEL1_GIRDERS, LEVEL1_LADDERS, MARIO_START, Ladder } from './levels';

/**
 * Donkey Kong — slice 2: ladders. Mario can now climb between girders. Walking
 * uses the shared PlatformerBody (gravity/jump); climbing is a separate locked
 * mode that overrides physics and moves Mario along a ladder rung.
 */
export class DKScene extends BaseGameScene {
  private mario!: PlatformerBody;
  private sprite!: Phaser.GameObjects.Image;
  private readonly segments: PlatformSegment[] = LEVEL1_GIRDERS;
  private readonly ladders: Ladder[] = LEVEL1_LADDERS;

  private facing: 1 | -1 = 1;
  private walkTimer = 0;
  private walkFrame: 0 | 1 = 0;

  private climbing = false;
  private ladder?: Ladder;
  private climbTimer = 0;
  private climbFrame: 0 | 1 = 0;

  constructor() {
    super({ key: 'game-dk', gameId: 'donkeykong', width: WIDTH, height: HEIGHT });
  }

  protected createGame(): void {
    buildDKTextures(this);
    this.drawLadders();
    this.drawGirders();

    this.climbing = false;
    this.ladder = undefined;
    this.mario = new PlatformerBody(MARIO_START.x, MARIO_START.y - MARIO_H / 2, MARIO_W, MARIO_H);
    this.sprite = this.add.image(this.mario.x, this.mario.y, TX.marioWalk0).setDepth(10);
  }

  protected updateGame(_time: number, delta: number): void {
    if (this.climbing) {
      this.climb(delta);
    } else {
      this.walk(delta);
    }
    this.sprite.setPosition(this.mario.x, this.mario.y);
  }

  // --- walking ------------------------------------------------------------

  private walk(delta: number): void {
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

    if (this.mario.onGround && this.tryMountLadder()) {
      return;
    }

    this.sprite.setFlipX(this.facing < 0);
    this.animateWalk(delta, dir !== 0);
  }

  /** If standing at a ladder and pressing up/down, start climbing it. */
  private tryMountLadder(): boolean {
    const feet = this.mario.feet;
    const up = this.controls.isDown('up');
    const down = this.controls.isDown('down');
    if (!up && !down) {
      return false;
    }
    for (const ladder of this.ladders) {
      if (Math.abs(this.mario.x - ladder.x) > LADDER_GRAB_X) {
        continue;
      }
      if (up && Math.abs(feet - ladder.bottomY) < 4) {
        this.startClimb(ladder, false);
        return true;
      }
      if (down && Math.abs(feet - ladder.topY) < 4) {
        this.startClimb(ladder, true);
        return true;
      }
    }
    return false;
  }

  // --- climbing -----------------------------------------------------------

  private startClimb(ladder: Ladder, descending: boolean): void {
    this.climbing = true;
    this.ladder = ladder;
    this.mario.x = ladder.x;
    this.mario.vy = 0;
    this.mario.onGround = false;
    this.sprite.setFlipX(false);
    // Step onto the ladder so we don't instantly re-trigger the exit check.
    this.setFeet(descending ? ladder.topY + 2 : ladder.bottomY - 2);
  }

  private climb(delta: number): void {
    const ladder = this.ladder;
    if (!ladder) {
      this.climbing = false;
      return;
    }
    this.mario.x = ladder.x;

    let moved = false;
    const step = (CLIMB_SPEED * delta) / 1000;
    if (this.controls.isDown('up')) {
      this.setFeet(this.mario.feet - step);
      moved = true;
    } else if (this.controls.isDown('down')) {
      this.setFeet(this.mario.feet + step);
      moved = true;
    }

    const feet = this.mario.feet;
    if (feet <= ladder.topY) {
      this.setFeet(ladder.topY);
      this.exitClimb();
      return;
    }
    if (feet >= ladder.bottomY) {
      this.setFeet(ladder.bottomY);
      this.exitClimb();
      return;
    }

    this.animateClimb(delta, moved);
  }

  private exitClimb(): void {
    this.climbing = false;
    this.ladder = undefined;
    this.mario.vy = 0;
    this.mario.onGround = true; // standing on the girder we arrived at
  }

  private setFeet(feet: number): void {
    this.mario.y = feet - this.mario.height / 2;
  }

  // --- animation ----------------------------------------------------------

  private animateWalk(delta: number, moving: boolean): void {
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

  private animateClimb(delta: number, moving: boolean): void {
    if (moving) {
      this.climbTimer += delta;
      if (this.climbTimer >= CLIMB_FRAME_MS) {
        this.climbTimer = 0;
        this.climbFrame = this.climbFrame === 0 ? 1 : 0;
      }
    }
    this.sprite.setTexture(this.climbFrame === 0 ? TX.marioClimb0 : TX.marioClimb1);
  }

  // --- world --------------------------------------------------------------

  private drawGirders(): void {
    const g = this.add.graphics().setDepth(2);
    for (const girder of LEVEL1_GIRDERS) {
      g.fillStyle(COLORS.girder, 1);
      g.fillRect(girder.x1, girder.y, girder.x2 - girder.x1, GIRDER_THICKNESS);
      g.fillStyle(COLORS.rivet, 1);
      for (let x = girder.x1 + 3; x < girder.x2 - 1; x += 14) {
        g.fillRect(x, girder.y + 1, 2, 2);
      }
    }
  }

  private drawLadders(): void {
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(COLORS.ladder, 1);
    for (const ladder of this.ladders) {
      const top = ladder.topY;
      const height = ladder.bottomY - ladder.topY + GIRDER_THICKNESS;
      g.fillRect(ladder.x - 3, top, 1, height); // left rail
      g.fillRect(ladder.x + 2, top, 1, height); // right rail
      for (let y = top + 2; y < top + height; y += 6) {
        g.fillRect(ladder.x - 3, y, 6, 1); // rungs
      }
    }
  }
}
