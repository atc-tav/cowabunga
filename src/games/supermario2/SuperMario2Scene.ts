import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { PlatformerBody, PlatformSegment, surfaceY } from '../../shared/Platformer';
import { InputManager } from '../../shared/InputManager';
import { LivesManager } from '../../shared/LivesManager';
import { StateMachine } from '../../shared/StateMachine';
import { LABEL_STYLE, HINT_STYLE, HUD_STYLE } from '../../shared/ui';
import { buildSM2Textures, TX } from './sprites';
import { COLORS } from './palette';
import { CHARACTERS, CHARACTER_ORDER, CharacterId, CharacterStats } from './characters';
import { Enemy, EnemyKind, createEnemy } from './enemies';
import { WORLD_1_1, LevelData } from './levels';
import {
  WIDTH,
  HEIGHT,
  HUD_H,
  MAX_FALL,
  RUN_SPEED,
  JUMP_CUT,
  FLOAT_HORIZ,
  FLOAT_DURATION_MS,
  TOAD_CHARGE_MULT,
  TOAD_CHARGE_FRAMES,
  THROW_VX,
  THROW_VY,
  ITEM_BOUNCE_DECAY,
  ITEM_FRICTION,
  ITEM_STOP_SPEED,
  PLUCK_RANGE,
  PICKUP_RANGE,
  START_HP,
  MAX_HP,
  HEART_PER_ENEMIES,
  DAMAGE_INVULN_MS,
  CHERRY_FOR_STARMAN,
  STARMAN_MS,
  JAR_SPAWN_MS,
  JAR_MAX_ALIVE,
  PLAYER_W,
  PLAYER_H,
  LIVES_START,
  READY_MS,
  DEATH_PAUSE_MS,
  WIN_MS,
  GAMEOVER_MS,
  WALK_FRAME_MS,
} from './constants';

const K = Phaser.Input.Keyboard.KeyCodes;

type FlowState = 'select' | 'ready' | 'playing' | 'dying' | 'won' | 'gameover';

/** What the player is currently holding above their head. */
interface Carried {
  type: 'veg' | 'enemy';
  enemyKind?: EnemyKind;
  sprite: Phaser.GameObjects.Image;
}

/** A thrown veggie or enemy body in flight (bounces, kills on contact). */
interface Projectile {
  type: 'veg' | 'enemy';
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number; // centre
  vx: number;
  vy: number;
  w: number;
  h: number;
  chainKills: boolean;
  inert: boolean;
}

interface Grass {
  x: number;
  feetY: number;
  sprite: Phaser.GameObjects.Image;
  plucked: boolean;
}
interface Pickup {
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
}

/**
 * Super Mario Bros. 2 (NES) — World 1-1 vertical slice. Establishes the systems
 * that define SMB2: four playable characters with distinct physics (Luigi's high
 * floaty jump, Toad's fast pluck, Peach's float, Mario's balance) and the
 * pluck-grass / pick-up-and-throw / NO-stomp combat loop, plus cherries → Starman,
 * a spawn jar, hearts, and the Crystal Ball → Mask Gate exit. Bosses, Sub-Space,
 * and the remaining worlds are later slices (spec §14 flags level data as
 * incomplete).
 */
export class SuperMario2Scene extends BaseGameScene {
  private level: LevelData = WORLD_1_1;
  private platforms: PlatformSegment[] = [];
  private worldGfx!: Phaser.GameObjects.Graphics;

  private flow!: StateMachine<SuperMario2Scene, FlowState>;
  private lives!: LivesManager;

  // --- player ---
  private charId: CharacterId = 'mario';
  private char!: CharacterStats;
  private body!: PlatformerBody;
  private sprite!: Phaser.GameObjects.Image;
  private vx = 0;
  private facing: 1 | -1 = 1;
  private hp = START_HP;
  private invuln = 0;
  private jumpHeld = false;
  private crouchFrames = 0;
  private floating = false;
  private floatTimer = 0;
  private pluckTimer = 0;
  private pluckTarget: Grass | null = null;
  private carried: Carried | null = null;
  private walkTimer = 0;
  private walkFrame: 0 | 1 = 0;
  private starman = 0;
  private starTintTimer = 0;

  // --- world objects ---
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private grasses: Grass[] = [];
  private cherries: Pickup[] = [];
  private hearts: Pickup[] = [];
  private jarSprites: Phaser.GameObjects.Image[] = [];
  private jarTimers: number[] = [];
  private crystalSprite!: Phaser.GameObjects.Image;
  private gateSprite!: Phaser.GameObjects.Image;
  private gateOpen = false;
  private cherryCount = 0;
  private killsThisScreen = 0;
  private screenIndex = 0;

  // --- secondary input: the B (grab/throw) button, keyboard-only so it never
  //     collides with the A (jump) button on a gamepad. ---
  private action!: InputManager;

  // --- HUD (pinned) ---
  private hudPortrait!: Phaser.GameObjects.Image;
  private hudHearts: Phaser.GameObjects.Image[] = [];
  private hudScore!: Phaser.GameObjects.Text;
  private hudWorld!: Phaser.GameObjects.Text;
  private hudLives!: Phaser.GameObjects.Text;
  private hudCherries: Phaser.GameObjects.Image[] = [];
  private banner!: Phaser.GameObjects.Text;

