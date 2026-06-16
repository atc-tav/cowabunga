import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { PlatformerBody, PlatformSegment, surfaceY } from '../../shared/Platformer';
import { StateMachine } from '../../shared/StateMachine';
import { LivesManager } from '../../shared/LivesManager';
import { LABEL_STYLE, HINT_STYLE } from '../../shared/ui';
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
  BARREL_INTERVAL_JITTER,
  BARREL_FRAME_MS,
  BARREL_DESCEND_CHANCE,
  BARREL_RIDE,
  BARREL_HIT_DIST,
  LIVES_START,
  COUNTDOWN_STEP_MS,
  HELP_FLASH_MS,
  HELP_PERIOD_MIN_MS,
  HELP_PERIOD_MAX_MS,
  DEATH_PAUSE_MS,
  WIN_MS,
  GAMEOVER_MS,
  HAMMER_DURATION_MS,
  HAMMER_BLINK_MS,
  HAMMER_SWING_MS,
  HAMMER_SMASH_DIST,
  HAMMER_PICKUP_DIST,
  SCORE_SMASH,
  HAMMER_SPOTS,
} from './constants';
import { COLORS } from './palette';
import { floatingText } from '../../shared/popups';
import { buildDKTextures, BARREL_KEYS, TX } from './sprites';
import { LEVEL1_GIRDERS, buildLadders, DK_X, PAULINE_X, Ladder } from './levels';

interface Barrel {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  dir: 1 | -1;
  mode: 'roll' | 'fall';
  girder: number;
  targetGirder: number;
  targetY: number;
  usedLadder: boolean;
  frameTimer: number;
  frame: number;
}

/**
 * Donkey Kong — Level 1 core: Mario starts bottom-left and must climb to
 * Pauline at the top while dodging DK's barrels. Adds lives + a round state
 * machine (ready/playing/dying/won/gameover). Hammer + fireball come next.
 */
export class DKScene extends BaseGameScene {
  private mario!: PlatformerBody;
  private sprite!: Phaser.GameObjects.Image;
  private readonly girders: PlatformSegment[] = LEVEL1_GIRDERS;
  private readonly ladders: Ladder[] = buildLadders();
  private readonly startGirder = LEVEL1_GIRDERS.length - 1;

  private flow!: StateMachine<DKScene>;
  private lives!: LivesManager;
  private readonly lifeIcons: Phaser.GameObjects.Image[] = [];
  private banner!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;
  private countdownTimer = 0;
  private countdownNum = 0;
  private helpTimer = 0;

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

  private hammerMode = false;
  private hammerTimer = 0;
  private hammerSwingTimer = 0;
  private hammerUp = false;
  private hammerSprite!: Phaser.GameObjects.Image;
  private readonly hammerItems: { sprite: Phaser.GameObjects.Image; x: number; y: number; taken: boolean }[] = [];

  constructor() {
    super({ key: 'game-dk', gameId: 'donkeykong', width: WIDTH, height: HEIGHT });
  }

