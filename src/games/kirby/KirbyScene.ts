import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { surfaceY } from '../../shared/Platformer';
import { StateMachine } from '../../shared/StateMachine';
import { LivesManager } from '../../shared/LivesManager';
import { LABEL_STYLE, HINT_STYLE } from '../../shared/ui';
import { playFrames } from '../../shared/effects';
import {
  WIDTH,
  HEIGHT,
  PLAY_H,
  HUD_Y,
  FRAME_MS,
  GAME,
  AbilityName,
  KIRBY_W,
  KIRBY_H,
  WALK_FRAME_MS,
  RUN_FRAME_MS,
  HOVER_FRAME_MS,
  PIT_DEATH_Y,
  STAGE_CLEAR_MS,
  GAMEOVER_MS,
  RESPAWN_MS,
} from './constants';
import { COLORS } from './palette';
import { buildKirbyTextures, TX } from './sprites';
import {
  TERRAIN,
  STAGE_WIDTH,
  ENEMY_SPAWNS,
  KIRBY_START,
  DOOR_POS,
  surfaceAt,
} from './levels';
import { Enemy } from './enemies';

/** A short-lived offensive projectile (spit star, air pellet, beam blob). */
interface Shot {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifeMs: number;
}

/** The single floating Copy-Ability star dropped when Kirby is hit (§3.5). */
interface AbilityStar {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ability: AbilityName;
  lifeMs: number;
}

const STICK = 7; // px — max step Kirby snaps to following a surface
const HURT_STUN_MS = 300; // ms of recoil where control is reduced
const KNOCKBACK = 1.6; // px/frame knockback on damage

type FlowState = 'intro' | 'playing' | 'dying' | 'cleared' | 'gameover';

/**
 * Kirby's Adventure — first vertical slice (Vegetable Valley 1-1). Implements
 * the series' identity loop: walk/run, indefinite hover + air pellet, crouch,
 * slide with i-frames, and the full inhale → hold → spit-star / swallow → copy
 * ability chain, with the ability-star-on-damage recovery mechanic. Two real
 * abilities (Beam, Spark) ship in this slice; the remaining 22, the bosses, and
 * authored level geometry follow in later slices (see spec §14).
 */
export class KirbyScene extends BaseGameScene {
  // --- world ---
  private worldGfx!: Phaser.GameObjects.Graphics;
  private door!: Phaser.GameObjects.Image;
  private enemies: Enemy[] = [];

  // --- Kirby body (positions px, velocities px/frame) ---
  private kx = 0;
  private ky = 0;
  private vx = 0;
  private vy = 0;
  private facing: 1 | -1 = 1;
  private onGround = false;
  private sprite!: Phaser.GameObjects.Image;

  // --- Kirby state flags ---
  private hovering = false;
  private inhaling = false;
  private holding = false;
  private heldAbility: AbilityName | null = null;
  private sliding = false;
  private ducking = false;
  private copyAbility: AbilityName | null = null;
  private sparkActive = false;

  private jumpHoldFrames = 0;
  private slideFrames = 0;
  private slideIFrames = 0;
  private iframeMs = 0;
  private hurtMs = 0;
  private abilityCooldownMs = 0; // tap abilities (beam / cutter / freeze)
  private sparkTickMs = 0;
  private fireTickMs = 0; // gap between Fire-breath puffs
  private stoneForm = false; // Stone ability engaged (invincible, immobile)

  // run double-tap tracking
  private running = false;
  private lastTapLeft = -1;
  private lastTapRight = -1;

  // animation
  private animTimer = 0;
  private animFrame: 0 | 1 = 0;

  // --- entities ---
  private shots: Shot[] = [];
  private abilityStar: AbilityStar | null = null;
  private pulled: Enemy | null = null;
  private inhaleGfx!: Phaser.GameObjects.Graphics;
  private sparkBits: Phaser.GameObjects.Image[] = [];
  private sparkPhase = 0;
  private dropKey?: Phaser.Input.Keyboard.Key; // Select — discard current ability
  private cutter: { sprite: Phaser.GameObjects.Image; x: number; y: number; vx: number; returning: boolean; spin: number } | null = null;

  // --- session ---
  private hp: number = GAME.maxHP;
  private lives!: LivesManager;
  private flow!: StateMachine<KirbyScene, FlowState>;
  private timer = 0;

