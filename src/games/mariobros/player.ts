import Phaser from 'phaser';
import { PlatformerBody, PlatformSegment } from '../../shared/Platformer';
import { InputManager } from '../../shared/InputManager';
import { LivesManager } from '../../shared/LivesManager';
import {
  GRAVITY,
  JUMP_SPEED,
  RUN_ACCEL,
  RUN_MAX,
  GROUND_FRICTION,
  MARIO_W,
  MARIO_H,
  WALK_FRAME_MS,
  WIDTH,
  LIVES_START,
  RESPAWN_MS,
  VS_STUN_MS,
  COMBO_WINDOW_MS,
  COMBO_STEP,
  COMBO_CAP,
  EXTRA_LIFE_AT,
} from './constants';

/**
 * Combo score for the `n`-th chained kick (1-based): additive +800 per kick,
 * capped at 3200 (spec §0 #2). 1→800, 2→1600, 3→2400, 4→3200, 5+→3200.
 * Pure so it is unit-checkable.
 */
export function comboScore(n: number): number {
  return Math.min(COMBO_STEP * Math.max(1, n), COMBO_CAP);
}

export interface PlayerConfig {
  controls: InputManager;
  tex: { run0: string; run1: string; jump: string };
  start: { x: number; y: number };
  facing: 1 | -1;
  /** HUD + score-popup colour, e.g. '#ff5030'. */
  color: string;
  label: string; // 'MARIO' / 'LUIGI'
}

const SPAWN_INVULN_MS = 1300;

/**
 * One controllable plumber: a PlatformerBody plus its own input, lives, score,
 * and death/respawn lifecycle. Two of these drive co-op / versus; one drives
 * solo. The scene owns world rules (enemies, POW); the Player owns "me".
 */
export class Player {
  readonly controls: InputManager;
  readonly body: PlatformerBody;
  readonly sprite: Phaser.GameObjects.Image;
  readonly lives: LivesManager;
  readonly color: string;
  readonly label: string;

  score = 0;
  /** Next score threshold that will grant an extra life (spec §0 #5). */
  nextExtraLife = EXTRA_LIFE_AT;
  alive = true;
  facing: 1 | -1 = 1;
  stun = 0; // versus knock-over: no control while > 0
  invuln = 0; // brief post-spawn immunity
  comboCount = 0;

  private readonly cfg: PlayerConfig;
  private vx = 0;
  private respawnTimer = 0;
  private comboTimer = 0;
  private walkTimer = 0;
  private walkFrame: 0 | 1 = 0;

  constructor(private readonly scene: Phaser.Scene, cfg: PlayerConfig) {
    this.cfg = cfg;
    this.controls = cfg.controls;
    this.color = cfg.color;
    this.label = cfg.label;
    this.body = new PlatformerBody(cfg.start.x, 0, MARIO_W, MARIO_H);
    this.sprite = this.scene.add.image(cfg.start.x, 0, cfg.tex.run0).setDepth(10);
    this.lives = new LivesManager(LIVES_START);
    this.placeAtStart();
  }

  /** True once this player has used up all lives and left the board for good. */
  get isOut(): boolean {
    return !this.alive && this.lives.isGameOver;
  }

  /** Immune to enemy contact (just spawned or knocked over in versus). */
  get safe(): boolean {
    return this.invuln > 0;
  }

  placeAtStart(): void {
    this.vx = 0;
    this.facing = this.cfg.facing;
    this.body.x = this.cfg.start.x;
    this.body.setFeet(this.cfg.start.y);
    this.body.vy = 0;
    this.body.onGround = true;
    this.body.bumped = null;
    this.stun = 0;
    this.invuln = SPAWN_INVULN_MS;
    this.sprite
      .setVisible(true)
      .setAlpha(1)
      .setFlipX(this.facing < 0)
      .setTexture(this.cfg.tex.run0)
      .setPosition(this.body.x, this.body.y);
  }

  /** Per-frame: handle respawn timing while dead, else move. `iceScale` shrinks
   *  ground friction when standing on a frozen platform (1 = normal). */
  update(delta: number, floors: PlatformSegment[], iceScale = 1): void {
    if (!this.alive) {
      if (this.lives.isGameOver) {
        return;
      }
      this.respawnTimer -= delta;
      if (this.respawnTimer <= 0) {
        this.alive = true;
        this.placeAtStart();
      }
      return;
    }
    this.move(delta, floors, iceScale);
  }

  private move(delta: number, floors: PlatformSegment[], iceScale: number): void {
    const dt = delta / 1000;
    if (this.invuln > 0) {
      this.invuln -= delta;
    }

    const controllable = this.stun <= 0;
    const dir = controllable
      ? (this.controls.isDown('left') ? -1 : 0) + (this.controls.isDown('right') ? 1 : 0)
      : 0;
    if (this.stun > 0) {
      this.stun -= delta;
    }

    this.applyHorizontal(dt, dir, iceScale);
    this.body.x += this.vx * dt;
    if (this.body.x < 0) {
      this.body.x += WIDTH;
    } else if (this.body.x > WIDTH) {
      this.body.x -= WIDTH;
    }

    if (controllable && this.controls.justPressed('fire')) {
      this.body.jump(JUMP_SPEED);
    }
    this.body.update(delta, GRAVITY, floors);
    this.sprite.setPosition(this.body.x, this.body.y).setFlipX(this.facing < 0);
    this.animate(delta, dir !== 0);
  }

