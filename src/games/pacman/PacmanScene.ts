import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { Grid } from '../../shared/Grid';
import { GridMover } from '../../shared/GridMover';
import { LivesManager } from '../../shared/LivesManager';
import { StateMachine } from '../../shared/StateMachine';
import { LABEL_STYLE, HINT_STYLE } from '../../shared/ui';
import {
  TILE,
  COLS,
  ROWS,
  MAZE_OFFSET_X,
  MAZE_OFFSET_Y,
  PLAYER_SPEED,
  GHOST_SPEED,
  FRIGHT_SPEED,
  EYES_SPEED,
  CHOMP_INTERVAL,
  TUNNEL_ROW,
  SCORE_DOT,
  SCORE_ENERGIZER,
  GHOST_EAT_BASE,
  GHOST_EAT_MAX_CHAIN,
  FRIGHT_MS,
  FRIGHT_BLINK_MS,
  LIVES_START,
  READY_MS,
  DEATH_SPIN_MS,
  GAMEOVER_MS,
  LEVELCLEAR_MS,
  CATCH_DISTANCE,
  SPEED_RAMP_PER_LEVEL,
  MAX_SPEED_LEVELS,
  PLAYER_START,
  GhostName,
  GHOST_STARTS,
  GHOST_RELEASE_MS,
  SCATTER_CORNERS,
  GHOST_EXIT_TARGET,
  GHOST_EXIT_ROW,
  GHOST_HOME_TARGET,
  isInsideHouse,
  PINKY_LEAD,
  INKY_LEAD,
  CLYDE_SCATTER_DIST,
  PHASE_SCHEDULE,
} from './constants';
import { toCells, WALL, DOOR, DOT, ENERGIZER } from './maze';
import { COLORS } from './palette';
import { buildPacmanTextures, TX } from './sprites';
import { Ghost } from './ghosts';

interface Pellet {
  img: Phaser.GameObjects.Image;
  energizer: boolean;
}

interface Tile {
  col: number;
  row: number;
}

/**
 * Pac-Man — slice 6: game flow & levels. The round is now driven by the shared
 * StateMachine (ready -> playing -> dying / levelclear -> gameover), levels
 * advance with a maze flash + speed ramp, and ALL state is rebuilt in
 * createGame() so re-entering from the menu or restarting after game over
 * always gives a clean board.
 */
export class PacmanScene extends BaseGameScene {
  private grid!: Grid;
  private maze!: Phaser.GameObjects.Graphics;
  private mover!: GridMover;
  private pac!: Phaser.GameObjects.Image;
  private lives!: LivesManager;
  private ghosts!: Record<GhostName, Ghost>;

  private flow!: StateMachine<PacmanScene>;
  private level = 1;

  private phaseMode: 'scatter' | 'chase' = 'scatter';
  private phaseIndex = 0;
  private phaseTimer = 0;
  private frightTimer = 0;
  private eatChain = 0;

  private readonly pellets = new Map<string, Pellet>();
  private readonly lifeIcons: Phaser.GameObjects.Image[] = [];

  private readyTimer = 0;
  private chompTimer = 0;
  private chompOpen = true;

