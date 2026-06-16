import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { Grid } from '../../shared/Grid';
import { GridMover } from '../../shared/GridMover';
import { LivesManager } from '../../shared/LivesManager';
import { LABEL_STYLE } from '../../shared/ui';
import {
  TILE,
  COLS,
  ROWS,
  MAZE_OFFSET_X,
  MAZE_OFFSET_Y,
  PLAYER_SPEED,
  GHOST_SPEED,
  CHOMP_INTERVAL,
  TUNNEL_ROW,
  SCORE_DOT,
  SCORE_ENERGIZER,
  LIVES_START,
  READY_MS,
  DEATH_SPIN_MS,
  GAMEOVER_MS,
  CATCH_DISTANCE,
  PLAYER_START,
  BLINKY_START,
} from './constants';
import { toCells, WALL, DOOR, DOT, ENERGIZER } from './maze';
import { COLORS } from './palette';
import { buildPacmanTextures, TX } from './sprites';
import { Ghost } from './ghosts';

interface Pellet {
  img: Phaser.GameObjects.Image;
  energizer: boolean;
}

type Phase = 'ready' | 'playing' | 'dying' | 'over';

/**
 * Pac-Man — slice 3: Blinky chases, and Pac-Man can die. Adds the first ghost
 * (shared Ghost + grid-AI), a lives system (shared LivesManager), collision,
 * the death-spin animation, and a tiny round state machine (READY -> PLAYING ->
 * DYING -> ... -> GAME OVER). The flow FSM is intentionally inline here; it
 * gets generalised into a shared GameFlow in a later slice.
 */
export class PacmanScene extends BaseGameScene {
  private grid!: Grid;
  private mover!: GridMover;
  private pac!: Phaser.GameObjects.Image;
  private blinky!: Ghost;
  private lives!: LivesManager;

  private readonly pellets = new Map<string, Pellet>();
  private readonly lifeIcons: Phaser.GameObjects.Image[] = [];

  private phase: Phase = 'ready';
  private phaseTimer = 0;
  private chompTimer = 0;
  private chompOpen = true;

  private banner!: Phaser.GameObjects.Text;

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
      .setAngle(180);

    this.blinky = new Ghost(
      this,
      this.grid,
      BLINKY_START.col,
      BLINKY_START.row,
      GHOST_SPEED,
      (col, row) => this.canEnter(col, row),
      [TX.blinky0, TX.blinky1],
    );

    this.lives = new LivesManager(LIVES_START);
    this.refreshLives();

    this.banner = this.add
      .text(this.nativeWidth / 2, MAZE_OFFSET_Y + 17 * TILE, '', LABEL_STYLE)
      .setOrigin(0.5)
      .setColor('#fcfc00')
      .setDepth(1000);

    this.startReady();
  }

  protected updateGame(_time: number, delta: number): void {
    switch (this.phase) {
      case 'ready':
        this.tickReady(delta);
        break;
      case 'playing':
        this.tickPlaying(delta);
        break;
      case 'dying':
      case 'over':
        // Animations / timers run via tweens + delayedCall; nothing to step.
        break;
    }
  }

  // --- phases -------------------------------------------------------------

  private startReady(): void {
    this.phase = 'ready';
    this.phaseTimer = READY_MS;
    this.banner.setText('READY!').setVisible(true);

    this.mover.teleport(this.grid.tileToWorldX(PLAYER_START.col), this.grid.tileToWorldY(PLAYER_START.row));
    this.mover.stop();
    this.pac.setPosition(this.mover.x, this.mover.y).setAngle(180).setTexture(TX.pacOpen);
    this.blinky.reset(BLINKY_START.col, BLINKY_START.row);
  }

  private tickReady(delta: number): void {
    this.phaseTimer -= delta;
    if (this.phaseTimer <= 0) {
      this.banner.setVisible(false);
      this.phase = 'playing';
    }
  }

  private tickPlaying(delta: number): void {
    this.readInput();
    this.mover.update(delta);
    this.wrap(this.mover);
    this.pac.setPosition(this.mover.x, this.mover.y);
    this.updateFacing();
    this.animateChomp(delta);
    this.eatPellet();

    const target = this.mover.currentTile();
    this.blinky.update(delta, target.col, target.row);
    this.wrap(this.blinky.mover);

    if (this.caughtByGhost()) {
      this.die();
    }
  }

  private die(): void {
    this.phase = 'dying';
    this.audio.play('death');
    this.tweens.add({
      targets: this.pac,
      angle: this.pac.angle + 720,
      scale: { from: 1, to: 0 },
      duration: DEATH_SPIN_MS,
      onComplete: () => this.afterDeath(),
    });
  }

  private afterDeath(): void {
    this.pac.setScale(1);
    if (this.lives.lose() <= 0) {
      this.gameOver();
      return;
    }
    this.refreshLives();
    this.startReady();
  }

  private gameOver(): void {
    this.phase = 'over';
    this.refreshLives();
    this.banner.setText('GAME OVER').setColor('#ff0000').setVisible(true);
    this.time.delayedCall(GAMEOVER_MS, () => this.scene.restart());
  }

  // --- helpers ------------------------------------------------------------

  private caughtByGhost(): boolean {
    return (
      Phaser.Math.Distance.Between(
        this.mover.x,
        this.mover.y,
        this.blinky.mover.x,
        this.blinky.mover.y,
      ) < CATCH_DISTANCE
    );
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

  private wrap(mover: GridMover): void {
    const rightEdge = MAZE_OFFSET_X + COLS * TILE;
    if (mover.x < MAZE_OFFSET_X - TILE / 2) {
      mover.teleport(this.grid.tileToWorldX(COLS - 1), mover.y);
    } else if (mover.x > rightEdge + TILE / 2) {
      mover.teleport(this.grid.tileToWorldX(0), mover.y);
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

  private refreshLives(): void {
    for (const icon of this.lifeIcons) {
      icon.destroy();
    }
    this.lifeIcons.length = 0;
    for (let i = 0; i < this.lives.count; i++) {
      this.lifeIcons.push(
        this.add
          .image(10 + i * 12, this.nativeHeight - 8, TX.pacClosed)
          .setScale(0.8)
          .setAngle(180)
          .setDepth(1000),
      );
    }
  }

  private drawMaze(): void {
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(1, COLORS.wall, 1);

    this.grid.forEach((value, col, row) => {
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
