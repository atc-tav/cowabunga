import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { Grid } from '../../shared/Grid';
import { GridMover, Vec2 } from '../../shared/GridMover';
import { LivesManager } from '../../shared/LivesManager';
import { StateMachine } from '../../shared/StateMachine';
import { chooseDirectionToward, chooseRandomDirection } from '../../shared/gridAI';
import { LABEL_STYLE } from '../../shared/ui';
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

interface Snake {
  segments: Segment[]; // head first
  dir: Vec2;
  facing: Vec2;
  hp: number;
  state: 'forage' | 'chase';
  stepAcc: number;
  enrageMs: number; // >0 = enraged 2x chase
  loseInterest: number;
  venomCd: number;
}

interface Severed {
  segments: Segment[];
  mode: 'decay' | 'chase';
  timer: number;
  stepAcc: number;
}

type VenomType = 'green' | 'red' | 'black';

interface Projectile {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
}

interface Venom extends Projectile {
  type: VenomType;
}

type PlayerEffect = 'none' | 'paralyze' | 'insane';

/**
 * HYDRA — Snake, inverted. The antagonist is an AI playing classic Snake
 * (foraging pellets, growing); the player pilots a ship hunting it. First
 * playable slice implementing the spec core: grid arena, ship + smoke trail,
 * foraging/chasing snake with awareness radius and line-of-sight venom,
 * head-HP vs. tail-length health, the tail-severing mechanic (incl. cut pieces
 * that become new snakes), venom status effects, lives, scoring, and an endless
 * difficulty ramp. See specs/hydra-original.md.
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
  private severed: Severed[] = [];
  private bullets: Projectile[] = [];
  private venoms: Venom[] = [];
  private pellets = new Map<string, Phaser.GameObjects.Image>();
  private awarenessGfx!: Phaser.GameObjects.Graphics;

  private effect: PlayerEffect = 'none';
  private effectTimer = 0;
  private invulnTimer = 0;

  private snakeBaseStep = C.SNAKE_BASE_STEP_MS;
  private venomCooldown = C.VENOM_COOLDOWN_MS;
  private rampTimer = 0;
  private snakeRespawnTimer = 0;
  private surviveAcc = 0;
  private nextExtraLife = C.EXTRA_LIFE_AT;

  private banner!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'game-hydra', gameId: 'hydra', width: C.WIDTH, height: C.HEIGHT });
  }

  protected createGame(): void {
    buildHydraTextures(this);
    this.resetState();

    this.grid = new Grid([], C.TILE, 0, 0);
    this.drawArena();
    this.awarenessGfx = this.add.graphics().setDepth(2);

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

    this.spawnSnake(this.makeSegments(Math.floor(C.COLS / 2), 12, { x: 1, y: 0 }, C.SNAKE_START_LENGTH));
    for (let i = 0; i < C.PELLET_COUNT; i++) {
      this.spawnPellet();
    }

    this.banner = this.add
      .text(C.WIDTH / 2, C.HEIGHT / 2, '', LABEL_STYLE)
      .setOrigin(0.5)
      .setDepth(1000)
      .setVisible(false);

    this.flow = new StateMachine<HydraScene>(this)
      .add('play', { update: (_c, dt) => this.updatePlay(dt) })
      .add('gameover', { enter: () => this.enterGameOver() });
    this.flow.transition('play');
  }

  protected updateGame(_time: number, delta: number): void {
    this.flow.update(delta);
  }

  // --- state reset --------------------------------------------------------

  private resetState(): void {
    this.snakes.forEach((s) => s.segments.forEach((seg) => seg.img.destroy()));
    this.severed.forEach((p) => p.segments.forEach((seg) => seg.img.destroy()));
    this.bullets.forEach((b) => b.img.destroy());
    this.venoms.forEach((v) => v.img.destroy());
    this.pellets.forEach((p) => p.destroy());
    this.lifeIcons.forEach((i) => i.destroy());
    this.snakes = [];
    this.severed = [];
    this.bullets = [];
    this.venoms = [];
    this.pellets.clear();
    this.lifeIcons = [];
    this.effect = 'none';
    this.effectTimer = 0;
    this.invulnTimer = 0;
    this.facing = { x: 0, y: -1 };
    this.snakeBaseStep = C.SNAKE_BASE_STEP_MS;
    this.venomCooldown = C.VENOM_COOLDOWN_MS;
    this.rampTimer = 0;
    this.snakeRespawnTimer = 0;
    this.surviveAcc = 0;
    this.nextExtraLife = C.EXTRA_LIFE_AT;
  }

  // --- main update --------------------------------------------------------

  private updatePlay(delta: number): void {
    this.tickRamp(delta);
    this.tickSurvival(delta);
    this.tickEffect(delta);
    if (this.invulnTimer > 0) {
      this.invulnTimer -= delta;
      this.ship.setAlpha(Math.floor(this.invulnTimer / 80) % 2 ? 0.3 : 1);
      if (this.invulnTimer <= 0) this.ship.setAlpha(1);
    }

    this.updatePlayer(delta);
    this.checkPlayerPelletPickup();
    this.updateBullets(delta);
    for (const snake of this.snakes) this.updateSnake(snake, delta);
    this.updateSevered(delta);
    this.updateVenom(delta);
    this.drawAwareness();

    if (this.checkSnakeContact()) {
      this.playerHit('eaten');
    }
    this.maybeRespawnSnake(delta);
  }

  // --- player -------------------------------------------------------------

  private updatePlayer(delta: number): void {
    const insane = this.effect === 'insane';
    this.mover.setSpeed(insane ? C.PLAYER_SPEED * C.INSANITY_SPEED_MULT : C.PLAYER_SPEED);

    if (this.effect === 'paralyze') {
      this.mover.stop();
    } else {
      let dx = 0;
      let dy = 0;
      if (this.controls.isDown('left')) dx = -1;
      else if (this.controls.isDown('right')) dx = 1;
      else if (this.controls.isDown('up')) dy = -1;
      else if (this.controls.isDown('down')) dy = 1;
      if (insane) {
        dx = -dx;
        dy = -dy;
      }
      this.mover.setDesired(dx, dy);
      this.mover.update(delta);
      if (this.mover.dir.x !== 0 || this.mover.dir.y !== 0) {
        this.facing = { ...this.mover.dir };
        this.emitSmoke();
      }
    }

    this.ship.setPosition(this.mover.x, this.mover.y);
    this.ship.setAngle(this.angleFor(this.facing));

    // Firing uses facing, works while stopped; disabled while paralyzed.
    if (
      this.effect !== 'paralyze' &&
      this.controls.justPressed('fire') &&
      this.bullets.length < C.MAX_BULLETS
    ) {
      this.fireBullet();
    }
  }

  private emitSmoke(): void {
    const puff = this.add
      .image(this.mover.x, this.mover.y, TX.smoke)
      .setDepth(4)
      .setAlpha(0.5);
    this.tweens.add({
      targets: puff,
      alpha: 0,
      scale: 0.4,
      duration: C.SMOKE_FADE_MS,
      onComplete: () => puff.destroy(),
    });
  }

  private fireBullet(): void {
    this.audio.play('shoot');
    const img = this.add.image(this.mover.x, this.mover.y, TX.bullet).setDepth(9);
    this.bullets.push({
      img,
      vx: this.facing.x * C.BULLET_SPEED,
      vy: this.facing.y * C.BULLET_SPEED,
    });
  }

  private updateBullets(delta: number): void {
    const dt = delta / 1000;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.img.x += b.vx * dt;
      b.img.y += b.vy * dt;
      // Bullets fly until they leave the screen or hit something.
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

  /** Returns true if the bullet was consumed by a hit. */
  private resolveBulletHit(b: Projectile): boolean {
    const col = this.grid.worldToCol(b.img.x);
    const row = this.grid.worldToRow(b.img.y);
    const dir: Vec2 = {
      x: Math.sign(b.vx),
      y: Math.sign(b.vy),
    };

    // Pellet?
    const pkey = `${col},${row}`;
    if (this.pellets.has(pkey)) {
      this.consumePelletAsPlayer(pkey, b.img.x, b.img.y);
      return true;
    }

    // Snakes (head then body).
    for (const snake of this.snakes) {
      const head = snake.segments[0];
      if (head.col === col && head.row === row) {
        this.hitHead(snake, b.img.x, b.img.y);
        return true;
      }
      for (let i = 1; i < snake.segments.length; i++) {
        const seg = snake.segments[i];
        if (seg.col === col && seg.row === row) {
          this.severSnake(snake, i, dir, b.img.x, b.img.y);
          return true;
        }
      }
    }
    return false;
  }

  private hitHead(snake: Snake, x: number, y: number): void {
    // Dodge chance if the shot lands while the player is in the snake's radius.
    if (this.playerInAwareness(snake) && Math.random() < C.DODGE_CHANCE) {
      return; // dodged — bullet still consumed by the caller
    }
    snake.hp -= 1;
    this.popScore(x, y, C.SCORE_HEAD_HIT, { color: '#ffffff', fontSize: '8px' });
    this.flashSnake(snake);
    if (snake.hp <= 0) {
      this.killSnake(snake);
    }
  }

  private flashSnake(snake: Snake): void {
    snake.segments.forEach((seg) => {
      this.tweens.add({ targets: seg.img, alpha: 0.2, duration: 60, yoyo: true });
    });
  }

  private killSnake(snake: Snake): void {
    this.impact('medium');
    const head = snake.segments[0];
    this.popScore(head.img.x, head.img.y, C.SCORE_SNAKE_KILL, { color: '#5ec43a', fontSize: '10px' });
    snake.segments.forEach((seg) => seg.img.destroy());
    this.snakes = this.snakes.filter((s) => s !== snake);
  }

  // --- severing -----------------------------------------------------------

  private severSnake(snake: Snake, index: number, bulletDir: Vec2, x: number, y: number): void {
    const localDir = this.segmentAxis(snake, index);
    const parallel =
      (localDir.x !== 0 && bulletDir.x !== 0) || (localDir.y !== 0 && bulletDir.y !== 0);

    if (parallel) {
      // From behind / along the body axis: clean removal of this segment back.
      const removed = snake.segments.splice(index);
      removed.forEach((seg) => seg.img.destroy());
      this.popScore(x, y, C.SCORE_TAIL_SEGMENT * removed.length, { color: '#9be86a', fontSize: '8px' });
      return;
    }

    // From the side: a cut. The struck segment is destroyed; the rear becomes a
    // severed piece whose fate depends on its length vs. the main snake's
    // REMAINING (head-side) length after the cut.
    const rear = snake.segments.splice(index); // [struck, ...rear]
    const struck = rear.shift();
    struck?.img.destroy();
    const frontLen = snake.segments.length; // head-side portion that remains
    this.popScore(x, y, C.SCORE_CUT, { color: '#e23c3c', fontSize: '9px' });
    this.impact('light');
    this.spawnSevered(rear, frontLen);
  }

  /** Local body direction at a segment (vector toward the head side). */
  private segmentAxis(snake: Snake, index: number): Vec2 {
    const a = snake.segments[index];
    const b = snake.segments[index - 1] ?? a;
    return { x: Math.sign(b.col - a.col), y: Math.sign(b.row - a.row) };
  }

  private spawnSevered(rear: Segment[], mainLen: number): void {
    const len = rear.length;
    if (len === 0) {
      return;
    }
    if (len >= mainLen && this.snakes.length < C.MAX_SNAKES) {
      // Long enough: it becomes a new snake.
      rear.forEach((seg) => seg.img.setTexture(TX.snakeBody));
      this.spawnSnakeFromSegments(rear);
      return;
    }
    if (len >= 3) {
      this.severed.push({ segments: rear, mode: 'chase', timer: C.SEVER_3_MS, stepAcc: 0 });
      return;
    }
    const timer = len === 2 ? C.SEVER_2_MS : C.SEVER_1_MS;
    this.severed.push({ segments: rear, mode: 'decay', timer, stepAcc: 0 });
  }

  private updateSevered(delta: number): void {
    for (let i = this.severed.length - 1; i >= 0; i--) {
      const p = this.severed[i];
      p.timer -= delta;
      if (p.mode === 'chase') {
        p.stepAcc += delta;
        const step = this.snakeBaseStep / C.ENRAGE_SPEED_MULT;
        if (p.stepAcc >= step) {
          p.stepAcc -= step;
          this.translateSevered(p);
        }
      } else {
        const a = Phaser.Math.Clamp(p.timer / C.SEVER_2_MS, 0.25, 1);
        p.segments.forEach((seg) => seg.img.setAlpha(a));
      }
      if (this.severedTouchesPlayer(p)) {
        this.playerHit('eaten');
      }
      if (p.timer <= 0) {
        p.segments.forEach((seg) => seg.img.destroy());
        this.severed.splice(i, 1);
      }
    }
  }

  /** Move a severed chase-piece one tile toward the player, as a rigid blob. */
  private translateSevered(p: Severed): void {
    const head = p.segments[0];
    const pt = this.mover.currentTile();
    const dir = chooseDirectionToward(
      head.col,
      head.row,
      { x: 0, y: 0 },
      pt.col,
      pt.row,
      (col, row) => this.inArena(col, row),
    );
    if (dir.x === 0 && dir.y === 0) {
      return;
    }
    for (const seg of p.segments) {
      seg.col = Phaser.Math.Clamp(seg.col + dir.x, 0, C.COLS - 1);
      seg.row = Phaser.Math.Clamp(seg.row + dir.y, C.PLAY_ROW_MIN, C.PLAY_ROW_MAX);
      seg.img.setPosition(this.grid.tileToWorldX(seg.col), this.grid.tileToWorldY(seg.row));
    }
  }

  // --- snakes -------------------------------------------------------------

  private makeSegments(col: number, row: number, dir: Vec2, len: number): Segment[] {
    const segs: Segment[] = [];
    for (let i = 0; i < len; i++) {
      const c = col - dir.x * i;
      const r = row - dir.y * i;
      const img = this.add
        .image(this.grid.tileToWorldX(c), this.grid.tileToWorldY(r), i === 0 ? TX.snakeHead : TX.snakeBody)
        .setDepth(8);
      segs.push({ col: c, row: r, img });
    }
    return segs;
  }

  private spawnSnake(segments: Segment[]): void {
    const head = segments[0];
    const dir = { x: Math.sign(head.col - (segments[1]?.col ?? head.col - 1)), y: 0 };
    this.snakes.push({
      segments,
      dir: dir.x === 0 && dir.y === 0 ? { x: 1, y: 0 } : dir,
      facing: { x: 1, y: 0 },
      hp: C.SNAKE_HP,
      state: 'forage',
      stepAcc: 0,
      enrageMs: 0,
      loseInterest: 0,
      venomCd: 0,
    });
  }

  private spawnSnakeFromSegments(segments: Segment[]): void {
    segments[0].img.setTexture(TX.snakeHead);
    this.spawnSnake(segments);
  }

  private updateSnake(snake: Snake, delta: number): void {
    if (snake.enrageMs > 0) snake.enrageMs -= delta;
    if (snake.venomCd > 0) snake.venomCd -= delta;

    // Awareness → chase / forage.
    const inRadius = this.playerInAwareness(snake);
    if (inRadius) {
      snake.state = 'chase';
      snake.loseInterest = C.LOSE_INTEREST_MS;
    } else if (snake.state === 'chase') {
      snake.loseInterest -= delta;
      if (snake.loseInterest <= 0) snake.state = 'forage';
    }

    this.maybeSpitVenom(snake);

    const enraged = snake.enrageMs > 0;
    const step = enraged ? this.snakeBaseStep / C.ENRAGE_SPEED_MULT : this.snakeBaseStep;
    snake.stepAcc += delta;
    if (snake.stepAcc >= step) {
      snake.stepAcc -= step;
      this.stepSnake(snake, enraged || snake.state === 'chase');
    }
  }

  private stepSnake(snake: Snake, chasing: boolean): void {
    const head = snake.segments[0];
    const blocked = this.snakeBodySet(snake);

    const canGo = (col: number, row: number): boolean =>
      this.inArena(col, row) && !blocked.has(`${col},${row}`);

    let dir: Vec2;
    if (chasing) {
      const pt = this.mover.currentTile();
      dir = chooseDirectionToward(head.col, head.row, snake.dir, pt.col, pt.row, canGo);
    } else {
      const target = this.nearestPellet(head);
      dir = target
        ? chooseDirectionToward(head.col, head.row, snake.dir, target.col, target.row, canGo)
        : chooseRandomDirection(head.col, head.row, snake.dir, canGo);
    }
    if (dir.x === 0 && dir.y === 0) {
      return; // boxed in this tick
    }
    snake.dir = dir;
    snake.facing = dir;

    const next: Cell = { col: head.col + dir.x, row: head.row + dir.y };
    const pkey = `${next.col},${next.row}`;
    const ate = this.pellets.has(pkey);
    if (ate) {
      this.destroyPellet(pkey);
      this.time.delayedCall(C.PELLET_RESPAWN_MS, () => this.spawnPellet());
    }

    if (ate) {
      // Grow: new head segment, keep the tail.
      const img = this.add
        .image(this.grid.tileToWorldX(next.col), this.grid.tileToWorldY(next.row), TX.snakeHead)
        .setDepth(8);
      snake.segments.unshift({ col: next.col, row: next.row, img });
    } else {
      // Recycle the tail as the new head.
      const tail = snake.segments.pop();
      if (!tail) return;
      tail.col = next.col;
      tail.row = next.row;
      tail.img.setPosition(this.grid.tileToWorldX(next.col), this.grid.tileToWorldY(next.row));
      snake.segments.unshift(tail);
    }
    this.restyleSnake(snake);
  }

  /** Head gets the head texture + rotation; everything else is body. */
  private restyleSnake(snake: Snake): void {
    snake.segments.forEach((seg, i) => {
      if (i === 0) {
        seg.img.setTexture(TX.snakeHead).setAngle(this.angleFor(snake.facing));
      } else {
        seg.img.setTexture(TX.snakeBody).setAngle(0);
      }
    });
  }

  private snakeBodySet(snake: Snake): Set<string> {
    // The tail tile will be vacated this step, so it's enterable.
    const set = new Set<string>();
    for (let i = 0; i < snake.segments.length - 1; i++) {
      const s = snake.segments[i];
      set.add(`${s.col},${s.row}`);
    }
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
    if (snake.venomCd > 0) {
      return;
    }
    const head = snake.segments[0];
    const pt = this.mover.currentTile();
    const f = snake.facing;
    // Player must be on the straight line ahead, within venom range.
    // Fire if the player is anywhere on the straight line directly ahead — the
    // venom travels the full screen, so there's no range cap on detection.
    const onLine =
      (f.x !== 0 && pt.row === head.row && Math.sign(pt.col - head.col) === f.x) ||
      (f.y !== 0 && pt.col === head.col && Math.sign(pt.row - head.row) === f.y);
    if (!onLine) {
      return;
    }
    this.spitVenom(snake);
    snake.venomCd = this.venomCooldown;
  }

  private spitVenom(snake: Snake): void {
    const head = snake.segments[0];
    const type = this.rollVenom();
    const tex = type === 'green' ? TX.venomGreen : type === 'red' ? TX.venomRed : TX.venomBlack;
    const img = this.add
      .image(head.img.x, head.img.y, tex)
      .setDepth(7);
    this.venoms.push({
      img,
      type,
      vx: snake.facing.x * C.VENOM_SPEED,
      vy: snake.facing.y * C.VENOM_SPEED,
    });
  }

  private rollVenom(): VenomType {
    const r = Math.random();
    if (r < C.VENOM_GREEN) return 'green';
    if (r < C.VENOM_GREEN + C.VENOM_RED) return 'red';
    return 'black';
  }

  private updateVenom(delta: number): void {
    const dt = delta / 1000;
    for (let i = this.venoms.length - 1; i >= 0; i--) {
      const v = this.venoms[i];
      v.img.x += v.vx * dt;
      v.img.y += v.vy * dt;
      const hit =
        this.invulnTimer <= 0 &&
        Phaser.Math.Distance.Between(v.img.x, v.img.y, this.mover.x, this.mover.y) < C.TILE * 0.7;
      if (hit) {
        this.applyVenom(v.type);
        v.img.destroy();
        this.venoms.splice(i, 1);
        continue;
      }
      // Venom flies until it leaves the screen.
      if (!this.inWorld(v.img.x, v.img.y)) {
        v.img.destroy();
        this.venoms.splice(i, 1);
      }
    }
  }

  private applyVenom(type: VenomType): void {
    if (type === 'black') {
      this.playerHit('poison');
      return;
    }
    this.effect = type === 'green' ? 'paralyze' : 'insane';
    this.effectTimer = Phaser.Math.Between(C.EFFECT_MIN_MS, C.EFFECT_MAX_MS);
    this.ship.setTint(type === 'green' ? COLORS.venomGreen : COLORS.venomRed);
  }

  private tickEffect(delta: number): void {
    if (this.effect === 'none') {
      return;
    }
    this.effectTimer -= delta;
    if (this.effectTimer <= 0) {
      this.effect = 'none';
      this.ship.clearTint();
    }
  }

  // --- pellets ------------------------------------------------------------

  private spawnPellet(): void {
    if (this.pellets.size >= C.PELLET_COUNT) {
      return;
    }
    const free = this.randomFreeTile();
    if (!free) {
      return;
    }
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

  /** The player driving over a pellet eats it — identical effect to shooting it. */
  private checkPlayerPelletPickup(): void {
    const pt = this.mover.currentTile();
    const key = `${pt.col},${pt.row}`;
    if (this.pellets.has(key)) {
      this.consumePelletAsPlayer(key, this.mover.x, this.mover.y);
    }
  }

  /** Shared "player removed a pellet" path: deny the snake, enrage it, respawn. */
  private consumePelletAsPlayer(key: string, x: number, y: number): void {
    this.destroyPellet(key);
    this.popScore(x, y, C.SCORE_PELLET_DENIED, { color: '#ffd23c', fontSize: '8px' });
    this.enrageNearestSnake();
    this.time.delayedCall(C.PELLET_RESPAWN_MS, () => this.spawnPellet());
  }

  private randomFreeTile(): Cell | null {
    const occupied = new Set<string>();
    this.snakes.forEach((s) => s.segments.forEach((seg) => occupied.add(`${seg.col},${seg.row}`)));
    this.pellets.forEach((_img, key) => occupied.add(key));
    for (let attempt = 0; attempt < 60; attempt++) {
      const col = Phaser.Math.Between(1, C.COLS - 2);
      const row = Phaser.Math.Between(C.PLAY_ROW_MIN + 1, C.PLAY_ROW_MAX - 1);
      if (!occupied.has(`${col},${row}`)) {
        return { col, row };
      }
    }
    return null;
  }

  private nearestPellet(from: Cell): Cell | null {
    let best: Cell | null = null;
    let bestD = Infinity;
    this.pellets.forEach((_img, key) => {
      const [c, r] = key.split(',').map(Number);
      const d = (c - from.col) ** 2 + (r - from.row) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { col: c, row: r };
      }
    });
    return best;
  }

  private enrageNearestSnake(): void {
    const pt = this.mover.currentTile();
    let best: Snake | null = null;
    let bestD = Infinity;
    for (const snake of this.snakes) {
      const head = snake.segments[0];
      const d = (head.col - pt.col) ** 2 + (head.row - pt.row) ** 2;
      if (d < bestD) {
        bestD = d;
        best = snake;
      }
    }
    if (best) {
      (best as Snake).enrageMs = Phaser.Math.Between(C.EFFECT_MIN_MS, C.EFFECT_MAX_MS);
      (best as Snake).state = 'chase';
      (best as Snake).loseInterest = C.LOSE_INTEREST_MS;
    }
  }

  // --- collisions & damage ------------------------------------------------

  private checkSnakeContact(): boolean {
    if (this.invulnTimer > 0) {
      return false;
    }
    const pt = this.mover.currentTile();
    for (const snake of this.snakes) {
      const head = snake.segments[0];
      if (head.col === pt.col && head.row === pt.row) {
        return true;
      }
    }
    return false;
  }

  private severedTouchesPlayer(p: Severed): boolean {
    if (this.invulnTimer > 0) {
      return false;
    }
    const pt = this.mover.currentTile();
    return p.segments.some((seg) => seg.col === pt.col && seg.row === pt.row);
  }

  private playerHit(_cause: 'eaten' | 'poison'): void {
    this.impact('heavy');
    this.audio.play('death');
    this.effect = 'none';
    this.ship.clearTint();
    if (this.lives.lose() <= 0) {
      this.flow.transition('gameover');
      return;
    }
    this.refreshLives();
    this.respawnPlayer();
  }

  private respawnPlayer(): void {
    this.mover.teleport(
      this.grid.tileToWorldX(Math.floor(C.COLS / 2)),
      this.grid.tileToWorldY(C.PLAY_ROW_MAX - 4),
    );
    this.mover.stop();
    this.facing = { x: 0, y: -1 };
    this.invulnTimer = C.RESPAWN_INVULN_MS;
  }

  // --- endless flow: ramp, survival, respawn ------------------------------

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
        this.makeSegments(Math.floor(C.COLS / 2), C.PLAY_ROW_MIN + 4, { x: 1, y: 0 }, C.SNAKE_START_LENGTH),
      );
    }
  }

  private enterGameOver(): void {
    this.banner.setText('GAME OVER').setColor('#e23c3c').setVisible(true);
    this.ship.setVisible(false);
    this.time.delayedCall(C.GAMEOVER_MS, () => this.scene.restart());
  }

  // --- rendering helpers --------------------------------------------------

  private drawArena(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(COLORS.bg, 1).fillRect(0, 0, C.WIDTH, C.HEIGHT);
    g.lineStyle(1, COLORS.gridLine, 1);
    const top = C.PLAY_ROW_MIN * C.TILE;
    const bottom = (C.PLAY_ROW_MAX + 1) * C.TILE;
    for (let c = 0; c <= C.COLS; c++) {
      g.lineBetween(c * C.TILE, top, c * C.TILE, bottom);
    }
    for (let r = C.PLAY_ROW_MIN; r <= C.PLAY_ROW_MAX + 1; r++) {
      g.lineBetween(0, r * C.TILE, C.WIDTH, r * C.TILE);
    }
  }

  private drawAwareness(): void {
    this.awarenessGfx.clear();
    for (const snake of this.snakes) {
      const head = snake.segments[0];
      const radius = this.awarenessRadius(snake) * C.TILE;
      const color = snake.state === 'chase' ? COLORS.eyeRed : COLORS.headGreen;
      this.awarenessGfx.lineStyle(1, color, 0.25);
      this.awarenessGfx.strokeCircle(head.img.x, head.img.y, radius);
    }
  }

  private refreshLives(): void {
    this.lifeIcons.forEach((i) => i.destroy());
    this.lifeIcons = [];
    for (let i = 0; i < this.lives.count; i++) {
      this.lifeIcons.push(
        this.add.image(10 + i * 12, C.HEIGHT - 7, TX.ship).setScale(0.7).setDepth(1000),
      );
    }
  }

  // --- small utils --------------------------------------------------------

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
    return 0; // up
  }
}