  private banner!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'game-pacman', gameId: 'pacman', width: 224, height: 288 });
  }

  protected createGame(): void {
    buildPacmanTextures(this);

    // Full reset — createGame runs on every (re)entry but the constructor does
    // not, so clear any state carried over from a previous play.
    this.clearPellets();
    this.lifeIcons.length = 0;
    this.level = 1;
    this.frightTimer = 0;
    this.eatChain = 0;
    this.chompTimer = 0;
    this.chompOpen = true;

    this.grid = new Grid(toCells(), TILE, MAZE_OFFSET_X, MAZE_OFFSET_Y);
    this.drawMaze();
    this.buildPellets();

    this.mover = new GridMover({
      grid: this.grid,
      startCol: PLAYER_START.col,
      startRow: PLAYER_START.row,
      speed: PLAYER_SPEED,
      canEnter: (col, row) => this.pacCanEnter(col, row),
    });
    this.pac = this.add.image(this.mover.x, this.mover.y, TX.pacOpen).setDepth(10).setAngle(180);

    this.ghosts = {
      blinky: this.makeGhost('blinky'),
      pinky: this.makeGhost('pinky'),
      inky: this.makeGhost('inky'),
      clyde: this.makeGhost('clyde'),
    };

    this.lives = new LivesManager(LIVES_START);
    this.refreshLives();

    this.banner = this.add
      .text(this.nativeWidth / 2, MAZE_OFFSET_Y + 17 * TILE, '', LABEL_STYLE)
      .setOrigin(0.5)
      .setColor('#fcfc00')
      .setDepth(1000);
    this.levelText = this.add
      .text(this.nativeWidth - 4, this.nativeHeight - 8, '', HINT_STYLE)
      .setOrigin(1, 1)
      .setDepth(1000);
    this.refreshLevel();

    this.flow = new StateMachine<PacmanScene>(this)
      .add('ready', { enter: () => this.enterReady(), update: (_c, dt) => this.updateReady(dt) })
      .add('playing', { update: (_c, dt) => this.updatePlaying(dt) })
      .add('dying', { enter: () => this.enterDying() })
      .add('levelclear', { enter: () => this.enterLevelClear() })
      .add('gameover', { enter: () => this.enterGameOver() });
    this.flow.transition('ready');
  }

  protected updateGame(_time: number, delta: number): void {
    this.flow.update(delta);
  }

  // --- flow states --------------------------------------------------------

  private enterReady(): void {
    this.banner.setText('READY!').setColor('#fcfc00').setVisible(true);
    this.resetActors();
  }

  private updateReady(delta: number): void {
    this.readyTimer -= delta;
    if (this.readyTimer <= 0) {
      this.banner.setVisible(false);
      this.flow.transition('playing');
    }
  }

  private updatePlaying(delta: number): void {
    this.readInput();
    this.mover.update(delta);
    this.wrap(this.mover);
    this.pac.setPosition(this.mover.x, this.mover.y);
    this.updateFacing();
    this.animateChomp(delta);

    this.eatPellet();
    if (this.flow.state !== 'playing') {
      return; // board cleared -> levelclear
    }

    this.tickFrightened(delta);
    this.updateGhosts(delta);
    if (this.checkGhostContact()) {
      this.flow.transition('dying');
    }
  }

  private enterDying(): void {
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
      this.flow.transition('gameover');
      return;
    }
    this.refreshLives();
    this.flow.transition('ready');
  }

  private enterLevelClear(): void {
    this.banner.setVisible(false);
    this.tweens.add({
      targets: this.maze,
      alpha: 0.2,
      duration: 180,
      yoyo: true,
      repeat: Math.max(1, Math.floor(LEVELCLEAR_MS / 360) - 1),
      onComplete: () => {
        this.maze.setAlpha(1);
        this.level++;
        this.refreshLevel();
        this.buildPellets();
        this.flow.transition('ready');
      },
    });
  }

  private enterGameOver(): void {
    this.refreshLives();
    this.banner.setText('GAME OVER').setColor('#ff0000').setVisible(true);
    this.time.delayedCall(GAMEOVER_MS, () => this.scene.restart());
  }

  // --- ghosts -------------------------------------------------------------

  private makeGhost(name: GhostName): Ghost {
    const start = GHOST_STARTS[name];
    return new Ghost(
      this,
      this.grid,
      name,
      start.col,
      start.row,
      GHOST_SPEED,
      GHOST_RELEASE_MS[name],
      (col, row, allowDoor) => this.ghostCanEnter(col, row, allowDoor),
    );
  }

  private updateGhosts(delta: number): void {
    this.advancePhase(delta);

    const pac = this.mover.currentTile();
    const pacDir = this.mover.dir;
    const blinkyTile = this.ghosts.blinky.tile();

    for (const ghost of this.ghostList()) {
      if (ghost.mode === 'house') {
        if (ghost.tickHouse(delta)) {
          ghost.mode = 'leaving';
        }
        continue;
      }
      if (ghost.mode === 'leaving') {
        ghost.update(delta, GHOST_EXIT_TARGET);
        this.wrap(ghost.mover);
        if (ghost.tile().row <= GHOST_EXIT_ROW) {
          ghost.mode = this.phaseMode;
        }
        continue;
      }
      if (ghost.mode === 'eyes') {
        ghost.update(delta, GHOST_HOME_TARGET);
        this.wrap(ghost.mover);
        const t = ghost.tile();
        if (isInsideHouse(t.col, t.row)) {
          // Actually home now — revive and head back out.
          ghost.mode = 'leaving';
          ghost.setSpeed(GHOST_SPEED);
        }
        continue;
      }
      if (ghost.mode === 'frightened') {
        ghost.update(delta, null);
        this.wrap(ghost.mover);
        continue;
      }
      ghost.update(delta, this.ghostTarget(ghost.name, pac, pacDir, blinkyTile));
      this.wrap(ghost.mover);
    }
  }

  private advancePhase(delta: number): void {
    if (!Number.isFinite(this.phaseTimer)) {
      return;
    }
    this.phaseTimer -= delta;
    if (this.phaseTimer > 0 || this.phaseIndex >= PHASE_SCHEDULE.length - 1) {
      return;
    }
    this.phaseIndex++;
    const next = PHASE_SCHEDULE[this.phaseIndex];
    this.phaseMode = next.mode;
    this.phaseTimer = next.ms;
    for (const ghost of this.ghostList()) {
      if (ghost.mode === 'scatter' || ghost.mode === 'chase') {
        ghost.mode = this.phaseMode;
        ghost.reverse();
      }
    }
  }

  private ghostTarget(name: GhostName, pac: Tile, pacDir: { x: number; y: number }, blinky: Tile): Tile {
    if (this.phaseMode === 'scatter') {
      return SCATTER_CORNERS[name];
    }
    switch (name) {
      case 'blinky':
        return pac;
      case 'pinky':
        return { col: pac.col + pacDir.x * PINKY_LEAD, row: pac.row + pacDir.y * PINKY_LEAD };
      case 'inky': {
        const ax = pac.col + pacDir.x * INKY_LEAD;
        const ay = pac.row + pacDir.y * INKY_LEAD;
        return { col: 2 * ax - blinky.col, row: 2 * ay - blinky.row };
      }
      case 'clyde': {
        const gt = this.ghosts.clyde.tile();
        const dist = Math.hypot(gt.col - pac.col, gt.row - pac.row);
        return dist > CLYDE_SCATTER_DIST ? pac : SCATTER_CORNERS.clyde;
      }
      default:
        return pac;
    }
  }

  private ghostList(): Ghost[] {
    return [this.ghosts.blinky, this.ghosts.pinky, this.ghosts.inky, this.ghosts.clyde];
  }

  /** Returns true if a lethal ghost caught Pac-Man (eats frightened ghosts as a side effect). */
  private checkGhostContact(): boolean {
    for (const ghost of this.ghostList()) {
      if (ghost.mode !== 'scatter' && ghost.mode !== 'chase' && ghost.mode !== 'frightened') {
        continue;
      }
      const dist = Phaser.Math.Distance.Between(
        this.mover.x,
        this.mover.y,
        ghost.mover.x,
        ghost.mover.y,
      );
      if (dist >= CATCH_DISTANCE) {
        continue;
      }
      if (ghost.mode === 'frightened') {
        this.eatGhost(ghost);
      } else {
        return true;
      }
    }
    return false;
  }

  private tickFrightened(delta: number): void {
    if (this.frightTimer <= 0) {
      return;
    }
    this.frightTimer -= delta;
    const blinking = this.frightTimer <= FRIGHT_BLINK_MS;
    for (const ghost of this.ghostList()) {
      if (ghost.mode === 'frightened') {
        ghost.blinking = blinking;
      }
    }
    if (this.frightTimer <= 0) {
      this.endFrightened();
    }
  }

  private frightenGhosts(): void {
    this.frightTimer = FRIGHT_MS;
    this.eatChain = 0;
    for (const ghost of this.ghostList()) {
      if (ghost.mode === 'scatter' || ghost.mode === 'chase') {
        ghost.mode = 'frightened';
        ghost.setSpeed(FRIGHT_SPEED);
        ghost.blinking = false;
        ghost.reverse();
      }
    }
  }

  private endFrightened(): void {
    this.frightTimer = 0;
    for (const ghost of this.ghostList()) {
      if (ghost.mode === 'frightened') {
        ghost.mode = this.phaseMode;
        ghost.setSpeed(this.ghostSpeed());
        ghost.blinking = false;
      }
    }
  }

  private eatGhost(ghost: Ghost): void {
    const points = GHOST_EAT_BASE * 2 ** this.eatChain;
    this.eatChain = Math.min(this.eatChain + 1, GHOST_EAT_MAX_CHAIN - 1);
    this.addScore(points);
    this.audio.play('eatghost');
    ghost.mode = 'eyes';
    ghost.blinking = false;
    ghost.setSpeed(EYES_SPEED);
  }

  // --- helpers ------------------------------------------------------------

  private resetActors(): void {
    this.readyTimer = READY_MS;
    this.applyLevelSpeeds();

    this.mover.teleport(this.grid.tileToWorldX(PLAYER_START.col), this.grid.tileToWorldY(PLAYER_START.row));
    this.mover.stop();
    this.pac.setPosition(this.mover.x, this.mover.y).setAngle(180).setScale(1).setTexture(TX.pacOpen);

    for (const name of Object.keys(GHOST_STARTS) as GhostName[]) {
      this.ghosts[name].reset(GHOST_STARTS[name].col, GHOST_STARTS[name].row, GHOST_RELEASE_MS[name]);
    }

    this.phaseIndex = 0;
    this.phaseMode = PHASE_SCHEDULE[0].mode;
    this.phaseTimer = PHASE_SCHEDULE[0].ms;
    this.frightTimer = 0;
    this.eatChain = 0;
  }

  private ghostSpeed(): number {
    const lv = Math.min(this.level - 1, MAX_SPEED_LEVELS);
    return Math.min(GHOST_SPEED + lv * SPEED_RAMP_PER_LEVEL, this.playerSpeed() - 4);
  }

  private playerSpeed(): number {
    const lv = Math.min(this.level - 1, MAX_SPEED_LEVELS);
    return PLAYER_SPEED + lv * SPEED_RAMP_PER_LEVEL;
  }

  private applyLevelSpeeds(): void {
    this.mover.setSpeed(this.playerSpeed());
    for (const ghost of this.ghostList()) {
      ghost.setBaseSpeed(this.ghostSpeed());
    }
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

  private pacCanEnter(col: number, row: number): boolean {
    if (row === TUNNEL_ROW && (col < 0 || col >= COLS)) {
      return true;
    }
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) {
      return false;
    }
    const tile = this.grid.get(col, row);
    return tile !== WALL && tile !== DOOR;
  }

  private ghostCanEnter(col: number, row: number, allowDoor: boolean): boolean {
    if (row === TUNNEL_ROW && (col < 0 || col >= COLS)) {
      return true;
    }
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) {
      return false;
    }
    const tile = this.grid.get(col, row);
    if (tile === WALL) {
      return false;
    }
    if (tile === DOOR) {
      return allowDoor;
    }
    return true;
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
    if (pellet.energizer) {
      this.frightenGhosts();
    }
    if (this.pellets.size === 0) {
      this.flow.transition('levelclear');
    }
  }

  private clearPellets(): void {
    for (const pellet of this.pellets.values()) {
      pellet.img.destroy();
    }
    this.pellets.clear();
  }

  /** Rebuild the full pellet field from the source maze layout. */
  private buildPellets(): void {
    this.clearPellets();
    const cells = toCells();
    for (let row = 0; row < cells.length; row++) {
      for (let col = 0; col < cells[row].length; col++) {
        const ch = cells[row][col];
        if (ch !== DOT && ch !== ENERGIZER) {
          continue;
        }
        this.grid.set(col, row, ch);
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
        this.pellets.set(`${col},${row}`, { img, energizer });
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

  private refreshLevel(): void {
    this.levelText.setText(`L${this.level}`);
  }

  private drawMaze(): void {
    const g = this.add.graphics().setDepth(1);
    this.maze = g;
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
