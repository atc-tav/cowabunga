import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { PlatformSegment, surfaceY } from '../../shared/Platformer';
import { StateMachine } from '../../shared/StateMachine';
import {
  InputManager,
  PLAYER_ONE_KEYS,
  PLAYER_TWO_KEYS,
} from '../../shared/InputManager';
import { LABEL_STYLE, HINT_STYLE, TITLE_STYLE } from '../../shared/ui';
import { floatingText } from '../../shared/popups';
import {
  WIDTH,
  HEIGHT,
  PLATFORM_THICKNESS,
  BUMP_AMP,
  BUMP_RECOVER,
  SHELL_STUN_MS,
  SHELL_STOP_WAKE_MS,
  SHELL_BUMP_HOP,
  STOMP_BOUNCE,
  ENEMY_TARGET,
  SPAWN_STAGGER_MS,
  PHASE_INTRO_MS,
  LOOP_SPEED_STEP,
  READY_MS,
  GAMEOVER_MS,
  POW_USES,
  POW_W,
  POW_H,
  GameMode,
} from './constants';
import { COLORS } from './palette';
import { buildMarioBrosTextures, TX } from './sprites';
import { FLOORS, PIPES, POW, MARIO_START, LUIGI_START, topPipeSpawns, bottomPipeZones } from './levels';
import { Enemy, EnemyKind, EnemyKindId, KINDS } from './enemies';
import { PHASES } from './phases';
import { Player } from './player';

interface Floor {
  seg: PlatformSegment;
  nudge: number;
}

const P1_COLOR = '#ff5030';
const P2_COLOR = '#30d030';

const MODES: { mode: GameMode; label: string }[] = [
  { mode: 'solo', label: '1 PLAYER' },
  { mode: 'coop', label: '2 PLAYERS - CO-OP' },
  { mode: 'versus', label: '2 PLAYERS - VERSUS' },
];

/**
 * Mario Bros. — the single-screen battle. Turtles, crabs and flies climb out of
 * the pipes; bump the floor beneath one to flip it, then kick it away. Supports
 * solo, two-player co-op (you can't hurt each other) and versus (bump your
 * rival off their feet; highest score wins).
 */
export class MarioBrosScene extends BaseGameScene {
  private floors: Floor[] = [];
  private groundSeg!: PlatformSegment;
  private platformGfx!: Phaser.GameObjects.Graphics;

  private flow!: StateMachine<MarioBrosScene>;
  private banner!: Phaser.GameObjects.Text;
  private readyTimer = 0;

  private mode: GameMode = 'solo';
  private players: Player[] = [];
  private p1Controls!: InputManager;
  private p2Controls!: InputManager;

  private selectIndex = 0;
  private selectGfx: Phaser.GameObjects.Text[] = [];
  private titleText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private panelGfx!: Phaser.GameObjects.Graphics;
  private blinkTimer = 0;
  private demoSpawnTimer = 0;
  private demoKindIdx = 0;
  private hudTexts: Phaser.GameObjects.Text[] = [];
  private hiText!: Phaser.GameObjects.Text;
  private readonly lifeIcons: Phaser.GameObjects.Image[] = [];

  private readonly enemies: Enemy[] = [];
  private spawnTimer = 0;
  private spawnQueue: EnemyKindId[] = [];
  private pipeToggle = 0;
  private phaseIndex = 0;
  private loopCount = 0;
  private phaseTimer = 0;
  private phaseText!: Phaser.GameObjects.Text;

