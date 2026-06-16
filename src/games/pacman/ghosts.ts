import Phaser from 'phaser';
import { Grid } from '../../shared/Grid';
import { GridMover } from '../../shared/GridMover';
import { chooseDirectionToward } from '../../shared/gridAI';
import { GHOST_FOOT_INTERVAL } from './constants';

/**
 * A maze ghost: a sprite driven by the shared GridMover, steering each frame
 * toward a target tile via the shared grid-AI. Targeting is injected, so the
 * same class will power Pinky/Inky/Clyde (and frightened mode) just by changing
 * how the target tile is computed.
 */
export class Ghost {
  readonly mover: GridMover;
  readonly sprite: Phaser.GameObjects.Image;

  private footTimer = 0;
  private footFrame = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly grid: Grid,
    startCol: number,
    startRow: number,
    speed: number,
    private readonly canEnter: (col: number, row: number) => boolean,
    private readonly frames: readonly [string, string],
  ) {
    this.mover = new GridMover({ grid, startCol, startRow, speed, canEnter });
    this.sprite = scene.add.image(this.mover.x, this.mover.y, frames[0]).setDepth(10);
  }

  /** Steer toward (targetCol,targetRow) and advance one frame. */
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

  reset(col: number, row: number): void {
    this.mover.teleport(this.grid.tileToWorldX(col), this.grid.tileToWorldY(row));
    this.mover.stop();
    this.sprite.setPosition(this.mover.x, this.mover.y);
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
