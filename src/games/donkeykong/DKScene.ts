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
  BARREL_SPEED,
  BARREL_FALL_SPEED,
  BARREL_INTERVAL_MS,
  BARREL_FRAME_MS,
  BARREL_DESCEND_CHANCE,
  BARREL_RIDE,
  BARREL_HIT_DIST,
  DK_POS,
  DEATH_PAUSE_MS,
} from './constants';
import { COLORS } from './palette';
import { buildDKTextures, BARREL_KEYS, TX } from './sprites';
import { LEVEL1_GIRDERS, LEVEL1_LADDERS, MARIO_START, Ladder } from './levels';

interface Barrel {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number; // sprite centre
  dir: 1 | -1;
  mode: 'roll' | 'fall';
  girderY: number;
  targetY: number;
  usedLadder: boolean;
  frameTimer: number;
  frame: number;
}

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

  private kong!: Phaser.GameObjects.Image;
  private readonly barrels: Barrel[] = [];
  private barrelTimer = 0;
  private dead = false;
  private deadTimer = 0;

  constructor() {
    super({ key: 'game-dk', gameId: 'donkeykong', width: WIDTH, height: HEIGHT });
  }

  protected createGame(): void {
    buildDKTextures(this);
    this.drawLadders();
    this.drawGirders();

    this.climbing = false;
    this.ladder = undefined;
    this.dead = false;
    this.barrels.length = 0;
    this.barrelTimer = BARREL_INTERVAL_MS;

    this.kong = this.add.image(DK_POS.x, DK_POS.y - 14, TX.kong).setDepth(9);
    this.mario = new PlatformerBody(MARIO_START.x, MARIO_START.y - MARIO_H / 2, MARIO_W, MARIO_H);
    this.sprite = this.add.image(this.mario.x, this.mario.y, TX.marioWalk0).setDepth(10);
  }

  protected updateGame(_time: number, delta: number): void {
    if (this.dead) {
      this.deadTimer -= delta;
      if (this.deadTimer <= 0) {
        this.respawn();
      }
      return;
    }

    if (this.climbing) {
      this.climb(delta);
    } else {
      this.walk(delta);
    }
    this.sprite.setPosition(this.mario.x, this.mario.y);

    this.spawnBarrels(delta);
    this.updateBarrels(delta);
    this.checkBarrelHit();
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

  // --- barrels ------------------------------------------------------------

  private spawnBarrels(delta: number): void {
    this.barrelTimer -= delta;
    if (this.barrelTimer > 0) {
      return;
    }
    this.barrelTimer = BARREL_INTERVAL_MS;
    const topGirderY = LEVEL1_GIRDERS[LEVEL1_GIRDERS.length - 1].y; // y=64 (DK's girder)
    const barrel: Barrel = {
      sprite: this.add.image(DK_POS.x + 16, topGirderY - BARREL_RIDE, BARREL_KEYS[0]).setDepth(8),
      x: DK_POS.x + 16,
      y: topGirderY - BARREL_RIDE,
      dir: 1,
      mode: 'roll',
      girderY: topGirderY,
      targetY: topGirderY,
      usedLadder: false,
      frameTimer: 0,
      frame: 0,
    };
    this.barrels.push(barrel);
    // "throw" tell
    this.tweens.add({ targets: this.kong, scaleX: 1.15, duration: 90, yoyo: true });
  }

  private updateBarrels(delta: number): void {
    const dt = delta / 1000;
    for (let i = this.barrels.length - 1; i >= 0; i--) {
      const b = this.barrels[i];
      if (b.mode === 'roll') {
        b.x += b.dir * BARREL_SPEED * dt;
        b.y = b.girderY - BARREL_RIDE;
        this.rollDecisions(b);
        if (b.x < -8 || b.x > WIDTH + 8) {
          b.sprite.destroy();
          this.barrels.splice(i, 1);
          continue;
        }
      } else {
        b.y += BARREL_FALL_SPEED * dt;
        if (b.y >= b.targetY - BARREL_RIDE) {
          b.y = b.targetY - BARREL_RIDE;
          b.girderY = b.targetY;
          b.mode = 'roll';
          b.usedLadder = false;
          const down = this.downLadderFrom(b.girderY);
          if (down) {
            b.dir = b.x <= down.x ? 1 : -1; // head toward the next ladder down
          }
        }
      }
      this.animateBarrel(b, delta);
      b.sprite.setPosition(b.x, b.y);
    }
  }

  /** Decide whether a rolling barrel descends a ladder or drops off an edge. */
  private rollDecisions(b: Barrel): void {
    const down = this.downLadderFrom(b.girderY);
    if (down && !b.usedLadder && Math.abs(b.x - down.x) < 3 && Math.random() < BARREL_DESCEND_CHANCE) {
      b.x = down.x;
      b.targetY = down.bottomY;
      b.mode = 'fall';
      b.usedLadder = true;
      return;
    }
    const girder = this.girderAt(b.girderY);
    if (!girder) {
      return;
    }
    if ((b.dir > 0 && b.x >= girder.x2 - 2) || (b.dir < 0 && b.x <= girder.x1 + 2)) {
      const below = this.girderBelow(b.girderY);
      if (below) {
        b.targetY = below.y;
        b.mode = 'fall';
        b.x = Phaser.Math.Clamp(b.x, below.x1 + 4, below.x2 - 4);
      }
    }
  }

  private animateBarrel(b: Barrel, delta: number): void {
    b.frameTimer += delta;
    if (b.frameTimer >= BARREL_FRAME_MS) {
      b.frameTimer = 0;
      b.frame = (b.frame + 1) % BARREL_KEYS.length;
      b.sprite.setTexture(BARREL_KEYS[b.frame]);
    }
  }

  private checkBarrelHit(): void {
    for (const b of this.barrels) {
      if (Phaser.Math.Distance.Between(b.x, b.y, this.mario.x, this.mario.y) < BARREL_HIT_DIST) {
        this.hit();
        return;
      }
    }
  }

  private hit(): void {
    this.dead = true;
    this.deadTimer = DEATH_PAUSE_MS;
    this.audio.play('death');
    this.cameras.main.flash(160, 255, 80, 80);
    // Mario death spin in place.
    this.tweens.add({ targets: this.sprite, angle: 360, duration: DEATH_PAUSE_MS });
    for (const b of this.barrels) {
      b.sprite.destroy();
    }
    this.barrels.length = 0;
  }

  private respawn(): void {
    this.dead = false;
    this.climbing = false;
    this.ladder = undefined;
    this.barrelTimer = BARREL_INTERVAL_MS;
    this.mario.x = MARIO_START.x;
    this.setFeet(MARIO_START.y);
    this.mario.vy = 0;
    this.facing = 1;
    this.sprite.setAngle(0).setVisible(true).setFlipX(false).setTexture(TX.marioWalk0);
  }

  // --- girder/ladder lookups ---------------------------------------------

  private girderAt(y: number): PlatformSegment | undefined {
    return this.segments.find((s) => s.y === y);
  }

  private girderBelow(y: number): PlatformSegment | undefined {
    let best: PlatformSegment | undefined;
    for (const s of this.segments) {
      if (s.y > y && (!best || s.y < best.y)) {
        best = s;
      }
    }
    return best;
  }

  private downLadderFrom(girderY: number): Ladder | undefined {
    return this.ladders.find((l) => l.topY === girderY);
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
