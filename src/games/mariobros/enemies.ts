import Phaser from 'phaser';
import { PlatformerBody, PlatformSegment, surfaceY } from '../../shared/Platformer';
import {
  GRAVITY,
  SHELL_W,
  SHELL_H,
  SHELL_SPEED,
  SHELL_RECOVER_SPEED,
  SHELL_PROJECTILE_SPEED,
  SHELL_SPIN_DEG,
  SHELL_GRACE_MS,
  SHELL_FRAME_MS,
  SHELL_STUN_BLINK_MS,
  SHELL_SCORE,
  ENEMY_LAST_MULT,
  CRAB_W,
  CRAB_H,
  CRAB_SPEED,
  CRAB_ANGRY_SPEED,
  CRAB_RECOVER_SPEED,
  CRAB_SCORE,
  FLY_W,
  FLY_H,
  FLY_SPEED,
  FLY_RECOVER_SPEED,
  FLY_SCORE,
  FLY_HOP_SPEED,
  FLY_GROUND_MS,
  FLY_FRAME_MS,
} from './constants';
import { COLORS } from './palette';
import { TX } from './sprites';

export type EnemyState = 'walk' | 'angry' | 'flipped' | 'shell';
export type EnemyKindId = 'turtle' | 'crab' | 'fly';

/**
 * Static description of an enemy species. Behavior is data: the same `Enemy`
 * body composes turtle, crab, and (soon) fly by swapping this config — the
 * project's "shared primitives, per-game behavior" rule applied within a game.
 */
export interface EnemyKind {
  id: 'turtle' | 'crab' | 'fly';
  w: number;
  h: number;
  walkSpeed: number;
  angrySpeed: number; // speed after the first (non-flipping) bump
  recoverSpeed: number;
  flipsToStun: number; // bumps needed to reach the helpless 'flipped' state
  canStomp: boolean; // can Mario kill it by landing on top while it's active?
  becomesShell: boolean; // kicked while flipped → sliding projectile (else dies)
  score: number;
  tex: { walk: [string, string]; flip: string };
  frameMs: number; // walk/flap animation cadence
  angryTint?: number;
  hops?: boolean; // moves by hopping; only flippable during the grounded window
}

export const KINDS: Record<EnemyKindId, EnemyKind> = {
  turtle: {
    id: 'turtle',
    w: SHELL_W,
    h: SHELL_H,
    walkSpeed: SHELL_SPEED,
    angrySpeed: SHELL_SPEED,
    recoverSpeed: SHELL_RECOVER_SPEED,
    flipsToStun: 1,
    canStomp: true,
    becomesShell: true,
    score: SHELL_SCORE,
    tex: { walk: [TX.shellWalk0, TX.shellWalk1], flip: TX.shellFlip },
    frameMs: SHELL_FRAME_MS,
  },
  crab: {
    id: 'crab',
    w: CRAB_W,
    h: CRAB_H,
    walkSpeed: CRAB_SPEED,
    angrySpeed: CRAB_ANGRY_SPEED,
    recoverSpeed: CRAB_RECOVER_SPEED,
    flipsToStun: 2,
    canStomp: false,
    becomesShell: false,
    score: CRAB_SCORE,
    tex: { walk: [TX.crabWalk0, TX.crabWalk1], flip: TX.crabFlip },
    frameMs: SHELL_FRAME_MS,
    angryTint: COLORS.crabAngry,
  },
  fly: {
    id: 'fly',
    w: FLY_W,
    h: FLY_H,
    walkSpeed: FLY_SPEED,
    angrySpeed: FLY_SPEED,
    recoverSpeed: FLY_RECOVER_SPEED,
    flipsToStun: 1,
    canStomp: true,
    becomesShell: false,
    score: FLY_SCORE,
    tex: { walk: [TX.flyWalk0, TX.flyWalk1], flip: TX.flyFlip },
    frameMs: FLY_FRAME_MS,
    hops: true,
  },
};

/**
 * A Mario Bros. enemy on a shared PlatformerBody. It walks the floors (falling
 * through gaps to the floor below), is flipped by bumps from beneath, and is
 * helpless while flipped until it recovers (faster). What a bump/kick/stomp
 * does is driven entirely by its `EnemyKind`.
 */
export class Enemy {
  readonly kind: EnemyKind;
  readonly body: PlatformerBody;
  readonly sprite: Phaser.GameObjects.Image;
  state: EnemyState = 'walk';
  dir: 1 | -1 = 1;
  stun = 0;
  grace = 0; // a freshly kicked shell ignores Mario this long
  owner = -1; // which player kicked this into a shell (for versus score credit)
  last = false; // the phase's final enemy: super-fast and blue
  speedScale = 1; // per-loop speed ramp
  floorSeg: PlatformSegment | null = null;

  private bumps = 0;
  private speed: number;
  private frameTimer = 0;
  private frame = 0;
  private hopTimer = 0;
  private wasGround = false;

  constructor(scene: Phaser.Scene, kind: EnemyKind, x: number, y: number, dir: 1 | -1) {
    this.kind = kind;
    this.body = new PlatformerBody(x, y, kind.w, kind.h);
    this.dir = dir;
    this.speed = kind.walkSpeed;
    this.sprite = scene.add.image(x, y, kind.tex.walk[0]).setDepth(9);
  }

  update(deltaMs: number, floors: PlatformSegment[]): void {
    const dt = deltaMs / 1000;
    if (this.grace > 0) {
      this.grace -= deltaMs;
    }
    if (this.state === 'flipped') {
      this.stun -= deltaMs;
    } else {
      const sp = this.state === 'shell' ? SHELL_PROJECTILE_SPEED : this.effSpeed;
      this.body.x += this.dir * sp * dt;
    }

    this.body.update(deltaMs, GRAVITY, floors);
    this.floorSeg = this.body.onGround ? this.findFloor(floors) : null;
    if (this.kind.hops) {
      this.hop(deltaMs);
    }

    this.sprite.setPosition(this.body.x, this.body.y);
    this.animate(deltaMs);
  }

