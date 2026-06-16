import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { PlatformerBody, PlatformSegment, surfaceY } from '../../shared/Platformer';
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
  DEATH_PAUSE_MS,
} from './constants';
import { COLORS } from './palette';
import { buildDKTextures, BARREL_KEYS, TX } from './sprites';
import { LEVEL1_GIRDERS, buildLadders, MARIO_START_X, DK_X, Ladder } from './levels';

interface Barrel {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  dir: 1 | -1;
  mode: 'roll' | 'fall';
  girder: number; // index into girders
  targetGirder: number;
  targetY: number;
  usedLadder: boolean;
  frameTimer: number;
  frame: number;
}

/**
 * Donkey Kong — slope slice: girders are angled, so Mario walks up/down them
 * and barrels roll downhill toward the next ladder (the slope tells you which
 * way they'll go). Built on the slope-aware shared PlatformerBody.
 */
export class DKScene extends BaseGameScene {
  private mario!: PlatformerBody;
  private sprite!: Phaser.GameObjects.Image;
  private readonly girders: PlatformSegment[] = LEVEL1_GIRDERS;
  private readonly ladders: Ladder[] = buildLadders();

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

    this.kong = this.add.image(DK_X, this.surfaceAt(0, DK_X) - 14, TX.kong).setDepth(9);
    this.mario = new PlatformerBody(MARIO_START_X, 0, MARIO_W, MARIO_H);
    this.mario.setFeet(this.surfaceAt(0, MARIO_START_X));
    this.mario.onGround = true;
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
        MARIO_W / 2 + 12,
        WIDTH - MARIO_W / 2 - 12,
      );
      this.facing = dir > 0 ? 1 : -1;
    }

    if (this.controls.justPressed('fire')) {
      this.mario.jump(JUMP_SPEED);
    }

    this.mario.update(delta, GRAVITY, this.girders);

    if (this.mario.onGround && this.tryMountLadder()) {
      return;
    }

    this.sprite.setFlipX(this.facing < 0);
    this.animateWalk(delta, dir !== 0);
  }

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
      if (up && Math.abs(feet - ladder.bottomY) < 5) {
        this.startClimb(ladder, false);
        return true;
      }
      if (down && Math.abs(feet - ladder.topY) < 5) {
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
    this.mario.setFeet(descending ? ladder.topY + 2 : ladder.bottomY - 2);
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
      this.mario.setFeet(this.mario.feet - step);
      moved = true;
    } else if (this.controls.isDown('down')) {
      this.mario.setFeet(this.mario.feet + step);
      moved = true;
    }

    if (this.mario.feet <= ladder.topY) {
      this.mario.setFeet(ladder.topY);
      this.exitClimb();
      return;
    }
    if (this.mario.feet >= ladder.bottomY) {
      this.mario.setFeet(ladder.bottomY);
      this.exitClimb();
      return;
    }
    this.animateClimb(delta, moved);
  }

  private exitClimb(): void {
    this.climbing = false;
    this.ladder = undefined;
    this.mario.vy = 0;
    this.mario.onGround = true;
  }

  // --- barrels ------------------------------------------------------------

  private spawnBarrels(delta: number): void {
    this.barrelTimer -= delta;
    if (this.barrelTimer > 0) {
      return;
    }
    this.barrelTimer = BARREL_INTERVAL_MS;
    const x = DK_X + 16;
    this.barrels.push({
      sprite: this.add.image(x, this.surfaceAt(0, x) - BARREL_RIDE, BARREL_KEYS[0]).setDepth(8),
      x,
      y: this.surfaceAt(0, x) - BARREL_RIDE,
      dir: this.downhill(0),
      mode: 'roll',
      girder: 0,
      targetGirder: 0,
      targetY: 0,
      usedLadder: false,
      frameTimer: 0,
      frame: 0,
    });
    this.tweens.add({ targets: this.kong, scaleX: 1.15, duration: 90, yoyo: true });
  }

  private updateBarrels(delta: number): void {
    const dt = delta / 1000;
    for (let i = this.barrels.length - 1; i >= 0; i--) {
      const b = this.barrels[i];
      if (b.mode === 'roll') {
        b.x += b.dir * BARREL_SPEED * dt;
        b.y = this.surfaceAt(b.girder, b.x) - BARREL_RIDE;
        this.rollDecisions(b);
        if (b.x < -8 || b.x > WIDTH + 8) {
          b.sprite.destroy();
          this.barrels.splice(i, 1);
          continue;
        }
      } else {
        b.y += BARREL_FALL_SPEED * dt;
        if (b.y >= b.targetY - BARREL_RIDE) {
          b.girder = b.targetGirder;
          b.y = this.surfaceAt(b.girder, b.x) - BARREL_RIDE;
          b.mode = 'roll';
          b.usedLadder = false;
          b.dir = this.downhill(b.girder); // roll downhill on the new girder
        }
      }
      this.animateBarrel(b, delta);
      b.sprite.setPosition(b.x, b.y);
    }
  }

  private rollDecisions(b: Barrel): void {
    const down = this.downLadderFrom(b.girder);
    if (down && !b.usedLadder && Math.abs(b.x - down.x) < 3 && Math.random() < BARREL_DESCEND_CHANCE) {
      b.x = down.x;
      b.targetGirder = b.girder + 1;
      b.targetY = down.bottomY;
      b.mode = 'fall';
      b.usedLadder = true;
      return;
    }
    const girder = this.girders[b.girder];
    if ((b.dir > 0 && b.x >= girder.x2 - 2) || (b.dir < 0 && b.x <= girder.x1 + 2)) {
      const belowIndex = b.girder + 1;
      if (belowIndex < this.girders.length) {
        b.targetGirder = belowIndex;
        b.x = Phaser.Math.Clamp(b.x, this.girders[belowIndex].x1 + 4, this.girders[belowIndex].x2 - 4);
        b.targetY = this.surfaceAt(belowIndex, b.x);
        b.mode = 'fall';
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
    this.mario.x = MARIO_START_X;
    this.mario.setFeet(this.surfaceAt(0, MARIO_START_X));
    this.mario.vy = 0;
    this.mario.onGround = true;
    this.facing = 1;
    this.sprite.setAngle(0).setVisible(true).setFlipX(false).setTexture(TX.marioWalk0);
  }

  // --- helpers ------------------------------------------------------------

  private surfaceAt(girderIndex: number, x: number): number {
    return surfaceY(this.girders[girderIndex], x);
  }

  /** Downhill direction of a girder: +1 down-to-the-right, -1 down-to-the-left (flat -> right). */
  private downhill(girderIndex: number): 1 | -1 {
    const g = this.girders[girderIndex];
    return g.y2 >= g.y1 ? 1 : -1;
  }

  private downLadderFrom(girderIndex: number): Ladder | undefined {
    return this.ladders.find((l) => l.fromGirder === girderIndex);
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
    for (const girder of this.girders) {
      g.fillStyle(COLORS.girder, 1);
      g.fillPoints(
        [
          new Phaser.Geom.Point(girder.x1, girder.y1),
          new Phaser.Geom.Point(girder.x2, girder.y2),
          new Phaser.Geom.Point(girder.x2, girder.y2 + GIRDER_THICKNESS),
          new Phaser.Geom.Point(girder.x1, girder.y1 + GIRDER_THICKNESS),
        ],
        true,
      );
      g.fillStyle(COLORS.rivet, 1);
      for (let x = girder.x1 + 6; x < girder.x2 - 4; x += 16) {
        g.fillRect(x, surfaceY(girder, x) + 1, 2, 2);
      }
    }
  }

  private drawLadders(): void {
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(COLORS.ladder, 1);
    for (const ladder of this.ladders) {
      const top = ladder.topY;
      const height = ladder.bottomY - ladder.topY + GIRDER_THICKNESS;
      g.fillRect(ladder.x - 3, top, 1, height);
      g.fillRect(ladder.x + 2, top, 1, height);
      for (let y = top + 2; y < top + height; y += 6) {
        g.fillRect(ladder.x - 3, y, 6, 1);
      }
    }
  }
}