  /**
   * Fixed jump arc (spec §3.1 / §0): horizontal velocity is locked at takeoff —
   * no mid-air steering. Ground accel/friction only applies while grounded;
   * airborne, `vx` is left untouched (the player can turn to face, but the arc
   * is fixed). Extracted so the test surface can drive it deterministically.
   */
  applyHorizontal(dt: number, dir: number, iceScale = 1): void {
    if (this.body.onGround) {
      if (dir !== 0) {
        this.vx += dir * RUN_ACCEL * dt;
        this.facing = dir > 0 ? 1 : -1;
      } else {
        const friction = GROUND_FRICTION * dt * iceScale;
        this.vx = this.vx > 0 ? Math.max(0, this.vx - friction) : Math.min(0, this.vx + friction);
      }
      this.vx = Phaser.Math.Clamp(this.vx, -RUN_MAX, RUN_MAX);
    } else if (dir !== 0) {
      this.facing = dir > 0 ? 1 : -1;
    }
  }

  /**
   * Deterministic physics step for the test surface: drive the body with an
   * explicit horizontal `dir` (-1/0/1) instead of live input, applying the same
   * accel/friction/wrap/gravity path `move()` uses. No engine input is read, so
   * scenarios can prove momentum, falling, traversal, wrap and head-bumps without
   * synthetic key events. Returns nothing; read the result from the snapshot.
   */
  stepPhysics(delta: number, floors: PlatformSegment[], dir: number, iceScale = 1): void {
    if (!this.alive) {
      return;
    }
    const dt = delta / 1000;
    this.applyHorizontal(dt, dir, iceScale);
    this.body.x += this.vx * dt;
    if (this.body.x < 0) {
      this.body.x += WIDTH;
    } else if (this.body.x > WIDTH) {
      this.body.x -= WIDTH;
    }
    this.body.update(delta, GRAVITY, floors);
    this.syncSprite();
  }

  /** Test-surface accessors for deterministic physics checks. */
  get vxDebug(): number {
    return this.vx;
  }
  set vxDebug(v: number) {
    this.vx = v;
  }

  private animate(delta: number, moving: boolean): void {
    // Blink while briefly immune so the player can read the safe window.
    this.sprite.setAlpha(this.invuln > 0 && Math.floor(this.invuln / 100) % 2 === 0 ? 0.4 : 1);
    if (this.stun > 0 || !this.body.onGround) {
      this.sprite.setTexture(this.cfg.tex.jump);
      return;
    }
    if (!moving && Math.abs(this.vx) < 5) {
      this.sprite.setTexture(this.cfg.tex.run0);
      return;
    }
    this.walkTimer += delta;
    if (this.walkTimer >= WALK_FRAME_MS) {
      this.walkTimer = 0;
      this.walkFrame = this.walkFrame === 0 ? 1 : 0;
    }
    this.sprite.setTexture(this.walkFrame === 0 ? this.cfg.tex.run0 : this.cfg.tex.run1);
  }

  /** Killed by an enemy: lose a life, blink out, and queue a respawn. */
  die(): void {
    if (!this.alive) {
      return;
    }
    this.alive = false;
    this.vx = 0;
    this.respawnTimer = RESPAWN_MS;
    this.lives.lose();
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.2,
      duration: 120,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        if (!this.alive) {
          this.sprite.setVisible(false).setAlpha(1);
        }
      },
    });
  }

  /**
   * Register a defeat for the combo chain and return the points awarded for it:
   * additive +800 per chained kick, capped at 3200 (spec §0 #2). Kicks within
   * COMBO_WINDOW_MS of each other extend the chain; otherwise it resets to 800.
   */
  registerKill(): number {
    this.comboCount = this.comboTimer > 0 ? this.comboCount + 1 : 1;
    this.comboTimer = COMBO_WINDOW_MS;
    return comboScore(this.comboCount);
  }

  /**
   * Grant an extra life the once the player's score first crosses 20,000
   * (spec §0 #5 — US DIP factory default: a single award, not recurring).
   * Returns the number of lives granted this call (0 or 1).
   */
  grantExtraLifeIfDue(): number {
    if (this.score >= this.nextExtraLife) {
      this.lives.gain(1);
      this.nextExtraLife = Number.POSITIVE_INFINITY; // one-shot
      return 1;
    }
    return 0;
  }

  tickCombo(delta: number): void {
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
      }
    }
  }

  /** Versus: knocked over by another player's bump — briefly loses control. */
  stunForVersus(): void {
    if (this.alive && this.stun <= 0) {
      this.stun = VS_STUN_MS;
      this.vx = 0;
    }
  }

  getBounds(): Phaser.Geom.Rectangle {
    return this.sprite.getBounds();
  }

  /** Snap the sprite to the body — for deterministic test-surface placement. */
  syncSprite(): void {
    this.sprite.setPosition(this.body.x, this.body.y);
  }
}