  /**
   * Hopping movement (the fly): launch upward after a brief grounded dwell. The
   * dwell is the only window it's grounded — and so the only time it's flippable
   * (platform/POW bumps require it to be on a floor).
   */
  private hop(deltaMs: number): void {
    if (!this.isActive) {
      return;
    }
    if (this.body.onGround) {
      if (!this.wasGround) {
        this.hopTimer = FLY_GROUND_MS; // just landed — pause before the next hop
      } else {
        this.hopTimer -= deltaMs;
        if (this.hopTimer <= 0) {
          this.body.jump(FLY_HOP_SPEED);
        }
      }
    }
    this.wasGround = this.body.onGround;
  }

  /**
   * A bump from below (platform or POW). Advances toward being flipped: the
   * last bump flips it (helpless for `stunMs`); earlier ones only anger it
   * (faster). Ignored once flipped or sliding. Returns true if it just flipped.
   */
  bump(stunMs: number): boolean {
    if (this.state === 'flipped' || this.state === 'shell') {
      return false;
    }
    this.bumps += 1;
    if (this.bumps >= this.kind.flipsToStun) {
      this.state = 'flipped';
      this.stun = stunMs;
      return true;
    }
    this.state = 'angry';
    this.speed = this.kind.angrySpeed;
    return false;
  }

  /** Directly flip it for `ms` (a stomped speeding shell, or a POW slam). */
  flipFor(ms: number): void {
    this.state = 'flipped';
    this.stun = ms;
  }

  /** A sliding shell bumped from below pops up, keeping its horizontal slide. */
  bumpHop(speed: number): void {
    if (this.state !== 'shell') {
      return;
    }
    this.body.vy = -speed;
    this.body.onGround = false;
  }

  /** Recover from a flip: back on its feet, faster, a fresh direction. */
  recover(): void {
    this.bumps = Math.max(0, this.kind.flipsToStun - 1);
    this.speed = this.kind.recoverSpeed;
    this.state = this.bumps > 0 ? 'angry' : 'walk';
    this.dir = Math.random() < 0.5 ? 1 : -1;
  }

  get readyToRecover(): boolean {
    return this.state === 'flipped' && this.stun <= 0;
  }

  /**
   * Kick a flipped enemy. A turtle slides off as a lethal projectile (returns
   * true); other species just die — the caller defeats them (returns false).
   */
  kick(dir: 1 | -1, owner = -1): boolean {
    if (!this.kind.becomesShell) {
      return false;
    }
    this.state = 'shell';
    this.dir = dir;
    this.grace = SHELL_GRACE_MS;
    this.owner = owner;
    return true;
  }

  /** Mark as the phase's final enemy: blue and super-fast (even if flipped). */
  makeLast(): void {
    this.last = true;
  }

  /** Walking speed after the per-loop ramp and any last-enemy multiplier. */
  private get effSpeed(): number {
    return this.speed * this.speedScale * (this.last ? ENEMY_LAST_MULT : 1);
  }

  /** Current body tint (or null to clear) based on last/angry state. */
  private tintFor(): number | null {
    if (this.last) {
      return COLORS.enemyLast;
    }
    if (this.state === 'angry' && this.kind.angryTint !== undefined) {
      return this.kind.angryTint;
    }
    return null;
  }

  get isActive(): boolean {
    return this.state === 'walk' || this.state === 'angry';
  }
  get isFlipped(): boolean {
    return this.state === 'flipped';
  }
  get isShell(): boolean {
    return this.state === 'shell';
  }

  /** A kicked shell is lethal to Mario once its brief grace has elapsed. */
  get lethalShell(): boolean {
    return this.state === 'shell' && this.grace <= 0;
  }

  private findFloor(floors: PlatformSegment[]): PlatformSegment | null {
    for (const s of floors) {
      if (this.body.x >= s.x1 && this.body.x <= s.x2 && Math.abs(this.body.feet - surfaceY(s, this.body.x)) < 3) {
        return s;
      }
    }
    return null;
  }

  private animate(deltaMs: number): void {
    if (this.state === 'shell') {
      // Stays upside-down and spins until it leaves the screen.
      this.sprite.setTexture(this.kind.tex.flip).clearTint().setAlpha(1).setFlipX(false);
      this.sprite.angle += (SHELL_SPIN_DEG * deltaMs) / 1000;
      return;
    }
    const tint = this.tintFor();
    if (this.state === 'flipped') {
      const blink = this.stun < SHELL_STUN_BLINK_MS && Math.floor(this.stun / 150) % 2 === 0;
      this.sprite.setTexture(this.kind.tex.flip).setAngle(0).setAlpha(blink ? 0.4 : 1);
      if (tint !== null) {
        this.sprite.setTint(tint);
      } else {
        this.sprite.clearTint();
      }
      return;
    }
    this.sprite.setAngle(0).setAlpha(1).setFlipX(this.dir < 0);
    if (tint !== null) {
      this.sprite.setTint(tint);
    } else {
      this.sprite.clearTint();
    }
    this.frameTimer += deltaMs;
    if (this.frameTimer >= this.kind.frameMs) {
      this.frameTimer = 0;
      this.frame ^= 1;
    }
    this.sprite.setTexture(this.frame === 0 ? this.kind.tex.walk[0] : this.kind.tex.walk[1]);
  }
}