  // --- character select ---
  private selectGroup: Phaser.GameObjects.GameObject[] = [];
  private selectCursor = 0;
  private selectCursorBox!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: 'game-supermario2', gameId: 'supermario2', width: WIDTH, height: HEIGHT });
  }

  protected createGame(): void {
    buildSM2Textures(this);
    this.showDefaultHud(false);
    this.cameras.main.setBackgroundColor(COLORS.sky);
    this.cameras.main.setBounds(0, 0, this.level.width, HEIGHT);

    // Phantom pad index keeps the grab button keyboard-only (see field comment).
    this.action = new InputManager(this, { keys: { fire: [K.X, K.J, K.SHIFT] }, padIndex: 99 });

    this.platforms = this.level.platforms;
    this.worldGfx = this.add.graphics().setDepth(1);
    this.drawWorld();

    this.body = new PlatformerBody(this.level.start.x, 0, PLAYER_W, PLAYER_H);
    this.sprite = this.add.image(0, 0, TX.marioRun0).setOrigin(0.5, 1).setDepth(10);

    this.crystalSprite = this.add.image(0, 0, TX.crystal).setOrigin(0.5, 1).setDepth(6).setVisible(false);
    this.gateSprite = this.add.image(0, 0, TX.maskGate).setOrigin(0.5, 1).setDepth(5).setVisible(false);

    this.lives = new LivesManager(LIVES_START);
    this.createSm2Hud();

    this.banner = this.add
      .text(WIDTH / 2, HEIGHT / 2, '', LABEL_STYLE)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2000)
      .setColor('#fcfc00')
      .setVisible(false);

    this.flow = new StateMachine<SuperMario2Scene, FlowState>(this)
      .add('select', { enter: () => this.enterSelect(), update: (_c, d) => this.updateSelect(d), exit: () => this.clearSelect() })
      .add('ready', { enter: () => this.enterReady() })
      .add('playing', { update: (_c, d) => this.updatePlaying(d) })
      .add('dying', { enter: () => this.enterDying() })
      .add('won', { enter: () => this.enterWon() })
      .add('gameover', { enter: () => this.enterGameOver() });

    this.flow.transition('select');
  }

  protected updateGame(_time: number, delta: number): void {
    this.action.update();
    this.flow.update(delta);
  }

  // =========================================================================
  // Character select
  // =========================================================================

  private enterSelect(): void {
    this.cameras.main.setScroll(0, 0);
    this.hideWorldForSelect(true);
    this.clearSelect();

    const title = this.add
      .text(WIDTH / 2, 40, 'CHOOSE YOUR PLAYER', LABEL_STYLE)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1500);
    this.selectGroup.push(title);

    const spacing = WIDTH / (CHARACTER_ORDER.length + 1);
    CHARACTER_ORDER.forEach((id, i) => {
      const cx = spacing * (i + 1);
      const c = CHARACTERS[id];
      const img = this.add.image(cx, 120, c.tex.run0).setOrigin(0.5, 1).setScrollFactor(0).setDepth(1500).setScale(2);
      const label = this.add
        .text(cx, 132, c.label, HINT_STYLE)
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(1500)
        .setColor(c.color);
      this.selectGroup.push(img, label);
    });

    this.selectCursorBox = this.add
      .rectangle(spacing, 100, 40, 56)
      .setStrokeStyle(2, COLORS.star)
      .setScrollFactor(0)
      .setDepth(1499);
    this.selectGroup.push(this.selectCursorBox);

    const hint = this.add
      .text(WIDTH / 2, 175, '← →  SELECT    Z  START', HINT_STYLE)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1500);
    this.selectGroup.push(hint);

    this.selectCursor = CHARACTER_ORDER.indexOf(this.charId);
    if (this.selectCursor < 0) this.selectCursor = 0;
    this.moveCursor(0);
  }

  private updateSelect(_delta: number): void {
    if (this.controls.justPressed('left')) this.moveCursor(-1);
    if (this.controls.justPressed('right')) this.moveCursor(1);
    if (this.controls.justPressed('fire') || this.controls.justPressed('confirm')) {
      this.charId = CHARACTER_ORDER[this.selectCursor];
      this.audio.play('select');
      this.flow.transition('ready');
    }
  }

  private moveCursor(d: number): void {
    this.selectCursor = Phaser.Math.Wrap(this.selectCursor + d, 0, CHARACTER_ORDER.length);
    const spacing = WIDTH / (CHARACTER_ORDER.length + 1);
    this.selectCursorBox.setX(spacing * (this.selectCursor + 1));
    if (d !== 0) this.audio.play('move');
  }

  private clearSelect(): void {
    for (const o of this.selectGroup) o.destroy();
    this.selectGroup.length = 0;
  }

  /** Hide the live world while the (camera-zero) select screen is up. */
  private hideWorldForSelect(hidden: boolean): void {
    const vis = !hidden;
    this.worldGfx.setVisible(vis);
    this.sprite.setVisible(vis);
    this.crystalSprite.setVisible(vis && this.gateVisible());
    this.gateSprite.setVisible(vis);
    for (const g of this.grasses) g.sprite.setVisible(vis && !g.plucked);
    for (const e of this.enemies) e.sprite.setVisible(vis);
    for (const c of this.cherries) c.sprite.setVisible(vis);
    for (const j of this.jarSprites) j.setVisible(vis);
  }

  private gateVisible(): boolean {
    return true;
  }

  // =========================================================================
  // Flow: ready / dying / won / gameover
  // =========================================================================

  private enterReady(): void {
    this.loadLevel();
    this.hideWorldForSelect(false);
    this.char = CHARACTERS[this.charId];
    this.refreshPortrait();
    this.banner.setText(this.level.name).setColor('#ffffff').setVisible(true);
    this.time.delayedCall(READY_MS, () => {
      this.banner.setVisible(false);
      this.flow.transition('playing');
    });
  }

  private enterDying(): void {
    this.audio.play('death');
    this.cameras.main.flash(160, 255, 80, 80);
    this.dropCarried();
    this.tweens.add({ targets: this.sprite, y: this.sprite.y - 24, alpha: 0.2, duration: DEATH_PAUSE_MS, ease: 'Quad.easeOut' });
    this.time.delayedCall(DEATH_PAUSE_MS, () => {
      this.sprite.setAlpha(1);
      if (this.lives.lose() <= 0) {
        this.flow.transition('gameover');
      } else {
        this.flow.transition('select');
      }
    });
  }

  private enterWon(): void {
    this.audio.play('win');
    this.banner.setText('STAGE CLEAR!').setColor('#fcfc00').setVisible(true);
    this.time.delayedCall(WIN_MS, () => {
      this.banner.setVisible(false);
      this.flow.transition('select');
    });
  }

  private enterGameOver(): void {
    this.banner.setText('GAME OVER').setColor('#ff4040').setVisible(true);
    this.time.delayedCall(GAMEOVER_MS, () => this.scene.restart());
  }

  // =========================================================================
  // Level build
  // =========================================================================

  private loadLevel(): void {
    // Reset transient world.
    for (const e of this.enemies) e.sprite.destroy();
    for (const p of this.projectiles) p.sprite.destroy();
    for (const g of this.grasses) g.sprite.destroy();
    for (const c of this.cherries) c.sprite.destroy();
    for (const h of this.hearts) h.sprite.destroy();
    for (const j of this.jarSprites) j.destroy();
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.grasses.length = 0;
    this.cherries.length = 0;
    this.hearts.length = 0;
    this.jarSprites.length = 0;
    this.jarTimers.length = 0;
    this.dropCarried();

    // Grass tufts on the ground.
    for (const gr of this.level.grass) {
      const feetY = this.groundTopAt(gr.x) + 6;
      const sprite = this.add.image(gr.x, feetY, TX.grass).setOrigin(0.5, 1).setDepth(4);
      this.grasses.push({ x: gr.x, feetY, sprite, plucked: false });
    }
    // Jars.
    for (const jar of this.level.jars) {
      this.jarSprites.push(this.add.image(jar.x, jar.y + 2, TX.jar).setOrigin(0.5, 1).setDepth(7));
      this.jarTimers.push(JAR_SPAWN_MS);
    }
    // Enemies.
    for (const sp of this.level.enemies) {
      const feetY = this.groundTopAt(sp.x);
      this.enemies.push(createEnemy(this, sp.kind, sp.x, feetY, sp.dir));
    }
    // Cherries.
    for (const ch of this.level.cherries) {
      this.cherries.push({ x: ch.x, y: ch.y, sprite: this.add.image(ch.x, ch.y, TX.cherry).setDepth(6) });
    }
    // Crystal ball + gate.
    this.crystalSprite.setPosition(this.level.crystal.x, this.level.crystal.y).setVisible(true);
    this.gateSprite.setPosition(this.level.gate.x, this.level.gate.y).setVisible(true).clearTint();
    this.gateOpen = false;
    this.cherryCount = 0;
    this.killsThisScreen = 0;
    this.starman = 0;

    // Player.
    this.placePlayerAtStart();
  }

  private placePlayerAtStart(): void {
    this.body.x = this.level.start.x;
    this.body.setFeet(this.groundTopAt(this.level.start.x));
    this.body.vy = 0;
    this.body.onGround = true;
    this.vx = 0;
    this.facing = 1;
    this.hp = START_HP;
    this.invuln = 0;
    this.floating = false;
    this.pluckTimer = 0;
    this.pluckTarget = null;
    this.sprite.clearTint().setAlpha(1).setScale(1).setPosition(this.body.x, this.body.feet);
    this.refreshHud();
  }

  // =========================================================================
  // Main play loop
  // =========================================================================

  private updatePlaying(delta: number): void {
    const dt = delta / 1000;
    this.updatePlayer(delta, dt);
    this.updateJars(delta);
    this.updateEnemies(delta, dt);
    this.updateProjectiles(delta, dt);
    this.updateCherries();
    this.updateHearts();
    this.updateStarman(delta);
    this.updateCrystalGate();
    this.updateCamera();
    this.updateScreenCounter();
  }

  private updatePlayer(delta: number, dt: number): void {
    if (this.invuln > 0) this.invuln -= delta;
    const carrying = this.carried !== null;
    const c = this.char;

    // Pluck animation lock.
    if (this.pluckTimer > 0) {
      this.pluckTimer -= delta;
      this.vx = 0;
      this.body.update(delta, c.gravity, this.platforms);
      if (this.pluckTimer <= 0 && this.pluckTarget) {
        this.completePluck(this.pluckTarget);
        this.pluckTarget = null;
      }
      this.drawPlayer(delta, false);
      this.checkEnemyContact();
      this.checkPit();
      return;
    }

    const left = this.controls.isDown('left');
    const right = this.controls.isDown('right');
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    const down = this.controls.isDown('down');

    // Crouch / Toad charge tracking.
    if (down && this.body.onGround) {
      this.crouchFrames += 1;
    } else if (!down) {
      this.crouchFrames = 0;
    }

    // --- Peach float ---
    if (this.floating) {
      this.updateFloat(delta, dt, dir);
      this.handleGrabButton(carrying);
      this.drawPlayer(delta, dir !== 0);
      this.checkEnemyContact();
      this.checkPit();
      return;
    }

    // Horizontal: snappy to top speed; slide on release (per-char decel).
    const maxSpeed = RUN_SPEED * (carrying ? c.carryMod : 1);
    if (dir !== 0 && !down) {
      this.vx = dir * maxSpeed;
      this.facing = dir > 0 ? 1 : -1;
    } else {
      this.vx *= Math.pow(c.decel, dt * 60);
      if (Math.abs(this.vx) < 2) this.vx = 0;
    }
    this.body.x = Phaser.Math.Clamp(this.body.x + this.vx * dt, PLAYER_W / 2, this.level.width - PLAYER_W / 2);

    // Jump (A button = 'fire'). Down is held for Toad's charged jump, so we do
    // not gate the jump on `!down`.
    if (this.controls.justPressed('fire') && this.body.onGround) {
      this.doJump(carrying);
    }
    // Variable height: releasing early scrubs the rise.
    if (!this.controls.isDown('fire') && this.jumpHeld && this.body.vy < 0) {
      this.body.vy *= JUMP_CUT;
      this.jumpHeld = false;
    }

    this.body.update(delta, c.gravity, this.platforms);
    if (this.body.vy > MAX_FALL) this.body.vy = MAX_FALL;
    if (this.body.onGround) this.jumpHeld = false;

    // Peach float trigger: holding A past the apex (vy >= 0).
    if (c.canFloat && this.controls.isDown('fire') && !this.body.onGround && this.body.vy >= 0 && !this.floating) {
      this.startFloat();
    }

    this.handleGrabButton(carrying);
    this.drawPlayer(delta, dir !== 0);
    this.checkEnemyContact();
    this.checkPit();
  }

  private doJump(carrying: boolean): void {
    const c = this.char;
    let v = carrying ? c.jumpCarrying : c.jumpUnloaded;
    if (c.canCharge && this.controls.isDown('down') && this.crouchFrames >= TOAD_CHARGE_FRAMES) {
      v *= TOAD_CHARGE_MULT;
    }
    this.body.jump(v);
    this.jumpHeld = true;
    this.audio.play('jump');
  }

  private startFloat(): void {
    this.floating = true;
    this.floatTimer = FLOAT_DURATION_MS;
    this.body.vy = 0;
    this.audio.play('float');
  }

  private updateFloat(delta: number, dt: number, dir: number): void {
    this.floatTimer -= delta;
    if (dir !== 0) this.facing = dir > 0 ? 1 : -1;
    this.vx = dir * FLOAT_HORIZ;
    this.body.x = Phaser.Math.Clamp(this.body.x + this.vx * dt, PLAYER_W / 2, this.level.width - PLAYER_W / 2);
    // Hover: integrate with zero gravity so we still land on surfaces.
    this.body.vy = 0;
    this.body.update(delta, 0, this.platforms);
    if (this.floatTimer <= 0 || this.body.onGround || !this.controls.isDown('fire')) {
      this.floating = false;
    }
  }

  // --- grab / pluck / throw ------------------------------------------------

  private handleGrabButton(carrying: boolean): void {
    if (!this.action.justPressed('fire')) return;
    if (carrying) {
      this.throwCarried();
      return;
    }
    // Try to grab an adjacent enemy first.
    const e = this.nearestGrabbableEnemy();
    if (e) {
      this.pickUpEnemy(e);
      return;
    }
    // Otherwise pluck a grass tuft if grounded near one.
    if (this.body.onGround) {
      const g = this.nearestPluckableGrass();
      if (g) {
        this.beginPluck(g);
      }
    }
  }

  private nearestGrabbableEnemy(): Enemy | null {
    for (const e of this.enemies) {
      if (!e.alive || !e.cfg.canBePickedUp) continue;
      if (this.overlap(this.body.x, this.body.feet - PLAYER_H / 2, PLAYER_W, PLAYER_H, e.body.x, e.body.y, e.cfg.w, e.cfg.h, PICKUP_RANGE)) {
        return e;
      }
    }
    return null;
  }

  private nearestPluckableGrass(): Grass | null {
    let best: Grass | null = null;
    let bestD = PLUCK_RANGE;
    for (const g of this.grasses) {
      if (g.plucked) continue;
      const d = Math.abs(g.x - this.body.x);
      if (d < bestD && Math.abs(g.feetY - this.body.feet) < 24) {
        bestD = d;
        best = g;
      }
    }
    return best;
  }

  private beginPluck(g: Grass): void {
    this.pluckTimer = this.char.pluckMs;
    this.pluckTarget = g;
    this.vx = 0;
    this.audio.play('pluck');
  }

  private completePluck(g: Grass): void {
    g.plucked = true;
    g.sprite.setVisible(false);
    this.carry('veg');
    this.audio.play('pop');
  }

  private pickUpEnemy(e: Enemy): void {
    e.alive = false;
    e.sprite.destroy();
    this.enemies.splice(this.enemies.indexOf(e), 1);
    this.carry('enemy', e.kind);
    this.audio.play('grab');
  }

  private carry(type: 'veg' | 'enemy', enemyKind?: EnemyKind): void {
    const key = type === 'veg' ? TX.turnip : this.enemyTex(enemyKind!);
    const sprite = this.add.image(this.body.x, this.body.feet - PLAYER_H, key).setOrigin(0.5, 1).setDepth(11);
    this.carried = { type, enemyKind, sprite };
  }

  private enemyTex(kind: EnemyKind): string {
    switch (kind) {
      case 'shyRed':
        return TX.shyRed0;
      case 'shyPink':
        return TX.shyPink0;
      case 'tweeter':
        return TX.tweeter0;
    }
  }

  private throwCarried(): void {
    const car = this.carried;
    if (!car) return;
    const x = this.body.x + this.facing * 8;
    const y = this.body.feet - PLAYER_H - 2;
    car.sprite.destroy();
    const isVeg = car.type === 'veg';
    const w = isVeg ? 10 : 14;
    const h = isVeg ? 10 : 14;
    const sprite = this.add.image(x, y, isVeg ? TX.turnip : this.enemyTex(car.enemyKind!)).setOrigin(0.5, 0.5).setDepth(9);
    this.projectiles.push({
      type: car.type,
      sprite,
      x,
      y,
      vx: THROW_VX * this.facing,
      vy: -THROW_VY,
      w,
      h,
      chainKills: true, // every slice entity chain-kills (Ostro is the lone exception, not here)
      inert: false,
    });
    this.carried = null;
    this.audio.play('throw');
  }

  private dropCarried(): void {
    if (this.carried) {
      this.carried.sprite.destroy();
      this.carried = null;
    }
  }

  // --- contact / damage ----------------------------------------------------

  private checkEnemyContact(): void {
    if (this.pluckTimer > 0) return;
    for (const e of [...this.enemies]) {
      if (!e.alive) continue;
      if (!this.overlap(this.body.x, this.body.feet - PLAYER_H / 2, PLAYER_W, PLAYER_H, e.body.x, e.body.y, e.cfg.w, e.cfg.h, 0)) {
        continue;
      }
      if (this.starman > 0) {
        this.defeatEnemy(e, e.body.x, e.body.y);
        continue;
      }
      // No-stomp rule: descending onto an enemy from above => auto pick-up.
      const fromAbove = this.body.vy > 0 && this.body.feet <= e.body.y + 2;
      if (fromAbove && !this.carried && e.cfg.canBePickedUp) {
        this.body.vy = -120; // small hop off
        this.pickUpEnemy(e);
        return;
      }
      this.hurtPlayer();
      return;
    }
  }

  private hurtPlayer(): void {
    if (this.invuln > 0 || this.starman > 0) return;
    this.hp -= 1;
    this.invuln = DAMAGE_INVULN_MS;
    this.audio.play('hurt');
    this.impact('light');
    this.body.vy = -150;
    this.vx = -this.facing * 90;
    this.refreshHud();
    if (this.hp <= 0) {
      this.flow.transition('dying');
    } else {
      // 1 HP -> shrink to small form (visual only).
      this.sprite.setScale(1, this.hp === 1 ? 0.78 : 1);
    }
  }

  private checkPit(): void {
    if (this.body.feet > HEIGHT + 16) {
      this.hp = 0;
      this.flow.transition('dying');
    }
  }

  // =========================================================================
  // Enemies
  // =========================================================================

  private updateEnemies(delta: number, dt: number): void {
    if (this.starman > 0 || this.invuln > 0) {
      // (no special handling; contact handled in checkEnemyContact)
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      const speed = e.cfg.speed;

      // Walls at level bounds.
      if (e.body.x <= e.cfg.w / 2 && e.dir < 0) e.dir = 1;
      if (e.body.x >= this.level.width - e.cfg.w / 2 && e.dir > 0) e.dir = -1;

      // Ledge handling (only meaningful while grounded).
      if (e.body.onGround && e.cfg.turnsAtLedge) {
        const aheadX = e.body.x + e.dir * (e.cfg.w / 2 + 4);
        if (!this.hasFloorNear(aheadX, e.body.feet)) {
          e.dir = e.dir > 0 ? -1 : 1;
        }
      }

      e.body.x = Phaser.Math.Clamp(e.body.x + e.dir * speed * dt, e.cfg.w / 2, this.level.width - e.cfg.w / 2);

      // Tweeter hops.
      if (e.cfg.hops && e.body.onGround) {
        e.hopTimer -= delta;
        if (e.hopTimer <= 0) {
          e.body.jump(this.hopSpeed());
          e.hopTimer = Phaser.Math.Between(600, 1100);
        }
      }

      e.body.update(delta, this.char ? this.char.gravity : 1440, this.platforms);
      if (e.body.feet > HEIGHT + 24) {
        // Fell into a pit / off the world.
        e.sprite.destroy();
        this.enemies.splice(i, 1);
        continue;
      }
      this.animateEnemy(e, delta);
    }
  }

  private hopSpeed(): number {
    return 220;
  }

  private animateEnemy(e: Enemy, delta: number): void {
    e.frameTimer += delta;
    if (e.frameTimer >= e.cfg.frameMs) {
      e.frameTimer = 0;
      e.frame = e.frame === 0 ? 1 : 0;
    }
    e.sprite
      .setTexture(e.cfg.tex[e.frame])
      .setPosition(e.body.x, e.body.feet)
      .setFlipX(e.dir < 0);
  }

  private updateJars(delta: number): void {
    for (let i = 0; i < this.jarSprites.length; i++) {
      this.jarTimers[i] -= delta;
      if (this.jarTimers[i] > 0) continue;
      this.jarTimers[i] = JAR_SPAWN_MS;
      const aliveFromJars = this.enemies.filter((e) => e.fromJar && e.alive).length;
      if (aliveFromJars >= JAR_MAX_ALIVE) continue;
      const jar = this.level.jars[i];
      const dir: 1 | -1 = Math.random() < 0.5 ? -1 : 1;
      const e = createEnemy(this, 'shyRed', jar.x, jar.y - 2, dir, true);
      this.enemies.push(e);
      this.tweens.add({ targets: this.jarSprites[i], scaleY: 0.85, duration: 90, yoyo: true });
    }
  }

  // =========================================================================
  // Projectiles
  // =========================================================================

  private updateProjectiles(_delta: number, dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.inert) {
        p.vy += (this.char ? this.char.gravity : 1440) * dt;
        if (p.vy > MAX_FALL) p.vy = MAX_FALL;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // Floor bounce.
        const feet = p.y + p.h / 2;
        const sy = this.floorUnder(p.x, feet);
        if (sy !== undefined && feet >= sy && p.vy >= 0) {
          p.y = sy - p.h / 2;
          p.vy = -Math.abs(p.vy) * ITEM_BOUNCE_DECAY;
          p.vx *= Math.pow(ITEM_FRICTION, dt * 60 * 4);
          if (Math.abs(p.vy) < 40 && Math.abs(p.vx) < ITEM_STOP_SPEED) {
            p.inert = true;
            p.vx = 0;
            p.vy = 0;
            this.fadeProjectile(p);
          }
        }
        // Off the world.
        if (p.x < -16 || p.x > this.level.width + 16 || p.y > HEIGHT + 32) {
          p.sprite.destroy();
          this.projectiles.splice(i, 1);
          continue;
        }
        // Enemy hits.
        if (!p.inert) {
          for (const e of [...this.enemies]) {
            if (!e.alive) continue;
            if (this.overlap(p.x, p.y, p.w, p.h, e.body.x, e.body.y, e.cfg.w, e.cfg.h, 0)) {
              this.defeatEnemy(e, e.body.x, e.body.y);
              if (!p.chainKills) {
                p.sprite.destroy();
                this.projectiles.splice(i, 1);
                break;
              }
            }
          }
        }
      }
      p.sprite.setPosition(p.x, p.y).setAngle(p.inert ? 0 : p.sprite.angle + (p.type === 'enemy' ? 0 : 12));
    }
  }

  private fadeProjectile(p: Projectile): void {
    this.tweens.add({
      targets: p.sprite,
      alpha: 0,
      delay: 500,
      duration: 300,
      onComplete: () => {
        p.sprite.destroy();
        const idx = this.projectiles.indexOf(p);
        if (idx >= 0) this.projectiles.splice(idx, 1);
      },
    });
  }

  private defeatEnemy(e: Enemy, x: number, y: number): void {
    e.alive = false;
    e.sprite.destroy();
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    this.popScore(x, y - 8, e.cfg.score, { color: '#ffffff', fontSize: '8px' });
    this.refreshHud();
    this.audio.play('defeat');
    this.registerScreenKill(x, y);
  }

  private registerScreenKill(x: number, y: number): void {
    this.killsThisScreen += 1;
    if (this.killsThisScreen % HEART_PER_ENEMIES === 0) {
      this.hearts.push({ x, y, sprite: this.add.image(x, y, TX.heart).setDepth(6) });
      this.audio.play('heart');
    }
  }

  // =========================================================================
  // Pickups: cherries, hearts, crystal/gate
  // =========================================================================

  private updateCherries(): void {
    for (let i = this.cherries.length - 1; i >= 0; i--) {
      const c = this.cherries[i];
      if (this.overlap(this.body.x, this.body.feet - PLAYER_H / 2, PLAYER_W, PLAYER_H, c.x, c.y, 8, 8, 2)) {
        c.sprite.destroy();
        this.cherries.splice(i, 1);
        this.cherryCount += 1;
        this.audio.play('cherry');
        this.refreshHud();
        if (this.cherryCount >= CHERRY_FOR_STARMAN) {
          this.cherryCount = 0;
          this.grantStarman();
        }
      }
    }
  }

  private grantStarman(): void {
    const star = this.add.image(this.body.x, HEIGHT, TX.star).setDepth(12);
    this.tweens.add({
      targets: star,
      y: this.body.feet - PLAYER_H / 2,
      x: this.body.x,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => {
        star.destroy();
        this.starman = STARMAN_MS;
        this.audio.play('starman');
      },
    });
  }

  private updateStarman(delta: number): void {
    if (this.starman <= 0) return;
    this.starman -= delta;
    this.starTintTimer -= delta;
    if (this.starTintTimer <= 0) {
      this.starTintTimer = 80;
      const palette = [0xffffff, COLORS.star, COLORS.red, COLORS.crystal, COLORS.green];
      this.sprite.setTint(palette[Phaser.Math.Between(0, palette.length - 1)]);
    }
    if (this.starman <= 0) {
      this.sprite.clearTint();
    }
  }

  private updateHearts(): void {
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      if (this.overlap(this.body.x, this.body.feet - PLAYER_H / 2, PLAYER_W, PLAYER_H, h.x, h.y, 10, 9, 2)) {
        h.sprite.destroy();
        this.hearts.splice(i, 1);
        if (this.hp < MAX_HP) this.hp += 1;
        this.sprite.setScale(1, this.hp === 1 ? 0.78 : 1);
        this.audio.play('heart');
        this.refreshHud();
      }
    }
  }

  private updateCrystalGate(): void {
    if (!this.gateOpen) {
      const cx = this.level.crystal.x;
      const cy = this.level.crystal.y;
      this.crystalSprite.setY(cy - 4 + Math.sin(this.time.now / 300) * 3);
      if (this.overlap(this.body.x, this.body.feet - PLAYER_H / 2, PLAYER_W, PLAYER_H, cx, cy - 5, 10, 10, 4)) {
        this.gateOpen = true;
        this.crystalSprite.setVisible(false);
        this.gateSprite.setTint(0xffffff);
        this.tweens.add({ targets: this.gateSprite, scale: 1.12, duration: 160, yoyo: true });
        this.popScore(cx, cy - 12, 1000, { color: '#3cbcfc' });
        this.audio.play('crystal');
        this.refreshHud();
      }
      return;
    }
    // Gate open: walking into it clears the stage.
    const g = this.level.gate;
    if (this.overlap(this.body.x, this.body.feet - PLAYER_H / 2, PLAYER_W, PLAYER_H, g.x, g.y - 20, 16, 40, 0)) {
      this.flow.transition('won');
    }
  }

  // =========================================================================
  // Camera / screen
  // =========================================================================

  private updateCamera(): void {
    const cam = this.cameras.main;
    const targetX = Phaser.Math.Clamp(this.body.x - WIDTH / 2, 0, this.level.width - WIDTH);
    cam.setScroll(targetX, 0); // one-axis scroll only (spec §2.2 CHECK)
  }

  private updateScreenCounter(): void {
    const idx = Math.floor(this.cameras.main.scrollX / WIDTH);
    if (idx !== this.screenIndex) {
      this.screenIndex = idx;
      this.killsThisScreen = 0; // heart counter is screen-local (spec §3.7 CHECK)
    }
  }

  // =========================================================================
  // Rendering helpers
  // =========================================================================

  private drawPlayer(delta: number, moving: boolean): void {
    const c = this.char;
    this.sprite.setPosition(this.body.x, this.body.feet).setFlipX(this.facing < 0);

    // Blink during i-frames.
    if (this.invuln > 0 && this.starman <= 0) {
      this.sprite.setAlpha(Math.floor(this.invuln / 90) % 2 === 0 ? 0.4 : 1);
    } else {
      this.sprite.setAlpha(1);
    }

    let tex: string;
    if (this.carried) {
      tex = c.tex.carry;
    } else if (this.floating) {
      tex = c.tex.carry; // arms-out float pose
    } else if (!this.body.onGround) {
      tex = c.tex.jump;
    } else if (this.pluckTimer > 0) {
      tex = c.tex.run0;
    } else if (moving) {
      this.walkTimer += delta;
      if (this.walkTimer >= WALK_FRAME_MS) {
        this.walkTimer = 0;
        this.walkFrame = this.walkFrame === 0 ? 1 : 0;
      }
      tex = this.walkFrame === 0 ? c.tex.run0 : c.tex.run1;
    } else {
      tex = c.tex.run0;
    }
    this.sprite.setTexture(tex);

    if (this.carried) {
      this.carried.sprite.setPosition(this.body.x, this.body.feet - PLAYER_H);
    }
  }

  private drawWorld(): void {
    const g = this.worldGfx;
    g.clear();
    for (const s of this.platforms) {
      const w = s.x2 - s.x1;
      if (s.thickness === undefined) {
        // Solid ground to the bottom of the level.
        g.fillStyle(COLORS.groundTop, 1);
        g.fillRect(s.x1, s.y1, w, 4);
        g.fillStyle(COLORS.groundFill, 1);
        g.fillRect(s.x1, s.y1 + 4, w, HEIGHT - (s.y1 + 4));
        g.fillStyle(COLORS.groundEdge, 1);
        g.fillRect(s.x1, s.y1 + 4, w, 2);
      } else {
        // Floating ledge / brick block.
        g.fillStyle(COLORS.groundTop, 1);
        g.fillRect(s.x1, s.y1, w, 3);
        g.fillStyle(COLORS.brick, 1);
        g.fillRect(s.x1, s.y1 + 3, w, s.thickness);
        g.fillStyle(COLORS.brickEdge, 1);
        g.fillRect(s.x1, s.y1 + 3 + s.thickness - 2, w, 2);
      }
    }
  }

  // =========================================================================
  // HUD
  // =========================================================================

  private createSm2Hud(): void {
    this.hudPortrait = this.add.image(12, HUD_H + 6, TX.marioRun0).setOrigin(0.5, 1).setScrollFactor(0).setDepth(1001);
    this.hudHearts = [];
    for (let i = 0; i < MAX_HP; i++) {
      this.hudHearts.push(this.add.image(26 + i * 11, 6, TX.heart).setOrigin(0, 0).setScrollFactor(0).setDepth(1001).setScale(0.8));
    }
    this.hudCherries = [];
    for (let i = 0; i < CHERRY_FOR_STARMAN; i++) {
      this.hudCherries.push(this.add.image(26 + i * 8, 18, TX.cherry).setOrigin(0, 0).setScrollFactor(0).setDepth(1001).setScale(0.7).setAlpha(0.25));
    }
    this.hudScore = this.add.text(WIDTH - 4, 3, 'SCORE 0', HUD_STYLE).setOrigin(1, 0).setScrollFactor(0).setDepth(1001);
    this.hudWorld = this.add.text(WIDTH - 4, 15, this.level.name, HINT_STYLE).setOrigin(1, 0).setScrollFactor(0).setDepth(1001);
    this.hudLives = this.add.text(WIDTH / 2, 3, '', HUD_STYLE).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1001);
    this.refreshHud();
  }

  private refreshPortrait(): void {
    this.hudPortrait.setTexture(this.char.tex.run0);
  }

  private refreshHud(): void {
    this.hudScore.setText(`SCORE ${this.scores.score}`);
    this.hudWorld.setText(this.level.name);
    this.hudLives.setText(`x${this.lives.count}`);
    for (let i = 0; i < this.hudHearts.length; i++) {
      this.hudHearts[i].setVisible(i < this.hp);
    }
    for (let i = 0; i < this.hudCherries.length; i++) {
      this.hudCherries[i].setAlpha(i < this.cherryCount ? 1 : 0.25);
    }
  }

  // =========================================================================
  // Geometry helpers
  // =========================================================================

  /** Top surface of the highest platform directly under x (defaults to ground). */
  private groundTopAt(x: number): number {
    let best = this.level.groundY;
    for (const s of this.platforms) {
      if (x < s.x1 || x > s.x2) continue;
      const sy = surfaceY(s, x);
      if (sy < best) best = sy;
    }
    return best;
  }

  /** The surface a falling entity at (x, feet) would land on, if any is close below. */
  private floorUnder(x: number, feet: number): number | undefined {
    let best: number | undefined;
    for (const s of this.platforms) {
      if (x < s.x1 || x > s.x2) continue;
      const sy = surfaceY(s, x);
      if (sy >= feet - 8 && (best === undefined || sy < best)) best = sy;
    }
    return best;
  }

  /** Is there a walkable surface near (x) at roughly the given feet height? */
  private hasFloorNear(x: number, feet: number): boolean {
    for (const s of this.platforms) {
      if (x < s.x1 || x > s.x2) continue;
      const sy = surfaceY(s, x);
      if (Math.abs(sy - feet) < 8) return true;
    }
    return false;
  }

  /** Centre-based AABB overlap with an optional padding margin. */
  private overlap(
    ax: number,
    ay: number,
    aw: number,
    ah: number,
    bx: number,
    by: number,
    bw: number,
    bh: number,
    pad: number,
  ): boolean {
    return (
      Math.abs(ax - bx) <= (aw + bw) / 2 + pad &&
      Math.abs(ay - by) <= (ah + bh) / 2 + pad
    );
  }
}
