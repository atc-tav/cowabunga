import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { Grid } from '../../shared/Grid';
import { GridMover, Vec2 } from '../../shared/GridMover';
import { LivesManager } from '../../shared/LivesManager';
import { StateMachine } from '../../shared/StateMachine';
import { chooseDirectionToward, chooseRandomDirection } from '../../shared/gridAI';
import { LABEL_STYLE, HUD_STYLE } from '../../shared/ui';
import { COLORS } from './palette';
import { buildHydraTextures, TX } from './sprites';
import * as C from './constants';

interface Cell {
  col: number;
  row: number;
}

interface Segment extends Cell {
  img: Phaser.GameObjects.Image;
}

type SnakeKind = 'green' | 'blue';

interface Snake {
  kind: SnakeKind;
  segments: Segment[]; // head first
  dir: Vec2;
  facing: Vec2;
  hp: number;
  state: 'forage' | 'chase' | 'wander';
  stepAcc: number;
  enrageMs: number; // chase fast
  loseInterest: number;
  venomCd: number;
  fireMs: number; // fire-infected: attacks other snakes
  iceMs: number; // ice-infected: slowed
}

type BulletKind = 'normal' | 'fire' | 'ice';

interface Bullet {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  kind: BulletKind;
}

type VenomType = 'green' | 'red' | 'blue';

interface Venom {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  type: VenomType;
}

interface Egg extends Cell {
  img: Phaser.GameObjects.Image;
  timer: number;
}

interface Wingman {
  img: Phaser.GameObjects.Image;
  life: number;
  fireTimer: number;
}

type PlayerEffect = 'none' | 'red' | 'green' | 'blue';

/**
 * HYDRA v2 — Snake, inverted, with a deeper sandbox: green snakes that split at
 * length 10, weak blue snakes (from cuts/eggs/fire-bites), three venom effects,
 * an accelerating pellet economy, a growing powerup meter, and four powerups
 * (mine, fire poison, ice poison, wingman). See specs/hydra-original.md.
 */
export class HydraScene extends BaseGameScene {
  private grid!: Grid;
  private flow!: StateMachine<HydraScene>;

  private mover!: GridMover;
  private ship!: Phaser.GameObjects.Image;
  private facing: Vec2 = { x: 0, y: -1 };
  private lives!: LivesManager;
  private lifeIcons: Phaser.GameObjects.Image[] = [];

  private snakes: Snake[] = [];
  private bullets: Bullet[] = [];
  private venoms: Venom[] = [];
  private eggs: Egg[] = [];
  private pellets = new Map<string, Phaser.GameObjects.Image>();
  private mines = new Map<string, Phaser.GameObjects.Image>();
  private wingman?: Wingman;
  private awarenessGfx!: Phaser.GameObjects.Graphics;
  private meterGfx!: Phaser.GameObjects.Graphics;
  private itemText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;

  private effect: PlayerEffect = 'none';
  private effectTimer = 0;
  private invulnTimer = 0;

  // Powerups
  private meterValue = 0;
  private meterMax = C.METER_START;
  private mineCount = 0;
  private fireAmmo = 0;
  private iceAmmo = 0;

  private snakeBaseStep = C.SNAKE_BASE_STEP_MS;
  private venomCooldown = C.VENOM_COOLDOWN_MS;
  private rampTimer = 0;
  private snakeRespawnTimer = 0;
  private surviveAcc = 0;
  private nextExtraLife = C.EXTRA_LIFE_AT;

  private pelletTimer = 0;
  private pelletInterval = C.PELLET_INTERVAL_START;

  private plantKey?: Phaser.Input.Keyboard.Key;
  private padYPrev = false;

  constructor() {
    super({ key: 'game-hydra', gameId: 'hydra', width: C.WIDTH, height: C.HEIGHT });
  }

  protected createGame(): void {
    buildHydraTextures(this);
    this.resetState();

    this.grid = new Grid([], C.TILE, 0, 0);
    this.drawArena();
    this.awarenessGfx = this.add.graphics().setDepth(2);
    this.meterGfx = this.add.graphics().setDepth(1000);

    this.plantKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.X);

    this.mover = new GridMover({
      grid: this.grid,
      startCol: Math.floor(C.COLS / 2),
      startRow: C.PLAY_ROW_MAX - 4,
      speed: C.PLAYER_SPEED,
      canEnter: (col, row) => this.inArena(col, row),
    });
    this.ship = this.add.image(this.mover.x, this.mover.y, TX.ship).setDepth(10);

    this.lives = new LivesManager(C.STARTING_LIVES);
    this.refreshLives();

    this.spawnSnake(
      this.makeSegments(Math.floor(C.COLS / 2), 12, { x: 1, y: 0 }, C.SNAKE_START_LENGTH, 'green'),
      'green',
    );
    for (let i = 0; i < C.PELLET_START_COUNT; i++) this.spawnPellet();

    this.itemText = this.add
      .text(C.WIDTH - 4, C.HEIGHT - 18, '', HUD_STYLE)
      .setOrigin(1, 0)
      .setDepth(1000);
    this.banner = this.add
      .text(C.WIDTH / 2, C.HEIGHT / 2, '', LABEL_STYLE)
      .setOrigin(0.5)
      .setDepth(1500)
      .setVisible(false);

