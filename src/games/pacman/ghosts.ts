import Phaser from 'phaser';
import { Grid } from '../../shared/Grid';
import { GridMover } from '../../shared/GridMover';
import { chooseDirectionToward } from '../../shared/gridAI';
import { GHOST_FOOT_INTERVAL, GhostName } from './constants';
import { ghostFrames } from './sprites';

export type GhostMode = 'house' | 'leaving' | 'scatter' | 'chase';

/**
 * A maze ghost driven by the shared GridMover + grid-AI. Personality lives in
 * how the scene picks each ghost's target tile; this class owns movement, the
 * house/leaving/scatter/chase mode, the door rule (only passable while
 * leaving), the foot-wobble animation, and the in-house bob.
 */
export class Ghost {
  readonly mover: GridMover;
  readonly sprite: Phaser.GameObjects.Image;
  mode: GhostMode = 'house';
  releaseTimer: number;

  private readonly grid: Grid;
  private readonly frames: [string, string];
  private readonly canEnter: (col: number, row: number) => boolean;
  private homeY: number;
  private footTimer = 0;
  private footFrame = 0;
  private bobTimer = 0;

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
    this.releaseTimer = releaseMs;
    this.frames = ghostFrames(name);
    // Door is passable only while leaving the house.
    this.canEnter = (col, row) => baseCanEnter(col, row, this.mode === 'leaving');
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

  /** Steer toward a target tile and advance one frame. */
  update(deltaMs: number, targetCol: number, targetRow: number): void {
    const { col, row } = this.mover.currentTile();
    const choice = chooseDirectionToward(
      col,
      row,
      this.mover.dir,
      targetCol,
      targetRow,
      this.canEnter,
    );
    this.mover.setDesired(choice.x, choice.y);
    this.mover.update(deltaMs);
    this.sprite.setPosition(this.mover.x, this.mover.y);
    this.animateFeet(deltaMs);
  }

  tile(): { col: number; row: number } {
    return this.mover.currentTile();
  }

  reverse(): void {
    this.mover.reverse();
  }

  reset(col: number, row: number, releaseMs: number): void {
    this.mode = 'house';
    this.releaseTimer = releaseMs;
    this.bobTimer = 0;
    this.mover.teleport(this.grid.tileToWorldX(col), this.grid.tileToWorldY(row));
    this.mover.stop();
    this.homeY = this.mover.y;
    this.sprite.setPosition(this.mover.x, this.mover.y).setTexture(this.frames[0]);
  }

  private animateFeet(deltaMs: number): void {
    this.footTimer += deltaMs;
    if (this.footTimer >= GHOST_FOOT_INTERVAL) {
      this.footTimer = 0;
      this.footFrame ^= 1;
      this.sprite.setTexture(this.frames[this.footFrame]);
    }
  }
}