  // --- HUD (own, scroll-fixed) ---
  private hudPips: Phaser.GameObjects.Image[] = [];
  private hudAbility!: Phaser.GameObjects.Text;
  private hudScore!: Phaser.GameObjects.Text;
  private hudLives!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'game-kirby', gameId: 'kirby', width: WIDTH, height: HEIGHT });
  }

  protected createGame(): void {
    buildKirbyTextures(this);
    this.showDefaultHud(false); // we draw our own scroll-fixed HUD
    this.cameras.main.setBackgroundColor('#68b0f8');
    this.cameras.main.setBounds(0, 0, STAGE_WIDTH, HEIGHT);

    // Rebuild ALL state here — createGame runs on every (re)entry (RL reset).
    this.enemies.forEach((e) => e.destroy());
    this.enemies = [];
    this.shots.forEach((s) => s.sprite.destroy());
    this.shots = [];
    this.clearAbilityStar();
    this.clearSpark();
    this.clearCutter();
    this.resetKirbyState();

    this.worldGfx = this.add.graphics().setDepth(1);
    this.drawWorld();

    this.door = this.add.image(DOOR_POS.x, DOOR_POS.y, TX.door).setDepth(2);
    this.door.setOrigin(0.5, 1);

    this.sprite = this.add.image(0, 0, TX.kirbyIdle).setDepth(10);
    this.inhaleGfx = this.add.graphics().setDepth(9);
    // Select-equivalent: X discards the current Copy Ability (it pops out as a
    // re-inhalable star), so a player can swap between abilities (§3.1).
    this.dropKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.X);

    for (const spawn of ENEMY_SPAWNS) {
      this.enemies.push(new Enemy(this, spawn, surfaceAt));
    }

    this.lives = new LivesManager(GAME.livesStart);
    this.hp = GAME.maxHP;
    this.placeKirbyAtStart();

    this.buildHud();

    this.flow = new StateMachine<KirbyScene, FlowState>(this)
      .add('intro', { enter: (c) => c.enterIntro(), update: (c, d) => c.updateIntro(d) })
      .add('playing', { update: (c, d) => c.updatePlaying(d) })
      .add('dying', { enter: (c) => c.enterDying(), update: (c, d) => c.updateDying(d) })
      .add('cleared', { enter: (c) => c.enterCleared(), update: (c, d) => c.updateCleared(d) })
      .add('gameover', { enter: (c) => c.enterGameOver(), update: (c, d) => c.updateGameOver(d) });
    this.flow.transition('intro');
  }

  protected updateGame(_time: number, delta: number): void {
    this.flow.update(delta);
  }

  // =========================================================================
  // Flow states
  // =========================================================================

  private enterIntro(): void {
    this.timer = 1100;
    this.banner.setText('VEGETABLE VALLEY  1-1').setVisible(true);
  }

  private updateIntro(delta: number): void {
    this.syncCamera();
    this.timer -= delta;
    if (this.timer <= 0) {
      this.banner.setVisible(false);
      this.flow.transition('playing');
    }
  }

  private enterDying(): void {
    this.timer = RESPAWN_MS;
    this.inhaling = false;
    this.holding = false;
    this.stoneForm = false;
    this.clearSpark();
    this.clearCutter();
    this.sprite.setTexture(TX.kirbyHit);
    this.tweens.add({ targets: this.sprite, alpha: 0.15, duration: 160, yoyo: true, repeat: 2 });
  }

  private updateDying(delta: number): void {
    this.timer -= delta;
    if (this.timer <= 0) {
      if (this.lives.isGameOver) {
        this.flow.transition('gameover');
      } else {
        this.hp = GAME.maxHP;
        this.copyAbility = null;
        this.clearAbilityStar();
        this.placeKirbyAtStart();
        this.refreshHud();
        this.flow.transition('playing');
      }
    }
  }

  private enterCleared(): void {
    this.timer = STAGE_CLEAR_MS;
    this.popScore(this.kx, this.ky - 16, GAME.pointsStageClear);
    this.banner.setText('STAGE CLEAR!').setVisible(true);
  }

  private updateCleared(delta: number): void {
    this.timer -= delta;
    this.refreshHud();
    if (this.timer <= 0) {
      this.returnToMenu();
    }
  }

  private enterGameOver(): void {
    this.timer = GAMEOVER_MS;
    this.sprite.setVisible(false);
    this.banner.setText('GAME OVER').setVisible(true);
  }

  private updateGameOver(delta: number): void {
    this.timer -= delta;
    if (this.timer <= 0) {
      this.returnToMenu();
    }
  }

  // =========================================================================
  // Core gameplay tick
  // =========================================================================

  private updatePlaying(delta: number): void {
    const f = delta / FRAME_MS;

    this.tickTimers(delta);
    this.maybeDropAbility();
    this.handleHorizontal(f);
    this.handleActions(f, delta);
    this.handleVertical(f);
    this.updateEnemies(f, delta);
    this.updateShots(f, delta);
    this.updateCutter(f, delta);
    this.updateAbilityStar(f, delta);
    this.updateSpark(f, delta);

    this.checkEnemyContact();
    this.checkPit();
    this.checkDoor();

    this.syncCamera();
    this.animateKirby(delta);
    this.refreshHud();
  }

  private tickTimers(delta: number): void {
    if (this.iframeMs > 0) this.iframeMs -= delta;
    if (this.hurtMs > 0) this.hurtMs -= delta;
    if (this.abilityCooldownMs > 0) this.abilityCooldownMs -= delta;
    if (this.sparkTickMs > 0) this.sparkTickMs -= delta;
    if (this.fireTickMs > 0) this.fireTickMs -= delta;
  }

  /** Walk / run, double-tap detection, and facing. Inhale locks movement (§3.4). */
  private handleHorizontal(f: number): void {
    const now = this.time.now;
    const win = GAME.runTapWindowFrames * FRAME_MS;
    if (this.controls.justPressed('left')) {
      if (now - this.lastTapLeft < win) this.running = true;
      this.lastTapLeft = now;
    }
    if (this.controls.justPressed('right')) {
      if (now - this.lastTapRight < win) this.running = true;
      this.lastTapRight = now;
    }
    const left = this.controls.isDown('left');
    const right = this.controls.isDown('right');
    if (!left && !right) this.running = false;

    // Movement-locking states.
    if (this.inhaling || this.hurtMs > 0 || this.sliding || this.stoneForm) {
      if (this.sliding) this.advanceSlide(f);
      else if (this.hurtMs > 0) this.kx += this.vx * f; // ride out knockback
      this.clampX();
      return;
    }

    let dir = 0;
    if (left) dir -= 1;
    if (right) dir += 1;
    if (dir !== 0) this.facing = dir > 0 ? 1 : -1;

    this.ducking = this.onGround && this.controls.isDown('down') && dir === 0 && !this.holding;

    const onGroundSpeed = this.running ? GAME.runSpeed : GAME.walkSpeed;
    const speed = this.onGround ? onGroundSpeed : GAME.airControl;
    this.vx = this.ducking ? 0 : dir * speed;
    this.kx += this.vx * f;
    this.clampX();
  }

  private advanceSlide(f: number): void {
    this.kx += this.facing * GAME.slideSpeed * f;
    this.slideFrames -= f;
    if (this.slideIFrames > 0) this.slideIFrames -= f;
    if (this.slideFrames <= 0) {
      this.sliding = false;
      this.slideIFrames = 0;
    }
  }

  private clampX(): void {
    this.kx = Phaser.Math.Clamp(this.kx, KIRBY_W / 2, STAGE_WIDTH - KIRBY_W / 2);
  }

  /** A-button (up) = jump / hover; B-button (fire) = inhale / ability / spit. */
  private handleActions(f: number, delta: number): void {
    const jump = this.controls.justPressed('up');
    const fire = this.controls.justPressed('fire');
    const fireHeld = this.controls.isDown('fire');

    // --- Stone form locks out everything but the revert press. ---
    if (this.stoneForm) {
      if (fire) this.stoneForm = false; // revert to normal Kirby
      return;
    }

    // --- jump / hover (A) ---
    if (jump && !this.inhaling && !this.sliding && this.hurtMs <= 0) {
      if (this.onGround) {
        this.startJump();
      } else if (!this.hovering) {
        this.hovering = true;
        this.vy = -GAME.hoverAscendRate;
      }
    }

    // --- fire (B) ---
    if (this.holding) {
      if (fire) this.spitStar();
      else if (this.controls.justPressed('down')) this.swallow();
      return;
    }

    if (this.hovering) {
      if (fire) this.fireAirPellet();
      return;
    }

    if (this.copyAbility !== null) {
      this.useAbility(fire, fireHeld);
      return;
    }

    // No ability: slide (running) or inhale.
    if (fire && this.onGround && this.running && !this.ducking) {
      this.startSlide();
      return;
    }
    this.inhaling = fireHeld && !this.sliding;
    if (this.inhaling) this.doInhale(f, delta);
    else if (this.pulled) {
      this.pulled.release();
      this.pulled = null;
    }
  }

  private startJump(): void {
    this.vy = GAME.jumpVelocity;
    this.onGround = false;
    this.hovering = false;
    this.jumpHoldFrames = GAME.jumpHoldFrames;
  }

  private startSlide(): void {
    this.sliding = true;
    this.slideFrames = GAME.slideDurationFrames;
    this.slideIFrames = GAME.slideIFrames;
  }

  /** Vertical integration: gravity + variable jump + indefinite hover (§3.3). */
  private handleVertical(f: number): void {
    const prevFeet = this.ky + KIRBY_H / 2;

    if (this.onGround && !this.hovering) {
      const sy = this.standUnder(this.kx, prevFeet);
      if (sy !== undefined) {
        this.ky = sy - KIRBY_H / 2;
        this.vy = 0;
        return;
      }
      this.onGround = false; // walked off a ledge
    }

    if (this.hovering) {
      this.vy = this.controls.isDown('up') ? -GAME.hoverAscendRate : GAME.hoverDrift;
    } else {
      const holdingUp = this.controls.isDown('up') && this.vy < 0 && this.jumpHoldFrames > 0;
      const g = holdingUp ? GAME.gravity * 0.5 : GAME.gravity;
      if (this.jumpHoldFrames > 0) this.jumpHoldFrames -= f;
      this.vy += g * f;
      const maxFall = this.stoneForm ? GAME.stoneFallSpeed : GAME.maxFallSpeed;
      if (this.vy > maxFall) this.vy = maxFall;
    }

    this.ky += this.vy * f;

    // Land on any surface crossed from above (one-way platforms).
    if (this.vy >= 0) {
      const feet = this.ky + KIRBY_H / 2;
      let landY: number | undefined;
      for (const s of TERRAIN) {
        if (this.kx < s.x1 || this.kx > s.x2) continue;
        const sy = surfaceY(s, this.kx);
        if (prevFeet <= sy + 2 && feet >= sy && (landY === undefined || sy < landY)) {
          landY = sy;
        }
      }
      if (landY !== undefined) {
        this.ky = landY - KIRBY_H / 2;
        this.vy = 0;
        this.onGround = true;
        this.hovering = false;
      }
    }
  }

  /** Highest terrain surface within STICK of `feet` under x (the floor we ride). */
  private standUnder(x: number, feet: number): number | undefined {
    let best: number | undefined;
    for (const s of TERRAIN) {
      if (x < s.x1 || x > s.x2) continue;
      const sy = surfaceY(s, x);
      if (Math.abs(feet - sy) <= STICK && (best === undefined || sy < best)) {
        best = sy;
      }
    }
    return best;
  }

  // =========================================================================
  // Inhale → hold → swallow / spit (§3.4)
  // =========================================================================

  private doInhale(f: number, _delta: number): void {
    this.vx = 0; // locked while inhaling (§3.4 CHECK)

    // Already reeling something in?
    if (this.pulled && this.pulled.state !== 'dead') {
      const reached = this.pulled.pullToward(this.mouthX(), this.ky, f);
      if (reached) {
        this.heldAbility = this.pulled.ability;
        this.pulled.destroy();
        this.pulled = null;
        this.holding = true;
        this.inhaling = false;
      }
      this.drawInhaleCone();
      return;
    }

    // Re-inhale a floating ability star (§3.5).
    if (this.abilityStar && this.inCone(this.abilityStar.x, this.abilityStar.y)) {
      const dx = this.mouthX() - this.abilityStar.x;
      const dy = this.ky - this.abilityStar.y;
      const dist = Math.hypot(dx, dy);
      const step = GAME.inhalePullSpeed * f;
      if (dist <= step + 4) {
        this.copyAbility = this.abilityStar.ability;
        this.clearAbilityStar();
        this.inhaling = false;
      } else {
        this.abilityStar.x += (dx / dist) * step;
        this.abilityStar.y += (dy / dist) * step;
      }
      this.drawInhaleCone();
      return;
    }

    // Acquire the nearest eligible enemy in the cone.
    let nearest: Enemy | null = null;
    let nearestD = Infinity;
    for (const e of this.enemies) {
      if (e.state !== 'patrol') continue;
      if (!this.inCone(e.x, e.y)) continue;
      const d = Math.abs(e.x - this.kx);
      if (d < nearestD) {
        nearestD = d;
        nearest = e;
      }
    }
    if (nearest) this.pulled = nearest;
    this.drawInhaleCone();
  }

  private inCone(x: number, y: number): boolean {
    const dx = (x - this.kx) * this.facing;
    return dx > 0 && dx < GAME.inhaleRangePx && Math.abs(y - this.ky) < 18;
  }

  private mouthX(): number {
    return this.kx + this.facing * (KIRBY_W / 2);
  }

  private drawInhaleCone(): void {
    this.inhaleGfx.clear();
    if (!this.inhaling) return;
    const x0 = this.mouthX();
    this.inhaleGfx.fillStyle(0xffffff, 0.18);
    this.inhaleGfx.beginPath();
    this.inhaleGfx.moveTo(x0, this.ky);
    this.inhaleGfx.lineTo(x0 + this.facing * GAME.inhaleRangePx, this.ky - 12);
    this.inhaleGfx.lineTo(x0 + this.facing * GAME.inhaleRangePx, this.ky + 12);
    this.inhaleGfx.closePath();
    this.inhaleGfx.fillPath();
  }

  private spitStar(): void {
    this.spawnShot(TX.star, this.facing * GAME.starProjSpeed, 0, 700);
    this.holding = false;
    this.heldAbility = null;
  }

  private swallow(): void {
    if (this.heldAbility) {
      this.copyAbility = this.heldAbility;
      this.floatLabel(this.copyAbility.toUpperCase());
    }
    this.holding = false;
    this.heldAbility = null;
  }

  /** Select (X): discard the equipped ability as a re-inhalable star (§3.1). */
  private maybeDropAbility(): void {
    if (!this.dropKey || !Phaser.Input.Keyboard.JustDown(this.dropKey)) return;
    if (!this.copyAbility) return;
    this.stoneForm = false;
    this.sparkActive = false;
    this.clearSpark();
    this.clearCutter();
    this.dropAbilityStar(this.copyAbility, this.facing);
    this.copyAbility = null;
  }

  // =========================================================================
  // Abilities, pellets, projectiles
  // =========================================================================

  private fireAirPellet(): void {
    this.spawnShot(TX.airPellet, this.facing * GAME.airPelletSpeed, 0, 500);
    this.hovering = false;
    this.vy = 0.6; // begin a gentle descent
  }

  /** Dispatch the equipped ability's B-press / B-hold behaviour (§5.1). */
  private useAbility(fire: boolean, fireHeld: boolean): void {
    switch (this.copyAbility) {
      case 'beam':
        if (fire && this.abilityCooldownMs <= 0) this.castBeam();
        break;
      case 'spark':
        this.sparkActive = fireHeld; // sustained barrier while held
        break;
      case 'fire':
        if (fireHeld) this.breatheFire(); // sustained flame while held
        break;
      case 'cutter':
        if (fire && !this.cutter) this.throwCutter();
        break;
      case 'freeze':
        if (fire && this.abilityCooldownMs <= 0) this.castFreeze();
        break;
      case 'stone':
        if (fire) this.enterStone();
        break;
      default:
        break;
    }
  }

  private castBeam(): void {
    this.abilityCooldownMs = GAME.abilityCooldownMs;
    // A short whip arc of blobs sweeping forward and down (Waddle Doo beam).
    const arc = [-10, -4, 2, 8];
    for (let i = 0; i < arc.length; i++) {
      const s = this.spawnShot(TX.beam, this.facing * 3.0, 0, GAME.beamDurationMs);
      s.x = this.mouthX() + this.facing * (i * 8);
      s.y = this.ky + arc[i];
      s.vy = 0.8;
      s.sprite.setPosition(s.x, s.y);
    }
  }

  /** Fire: a sustained flame breath — puffs spawn on a tick while B is held. */
  private breatheFire(): void {
    if (this.fireTickMs > 0) return;
    this.fireTickMs = GAME.fireTickMs;
    const s = this.spawnShot(TX.flame, this.facing * GAME.fireSpeed, 0, GAME.fireLifeMs);
    s.y = this.ky + 2;
    s.sprite.setPosition(s.x, s.y);
  }

  /** Cutter: a single boomerang blade that flies out, then returns to Kirby. */
  private throwCutter(): void {
    this.abilityCooldownMs = GAME.abilityCooldownMs;
    this.cutter = {
      sprite: this.add.image(this.mouthX(), this.ky, TX.blade).setDepth(11),
      x: this.mouthX(),
      y: this.ky,
      vx: this.facing * GAME.cutterSpeed,
      returning: false,
      spin: 0,
    };
  }

  /** Freeze: a one-shot radial burst that defeats everything in range (§5.1). */
  private castFreeze(): void {
    this.abilityCooldownMs = GAME.abilityCooldownMs;
    const r = GAME.freezeRadiusPx;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      playFrames(this, this.kx + Math.cos(a) * r * 0.6, this.ky + Math.sin(a) * r * 0.6, [TX.ice], 160, 12);
    }
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      if (Math.hypot(e.x - this.kx, e.y - this.ky) <= r + e.width / 2) {
        this.defeatEnemy(e);
      }
    }
    this.impact('light');
  }

  /** Stone: become a heavy invincible rock until B is pressed again. */
  private enterStone(): void {
    this.stoneForm = true;
    this.hovering = false;
    this.inhaling = false;
    this.vx = 0;
  }

  /** Cutter blade flight: out to max range, then boomerang home (§5.1). */
  private updateCutter(f: number, delta: number): void {
    const c = this.cutter;
    if (!c) return;
    c.spin += delta;
    if (!c.returning && Math.abs(c.x - this.kx) >= GAME.cutterRangePx) {
      c.returning = true;
    }
    c.vx = c.returning ? (this.kx - c.x) * 0.12 : c.vx;
    c.x += c.vx * f;
    c.sprite.setPosition(c.x, c.y).setAngle(c.spin).setFlipX(this.facing < 0);
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      if (Phaser.Geom.Rectangle.Contains(e.bounds(), c.x, c.y)) {
        this.defeatEnemy(e);
      }
    }
    if (c.returning && Math.abs(c.x - this.kx) < 6) {
      c.sprite.destroy();
      this.cutter = null;
    }
  }

  private clearCutter(): void {
    this.cutter?.sprite.destroy();
    this.cutter = null;
  }

  private updateSpark(f: number, delta: number): void {
    if (this.copyAbility !== 'spark' || !this.sparkActive) {
      if (this.sparkBits.length) this.clearSpark();
      return;
    }
    if (this.sparkBits.length === 0) {
      for (let i = 0; i < 6; i++) {
        this.sparkBits.push(this.add.image(this.kx, this.ky, TX.spark).setDepth(11));
      }
    }
    this.sparkPhase += 0.25 * f;
    const r = GAME.sparkRadiusPx;
    this.sparkBits.forEach((bit, i) => {
      const a = this.sparkPhase + (i / this.sparkBits.length) * Math.PI * 2;
      bit.setPosition(this.kx + Math.cos(a) * r, this.ky + Math.sin(a) * r).setVisible(true);
    });
    // Periodic radial damage.
    if (this.sparkTickMs <= 0) {
      this.sparkTickMs = GAME.sparkTickMs;
      for (const e of this.enemies) {
        if (e.state === 'dead') continue;
        if (Math.hypot(e.x - this.kx, e.y - this.ky) <= r + e.width / 2) {
          this.defeatEnemy(e);
        }
      }
    }
    void delta;
  }

  private spawnShot(tex: string, vx: number, vy: number, lifeMs: number): Shot {
    const shot: Shot = {
      sprite: this.add.image(this.mouthX(), this.ky, tex).setDepth(11),
      x: this.mouthX(),
      y: this.ky,
      vx,
      vy,
      lifeMs,
    };
    this.shots.push(shot);
    return shot;
  }

  private updateShots(f: number, delta: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.vx * f;
      s.y += s.vy * f;
      s.lifeMs -= delta;
      s.sprite.setPosition(s.x, s.y);
      let hit = false;
      for (const e of this.enemies) {
        if (e.state === 'dead') continue;
        if (Phaser.Geom.Rectangle.Contains(e.bounds(), s.x, s.y)) {
          this.defeatEnemy(e);
          hit = true;
          break;
        }
      }
      if (hit || s.lifeMs <= 0 || s.x < -16 || s.x > STAGE_WIDTH + 16) {
        s.sprite.destroy();
        this.shots.splice(i, 1);
      }
    }
  }

  // =========================================================================
  // Enemies & damage
  // =========================================================================

  private updateEnemies(f: number, delta: number): void {
    for (const e of this.enemies) {
      if (e === this.pulled) continue; // movement driven by the inhale
      e.update(f, delta);
    }
  }

  private defeatEnemy(e: Enemy): void {
    if (e.state === 'dead') return;
    this.popScore(e.x, e.y - 8, e.def.score);
    playFrames(this, e.x, e.y, [TX.star], 90, 12);
    if (e === this.pulled) this.pulled = null;
    e.destroy();
  }

  private checkEnemyContact(): void {
    if (this.iframeMs > 0 || this.hurtMs > 0) return;
    if (this.slideIFrames > 0) return; // slide i-frames (§3.3 CHECK)
    const kb = new Phaser.Geom.Rectangle(
      this.kx - KIRBY_W / 2,
      this.ky - KIRBY_H / 2,
      KIRBY_W,
      KIRBY_H,
    );
    for (const e of this.enemies) {
      if (e.state === 'dead' || e === this.pulled) continue;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(kb, e.bounds())) continue;
      if (this.stoneForm) {
        this.defeatEnemy(e); // Stone is invincible and crushes on contact
        continue;
      }
      this.damageKirby(e.x);
      return;
    }
  }

  private damageKirby(fromX: number): void {
    this.hp -= 1;
    this.iframeMs = GAME.iframeDurationMs;
    this.hurtMs = HURT_STUN_MS;
    this.inhaling = false;
    this.holding = false;
    this.sparkActive = false;
    this.stoneForm = false;
    this.clearCutter();
    const away = this.kx < fromX ? -1 : 1;
    this.vx = away * KNOCKBACK;
    this.vy = -1.5;
    this.onGround = false;

    if (this.copyAbility) {
      this.dropAbilityStar(this.copyAbility, away);
      this.copyAbility = null;
    }
    this.impact('light');

    if (this.hp <= 0) {
      this.lives.lose();
      this.flow.transition('dying');
    }
  }

  // =========================================================================
  // Ability star (§3.5) — only one on screen, re-inhalable, blinks then dies
  // =========================================================================

  private dropAbilityStar(ability: AbilityName, away: number): void {
    this.clearAbilityStar(); // single-star rule
    this.abilityStar = {
      sprite: this.add.image(this.kx, this.ky, TX.abilityStar).setDepth(11),
      x: this.kx,
      y: this.ky,
      vx: away * GAME.abilityStarBounceDx,
      vy: GAME.abilityStarBounceDy,
      ability,
      lifeMs: GAME.abilityStarLifeMs,
    };
  }

  private updateAbilityStar(f: number, delta: number): void {
    const star = this.abilityStar;
    if (!star) return;
    star.vy += GAME.gravity * f;
    if (star.vy > GAME.maxFallSpeed) star.vy = GAME.maxFallSpeed;
    star.x += star.vx * f;
    star.y += star.vy * f;

    const sy = surfaceAt(star.x);
    if (sy !== undefined && star.y >= sy - 4) {
      star.y = sy - 4;
      star.vy = -Math.abs(star.vy) * 0.5; // bounce
      star.vx *= 0.7;
    }
    star.x = Phaser.Math.Clamp(star.x, 6, STAGE_WIDTH - 6);
    star.lifeMs -= delta;

    // Blink warning, then shatter.
    const blink = star.lifeMs < GAME.abilityStarBlinkMs;
    star.sprite
      .setPosition(star.x, star.y)
      .setVisible(!blink || Math.floor(star.lifeMs / 120) % 2 === 0);
    if (star.lifeMs <= 0) this.clearAbilityStar();
  }

  private clearAbilityStar(): void {
    this.abilityStar?.sprite.destroy();
    this.abilityStar = null;
  }

  private clearSpark(): void {
    this.sparkBits.forEach((b) => b.destroy());
    this.sparkBits = [];
    this.sparkActive = false;
  }

  // =========================================================================
  // World checks
  // =========================================================================

  private checkPit(): void {
    if (this.ky + KIRBY_H / 2 > PIT_DEATH_Y) {
      this.hp = 0;
      this.lives.lose();
      this.flow.transition('dying');
    }
  }

  private checkDoor(): void {
    if (Math.abs(this.kx - DOOR_POS.x) < 12 && this.onGround) {
      this.flow.transition('cleared');
    }
  }

  // =========================================================================
  // Presentation
  // =========================================================================

  private syncCamera(): void {
    const sx = Phaser.Math.Clamp(this.kx - WIDTH / 2, 0, STAGE_WIDTH - WIDTH);
    this.cameras.main.scrollX = sx;
  }

  private animateKirby(delta: number): void {
    const tex = this.pickKirbyTexture(delta);
    this.sprite.setTexture(tex).setPosition(this.kx, this.ky).setFlipX(this.facing < 0);
    // Blink while invincible so the safe window is readable; peach-tint with ability.
    const blink = this.iframeMs > 0 && Math.floor(this.iframeMs / 100) % 2 === 0;
    this.sprite.setAlpha(blink ? 0.4 : 1);
    // Stone draws its own rock sprite; otherwise peach-tint when carrying an ability.
    this.sprite.setTint(this.copyAbility && !this.stoneForm ? 0xffd0e8 : 0xffffff);
    this.drawInhaleCone();
  }

  private pickKirbyTexture(delta: number): string {
    if (this.stoneForm) return TX.kirbyStone;
    if (this.hurtMs > 0) return TX.kirbyHit;
    if (this.sliding) return TX.kirbySlide;
    if (this.inhaling) return TX.kirbyInhale;
    if (this.holding) return TX.kirbyHolding;
    if (!this.onGround) {
      if (this.hovering) {
        this.animTimer += delta;
        if (this.animTimer >= HOVER_FRAME_MS) {
          this.animTimer = 0;
          this.animFrame = this.animFrame === 0 ? 1 : 0;
        }
        return this.animFrame === 0 ? TX.kirbyHover0 : TX.kirbyHover1;
      }
      return TX.kirbyJump;
    }
    if (this.ducking) return TX.kirbyDuck;
    if (Math.abs(this.vx) > 0.01) {
      this.animTimer += delta;
      const frameMs = this.running ? RUN_FRAME_MS : WALK_FRAME_MS;
      if (this.animTimer >= frameMs) {
        this.animTimer = 0;
        this.animFrame = this.animFrame === 0 ? 1 : 0;
      }
      return this.animFrame === 0 ? TX.kirbyWalk0 : TX.kirbyWalk1;
    }
    return TX.kirbyIdle;
  }

  // =========================================================================
  // Setup helpers
  // =========================================================================

  private resetKirbyState(): void {
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.hovering = false;
    this.inhaling = false;
    this.holding = false;
    this.heldAbility = null;
    this.sliding = false;
    this.ducking = false;
    this.copyAbility = null;
    this.sparkActive = false;
    this.stoneForm = false;
    this.jumpHoldFrames = 0;
    this.slideFrames = 0;
    this.slideIFrames = 0;
    this.iframeMs = 0;
    this.hurtMs = 0;
    this.abilityCooldownMs = 0;
    this.sparkTickMs = 0;
    this.fireTickMs = 0;
    this.running = false;
    this.pulled = null;
    this.animTimer = 0;
    this.animFrame = 0;
  }

  private placeKirbyAtStart(): void {
    this.kx = KIRBY_START.x;
    this.ky = KIRBY_START.y - KIRBY_H / 2;
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.facing = 1;
    this.hovering = false;
    this.inhaling = false;
    this.holding = false;
    this.sliding = false;
    this.iframeMs = 0;
    this.hurtMs = 0;
    this.sprite.setVisible(true).setAlpha(1).setPosition(this.kx, this.ky);
  }

  private drawWorld(): void {
    const g = this.worldGfx;
    g.clear();
    for (const s of TERRAIN) {
      const top = surfaceY(s, s.x1);
      const w = s.x2 - s.x1;
      const thick = s.thickness ?? 8;
      // Big grass spans fill to the playfield floor; thin ledges show their slab.
      const depth = thick > 30 ? PLAY_H - top : thick;
      g.fillStyle(COLORS.groundDark, 1);
      g.fillRect(s.x1, top, w, depth);
      g.fillStyle(COLORS.ground, 1);
      g.fillRect(s.x1, top, w, 4);
      g.fillStyle(COLORS.groundEdge, 1);
      g.fillRect(s.x1, top, w, 2);
    }
  }

  // =========================================================================
  // HUD (own, scroll-fixed) — pips + ability + score + lives over the panel
  // =========================================================================

  private buildHud(): void {
    this.add
      .rectangle(0, HUD_Y, WIDTH, HEIGHT - HUD_Y, 0x101830)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(999);

    this.hudPips.forEach((p) => p.destroy());
    this.hudPips = [];
    for (let i = 0; i < GAME.maxHP; i++) {
      const pip = this.add
        .image(70 + i * 9, HUD_Y + 8, TX.hpFull)
        .setScrollFactor(0)
        .setDepth(1000);
      this.hudPips.push(pip);
    }
    this.hudAbility = this.add
      .text(4, HUD_Y + 3, '---', { ...HINT_STYLE, color: '#fcfc00' })
      .setScrollFactor(0)
      .setDepth(1000);
    this.hudScore = this.add
      .text(WIDTH - 4, HUD_Y + 3, '', { ...HINT_STYLE, color: '#ffffff' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000);
    this.hudLives = this.add
      .text(WIDTH - 4, HUD_Y + 9, '', { ...HINT_STYLE, color: '#ff80c0' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.banner = this.add
      .text(WIDTH / 2, HEIGHT / 2 - 16, '', LABEL_STYLE)
      .setOrigin(0.5)
      .setColor('#fcfc00')
      .setScrollFactor(0)
      .setDepth(2000)
      .setVisible(false);

    this.refreshHud();
  }

  private refreshHud(): void {
    for (let i = 0; i < this.hudPips.length; i++) {
      this.hudPips[i].setTexture(i < this.hp ? TX.hpFull : TX.hpEmpty);
    }
    this.hudAbility.setText(this.copyAbility ? this.copyAbility.toUpperCase() : '---');
    this.hudScore.setText(`${this.scores.score}`.padStart(6, '0'));
    this.hudLives.setText(`x${this.lives.count}`);
  }

  private floatLabel(text: string): void {
    const t = this.add
      .text(this.kx, this.ky - 18, text, { ...HINT_STYLE, color: '#fcfc00' })
      .setOrigin(0.5)
      .setDepth(2000);
    this.tweens.add({
      targets: t,
      y: t.y - 12,
      alpha: 0,
      duration: 700,
      onComplete: () => t.destroy(),
    });
  }
}
