import Phaser from 'phaser';
import { TX } from './sprites';
import { GAME, AbilityName } from './constants';
import { EnemySpawn } from './levels';

export type EnemyKindId = 'waddleDee' | 'bronto' | 'waddleDoo' | 'sparky';

interface EnemyKindDef {
  frames: [string, string];
  frameMs: number;
  width: number;
  height: number;
  speed: number; // px/frame
  flyer: boolean; // sine-wave flyer (no gravity, no ledge logic)
  ledgeTurner: boolean; // ground walker that turns at ledges
  ability: AbilityName | null;
  score: number;
}

const KINDS: Record<EnemyKindId, EnemyKindDef> = {
  waddleDee: {
    frames: [TX.waddleDee0, TX.waddleDee1],
    frameMs: 200,
    width: 12,
    height: 10,
    speed: 0.8,
    flyer: false,
    ledgeTurner: true,
    ability: null,
    score: GAME.pointsBasicEnemy,
  },
  bronto: {
    frames: [TX.bronto0, TX.bronto1],
    frameMs: 180,
    width: 12,
    height: 10,
    speed: 1.2,
    flyer: true,
    ledgeTurner: false,
    ability: null,
    score: GAME.pointsBasicEnemy,
  },
  waddleDoo: {
    frames: [TX.waddleDoo0, TX.waddleDoo1],
    frameMs: 200,
    width: 12,
    height: 10,
    speed: 0.8,
    flyer: false,
    ledgeTurner: true,
    ability: 'beam',
    score: GAME.pointsAbilityEnemy,
  },
  sparky: {
    frames: [TX.sparky0, TX.sparky1],
    frameMs: 150,
    width: 10,
    height: 8,
    speed: 0.6,
    flyer: false,
    ledgeTurner: true,
    ability: 'spark',
    score: GAME.pointsAbilityEnemy,
  },
};

export type EnemyState = 'patrol' | 'pulled' | 'dead';

/**
 * A single stage enemy. Owns its patrol / fly AI and animation; the scene owns
 * the interactions (inhale pull, contact damage, defeat scoring). Ground
 * walkers snap to the terrain surface and optionally turn at ledges; flyers bob
 * on a sine path. Movement is expressed in px/frame and scaled by `f` (the
 * 60 Hz frame count for this tick) so it stays frame-rate independent.
 */
export class Enemy {
  readonly sprite: Phaser.GameObjects.Image;
  readonly def: EnemyKindDef;
  readonly ability: AbilityName | null;
  state: EnemyState = 'patrol';
  x: number;
  y: number; // centre

  private dir: 1 | -1 = -1;
  private readonly minX: number;
  private readonly maxX: number;
  private readonly baseY: number;
  private phase = 0;
  private frameTimer = 0;
  private frame: 0 | 1 = 0;

  constructor(
    scene: Phaser.Scene,
    spawn: EnemySpawn,
    private readonly surfaceAt: (x: number) => number | undefined,
  ) {
    this.def = KINDS[spawn.kind];
    this.ability = this.def.ability;
    this.x = spawn.x;
    this.minX = spawn.minX ?? spawn.x - 48;
    this.maxX = spawn.maxX ?? spawn.x + 48;
    this.baseY = spawn.y - this.def.height / 2;
    if (this.def.flyer) {
      this.y = this.baseY;
    } else {
      const sy = this.surfaceAt(spawn.x) ?? spawn.y;
      this.y = sy - this.def.height / 2;
    }
    this.sprite = scene.add.image(this.x, this.y, this.def.frames[0]).setDepth(8);
  }

  get width(): number {
    return this.def.width;
  }
  get height(): number {
    return this.def.height;
  }

  bounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.x - this.width / 2,
      this.y - this.height / 2,
      this.width,
      this.height,
    );
  }

  /** Patrol / fly for this tick. `f` = delta / FRAME_MS (60 Hz frame count). */
  update(f: number, deltaMs: number): void {
    if (this.state !== 'patrol') {
      return;
    }
    if (this.def.flyer) {
      this.phase += 0.06 * f;
      this.x += this.dir * this.def.speed * f;
      if (this.x <= this.minX) {
        this.dir = 1;
      } else if (this.x >= this.maxX) {
        this.dir = -1;
      }
      this.y = this.baseY + Math.sin(this.phase) * 10;
    } else {
      const nextX = this.x + this.dir * this.def.speed * f;
      const ahead = this.surfaceAt(nextX + this.dir * (this.width / 2));
      const hitEdge = nextX <= this.minX || nextX >= this.maxX;
      if (hitEdge || (this.def.ledgeTurner && ahead === undefined)) {
        this.dir = this.dir === 1 ? -1 : 1;
      } else {
        this.x = nextX;
      }
      const sy = this.surfaceAt(this.x);
      if (sy !== undefined) {
        this.y = sy - this.height / 2;
      }
    }
    this.animate(deltaMs);
  }

  /** Reel toward a point while being inhaled; true once it reaches the mouth. */
  pullToward(tx: number, ty: number, f: number): boolean {
    this.state = 'pulled';
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    const step = GAME.inhalePullSpeed * f;
    if (dist <= step + 2) {
      return true;
    }
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    this.sprite.setPosition(this.x, this.y);
    return false;
  }

  /** Released from a partial inhale: resume patrolling. */
  release(): void {
    if (this.state === 'pulled') {
      this.state = 'patrol';
    }
  }

  private animate(deltaMs: number): void {
    this.frameTimer += deltaMs;
    if (this.frameTimer >= this.def.frameMs) {
      this.frameTimer = 0;
      this.frame = this.frame === 0 ? 1 : 0;
    }
    this.sprite
      .setTexture(this.def.frames[this.frame])
      .setPosition(this.x, this.y)
      .setFlipX(this.dir > 0);
  }

  destroy(): void {
    this.state = 'dead';
    this.sprite.destroy();
  }
}
