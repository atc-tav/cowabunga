import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { Grid } from '../../shared/Grid';
import { GridMover } from '../../shared/GridMover';
import {
  TILE,
  COLS,
  ROWS,
  MAZE_OFFSET_X,
  MAZE_OFFSET_Y,
  PLAYER_SPEED,
  CHOMP_INTERVAL,
  TUNNEL_ROW,
  SCORE_DOT,
  SCORE_ENERGIZER,
  PLAYER_START,
} from './constants';
import { toCells, WALL, DOOR, DOT, ENERGIZER } from './maze';
import { COLORS } from './palette';
import { buildPacmanTextures, TX } from './sprites';

interface Pellet {
  img: Phaser.GameObjects.Image;
  energizer: boolean;
}

/**
 * Pac-Man — slices 1+2: the maze, the pellets, and a drivable Pac-Man that
 * eats them. Ghosts, frightened mode, and fruit come in later slices. Built on
 * the shared Grid + GridMover so the maze logic is reusable, not bespoke.
 */
export class PacmanScene extends BaseGameScene {
  private grid!: Grid;
  private mover!: GridMover;
  private pac!: Phaser.GameObjects.Image;
  private readonly pellets = new Map<string, Pellet>();
  private chompTimer = 0;
  private chompOpen = true;

  constructor() {
    super({ key: 'game-pacman', gameId: 'pacman', width: 224, height: 288 });
  }

  protected createGame(): void {
    buildPacmanTextures(this);
    this.grid = new Grid(toCells(), TILE, MAZE_OFFSET_X, MAZE_OFFSET_Y);

    this.drawMaze();
    this.buildPellets();

    this.mover = new GridMover({
      grid: this.grid,
      startCol: PLAYER_START.col,
      startRow: PLAYER_START.row,
      speed: PLAYER_SPEED,
      canEnter: (col, row) => this.canEnter(col, row),
    });

    this.pac = this.add
      .image(this.mover.x, this.mover.y, TX.pacOpen)
      .setDepth(10)
      .setAngle(180); // facing left at start
  }

  protected updateGame(_time: number, delta: number): void {
    this.readInput();
    this.mover.update(delta);
    this.handleTunnel();
    this.pac.setPosition(this.mover.x, this.mover.y);
    this.updateFacing();
    this.animateChomp(delta);
    this.eatPellet();
  }

  private readInput(): void {
    if (this.controls.isDown('left')) {
      this.mover.setDesired(-1, 0);
    } else if (this.controls.isDown('right')) {
      this.mover.setDesired(1, 0);
    } else if (this.controls.isDown('up')) {
      this.mover.setDesired(0, -1);
    } else if (this.controls.isDown('down')) {
      this.mover.setDesired(0, 1);
    }
  }

  /** Walkability rule handed to the GridMover. Tunnel row is open at the edges. */
  private canEnter(col: number, row: number): boolean {
    if (row === TUNNEL_ROW && (col < 0 || col >= COLS)) {
      return true;
    }
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) {
      return false;
    }
    const tile = this.grid.get(col, row);
    return tile !== WALL && tile !== DOOR;
  }

  /** Warp Pac-Man across the screen when he leaves through a side tunnel. */
  private handleTunnel(): void {
    const rightEdge = MAZE_OFFSET_X + COLS * TILE;
    if (this.mover.x < MAZE_OFFSET_X - TILE / 2) {
      this.mover.teleport(this.grid.tileToWorldX(COLS - 1), this.mover.y);
    } else if (this.mover.x > rightEdge + TILE / 2) {
      this.mover.teleport(this.grid.tileToWorldX(0), this.mover.y);
    }
  }

  private updateFacing(): void {
    const { x, y } = this.mover.dir;
    if (x === 1) {
      this.pac.setAngle(0);
    } else if (x === -1) {
      this.pac.setAngle(180);
    } else if (y === 1) {
      this.pac.setAngle(90);
    } else if (y === -1) {
      this.pac.setAngle(270);
    }
  }

  private animateChomp(delta: number): void {
    if (!this.mover.moving) {
      this.pac.setTexture(TX.pacOpen);
      return;
    }
    this.chompTimer += delta;
    if (this.chompTimer >= CHOMP_INTERVAL) {
      this.chompTimer = 0;
      this.chompOpen = !this.chompOpen;
      this.pac.setTexture(this.chompOpen ? TX.pacOpen : TX.pacClosed);
    }
  }

  private eatPellet(): void {
    const { col, row } = this.mover.currentTile();
    const key = `${col},${row}`;
    const pellet = this.pellets.get(key);
    if (!pellet) {
      return;
    }
    pellet.img.destroy();
    this.pellets.delete(key);
    this.grid.set(col, row, ' ');
    this.addScore(pellet.energizer ? SCORE_ENERGIZER : SCORE_DOT);
    this.audio.play(pellet.energizer ? 'energizer' : 'chomp');

    if (this.pellets.size === 0) {
      this.time.delayedCall(400, () => this.buildPellets());
    }
  }

  /** (Re)populate the maze with pellets from the source layout. */
  private buildPellets(): void {
    const cells = toCells();
    for (let row = 0; row < cells.length; row++) {
      for (let col = 0; col < cells[row].length; col++) {
        const ch = cells[row][col];
        if (ch !== DOT && ch !== ENERGIZER) {
          continue;
        }
        this.grid.set(col, row, ch);
        const key = `${col},${row}`;
        if (this.pellets.has(key)) {
          continue;
        }
        const energizer = ch === ENERGIZER;
        const img = this.add
          .image(this.grid.tileToWorldX(col), this.grid.tileToWorldY(row), energizer ? TX.energizer : TX.dot)
          .setDepth(5);
        if (energizer) {
          this.tweens.add({
            targets: img,
            scale: { from: 1, to: 0.4 },
            duration: 350,
            yoyo: true,
            repeat: -1,
          });
        }
        this.pellets.set(key, { img, energizer });
      }
    }
  }

  /** Draw the maze as thin blue corridor outlines (the arcade look). */
  private drawMaze(): void {
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(1, COLORS.wall, 1);

    this.grid.forEach((value, col, row) => {
      // Outline walkable cells against their wall neighbours.
      if (value === WALL || value === DOOR) {
        return;
      }
      const left = MAZE_OFFSET_X + col * TILE;
      const top = MAZE_OFFSET_Y + row * TILE;
      const right = left + TILE;
      const bottom = top + TILE;

      if (this.isWall(col, row - 1)) {
        g.lineBetween(left, top, right, top);
      }
      if (this.isWall(col, row + 1)) {
        g.lineBetween(left, bottom, right, bottom);
      }
      if (this.isWall(col - 1, row)) {
        g.lineBetween(left, top, left, bottom);
      }
      if (this.isWall(col + 1, row)) {
        g.lineBetween(right, top, right, bottom);
      }
    });

    // The ghost-house door as a distinct pink bar.
    g.lineStyle(2, COLORS.door, 1);
    this.grid.forEach((value, col, row) => {
      if (value !== DOOR) {
        return;
      }
      const left = MAZE_OFFSET_X + col * TILE;
      const cy = MAZE_OFFSET_Y + row * TILE + TILE / 2;
      g.lineBetween(left, cy, left + TILE, cy);
    });
  }

  private isWall(col: number, row: number): boolean {
    // Out of horizontal bounds is solid everywhere except the open tunnel row.
    if (col < 0 || col >= COLS) {
      return row !== TUNNEL_ROW;
    }
    if (row < 0 || row >= ROWS) {
      return true;
    }
    const tile = this.grid.get(col, row);
    return tile === WALL || tile === DOOR;
  }
}
