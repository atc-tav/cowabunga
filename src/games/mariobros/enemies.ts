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
  CRAB_W,
  CRAB_H,
  CRAB_SPEED,
  CRAB_ANGRY_SPEED,
  CRAB_RECOVER_SPEED,
  CRAB_SCORE,
} from './constants';
import { COLORS } from './palette';
import { TX } from './sprites';

export type EnemyState = 'walk' | 'angry' | 'flipped' | 'shell';

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
  angryTint?: number;
}

export const KINDS: Record<'turtle' | 'crab', EnemyKind> = {
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
    angryTint: COLORS.crabAngry,
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
  floorSeg: PlatformSegment | null = null;

  private bumps = 0;
  private speed: number;
  private frameTimer = 0;
  private frame = 0;

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
      const sp = this.state === 'shell' ? SHELL_PROJECTILE_SPEED : this.speed;
      this.body.x += this.dir * sp * dt;
    }

    this.body.update(deltaMs, GRAVITY, floors);
    this.floorSeg = this.body.onGround ? this.findFloor(floors) : null;

    this.sprite.setPosition(this.body.x, this.body.y);
    this.animate(deltaMs);
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

  /** Directly flip it for `ms` (e.g. stomping a speeding shell to stop it). */
  flipFor(ms: number): void {
    this.state = 'flipped';
    this.stun = ms;
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
  kick(dir: 1 | -1): boolean {
    if (!this.kind.becomesShell) {
      return false;
    }
    this.state = 'shell';
    this.dir = dir;
    this.grace = SHELL_GRACE_MS;
    return true;
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
    if (this.state === 'flipped') {
      const blink = this.stun < SHELL_STUN_BLINK_MS && Math.floor(this.stun / 150) % 2 === 0;
      this.sprite.setTexture(this.kind.tex.flip).clearTint().setAngle(0).setAlpha(blink ? 0.4 : 1);
      return;
    }
    this.sprite.setAngle(0).setAlpha(1).setFlipX(this.dir < 0);
    if (this.state === 'angry' && this.kind.angryTint !== undefined) {
      this.sprite.setTint(this.kind.angryTint);
    } else {
      this.sprite.clearTint();
    }
    this.frameTimer += deltaMs;
    if (this.frameTimer >= SHELL_FRAME_MS) {
      this.frameTimer = 0;
      this.frame ^= 1;
    }
    this.sprite.setTexture(this.frame === 0 ? this.kind.tex.walk[0] : this.kind.tex.walk[1]);
  }
}