  private powUses = POW_USES;
  private powSeg!: PlatformSegment;
  private powGfx!: Phaser.GameObjects.Graphics;
  private powText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'game-mariobros', gameId: 'mariobros', width: WIDTH, height: HEIGHT });
  }

  protected createGame(): void {
    buildMarioBrosTextures(this);
    this.showDefaultHud(false);

    this.floors = FLOORS.map((f) => ({ seg: { ...f, thickness: PLATFORM_THICKNESS }, nudge: 0 }));
    this.groundSeg = this.floors.find((f) => f.seg.x1 === 0 && f.seg.x2 === WIDTH)!.seg;
    this.drawStatics();
    this.platformGfx = this.add.graphics().setDepth(1);
    this.drawPlatforms();

    this.powSeg = { x1: POW.x - POW_W / 2, x2: POW.x + POW_W / 2, y1: POW.y, y2: POW.y, thickness: POW_H };
    this.powGfx = this.add.graphics().setDepth(1);
    this.powText = this.add
      .text(POW.x, POW.y + POW_H / 2, 'POW', { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(2);

    this.p1Controls = new InputManager(this, { keys: PLAYER_ONE_KEYS, padIndex: 0 });
    this.p2Controls = new InputManager(this, { keys: PLAYER_TWO_KEYS, padIndex: 1 });

    this.hiText = this.add
      .text(WIDTH / 2, 4, `HI ${this.scores.high}`, { ...LABEL_STYLE, fontSize: '8px' })
      .setOrigin(0.5, 0)
      .setDepth(1000);
    this.phaseText = this.add
      .text(WIDTH / 2, 14, '', { ...HINT_STYLE, color: '#cccccc' })
      .setOrigin(0.5, 0)
      .setDepth(1000);
    this.banner = this.add
      .text(WIDTH / 2, HEIGHT / 2, '', LABEL_STYLE)
      .setOrigin(0.5)
      .setColor('#fcfc00')
      .setDepth(1000);

    // Attract / title-screen furniture (shown only on the front end).
    this.panelGfx = this.add.graphics().setDepth(1500).setVisible(false);
    this.titleText = this.add
      .text(WIDTH / 2, 30, 'MARIO BROS', { ...TITLE_STYLE, fontSize: '20px' })
      .setOrigin(0.5)
      .setDepth(1600)
      .setVisible(false);
    this.promptText = this.add
      .text(WIDTH / 2, 132, 'PRESS START', LABEL_STYLE)
      .setOrigin(0.5)
      .setDepth(1600)
      .setVisible(false);

    this.flow = new StateMachine<MarioBrosScene>(this)
      .add('attract', { enter: () => this.enterAttract(), update: (_c, dt) => this.updateAttract(dt) })
      .add('modeselect', { enter: () => this.enterModeSelect(), update: (_c, dt) => this.updateModeSelect(dt) })
      .add('ready', { enter: () => this.enterReady(), update: (_c, dt) => this.updateReady(dt) })
      .add('phaseintro', { enter: () => this.enterPhaseIntro(), update: (_c, dt) => this.updatePhaseIntro(dt) })
      .add('playing', { update: (_c, dt) => this.updatePlaying(dt) })
      .add('gameover', { enter: () => this.enterGameOver() });
    this.flow.transition('attract');
  }

  protected updateGame(_time: number, delta: number): void {
    this.p1Controls.update();
    this.p2Controls.update();
    this.flow.update(delta);
  }

  // --- attract / title ----------------------------------------------------

  private enterAttract(): void {
    this.powUses = 0;
    this.drawPow();
    this.clearEnemies();
    this.demoSpawnTimer = 0;
    this.demoKindIdx = 0;
    this.blinkTimer = 0;
    this.banner.setVisible(false);
    this.phaseText.setText('');
    this.panelGfx.setVisible(false);
    this.titleText.setVisible(true);
    this.promptText.setVisible(true);
  }

  private updateAttract(delta: number): void {
    this.runDemo(delta);
    this.blinkTimer += delta;
    this.promptText.setVisible(Math.floor(this.blinkTimer / 400) % 2 === 0);
    // SPACE / Z / gamepad A start (ENTER is the pause key, handled by the base).
    if (this.controls.justPressed('confirm') || this.controls.justPressed('fire')) {
      this.promptText.setVisible(false);
      this.flow.transition('modeselect');
    }
  }

  // --- mode select --------------------------------------------------------

  private enterModeSelect(): void {
    this.selectIndex = 0;
    // A dark panel so the options read clearly over the busy demo level.
    this.panelGfx.clear();
    this.panelGfx.fillStyle(0x000000, 0.72);
    this.panelGfx.fillRect(24, 86, WIDTH - 48, 96);
    this.panelGfx.lineStyle(1, 0xffffff, 0.5);
    this.panelGfx.strokeRect(24, 86, WIDTH - 48, 96);
    this.panelGfx.setVisible(true);
    const baseY = 104;
    this.selectGfx = MODES.map((m, i) =>
      this.add
        .text(WIDTH / 2, baseY + i * 18, m.label, { ...LABEL_STYLE, fontSize: '10px' })
        .setOrigin(0.5)
        .setDepth(1600),
    );
    this.selectGfx.push(
      this.add
        .text(WIDTH / 2, baseY + MODES.length * 18 + 6, 'UP / DOWN + JUMP', HINT_STYLE)
        .setOrigin(0.5)
        .setDepth(1600),
    );
    this.refreshSelect();
  }

  private updateModeSelect(delta: number): void {
    this.runDemo(delta);
    if (this.controls.justPressed('up')) {
      this.selectIndex = (this.selectIndex + MODES.length - 1) % MODES.length;
      this.refreshSelect();
    } else if (this.controls.justPressed('down')) {
      this.selectIndex = (this.selectIndex + 1) % MODES.length;
      this.refreshSelect();
    } else if (this.controls.justPressed('confirm') || this.controls.justPressed('fire')) {
      this.mode = MODES[this.selectIndex].mode;
      this.selectGfx.forEach((t) => t.destroy());
      this.selectGfx = [];
      this.panelGfx.setVisible(false);
      this.titleText.setVisible(false);
      this.createPlayers();
      this.flow.transition('ready');
    }
  }

  private refreshSelect(): void {
    MODES.forEach((_, i) => {
      const on = i === this.selectIndex;
      this.selectGfx[i].setColor(on ? '#ffffff' : '#9a9a9a').setText(`${on ? '▸ ' : '  '}${MODES[i].label}`);
    });
  }

  /** Attract demo: every enemy type roams the level (no players, no scoring). */
  private runDemo(delta: number): void {
    for (const e of this.enemies) {
      e.update(delta, this.floorSegments());
    }
    this.handleEnemyCollisions();
    this.handleEnemyBounds();
    this.demoSpawnTimer -= delta;
    if (this.enemies.length < 5 && this.demoSpawnTimer <= 0) {
      const kinds = [KINDS.turtle, KINDS.crab, KINDS.fly];
      this.spawnEnemy(kinds[this.demoKindIdx % kinds.length]);
      this.demoKindIdx += 1;
      this.demoSpawnTimer = 850;
    }
  }

  private createPlayers(): void {
    this.players.forEach((p) => p.sprite.destroy());
    this.players = [
      new Player(this, {
        controls: this.p1Controls,
        tex: { run0: TX.marioRun0, run1: TX.marioRun1, jump: TX.marioJump },
        start: { ...MARIO_START },
        facing: 1,
        color: P1_COLOR,
        label: 'MARIO',
      }),
    ];
    if (this.mode !== 'solo') {
      this.players.push(
        new Player(this, {
          controls: this.p2Controls,
          tex: { run0: TX.luigiRun0, run1: TX.luigiRun1, jump: TX.luigiJump },
          start: { ...LUIGI_START },
          facing: -1,
          color: P2_COLOR,
          label: 'LUIGI',
        }),
      );
    }
    this.buildHud();
  }

  // --- flow ---------------------------------------------------------------

  private enterReady(): void {
    this.readyTimer = READY_MS;
    const tag = this.mode === 'versus' ? 'VERSUS!' : this.mode === 'coop' ? 'CO-OP!' : 'READY!';
    this.banner.setText(tag).setColor('#fcfc00').setVisible(true);
    this.players.forEach((p) => p.placeAtStart());
    this.phaseIndex = 0;
    this.loopCount = 0;
    this.startPhase(this.phaseIndex);
  }

  private updateReady(delta: number): void {
    this.readyTimer -= delta;
    if (this.readyTimer <= 0) {
      this.banner.setVisible(false);
      this.flow.transition('playing');
    }
  }

  private enterPhaseIntro(): void {
    this.phaseIndex += 1;
    if (this.phaseIndex >= PHASES.length) {
      this.phaseIndex = 0;
      this.loopCount += 1;
    }
    this.startPhase(this.phaseIndex);
    this.banner.setText(`PHASE ${this.phaseNumber()}`).setColor('#fcfc00').setVisible(true);
    this.phaseTimer = PHASE_INTRO_MS;
  }

  private updatePhaseIntro(delta: number): void {
    this.phaseTimer -= delta;
    if (this.phaseTimer <= 0) {
      this.banner.setVisible(false);
      this.flow.transition('playing');
    }
  }

  /** Global phase number (1-based) across loops, for the banner/HUD. */
  private phaseNumber(): number {
    return this.loopCount * PHASES.length + this.phaseIndex + 1;
  }

  /** Load a phase: queue its roster, refill the POW, reset the spawn cadence. */
  private startPhase(index: number): void {
    this.clearEnemies();
    this.spawnQueue = Phaser.Utils.Array.Shuffle([...PHASES[index].roster]);
    this.spawnTimer = 500;
    this.pipeToggle = 0;
    this.powUses = POW_USES;
    this.drawPow();
    this.phaseText.setText(`PHASE ${this.phaseNumber()}`);
  }

  private updatePlaying(delta: number): void {
    this.settleBumps(delta);

    for (const e of this.enemies) {
      e.update(delta, this.floorSegments());
    }

    this.players.forEach((p, i) => {
      p.update(delta, this.playerFloors());
      if (p.alive) {
        this.handlePlayerBump(p, i);
      }
    });

    this.recoverEnemies();
    this.shellsHitEnemies();
    this.handleEnemyCollisions();
    this.handleEnemyBounds();
    this.spawnFromQueue(delta);

    this.players.forEach((p, i) => {
      p.tickCombo(delta);
      if (p.alive && !p.safe && this.resolveEnemyContact(p, i)) {
        p.die();
      }
    });
    this.updateLastEnemy();
    this.refreshHud();

    if (this.players.every((p) => p.isOut)) {
      this.flow.transition('gameover');
    } else if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.flow.transition('phaseintro');
    }
  }

  private enterGameOver(): void {
    this.banner.setText(`GAME OVER\n${this.resultLine()}`).setColor('#ff5050').setAlign('center').setVisible(true);
    this.time.delayedCall(GAMEOVER_MS, () => this.scene.restart());
  }

  private resultLine(): string {
    if (this.mode === 'versus' && this.players.length === 2) {
      const [a, b] = this.players;
      if (a.score === b.score) {
        return 'TIE';
      }
      return `${(a.score > b.score ? a : b).label} WINS`;
    }
    const total = this.players.reduce((s, p) => s + p.score, 0);
    return `SCORE ${total}`;
  }

  // --- per-player world interaction --------------------------------------

  /** A player's head hit something this frame: the POW, or a floor (bump). */
  private handlePlayerBump(p: Player, index: number): void {
    const seg = p.body.bumped;
    if (!seg) {
      return;
    }
    if (seg === this.powSeg) {
      this.activatePow();
      return;
    }
    const floor = this.floors.find((f) => f.seg === seg);
    if (floor) {
      floor.nudge = -BUMP_AMP;
      this.audio.play('bump');
      this.impact('light');
    }
    for (const e of this.enemies) {
      if (e.floorSeg !== seg) {
        continue;
      }
      if (e.isActive) {
        e.bump(SHELL_STUN_MS);
      } else if (e.isShell) {
        e.bumpHop(SHELL_BUMP_HOP);
      }
    }
    // Versus: knock any rival standing on the bumped platform off their feet.
    if (this.mode === 'versus') {
      this.players.forEach((other, j) => {
        if (j !== index && other.alive && other.body.onGround && this.segmentUnder(other.body) === seg) {
          other.stunForVersus();
        }
      });
    }
  }

  private segmentUnder(body: { x: number; feet: number }): PlatformSegment | null {
    for (const f of this.floors) {
      const s = f.seg;
      if (body.x >= s.x1 && body.x <= s.x2 && Math.abs(body.feet - surfaceY(s, body.x)) < 4) {
        return s;
      }
    }
    return null;
  }

  /** Players also collide with the POW block (enemies don't). */
  private playerFloors(): PlatformSegment[] {
    const segs = this.floorSegments();
    return this.powUses > 0 ? [...segs, this.powSeg] : segs;
  }

  /**
   * One player vs the enemies. Stomp a stompable enemy from above to defeat it;
   * kick a flipped one (turtle → sliding shell); a side hit from an active enemy
   * (or a lethal shell that can hurt this player) is fatal. Returns true if this
   * player died.
   */
  private resolveEnemyContact(p: Player, index: number): boolean {
    const mb = p.getBounds();
    for (const e of [...this.enemies]) {
      if (!this.enemies.includes(e)) {
        continue; // already defeated earlier this frame
      }
      if (!Phaser.Geom.Intersects.RectangleToRectangle(mb, e.sprite.getBounds())) {
        continue;
      }
      const fromAbove = p.body.feet <= e.body.y + 4;

      if (e.isFlipped) {
        if (e.kick(e.body.x >= p.body.x ? 1 : -1, index)) {
          this.award(e, p); // kicking scores; it slides off as a lethal shell
          this.audio.play('kick');
        } else {
          this.defeat(e, p);
        }
        if (fromAbove) {
          p.body.vy = -STOMP_BOUNCE;
        }
      } else if (e.isShell) {
        if (fromAbove) {
          e.flipFor(SHELL_STOP_WAKE_MS);
          p.body.vy = -STOMP_BOUNCE;
        } else if (e.lethalShell && this.shellHurts(e, index)) {
          return true;
        }
      } else if (fromAbove && e.kind.canStomp) {
        this.defeat(e, p);
        p.body.vy = -STOMP_BOUNCE;
      } else if (fromAbove) {
        p.body.vy = -STOMP_BOUNCE; // can't be stomped — harmless bounce
      } else {
        return true;
      }
    }
    return false;
  }

  /** In co-op a kicked shell only endangers its own kicker, never the partner. */
  private shellHurts(shell: Enemy, playerIndex: number): boolean {
    if (this.mode === 'coop' && shell.owner >= 0 && shell.owner !== playerIndex) {
      return false;
    }
    return true;
  }

  // --- enemies ------------------------------------------------------------

  /** Drip enemies out of the pipes (alternating sides) until the roster's empty. */
  private spawnFromQueue(delta: number): void {
    this.spawnTimer -= delta;
    const maxOnScreen = ENEMY_TARGET + (this.players.length - 1) + 1;
    if (this.spawnQueue.length > 0 && this.enemies.length < maxOnScreen && this.spawnTimer <= 0) {
      this.spawnEnemy(KINDS[this.spawnQueue.shift()!]);
      this.spawnTimer = SPAWN_STAGGER_MS;
    }
  }

  private spawnEnemy(kind: EnemyKind): void {
    const spawns = topPipeSpawns();
    const spawn = spawns[this.pipeToggle % spawns.length];
    this.pipeToggle += 1;
    const e = new Enemy(this, kind, spawn.x, spawn.feetY - kind.h / 2, spawn.dir);
    e.body.onGround = true;
    e.speedScale = 1 + this.loopCount * LOOP_SPEED_STEP;
    this.enemies.push(e);
  }

  /** When the roster's exhausted and one enemy is left, it goes super-fast/blue. */
  private updateLastEnemy(): void {
    if (this.spawnQueue.length === 0 && this.enemies.length === 1) {
      this.enemies[0].makeLast();
    }
  }

  // --- POW block ----------------------------------------------------------

  private activatePow(): void {
    if (this.powUses <= 0) {
      return;
    }
    this.powUses -= 1;
    this.impact('heavy');
    this.audio.play('pow');
    this.flashPow();
    for (const e of this.enemies) {
      if (e.isActive && e.body.onGround) {
        e.flipFor(SHELL_STUN_MS);
      }
    }
    this.drawPow();
  }

  private flashPow(): void {
    const flash = this.add
      .rectangle(POW.x, POW.y + POW_H / 2, POW_W + 4, POW_H + 4, 0xffffff)
      .setDepth(3);
    this.tweens.add({ targets: flash, alpha: 0, duration: 220, onComplete: () => flash.destroy() });
  }

  private drawPow(): void {
    this.powGfx.clear();
    if (this.powUses <= 0) {
      this.powText.setVisible(false);
      return;
    }
    const alpha = Math.min(1, 0.5 + 0.17 * this.powUses);
    this.powGfx.fillStyle(COLORS.pow, alpha);
    this.powGfx.fillRect(this.powSeg.x1, this.powSeg.y1, POW_W, POW_H);
    this.powGfx.fillStyle(COLORS.platformTop, alpha);
    this.powGfx.fillRect(this.powSeg.x1, this.powSeg.y1, POW_W, 2);
    this.powText.setVisible(true).setAlpha(alpha);
  }

  private recoverEnemies(): void {
    for (const e of this.enemies) {
      if (e.readyToRecover) {
        e.recover();
      }
    }
  }

  /** A sliding shell mows down other enemies in its path (credited to its kicker). */
  private shellsHitEnemies(): void {
    for (const shell of [...this.enemies]) {
      if (!shell.isShell || !this.enemies.includes(shell)) {
        continue;
      }
      const sb = shell.sprite.getBounds();
      const owner = shell.owner >= 0 ? this.players[shell.owner] : undefined;
      for (const e of [...this.enemies]) {
        if (e === shell || e.isShell || !this.enemies.includes(e)) {
          continue;
        }
        if (Phaser.Geom.Intersects.RectangleToRectangle(sb, e.sprite.getBounds())) {
          this.defeat(e, owner);
        }
      }
    }
  }

  /** Two active enemies that collide both turn around and push apart. */
  private handleEnemyCollisions(): void {
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i];
      if (!a.isActive) {
        continue;
      }
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j];
        if (!b.isActive) {
          continue;
        }
        const dx = Math.abs(a.body.x - b.body.x);
        const dy = Math.abs(a.body.y - b.body.y);
        const minX = (a.kind.w + b.kind.w) / 2;
        const minY = (a.kind.h + b.kind.h) / 2;
        if (dx >= minX || dy >= minY) {
          continue;
        }
        const left = a.body.x <= b.body.x ? a : b;
        const right = left === a ? b : a;
        left.dir = -1;
        right.dir = 1;
        const push = (minX - dx) / 2 + 0.5;
        left.body.x -= push;
        right.body.x += push;
      }
    }
  }

  /**
   * Bottom floor has no wrap. A spent shell that reaches a corner pipe is out of
   * the game; a live enemy that walks in is recycled back to a top pipe (so it
   * must actually be defeated to clear the phase). Upper floors wrap edge-to-edge.
   */
  private handleEnemyBounds(): void {
    const zones = bottomPipeZones();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.floorSeg === this.groundSeg) {
        if (!zones.some(([a, b]) => e.body.x >= a && e.body.x <= b)) {
          continue;
        }
        if (e.isShell) {
          e.sprite.destroy();
          this.enemies.splice(i, 1);
        } else if (e.isActive) {
          this.recycleEnemy(e);
        }
      } else if (e.body.x < 0) {
        e.body.x += WIDTH;
      } else if (e.body.x > WIDTH) {
        e.body.x -= WIDTH;
      }
    }
  }

  /** Teleport an enemy that exited a bottom pipe back out of a top pipe. */
  private recycleEnemy(e: Enemy): void {
    const s = Phaser.Utils.Array.GetRandom(topPipeSpawns());
    e.body.x = s.x;
    e.body.setFeet(s.feetY);
    e.body.vy = 0;
    e.body.onGround = true;
    e.dir = s.dir;
  }

  /** Bank an enemy's points (with combo) and float them — without removing it. */
  private award(e: Enemy, by?: Player): void {
    const color = by?.color ?? '#ffffff';
    let points = e.kind.score;
    if (by) {
      points *= by.registerKill(); // chained kicks double (combo)
      by.score += points;
      this.addScore(points); // keeps the persistent HI in sync
    }
    floatingText(this, e.sprite.x, e.sprite.y, String(points), { color, fontSize: '8px' });
  }

  private defeat(e: Enemy, by?: Player): void {
    this.award(e, by);
    this.audio.play('kick');
    e.sprite.destroy();
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) {
      this.enemies.splice(idx, 1);
    }
  }

  private clearEnemies(): void {
    for (const e of this.enemies) {
      e.sprite.destroy();
    }
    this.enemies.length = 0;
  }

  private floorSegments(): PlatformSegment[] {
    return this.floors.map((f) => f.seg);
  }

  // --- HUD ----------------------------------------------------------------

  private buildHud(): void {
    this.hudTexts.forEach((t) => t.destroy());
    this.lifeIcons.forEach((i) => i.destroy());
    this.hudTexts = [];
    this.lifeIcons.length = 0;
    this.players.forEach((p, i) => {
      const right = i === 1;
      const t = this.add
        .text(right ? WIDTH - 4 : 4, 4, '', { ...LABEL_STYLE, fontSize: '8px' })
        .setOrigin(right ? 1 : 0, 0)
        .setColor(p.color)
        .setDepth(1000);
      this.hudTexts.push(t);
    });
    this.refreshHud();
  }

  private refreshHud(): void {
    this.lifeIcons.forEach((i) => i.destroy());
    this.lifeIcons.length = 0;
    this.hiText.setText(`HI ${this.scores.high}`);
    this.players.forEach((p, i) => {
      const right = i === 1;
      this.hudTexts[i].setText(`${p.label} ${p.score}`);
      const tex = i === 1 ? TX.luigiRun0 : TX.marioRun0;
      for (let n = 0; n < p.lives.count; n++) {
        const x = right ? WIDTH - 6 - n * 9 : 6 + n * 9;
        this.lifeIcons.push(
          this.add.image(x, 16, tex).setOrigin(right ? 1 : 0, 0).setScale(0.6).setDepth(1000),
        );
      }
    });
  }

  // --- bumps / rendering --------------------------------------------------

  private settleBumps(delta: number): void {
    const step = (BUMP_RECOVER * delta) / 1000;
    let dirty = false;
    for (const f of this.floors) {
      if (f.nudge < 0) {
        f.nudge = Math.min(0, f.nudge + step);
        dirty = true;
      }
    }
    if (dirty) {
      this.drawPlatforms();
    }
  }

  private drawPlatforms(): void {
    const g = this.platformGfx;
    g.clear();
    for (const f of this.floors) {
      const y = f.seg.y1 + f.nudge;
      g.fillStyle(COLORS.platform, 1);
      g.fillRect(f.seg.x1, y, f.seg.x2 - f.seg.x1, PLATFORM_THICKNESS);
      g.fillStyle(COLORS.platformTop, 1);
      g.fillRect(f.seg.x1, y, f.seg.x2 - f.seg.x1, 2);
    }
  }

  private drawStatics(): void {
    const g = this.add.graphics().setDepth(0);
    for (const pipe of PIPES) {
      const h = pipe.y2 - pipe.y1;
      g.fillStyle(COLORS.pipe, 1);
      g.fillRect(pipe.x1, pipe.y1, pipe.x2 - pipe.x1, h);
      g.fillStyle(COLORS.pipeRim, 1);
      const rimX = pipe.open === 'right' ? pipe.x2 - 5 : pipe.x1;
      g.fillRect(rimX, pipe.y1 - 2, 5, h + 4);
    }
  }
}