  protected createGame(): void {
    buildDKTextures(this);
    this.drawLadders();
    this.drawGirders();

    this.barrels.length = 0;
    this.lifeIcons.length = 0;

    this.hammerItems.length = 0;
    for (const spot of HAMMER_SPOTS) {
      const x = spot.x;
      const y = this.surfaceAt(spot.g, x) - 16;
      this.hammerItems.push({ sprite: this.add.image(x, y, TX.hammer).setDepth(7), x, y, taken: false });
    }
    this.hammerSprite = this.add.image(0, 0, TX.hammer).setDepth(11).setVisible(false);
    this.hammerMode = false;

    this.kong = this.add.image(DK_X, this.surfaceAt(0, DK_X) - 14, TX.kong).setDepth(9);
    this.add.image(PAULINE_X, this.surfaceAt(0, PAULINE_X) - 7, TX.pauline).setDepth(9);
    this.helpText = this.add
      .text(PAULINE_X, this.surfaceAt(0, PAULINE_X) - 18, 'HELP!', HINT_STYLE)
      .setOrigin(0.5, 1)
      .setColor('#ff66c4')
      .setDepth(1000)
      .setVisible(false);

    this.mario = new PlatformerBody(this.startX(), 0, MARIO_W, MARIO_H);
    this.sprite = this.add.image(0, 0, TX.marioWalk0).setDepth(10);

    this.lives = new LivesManager(LIVES_START);
    this.refreshLives();

    this.banner = this.add
      .text(WIDTH / 2, HEIGHT / 2, '', LABEL_STYLE)
      .setOrigin(0.5)
      .setColor('#fcfc00')
      .setDepth(1000);
    this.countdownText = this.add
      .text(WIDTH / 2, HEIGHT / 2, '', { fontFamily: 'monospace', fontSize: '40px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(1000)
      .setVisible(false);

    this.helpTimer = Phaser.Math.Between(HELP_PERIOD_MIN_MS, HELP_PERIOD_MAX_MS);

    this.flow = new StateMachine<DKScene>(this)
      .add('intro', { enter: () => this.enterIntro() })
      .add('countdown', { enter: () => this.enterCountdown(), update: (_c, dt) => this.updateCountdown(dt) })
      .add('playing', { update: (_c, dt) => this.updatePlaying(dt) })
      .add('dying', { enter: () => this.enterDying() })
      .add('won', { enter: () => this.enterWon() })
      .add('gameover', { enter: () => this.enterGameOver() });
    this.flow.transition('intro');
  }

  /** Start opposite the lowest ladder, so you must traverse to reach it. */
  private startX(): number {
    const lowest = this.ladders.find((l) => l.fromGirder === this.startGirder - 1);
    const ladderX = lowest ? lowest.x : 30;
    return ladderX < WIDTH / 2 ? WIDTH - 30 : 30;
  }

  protected updateGame(_time: number, delta: number): void {
    this.flow.update(delta);
  }

  // --- flow ---------------------------------------------------------------

  /** Level start only: Pauline cries HELP! (flashes 3x), then the countdown. */
  private enterIntro(): void {
    this.placeMarioAtStart();
    this.clearBarrels();
    this.flashHelp(3, () => this.flow.transition('countdown'));
  }

  /** Plays at level start (after HELP) AND on every respawn: big 3-2-1-GO!
   *  while DK's barrels begin rolling. Player is frozen and safe until GO. */
  private enterCountdown(): void {
    this.placeMarioAtStart();
    this.clearBarrels();
    this.barrelTimer = 0; // DK starts rolling immediately
    this.countdownNum = 3;
    this.countdownTimer = COUNTDOWN_STEP_MS;
    this.countdownText.setText('3').setVisible(true);
  }

  private updateCountdown(delta: number): void {
    this.spawnBarrels(delta);
    this.updateBarrels(delta);

    this.countdownTimer -= delta;
    if (this.countdownTimer > 0) {
      return;
    }
    this.countdownTimer = COUNTDOWN_STEP_MS;
    this.countdownNum -= 1;
    if (this.countdownNum > 0) {
      this.countdownText.setText(String(this.countdownNum));
    } else if (this.countdownNum === 0) {
      this.countdownText.setText('GO!');
    } else {
      this.countdownText.setVisible(false);
      this.flow.transition('playing');
    }
  }

  /** Flash HELP! `times`, then hide; optional callback when done. */
  private flashHelp(times: number, onComplete?: () => void): void {
    this.helpText.setVisible(true).setAlpha(1);
    this.tweens.add({
      targets: this.helpText,
      alpha: 0,
      duration: HELP_FLASH_MS,
      yoyo: true,
      repeat: times - 1,
      onComplete: () => {
        this.helpText.setVisible(false).setAlpha(1);
        onComplete?.();
      },
    });
  }

  private updatePlaying(delta: number): void {
    if (this.climbing) {
      this.climb(delta);
    } else {
      this.walk(delta);
    }
    this.sprite.setPosition(this.mario.x, this.mario.y);

    this.spawnBarrels(delta);
    this.updateBarrels(delta);
    this.tickHelp(delta);
    if (this.hammerMode) {
      this.tickHammer(delta);
    } else {
      this.checkHammerPickup();
    }

    if (this.reachedPauline()) {
      this.flow.transition('won');
      return;
    }
    if (this.barrelHitMario()) {
      this.flow.transition('dying');
    }
  }

  private enterDying(): void {
    this.audio.play('death');
    this.cameras.main.flash(160, 255, 80, 80);
    this.tweens.add({ targets: this.sprite, angle: 360, duration: DEATH_PAUSE_MS });
    this.clearBarrels();
    this.time.delayedCall(DEATH_PAUSE_MS, () => this.afterDeath());
  }

  private afterDeath(): void {
    this.sprite.setAngle(0);
    if (this.lives.lose() <= 0) {
      this.flow.transition('gameover');
      return;
    }
    this.refreshLives();
    this.flow.transition('countdown'); // replay the 3-2-1-GO! on respawn
  }

  private enterWon(): void {
    this.banner.setText('YOU WIN!').setColor('#fcfc00').setVisible(true);
    this.helpText.setVisible(false);
    this.clearBarrels();
    this.audio.play('win');
    this.addScore(5000);
    this.time.delayedCall(WIN_MS, () => this.scene.restart());
  }

  private enterGameOver(): void {
    this.banner.setText('GAME OVER').setColor('#ff0000').setVisible(true);
    this.time.delayedCall(GAMEOVER_MS, () => this.scene.restart());
  }

  // --- walking / climbing -------------------------------------------------

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
    // While wielding the hammer you can't jump or climb (classic restriction).
    if (!this.hammerMode && this.controls.justPressed('fire')) {
      this.mario.jump(JUMP_SPEED);
    }
    this.mario.update(delta, GRAVITY, this.girders);
    if (!this.hammerMode && this.mario.onGround && this.tryMountLadder()) {
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

  private placeMarioAtStart(): void {
    this.climbing = false;
    this.ladder = undefined;
    this.endHammer();
    for (const item of this.hammerItems) {
      item.taken = false;
      item.sprite.setVisible(true);
    }
    const sx = this.startX();
    this.mario.x = sx;
    this.mario.setFeet(this.surfaceAt(this.startGirder, sx));
    this.mario.vy = 0;
    this.mario.onGround = true;
    this.facing = sx > WIDTH / 2 ? -1 : 1; // face inward from the start side
    this.sprite
      .setAngle(0)
      .setFlipX(this.facing < 0)
      .setTexture(TX.marioWalk0)
      .setPosition(this.mario.x, this.mario.y);
  }

  // --- hammer -------------------------------------------------------------

  private checkHammerPickup(): void {
    for (const item of this.hammerItems) {
      if (item.taken) {
        continue;
      }
      if (Phaser.Math.Distance.Between(item.x, item.y, this.mario.x, this.mario.y) < HAMMER_PICKUP_DIST) {
        item.taken = true;
        item.sprite.setVisible(false);
        this.hammerMode = true;
        this.hammerTimer = HAMMER_DURATION_MS;
        this.hammerSwingTimer = HAMMER_SWING_MS;
        this.hammerUp = true;
        this.audio.play('hammer');
        return;
      }
    }
  }

  private tickHammer(delta: number): void {
    this.hammerTimer -= delta;
    if (this.hammerTimer <= 0) {
      this.endHammer();
      return;
    }

    this.hammerSwingTimer -= delta;
    if (this.hammerSwingTimer <= 0) {
      this.hammerSwingTimer = HAMMER_SWING_MS;
      this.hammerUp = !this.hammerUp;
    }

    const head = this.hammerHead();
    this.hammerSprite
      .setVisible(this.hammerTimer > HAMMER_BLINK_MS || Math.floor(this.hammerTimer / 120) % 2 === 0)
      .setPosition(head.x, head.y)
      .setAngle(this.hammerUp ? 0 : this.facing > 0 ? 90 : -90)
      .setFlipX(this.facing < 0);

    this.smashWithHammer(head);
  }

  private hammerHead(): { x: number; y: number } {
    if (this.hammerUp) {
      return { x: this.mario.x, y: this.mario.y - MARIO_H / 2 - 4 };
    }
    return { x: this.mario.x + this.facing * 9, y: this.mario.y + 2 };
  }

  private smashWithHammer(head: { x: number; y: number }): void {
    for (let i = this.barrels.length - 1; i >= 0; i--) {
      const b = this.barrels[i];
      if (Phaser.Math.Distance.Between(head.x, head.y, b.x, b.y) < HAMMER_SMASH_DIST) {
        b.sprite.destroy();
        this.barrels.splice(i, 1);
        this.addScore(SCORE_SMASH);
        floatingText(this, b.x, b.y, String(SCORE_SMASH), { color: '#ffffff', fontSize: '8px' });
        this.audio.play('smash');
      }
    }
  }

  private endHammer(): void {
    this.hammerMode = false;
    this.hammerSprite.setVisible(false);
  }

  // --- win condition ------------------------------------------------------

  private reachedPauline(): boolean {
    return (
      !this.climbing &&
      Math.abs(this.mario.feet - this.surfaceAt(0, this.mario.x)) < 4 &&
      Math.abs(this.mario.x - PAULINE_X) < 12
    );
  }

  // --- barrels ------------------------------------------------------------

  /** Periodically flash HELP! twice while playing, at random 5-15s intervals. */
  private tickHelp(delta: number): void {
    this.helpTimer -= delta;
    if (this.helpTimer <= 0) {
      this.helpTimer = Phaser.Math.Between(HELP_PERIOD_MIN_MS, HELP_PERIOD_MAX_MS);
      this.flashHelp(2);
    }
  }

  private spawnBarrels(delta: number): void {
    this.barrelTimer -= delta;
    if (this.barrelTimer > 0) {
      return;
    }
    this.barrelTimer = BARREL_INTERVAL_MS + Phaser.Math.Between(-BARREL_INTERVAL_JITTER, BARREL_INTERVAL_JITTER);
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
          b.dir = this.downhill(b.girder);
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

  private barrelHitMario(): boolean {
    for (const b of this.barrels) {
      if (Phaser.Math.Distance.Between(b.x, b.y, this.mario.x, this.mario.y) < BARREL_HIT_DIST) {
        return true;
      }
    }
    return false;
  }

  private clearBarrels(): void {
    for (const b of this.barrels) {
      b.sprite.destroy();
    }
    this.barrels.length = 0;
  }

  // --- helpers ------------------------------------------------------------

  private surfaceAt(girderIndex: number, x: number): number {
    return surfaceY(this.girders[girderIndex], x);
  }

  private downhill(girderIndex: number): 1 | -1 {
    const g = this.girders[girderIndex];
    return g.y2 >= g.y1 ? 1 : -1;
  }

  private downLadderFrom(girderIndex: number): Ladder | undefined {
    return this.ladders.find((l) => l.fromGirder === girderIndex);
  }

  private refreshLives(): void {
    for (const icon of this.lifeIcons) {
      icon.destroy();
    }
    this.lifeIcons.length = 0;
    for (let i = 0; i < this.lives.count; i++) {
      this.lifeIcons.push(this.add.image(8 + i * 11, 24, TX.marioWalk0).setScale(0.7).setDepth(1000));
    }
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