    this.flow = new StateMachine<HydraScene>(this)
      .add('play', { update: (_c, dt) => this.updatePlay(dt) })
      .add('gameover', { enter: () => this.enterGameOver() });
    this.flow.transition('play');
  }

  protected updateGame(_time: number, delta: number): void {
    this.flow.update(delta);
  }

  private resetState(): void {
    this.snakes.forEach((s) => s.segments.forEach((seg) => seg.img.destroy()));
    this.bullets.forEach((b) => b.img.destroy());
    this.venoms.forEach((v) => v.img.destroy());
    this.eggs.forEach((e) => e.img.destroy());
    this.pellets.forEach((p) => p.destroy());
    this.mines.forEach((m) => m.destroy());
    this.wingman?.img.destroy();
    this.lifeIcons.forEach((i) => i.destroy());
    this.snakes = [];
    this.bullets = [];
    this.venoms = [];
    this.eggs = [];
    this.pellets.clear();
    this.mines.clear();
    this.wingman = undefined;
    this.lifeIcons = [];
    this.effect = 'none';
    this.effectTimer = 0;
    this.invulnTimer = 0;
    this.facing = { x: 0, y: -1 };
    this.meterValue = 0;
    this.meterMax = C.METER_START;
    this.mineCount = 0;
    this.fireAmmo = 0;
    this.iceAmmo = 0;
    this.snakeBaseStep = C.SNAKE_BASE_STEP_MS;
    this.venomCooldown = C.VENOM_COOLDOWN_MS;
    this.rampTimer = 0;
    this.snakeRespawnTimer = 0;
    this.surviveAcc = 0;
    this.nextExtraLife = C.EXTRA_LIFE_AT;
    this.pelletTimer = 0;
    this.pelletInterval = C.PELLET_INTERVAL_START;
    this.padYPrev = false;
  }

  // --- main loop ----------------------------------------------------------

  private updatePlay(delta: number): void {
    this.tickRamp(delta);
    this.tickPellets(delta);
    this.tickSurvival(delta);
    this.tickEffect(delta);
    this.tickEggs(delta);
    if (this.invulnTimer > 0) {
      this.invulnTimer -= delta;
      this.ship.setAlpha(Math.floor(this.invulnTimer / 80) % 2 ? 0.3 : 1);
      if (this.invulnTimer <= 0) this.ship.setAlpha(1);
    }

    this.updatePlayer(delta);
    this.checkPlayerPelletPickup();
    this.updateBullets(delta);
    this.updateWingman(delta);
    for (const snake of [...this.snakes]) this.updateSnake(snake, delta);
    this.updateVenom(delta);
    this.drawAwareness();
    this.drawMeter();

    if (this.checkSnakeContact()) this.playerHit();
    this.maybeRespawnSnake(delta);
  }

  // --- player -------------------------------------------------------------

  private get isBlueForm(): boolean {
    return this.effect === 'blue';
  }

  private updatePlayer(delta: number): void {
    const mul =
      this.effect === 'red' ? C.RED_SPEED_MULT : this.effect === 'green' ? C.GREEN_SPEED_MULT : 1;
    this.mover.setSpeed(C.PLAYER_SPEED * mul);

    let dx = 0;
    let dy = 0;
    if (this.controls.isDown('left')) dx = -1;
    else if (this.controls.isDown('right')) dx = 1;
    else if (this.controls.isDown('up')) dy = -1;
    else if (this.controls.isDown('down')) dy = 1;
    if (this.effect === 'red') {
      dx = -dx; // red venom: reversed controls
      dy = -dy;
    }
    this.mover.setDesired(dx, dy);
    this.mover.update(delta);
    if (this.mover.dir.x !== 0 || this.mover.dir.y !== 0) {
      this.facing = { ...this.mover.dir };
      if (!this.isBlueForm) this.emitSmoke();
    }

    this.ship.setPosition(this.mover.x, this.mover.y);
    this.ship.setAngle(this.angleFor(this.facing));

    // While transformed into a blue snake you can't shoot or plant.
    if (this.isBlueForm) return;

    if (this.controls.justPressed('fire') && this.bullets.length < C.MAX_BULLETS) {
      this.fireBullet();
    }
    if (this.plantPressed() && this.mineCount > 0) {
      this.plantMine();
    }
  }

  private plantPressed(): boolean {
    const kb = this.plantKey ? Phaser.Input.Keyboard.JustDown(this.plantKey) : false;
    const pad = this.input.gamepad?.getPad(0);
    const yNow = pad?.Y ?? false;
    const edge = yNow && !this.padYPrev;
    this.padYPrev = yNow;
    return Boolean(kb || edge);
  }

  private emitSmoke(): void {
    const puff = this.add.image(this.mover.x, this.mover.y, TX.smoke).setDepth(4).setAlpha(0.5);
    this.tweens.add({ targets: puff, alpha: 0, scale: 0.4, duration: C.SMOKE_FADE_MS, onComplete: () => puff.destroy() });
  }

  private fireBullet(): void {
    this.audio.play('shoot');
    let kind: BulletKind = 'normal';
    let tex: string = TX.bullet;
    if (this.fireAmmo > 0) {
      kind = 'fire';
      tex = TX.fireBullet;
      this.fireAmmo--;
    } else if (this.iceAmmo > 0) {
      kind = 'ice';
      tex = TX.iceBullet;
      this.iceAmmo--;
    }
    const img = this.add.image(this.mover.x, this.mover.y, tex).setDepth(9);
    this.bullets.push({ img, vx: this.facing.x * C.BULLET_SPEED, vy: this.facing.y * C.BULLET_SPEED, kind });
  }

  private plantMine(): void {
    const pt = this.mover.currentTile();
    const key = `${pt.col},${pt.row}`;
    if (this.mines.has(key) || this.pellets.has(key)) return;
    this.mineCount--;
    const img = this.add
      .image(this.grid.tileToWorldX(pt.col), this.grid.tileToWorldY(pt.row), TX.mine)
      .setDepth(5);
    this.mines.set(key, img);
  }

  private checkPlayerPelletPickup(): void {
    const pt = this.mover.currentTile();
    const key = `${pt.col},${pt.row}`;
    if (!this.pellets.has(key)) return;
    if (this.isBlueForm) {
      // As a blue snake, eating a pellet lays an egg instead of feeding the meter.
      this.destroyPellet(key);
      this.layEgg(pt);
      return;
    }
    this.destroyPellet(key);
    this.popScore(this.mover.x, this.mover.y, C.SCORE_PELLET_DENIED, { color: '#ffd23c', fontSize: '8px' });
    this.enrageNearestSnake();
    this.addMeter();
  }

  private updateBullets(delta: number): void {
    const dt = delta / 1000;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.img.x += b.vx * dt;
      b.img.y += b.vy * dt;
      if (!this.inWorld(b.img.x, b.img.y)) {
        b.img.destroy();
        this.bullets.splice(i, 1);
        continue;
      }
      if (this.resolveBulletHit(b)) {
        b.img.destroy();
        this.bullets.splice(i, 1);
      }
    }
  }

  private resolveBulletHit(b: Bullet): boolean {
    const col = this.grid.worldToCol(b.img.x);
    const row = this.grid.worldToRow(b.img.y);
    const key = `${col},${row}`;
    if (this.pellets.has(key)) {
      this.destroyPellet(key);
      this.popScore(b.img.x, b.img.y, C.SCORE_PELLET_DENIED, { color: '#ffd23c', fontSize: '8px' });
      this.enrageNearestSnake();
      this.addMeter();
      return true;
    }
    for (const snake of this.snakes) {
      const headHit = snake.segments[0].col === col && snake.segments[0].row === row;
      let bodyIndex = -1;
      if (!headHit) {
        for (let i = 1; i < snake.segments.length; i++) {
          if (snake.segments[i].col === col && snake.segments[i].row === row) {
            bodyIndex = i;
            break;
          }
        }
      }
      if (!headHit && bodyIndex < 0) continue;

      if (snake.kind === 'blue') {
        this.killBlue(snake, b.img.x, b.img.y);
        return true;
      }
      if (b.kind === 'fire') {
        this.infect(snake, 'fire');
        return true;
      }
      if (b.kind === 'ice') {
        this.infect(snake, 'ice');
        return true;
      }
      if (headHit) {
        this.hitHead(snake, b.img.x, b.img.y);
      } else {
        this.cutToBlue(snake, bodyIndex, b.img.x, b.img.y);
      }
      return true;
    }
    return false;
  }

  private hitHead(snake: Snake, x: number, y: number): void {
    if (this.playerInAwareness(snake) && Math.random() < C.DODGE_CHANCE) return; // dodged
    snake.hp -= 1;
    this.popScore(x, y, C.SCORE_HEAD_HIT, { color: '#ffffff', fontSize: '8px' });
    this.flashSnake(snake);
    if (snake.hp <= 0) this.killSnake(snake);
  }

  private flashSnake(snake: Snake): void {
    snake.segments.forEach((seg) => this.tweens.add({ targets: seg.img, alpha: 0.2, duration: 60, yoyo: true }));
  }

  private killSnake(snake: Snake): void {
    this.impact('medium');
    const head = snake.segments[0];
    this.popScore(head.img.x, head.img.y, C.SCORE_SNAKE_KILL, { color: '#5ec43a', fontSize: '10px' });
    snake.segments.forEach((seg) => seg.img.destroy());
    this.snakes = this.snakes.filter((s) => s !== snake);
  }

  private killBlue(snake: Snake, x: number, y: number): void {
    this.popScore(x, y, C.SCORE_BLUE_KILL, { color: '#3c7bff', fontSize: '8px' });
    snake.segments.forEach((seg) => seg.img.destroy());
    this.snakes = this.snakes.filter((s) => s !== snake);
  }

  /** Shoot a segment off a green snake: the rear becomes a weak blue snake. */
  private cutToBlue(snake: Snake, index: number, x: number, y: number): void {
    const rear = snake.segments.splice(index);
    this.popScore(x, y, C.SCORE_CUT, { color: '#e23c3c', fontSize: '9px' });
    this.impact('light');
    this.restyleSnake(snake);
    this.spawnBlueFromSegments(rear);
  }

  private infect(snake: Snake, type: 'fire' | 'ice'): void {
    if (type === 'fire') snake.fireMs = C.FIRE_INFECT_MS;
    else snake.iceMs = C.ICE_INFECT_MS;
    const tint = type === 'fire' ? COLORS.fireShot : COLORS.iceShot;
    snake.segments.forEach((seg) => seg.img.setTint(tint));
  }

  // --- snakes -------------------------------------------------------------

  private makeSegments(col: number, row: number, dir: Vec2, len: number, kind: SnakeKind): Segment[] {
    const headTex = kind === 'blue' ? TX.snakeHeadBlue : TX.snakeHead;
    const bodyTex = kind === 'blue' ? TX.snakeBodyBlue : TX.snakeBody;
    const segs: Segment[] = [];
    for (let i = 0; i < len; i++) {
      const c = col - dir.x * i;
      const r = row - dir.y * i;
      const img = this.add
        .image(this.grid.tileToWorldX(c), this.grid.tileToWorldY(r), i === 0 ? headTex : bodyTex)
        .setDepth(8);
      segs.push({ col: c, row: r, img });
    }
    return segs;
  }

  private spawnSnake(segments: Segment[], kind: SnakeKind): Snake {
    const head = segments[0];
    const second = segments[1] ?? { col: head.col - 1, row: head.row };
    const dir: Vec2 = { x: Math.sign(head.col - second.col), y: Math.sign(head.row - second.row) };
    const snake: Snake = {
      kind,
      segments,
      dir: dir.x === 0 && dir.y === 0 ? { x: 1, y: 0 } : dir,
      facing: { x: 1, y: 0 },
      hp: kind === 'blue' ? C.BLUE_HP : C.SNAKE_HP,
      state: kind === 'blue' ? 'wander' : 'forage',
      stepAcc: 0,
      enrageMs: 0,
      loseInterest: 0,
      venomCd: 0,
      fireMs: 0,
      iceMs: 0,
    };
    this.snakes.push(snake);
    return snake;
  }

  private spawnBlueFromSegments(segments: Segment[]): void {
    if (segments.length === 0) return;
    if (this.snakes.length >= C.MAX_SNAKES) {
      segments.forEach((seg) => seg.img.destroy());
      return;
    }
    segments.forEach((seg, i) => seg.img.setTexture(i === 0 ? TX.snakeHeadBlue : TX.snakeBodyBlue).clearTint());
    this.spawnSnake(segments, 'blue');
  }

  private updateSnake(snake: Snake, delta: number): void {
    if (snake.enrageMs > 0) snake.enrageMs -= delta;
    if (snake.venomCd > 0) snake.venomCd -= delta;
    if (snake.fireMs > 0) {
      snake.fireMs -= delta;
      if (snake.fireMs <= 0) snake.segments.forEach((seg) => seg.img.clearTint());
    }
    if (snake.iceMs > 0) {
      snake.iceMs -= delta;
      if (snake.iceMs <= 0) snake.segments.forEach((seg) => seg.img.clearTint());
    }

    const sees = this.playerInAwareness(snake) || this.effect === 'green';
    if (snake.kind === 'green' && snake.fireMs <= 0) {
      if (sees) {
        snake.state = 'chase';
        snake.loseInterest = C.LOSE_INTEREST_MS;
      } else if (snake.state === 'chase') {
        snake.loseInterest -= delta;
        if (snake.loseInterest <= 0) snake.state = 'forage';
      }
      this.maybeSpitVenom(snake);
    } else if (snake.kind === 'blue') {
      snake.state = sees ? 'chase' : 'wander';
    }

    let factor = 1;
    if (snake.state === 'chase' || snake.enrageMs > 0) factor = C.SNAKE_FAST_MULT;
    if (snake.fireMs > 0 && this.snakes.length === 1) factor = C.FIRE_SPEED_MULT;
    if (snake.iceMs > 0) factor *= C.ICE_SPEED_MULT;
    factor = Math.min(factor, C.SNAKE_FAST_MULT);
    const step = this.snakeBaseStep / factor;

    snake.stepAcc += delta;
    if (snake.stepAcc >= step) {
      snake.stepAcc -= step;
      this.stepSnake(snake);
    }
  }

  private stepSnake(snake: Snake): void {
    const head = snake.segments[0];
    const blocked = this.snakeBodySet(snake);
    const canGo = (col: number, row: number): boolean => this.inArena(col, row) && !blocked.has(`${col},${row}`);

    let dir = this.chooseSnakeDir(snake, head, canGo);
    if (dir.x === 0 && dir.y === 0) return;
    snake.dir = dir;
    snake.facing = dir;

    const next: Cell = { col: head.col + dir.x, row: head.row + dir.y };
    const pkey = `${next.col},${next.row}`;
    const ate = snake.kind === 'green' && this.pellets.has(pkey);
    if (ate) this.destroyPellet(pkey);

    if (ate) {
      const img = this.add
        .image(this.grid.tileToWorldX(next.col), this.grid.tileToWorldY(next.row), TX.snakeHead)
        .setDepth(8);
      snake.segments.unshift({ col: next.col, row: next.row, img });
    } else {
      const tail = snake.segments.pop();
      if (!tail) return;
      tail.col = next.col;
      tail.row = next.row;
      tail.img.setPosition(this.grid.tileToWorldX(next.col), this.grid.tileToWorldY(next.row));
      snake.segments.unshift(tail);
    }
    this.restyleSnake(snake);

    if (this.mines.has(pkey)) this.triggerMine(snake, pkey);
    if (snake.fireMs > 0) this.fireBite(snake);
    if (snake.kind === 'green' && snake.segments.length >= C.SNAKE_SPLIT_LENGTH) this.splitSnake(snake);
  }

  private chooseSnakeDir(snake: Snake, head: Cell, canGo: (c: number, r: number) => boolean): Vec2 {
    // Fire-infected: hunt the nearest OTHER snake; if it's the only one, reverse.
    if (snake.fireMs > 0) {
      const others = this.snakes.filter((s) => s !== snake);
      if (others.length > 0) {
        const t = this.nearestSnakeHead(head, snake);
        if (t) return chooseDirectionToward(head.col, head.row, snake.dir, t.col, t.row, canGo);
      }
      const target = this.nearestPelletOrMine(head);
      const intended = target
        ? chooseDirectionToward(head.col, head.row, snake.dir, target.col, target.row, canGo)
        : chooseRandomDirection(head.col, head.row, snake.dir, canGo);
      const rev = { x: -intended.x, y: -intended.y };
      return canGo(head.col + rev.x, head.row + rev.y) ? rev : intended;
    }
    if (snake.state === 'chase') {
      const pt = this.mover.currentTile();
      return chooseDirectionToward(head.col, head.row, snake.dir, pt.col, pt.row, canGo);
    }
    if (snake.kind === 'blue') {
      return chooseRandomDirection(head.col, head.row, snake.dir, canGo);
    }
    const target = this.nearestPelletOrMine(head);
    return target
      ? chooseDirectionToward(head.col, head.row, snake.dir, target.col, target.row, canGo)
      : chooseRandomDirection(head.col, head.row, snake.dir, canGo);
  }

  /** A fire-infected snake bites a segment off any snake its head overlaps. */
  private fireBite(snake: Snake): void {
    const head = snake.segments[0];
    for (const other of this.snakes) {
      if (other === snake) continue;
      for (let i = 0; i < other.segments.length; i++) {
        if (other.segments[i].col === head.col && other.segments[i].row === head.row) {
          if (other.kind === 'blue' || i === 0) {
            this.killBlue(other, head.img.x, head.img.y);
          } else {
            this.cutToBlue(other, i, head.img.x, head.img.y);
          }
          return;
        }
      }
    }
  }

  private splitSnake(snake: Snake): void {
    const half = Math.floor(C.SNAKE_SPLIT_LENGTH / 2); // keep front 5, rear → new snake
    const rear = snake.segments.splice(half);
    this.restyleSnake(snake);
    if (rear.length > 0) {
      rear.forEach((seg, i) => seg.img.setTexture(i === 0 ? TX.snakeHead : TX.snakeBody));
      if (this.snakes.length < C.MAX_SNAKES) this.spawnSnake(rear, 'green');
      else rear.forEach((seg) => seg.img.destroy());
    }
  }

  private triggerMine(snake: Snake, key: string): void {
    const img = this.mines.get(key);
    if (img) {
      this.tweens.add({ targets: img, scale: 2, alpha: 0, duration: 160, onComplete: () => img.destroy() });
      this.mines.delete(key);
    }
    this.impact('light');
    if (snake.kind === 'blue') {
      this.killBlue(snake, snake.segments[0].img.x, snake.segments[0].img.y);
      return;
    }
    // Green snake: halve its length (lop off the back half).
    const keep = Math.max(1, Math.ceil(snake.segments.length / 2));
    const removed = snake.segments.splice(keep);
    removed.forEach((seg) => seg.img.destroy());
    this.restyleSnake(snake);
    this.popScore(snake.segments[0].img.x, snake.segments[0].img.y, C.SCORE_MINE_KILL, {
      color: '#ff3030',
      fontSize: '9px',
    });
  }

  private restyleSnake(snake: Snake): void {
    const headTex = snake.kind === 'blue' ? TX.snakeHeadBlue : TX.snakeHead;
    const bodyTex = snake.kind === 'blue' ? TX.snakeBodyBlue : TX.snakeBody;
    snake.segments.forEach((seg, i) => {
      seg.img.setTexture(i === 0 ? headTex : bodyTex).setAngle(i === 0 ? this.angleFor(snake.facing) : 0);
    });
  }

  private snakeBodySet(snake: Snake): Set<string> {
    const set = new Set<string>();
    for (let i = 0; i < snake.segments.length - 1; i++) set.add(`${snake.segments[i].col},${snake.segments[i].row}`);
    return set;
  }

  private awarenessRadius(snake: Snake): number {
    return Math.max(C.AWARENESS_MIN, snake.segments.length * C.AWARENESS_FACTOR);
  }

  private playerInAwareness(snake: Snake): boolean {
    const head = snake.segments[0];
    const pt = this.mover.currentTile();
    return Math.hypot(pt.col - head.col, pt.row - head.row) <= this.awarenessRadius(snake);
  }

  private maybeSpitVenom(snake: Snake): void {
    if (snake.venomCd > 0) return;
    const head = snake.segments[0];
    const pt = this.mover.currentTile();
    const f = snake.facing;
    const onLine =
      (f.x !== 0 && pt.row === head.row && Math.sign(pt.col - head.col) === f.x) ||
      (f.y !== 0 && pt.col === head.col && Math.sign(pt.row - head.row) === f.y);
    if (!onLine) return;
    this.spitVenom(snake);
    snake.venomCd = this.venomCooldown;
  }

  private spitVenom(snake: Snake): void {
    const head = snake.segments[0];
    const type = this.rollVenom();
    const tex = type === 'green' ? TX.venomGreen : type === 'red' ? TX.venomRed : TX.venomBlue;
    const img = this.add.image(head.img.x, head.img.y, tex).setDepth(7);
    this.venoms.push({ img, type, vx: snake.facing.x * C.VENOM_SPEED, vy: snake.facing.y * C.VENOM_SPEED });
  }

  private rollVenom(): VenomType {
    const r = Math.random();
    if (r < C.VENOM_GREEN) return 'green';
    if (r < C.VENOM_GREEN + C.VENOM_RED) return 'red';
    return 'blue';
  }

  private updateVenom(delta: number): void {
    const dt = delta / 1000;
    for (let i = this.venoms.length - 1; i >= 0; i--) {
      const v = this.venoms[i];
      v.img.x += v.vx * dt;
      v.img.y += v.vy * dt;
      const hit =
        this.invulnTimer <= 0 &&
        !this.isBlueForm &&
        Phaser.Math.Distance.Between(v.img.x, v.img.y, this.mover.x, this.mover.y) < C.TILE * 0.7;
      if (hit) {
        this.applyVenom(v.type);
        v.img.destroy();
        this.venoms.splice(i, 1);
        continue;
      }
      if (!this.inWorld(v.img.x, v.img.y)) {
        v.img.destroy();
        this.venoms.splice(i, 1);
      }
    }
  }

  private applyVenom(type: VenomType): void {
    this.effect = type;
    if (type === 'blue') {
      this.effectTimer = C.BLUE_FORM_MS;
      this.ship.setTexture(TX.snakeHeadBlue).clearTint();
    } else {
      this.effectTimer = Phaser.Math.Between(C.EFFECT_MIN_MS, C.EFFECT_MAX_MS);
      this.ship.setTint(type === 'green' ? COLORS.venomGreen : COLORS.venomRed);
    }
  }

  private tickEffect(delta: number): void {
    if (this.effect === 'none') return;
    this.effectTimer -= delta;
    if (this.effectTimer <= 0) {
      if (this.effect === 'blue') this.ship.setTexture(TX.ship);
      this.effect = 'none';
      this.ship.clearTint();
    }
  }

  // --- eggs / pellets / mines --------------------------------------------

  private layEgg(at: Cell): void {
    const img = this.add.image(this.grid.tileToWorldX(at.col), this.grid.tileToWorldY(at.row), TX.egg).setDepth(6);
    this.tweens.add({ targets: img, scale: { from: 0.7, to: 1.1 }, duration: 300, yoyo: true, repeat: -1 });
    this.eggs.push({ col: at.col, row: at.row, img, timer: C.EGG_HATCH_MS });
  }

  private tickEggs(delta: number): void {
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const e = this.eggs[i];
      e.timer -= delta;
      if (e.timer <= 0) {
        e.img.destroy();
        this.eggs.splice(i, 1);
        this.spawnSnake(this.makeSegments(e.col, e.row, { x: 1, y: 0 }, 2, 'blue'), 'blue');
      }
    }
  }

  private tickPellets(delta: number): void {
    this.pelletTimer += delta;
    if (this.pelletTimer >= this.pelletInterval) {
      this.pelletTimer = 0;
      this.pelletInterval = Math.max(C.PELLET_INTERVAL_MIN, this.pelletInterval * C.PELLET_INTERVAL_DECAY);
      if (this.pellets.size < C.PELLET_MAX) this.spawnPellet();
    }
  }

  private spawnPellet(): void {
    const free = this.randomFreeTile();
    if (!free) return;
    const img = this.add
      .image(this.grid.tileToWorldX(free.col), this.grid.tileToWorldY(free.row), TX.pellet)
      .setDepth(5);
    this.tweens.add({ targets: img, scale: { from: 1, to: 0.7 }, duration: 500, yoyo: true, repeat: -1 });
    this.pellets.set(`${free.col},${free.row}`, img);
  }

  private destroyPellet(key: string): void {
    const img = this.pellets.get(key);
    if (img) {
      img.destroy();
      this.pellets.delete(key);
    }
  }

  private randomFreeTile(): Cell | null {
    const occupied = new Set<string>();
    this.snakes.forEach((s) => s.segments.forEach((seg) => occupied.add(`${seg.col},${seg.row}`)));
    this.pellets.forEach((_img, key) => occupied.add(key));
    this.mines.forEach((_img, key) => occupied.add(key));
    for (let attempt = 0; attempt < 60; attempt++) {
      const col = Phaser.Math.Between(1, C.COLS - 2);
      const row = Phaser.Math.Between(C.PLAY_ROW_MIN + 1, C.PLAY_ROW_MAX - 1);
      if (!occupied.has(`${col},${row}`)) return { col, row };
    }
    return null;
  }

  private nearestPelletOrMine(from: Cell): Cell | null {
    let best: Cell | null = null;
    let bestD = Infinity;
    const consider = (key: string): void => {
      const [c, r] = key.split(',').map(Number);
      const d = (c - from.col) ** 2 + (r - from.row) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { col: c, row: r };
      }
    };
    this.pellets.forEach((_i, key) => consider(key));
    this.mines.forEach((_i, key) => consider(key));
    return best;
  }

  private nearestSnakeHead(from: Cell, exclude: Snake): Cell | null {
    let best: Cell | null = null;
    let bestD = Infinity;
    for (const s of this.snakes) {
      if (s === exclude) continue;
      const h = s.segments[0];
      const d = (h.col - from.col) ** 2 + (h.row - from.row) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { col: h.col, row: h.row };
      }
    }
    return best;
  }

  private enrageNearestSnake(): void {
    const pt = this.mover.currentTile();
    let best: Snake | null = null;
    let bestD = Infinity;
    for (const snake of this.snakes) {
      if (snake.kind !== 'green') continue;
      const head = snake.segments[0];
      const d = (head.col - pt.col) ** 2 + (head.row - pt.row) ** 2;
      if (d < bestD) {
        bestD = d;
        best = snake;
      }
    }
    if (best) {
      best.enrageMs = Phaser.Math.Between(C.EFFECT_MIN_MS, C.EFFECT_MAX_MS);
      best.state = 'chase';
      best.loseInterest = C.LOSE_INTEREST_MS;
    }
  }

  // --- powerups -----------------------------------------------------------

  private addMeter(): void {
    this.meterValue += 1;
    if (this.meterValue >= this.meterMax) {
      this.meterValue = 0;
      this.meterMax += C.METER_GROW;
      this.grantPowerup();
    }
  }

  private grantPowerup(): void {
    const r = Math.random();
    let label: string;
    if (r < C.PU_MINE) {
      this.mineCount += 1;
      label = 'MINE  (press X to plant)';
    } else if (r < C.PU_MINE + C.PU_FIRE) {
      this.fireAmmo += C.FIRE_AMMO;
      label = 'FIRE POISON x3';
    } else if (r < C.PU_MINE + C.PU_FIRE + C.PU_ICE) {
      this.iceAmmo += C.ICE_AMMO;
      label = 'ICE POISON x3';
    } else {
      this.spawnWingman();
      label = 'WINGMAN!';
    }
    this.flashBanner(label);
  }

  private flashBanner(text: string): void {
    this.banner.setText(text).setColor('#ffd23c').setAlpha(1).setVisible(true);
    this.tweens.add({ targets: this.banner, alpha: 0, duration: 1400, onComplete: () => this.banner.setVisible(false) });
  }

  private spawnWingman(): void {
    this.wingman?.img.destroy();
    const img = this.add.image(this.mover.x - C.WINGMAN_OFFSET, this.mover.y, TX.wingman).setDepth(10);
    this.wingman = { img, life: C.WINGMAN_MS, fireTimer: 0 };
  }

  private updateWingman(delta: number): void {
    const w = this.wingman;
    if (!w) return;
    w.life -= delta;
    const tx = Phaser.Math.Clamp(this.mover.x - C.WINGMAN_OFFSET, 8, C.WIDTH - 8);
    w.img.x += (tx - w.img.x) * Math.min(1, delta * 0.01);
    w.img.y += (this.mover.y - w.img.y) * Math.min(1, delta * 0.01);
    w.fireTimer -= delta;
    if (w.fireTimer <= 0 && this.snakes.length > 0) {
      w.fireTimer = C.WINGMAN_FIRE_MS;
      this.wingmanFire(w);
    }
    if (w.life <= 0) {
      w.img.destroy();
      this.wingman = undefined;
    }
  }

  private wingmanFire(w: Wingman): void {
    const target = this.nearestSnakeHead({ col: this.grid.worldToCol(w.img.x), row: this.grid.worldToRow(w.img.y) }, {} as Snake);
    if (!target) return;
    const dx = this.grid.tileToWorldX(target.col) - w.img.x;
    const dy = this.grid.tileToWorldY(target.row) - w.img.y;
    const len = Math.hypot(dx, dy) || 1;
    const img = this.add.image(w.img.x, w.img.y, TX.bullet).setDepth(9).setTint(COLORS.wingHull);
    this.bullets.push({ img, vx: (dx / len) * C.BULLET_SPEED, vy: (dy / len) * C.BULLET_SPEED, kind: 'normal' });
  }

  // --- collisions / damage -----------------------------------------------

  private checkSnakeContact(): boolean {
    if (this.invulnTimer > 0 || this.isBlueForm) return false;
    const pt = this.mover.currentTile();
    for (const snake of this.snakes) {
      const head = snake.segments[0];
      if (head.col === pt.col && head.row === pt.row) return true;
    }
    return false;
  }

  private playerHit(): void {
    this.impact('heavy');
    this.audio.play('death');
    if (this.effect === 'blue') this.ship.setTexture(TX.ship);
    this.effect = 'none';
    this.ship.clearTint();
    if (this.lives.lose() <= 0) {
      this.flow.transition('gameover');
      return;
    }
    this.refreshLives();
    this.mover.teleport(this.grid.tileToWorldX(Math.floor(C.COLS / 2)), this.grid.tileToWorldY(C.PLAY_ROW_MAX - 4));
    this.mover.stop();
    this.facing = { x: 0, y: -1 };
    this.invulnTimer = C.RESPAWN_INVULN_MS;
  }

  // --- endless flow -------------------------------------------------------

  private tickRamp(delta: number): void {
    this.rampTimer += delta;
    if (this.rampTimer >= C.RAMP_INTERVAL_MS) {
      this.rampTimer -= C.RAMP_INTERVAL_MS;
      this.snakeBaseStep = Math.max(C.SNAKE_MIN_STEP_MS, this.snakeBaseStep * C.RAMP_STEP_FACTOR);
      this.venomCooldown = Math.max(C.VENOM_COOLDOWN_MIN, this.venomCooldown * C.RAMP_VENOM_FACTOR);
    }
  }

  private tickSurvival(delta: number): void {
    this.surviveAcc += delta;
    if (this.surviveAcc >= 1000) {
      this.surviveAcc -= 1000;
      this.addScore(C.SCORE_SURVIVE_PER_SEC);
    }
    if (this.scores.score >= this.nextExtraLife) {
      this.nextExtraLife += C.EXTRA_LIFE_AT;
      this.lives.gain(1);
      this.refreshLives();
    }
  }

  private maybeRespawnSnake(delta: number): void {
    if (this.snakes.length > 0) {
      this.snakeRespawnTimer = C.SNAKE_RESPAWN_MS;
      return;
    }
    this.snakeRespawnTimer -= delta;
    if (this.snakeRespawnTimer <= 0) {
      this.snakeRespawnTimer = C.SNAKE_RESPAWN_MS;
      this.spawnSnake(
        this.makeSegments(Math.floor(C.COLS / 2), C.PLAY_ROW_MIN + 4, { x: 1, y: 0 }, C.SNAKE_START_LENGTH, 'green'),
        'green',
      );
    }
  }

  private enterGameOver(): void {
    this.banner.setText('GAME OVER').setColor('#e23c3c').setAlpha(1).setVisible(true);
    this.ship.setVisible(false);
    this.time.delayedCall(C.GAMEOVER_MS, () => this.scene.restart());
  }

  // --- rendering ----------------------------------------------------------

  private drawArena(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(COLORS.bg, 1).fillRect(0, 0, C.WIDTH, C.HEIGHT);
    g.lineStyle(1, COLORS.gridLine, 1);
    const top = C.PLAY_ROW_MIN * C.TILE;
    const bottom = (C.PLAY_ROW_MAX + 1) * C.TILE;
    for (let c = 0; c <= C.COLS; c++) g.lineBetween(c * C.TILE, top, c * C.TILE, bottom);
    for (let r = C.PLAY_ROW_MIN; r <= C.PLAY_ROW_MAX + 1; r++) g.lineBetween(0, r * C.TILE, C.WIDTH, r * C.TILE);
  }

  private drawAwareness(): void {
    this.awarenessGfx.clear();
    for (const snake of this.snakes) {
      if (snake.kind !== 'green') continue;
      const head = snake.segments[0];
      const color = snake.state === 'chase' ? COLORS.eyeRed : COLORS.headGreen;
      this.awarenessGfx.lineStyle(1, color, 0.22);
      this.awarenessGfx.strokeCircle(head.img.x, head.img.y, this.awarenessRadius(snake) * C.TILE);
    }
  }

  private drawMeter(): void {
    const g = this.meterGfx;
    g.clear();
    const w = 80;
    const x = (C.WIDTH - w) / 2;
    const y = 13;
    g.fillStyle(COLORS.meterBg, 1).fillRect(x, y, w, 3);
    g.fillStyle(COLORS.meterFill, 1).fillRect(x, y, (w * this.meterValue) / this.meterMax, 3);

    const parts: string[] = [];
    if (this.mineCount > 0) parts.push(`M${this.mineCount}`);
    if (this.fireAmmo > 0) parts.push(`F${this.fireAmmo}`);
    if (this.iceAmmo > 0) parts.push(`I${this.iceAmmo}`);
    this.itemText.setText(parts.join(' '));
  }

  private refreshLives(): void {
    this.lifeIcons.forEach((i) => i.destroy());
    this.lifeIcons = [];
    for (let i = 0; i < this.lives.count; i++) {
      this.lifeIcons.push(this.add.image(10 + i * 12, C.HEIGHT - 7, TX.ship).setScale(0.7).setDepth(1000));
    }
  }

  // --- utils --------------------------------------------------------------

  private inArena(col: number, row: number): boolean {
    return col >= 0 && col < C.COLS && row >= C.PLAY_ROW_MIN && row <= C.PLAY_ROW_MAX;
  }

  private inWorld(x: number, y: number): boolean {
    return x >= -C.TILE && x <= C.WIDTH + C.TILE && y >= 0 && y <= C.HEIGHT + C.TILE;
  }

  private angleFor(dir: Vec2): number {
    if (dir.x === 1) return 90;
    if (dir.x === -1) return 270;
    if (dir.y === 1) return 180;
    return 0;
  }
}
