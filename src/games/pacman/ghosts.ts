import Phaser from 'phaser';
import { Grid } from '../../shared/Grid';
import { GridMover } from '../../shared/GridMover';
import { chooseDirectionToward, chooseRandomDirection } from '../../shared/gridAI';
import { GHOST_FOOT_INTERVAL, GhostName } from './constants';
import { ghostFrames, FRIGHT_TX } from './sprites';

export type GhostMode = 'house' | 'leaving' | 'scatter' | 'chase' | 'frightened' | 'eyes';

interface Tile {
  col: number;
  row: number;
}

/**
 * A maze ghost driven by the shared GridMover + grid-AI. Personality lives in
 * how the scene picks each ghost's target tile; this class owns movement, mode
 * (house/leaving/scatter/chase/frightened/eyes), the door rule (passable only
 * while leaving or returning as eyes), speed changes, and animation.
 */
export class Ghost {
  readonly mover: GridMover;
  readonly sprite: Phaser.GameObjects.Image;
  mode: GhostMode = 'house';
  releaseTimer: number;
  blinking = false;

  private readonly grid: Grid;
  private readonly frames: [string, string];
  private readonly canEnter: (col: number, row: number) => boolean;
  private baseSpeed: number;
  private homeY: number;
  private footTimer = 0;
  private footFrame = 0;
  private bobTimer = 0;
  private decisionTile: Tile | null = null;
  private randomChoice = { x: 0, y: 0 };

  constructor(
    scene: Phaser.Scene,
    grid: Grid,
    readonly name: GhostName,
    startCol: number,
    startRow: number,
    speed: number,
    releaseMs: number,
    baseCanEnter: (col: number, row: number, allowDoor: boolean) => boolean,
  ) {
    this.grid = grid;
    this.baseSpeed = speed;
    this.releaseTimer = releaseMs;
    this.frames = ghostFrames(name);
    // Door is passable only while leaving the house or returning home as eyes.
    this.canEnter = (col, row) =>
      baseCanEnter(col, row, this.mode === 'leaving' || this.mode === 'eyes');
    this.mover = new GridMover({ grid, startCol, startRow, speed, canEnter: this.canEnter });
    this.homeY = this.mover.y;
    this.sprite = scene.add.image(this.mover.x, this.mover.y, this.frames[0]).setDepth(10);
  }

  /** Bob in place while waiting for release; returns true once it's time to leave. */
  tickHouse(deltaMs: number): boolean {
    this.releaseTimer -= deltaMs;
    this.bobTimer += deltaMs;
    this.sprite.y = this.homeY + Math.sin(this.bobTimer / 180) * 2;
    return this.releaseTimer <= 0;
  }

  /**
   * Advance one frame. Frightened ghosts wander randomly (target ignored);
   * everyone else steers toward the given target tile.
   */
  update(deltaMs: number, target: Tile | null): void {
    const { col, row } = this.mover.currentTile();
    let choice;
    if (this.mode === 'frightened') {
      // Re-roll a random direction only when entering a new tile.
      if (!this.decisionTile || this.decisionTile.col !== col || this.decisionTile.row !== row) {
        this.decisionTile = { col, row };
        this.randomChoice = chooseRandomDirection(col, row, this.mover.dir, this.canEnter);
      }
      choice = this.randomChoice;
    } else {
      const t = target ?? { col, row };
      choice = chooseDirectionToward(col, row, this.mover.dir, t.col, t.row, this.canEnter);
    }
    this.mover.setDesired(choice.x, choice.y);
    this.mover.update(deltaMs);
    this.sprite.setPosition(this.mover.x, this.mover.y);
    this.animate(deltaMs);
  }

  tile(): Tile {
    return this.mover.currentTile();
  }

  reverse(): void {
    this.mover.reverse();
  }

  setSpeed(speed: number): void {
    this.mover.setSpeed(speed);
  }

  /** Set the per-level baseline speed restored on reset. */
  setBaseSpeed(speed: number): void {
    this.baseSpeed = speed;
  }

  /** Reset to a fresh in-house state. */
  reset(col: number, row: number, releaseMs: number): void {
    this.mode = 'house';
    this.blinking = false;
    this.releaseTimer = releaseMs;
    this.bobTimer = 0;
    this.decisionTile = null;
    this.mover.setSpeed(this.baseSpeed);
    this.mover.teleport(this.grid.tileToWorldX(col), this.grid.tileToWorldY(row));
    this.mover.stop();
    this.homeY = this.mover.y;
    this.sprite.setPosition(this.mover.x, this.mover.y).setTexture(this.frames[0]);
  }

  private animate(deltaMs: number): void {
    this.footTimer += deltaMs;
    if (this.footTimer >= GHOST_FOOT_INTERVAL) {
      this.footTimer = 0;
      this.footFrame ^= 1;
    }

    let texture: string;
    if (this.mode === 'eyes') {
      texture = FRIGHT_TX.eyes;
    } else if (this.mode === 'frightened') {
      if (this.blinking) {
        // Flash between blue and white as the power-up runs out.
        texture = this.footFrame ? FRIGHT_TX.blink0 : FRIGHT_TX.body0;
      } else {
        texture = this.footFrame ? FRIGHT_TX.body1 : FRIGHT_TX.body0;
      }
    } else {
      texture = this.frames[this.footFrame];
    }
    this.sprite.setTexture(texture);
  }
}
