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
  SLIPICE_H,
  SLIPICE_SCORE,
  SLIPICE_SPAWN_MS,
  SLIPICE_PER_PHASE,
  ICE_FRICTION_SCALE,
  ICICLE_SPAWN_MS,
  ICICLE_MAX,
  COIN_SCORE,
  BONUS_TIME_MS,
  BONUS_COMPLETE_FIRST,
  BONUS_COMPLETE_REPEAT,
} from './constants';
import { COLORS } from './palette';
import { buildMarioBrosTextures, TX } from './sprites';
import {
  FLOORS,
  PIPES,
  POW,
  MARIO_START,
  LUIGI_START,
  topPipeSpawns,
  bottomPipeZones,
  icicleAnchors,
  bonusCoinSpots,
} from './levels';
import { Enemy, EnemyKind, EnemyKindId, KINDS } from './enemies';
import { Slipice } from './slipice';
import { Icicle } from './icicle';
import { PHASES } from './phases';
import { Player } from './player';
import { GameTestSurface, InvariantViolation, registerTestSurface } from '../../shared/testkit/surface';

interface Floor {
  seg: PlatformSegment;
  nudge: number;
  iced: boolean;
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
  private readonly slipices: Slipice[] = [];
  private slipiceSpawnTimer = 0;
  private slipiceCount = 0;
  private readonly icicles: Icicle[] = [];
  private icicleSpawnTimer = 0;
  private readonly coins: Phaser.GameObjects.Image[] = [];
  private bonusTimer = 0;
  private bonusCompletions = 0;

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

    this.floors = FLOORS.map((f) => ({ seg: { ...f, thickness: PLATFORM_THICKNESS }, nudge: 0, iced: false }));
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
      .add('bonus', { enter: () => this.enterBonus(), update: (_c, dt) => this.updateBonus(dt) })
      .add('playing', { update: (_c, dt) => this.updatePlaying(dt) })
      .add('gameover', { enter: () => this.enterGameOver() });
    this.flow.transition('attract');

    // Deterministic test surface (dev/test builds only; tree-shaken in prod).
    if (import.meta.env.DEV) {
      registerTestSurface(this.buildTestSurface());
    }
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
    this.clearSlipices();
    this.clearIcicles();
    this.clearCoins();
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
    const bonus = PHASES[this.phaseIndex].bonus;
    this.banner.setText(bonus ? 'BONUS PHASE' : `PHASE ${this.phaseNumber()}`).setColor('#fcfc00').setVisible(true);
    this.phaseTimer = PHASE_INTRO_MS;
  }

  private updatePhaseIntro(delta: number): void {
    this.phaseTimer -= delta;
    if (this.phaseTimer <= 0) {
      this.banner.setVisible(false);
      this.flow.transition(PHASES[this.phaseIndex].bonus ? 'bonus' : 'playing');
    }
  }

  /** Global phase number (1-based) across loops, for the banner/HUD. */
  private phaseNumber(): number {
    return this.loopCount * PHASES.length + this.phaseIndex + 1;
  }

  /** Load a phase: queue its roster, thaw the platforms, refill the POW. */
  private startPhase(index: number): void {
    this.clearEnemies();
    this.clearSlipices();
    this.clearIcicles();
    this.clearCoins();
    this.floors.forEach((f) => (f.iced = false));
    this.drawPlatforms();
    this.spawnQueue = Phaser.Utils.Array.Shuffle([...PHASES[index].roster]);
    this.spawnTimer = 500;
    this.pipeToggle = 0;
    this.slipiceCount = 0;
    this.slipiceSpawnTimer = SLIPICE_SPAWN_MS;
    this.icicleSpawnTimer = ICICLE_SPAWN_MS;
    this.powUses = PHASES[index].bonus ? 0 : POW_USES; // no POW in bonus phases
    this.drawPow();
    this.phaseText.setText(`PHASE ${this.phaseNumber()}`);
  }

  // --- bonus phase --------------------------------------------------------

  private enterBonus(): void {
    this.bonusTimer = BONUS_TIME_MS;
    this.players.forEach((p) => p.placeAtStart());
    for (const spot of bonusCoinSpots()) {
      this.coins.push(this.add.image(spot.x, spot.y, TX.coin).setDepth(8));
    }
  }

  private updateBonus(delta: number): void {
    this.bonusTimer = Math.max(0, this.bonusTimer - delta);
    this.players.forEach((p) => {
      p.update(delta, this.playerFloors(), this.iceScaleFor(p));
      if (p.alive) {
        this.collectCoins(p);
      }
    });
    this.phaseText.setText(`BONUS  ${Math.ceil(this.bonusTimer / 1000)}`);
    this.refreshHud();

    if (this.coins.length === 0 || this.bonusTimer <= 0) {
      this.phaseText.setText('');
      this.flow.transition('phaseintro');
    }
  }

  private collectCoins(p: Player): void {
    const mb = p.getBounds();
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      if (!Phaser.Geom.Intersects.RectangleToRectangle(mb, coin.getBounds())) {
        continue;
      }
      p.score += COIN_SCORE;
      this.addScore(COIN_SCORE);
      floatingText(this, coin.x, coin.y, String(COIN_SCORE), { color: p.color, fontSize: '8px' });
      coin.destroy();
      this.coins.splice(i, 1);
      if (this.coins.length === 0) {
        // grabbed them all: completion bonus to the finisher
        const reward = this.bonusCompletions === 0 ? BONUS_COMPLETE_FIRST : BONUS_COMPLETE_REPEAT;
        this.bonusCompletions += 1;
        p.score += reward;
        this.addScore(reward);
        floatingText(this, p.body.x, p.body.y - 10, `${reward}!`, { color: p.color, fontSize: '10px' });
      }
      this.checkExtraLife(p);
    }
  }

  private clearCoins(): void {
    for (const coin of this.coins) {
      coin.destroy();
    }
    this.coins.length = 0;
  }

  private updatePlaying(delta: number): void {
    this.settleBumps(delta);

    for (const e of this.enemies) {
      e.update(delta, this.floorSegments());
    }

    this.players.forEach((p, i) => {
      p.update(delta, this.playerFloors(), this.iceScaleFor(p));
      if (p.alive) {
        this.handlePlayerBump(p, i);
      }
    });

    this.recoverEnemies();
    this.shellsHitEnemies();
    this.handleEnemyCollisions();
    this.handleEnemyBounds();
    this.spawnFromQueue(delta);
    this.updateSlipice(delta);
    this.updateIcicles(delta);

    this.players.forEach((p, i) => {
      p.tickCombo(delta);
      if (p.alive && !p.safe && (this.resolveEnemyContact(p, i) || this.touchedSlipice(p) || this.touchedIcicle(p))) {
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
    for (const s of [...this.slipices]) {
      if (s.floorSeg === seg) {
        this.killSlipice(s, p); // a single bump shatters a Slipice (no kick)
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
      } else {
        // Un-flipped active enemy: enemies CANNOT be stomped in Mario Bros.
        // Touching one — including landing on top of it — kills the PLAYER; the
        // enemy survives (spec §3.1 stomp rule).
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

  // --- Slipice / ice ------------------------------------------------------

  private updateSlipice(delta: number): void {
    const phase = PHASES[this.phaseIndex];
    if (phase.slipice && this.slipices.length === 0 && this.slipiceCount < SLIPICE_PER_PHASE) {
      this.slipiceSpawnTimer -= delta;
      if (this.slipiceSpawnTimer <= 0) {
        this.spawnSlipice();
        this.slipiceSpawnTimer = SLIPICE_SPAWN_MS;
      }
    }

    const zones = bottomPipeZones();
    for (let i = this.slipices.length - 1; i >= 0; i--) {
      const s = this.slipices[i];
      s.update(delta, this.floorSegments());
      // Reverse only on contact with an enemy (never the player).
      for (const e of this.enemies) {
        if (e.isActive && Phaser.Geom.Intersects.RectangleToRectangle(s.sprite.getBounds(), e.sprite.getBounds())) {
          s.reverse();
          break;
        }
      }
      if (this.tryIce(s)) {
        this.shatter(s.sprite.x, s.sprite.y);
        s.sprite.destroy();
        this.slipices.splice(i, 1);
      } else if (s.floorSeg === this.groundSeg && zones.some(([a, b]) => s.body.x >= a && s.body.x <= b)) {
        s.sprite.destroy(); // gave up — left through a bottom pipe
        this.slipices.splice(i, 1);
      } else if (s.floorSeg !== this.groundSeg) {
        if (s.body.x < 0) {
          s.body.x += WIDTH;
        } else if (s.body.x > WIDTH) {
          s.body.x -= WIDTH;
        }
      }
    }
  }

  /** Freeze the (non-ground) platform a Slipice has reached the centre of. */
  private tryIce(s: Slipice): boolean {
    const seg = s.floorSeg;
    if (!seg || seg === this.groundSeg) {
      return false;
    }
    const floor = this.floors.find((f) => f.seg === seg);
    if (!floor || floor.iced) {
      return false;
    }
    if (Math.abs(s.body.x - (seg.x1 + seg.x2) / 2) < 6) {
      floor.iced = true;
      this.drawPlatforms();
      return true;
    }
    return false;
  }

  private spawnSlipice(): void {
    const spawn = Phaser.Utils.Array.GetRandom(topPipeSpawns());
    const s = new Slipice(this, spawn.x, spawn.feetY - SLIPICE_H / 2, spawn.dir);
    s.body.onGround = true;
    this.slipices.push(s);
    this.slipiceCount += 1;
  }

  private killSlipice(s: Slipice, by: Player): void {
    by.score += SLIPICE_SCORE;
    this.addScore(SLIPICE_SCORE);
    floatingText(this, s.sprite.x, s.sprite.y, String(SLIPICE_SCORE), { color: by.color, fontSize: '8px' });
    this.shatter(s.sprite.x, s.sprite.y);
    s.sprite.destroy();
    const idx = this.slipices.indexOf(s);
    if (idx >= 0) {
      this.slipices.splice(idx, 1);
    }
  }

  private touchedSlipice(p: Player): boolean {
    const mb = p.getBounds();
    return this.slipices.some((s) =>
      Phaser.Geom.Intersects.RectangleToRectangle(mb, s.sprite.getBounds()),
    );
  }

  /** Friction multiplier for whichever platform this player stands on. */
  private iceScaleFor(p: Player): number {
    const seg = this.segmentUnder(p.body);
    const floor = seg ? this.floors.find((f) => f.seg === seg) : undefined;
    return floor?.iced ? ICE_FRICTION_SCALE : 1;
  }

  private shatter(x: number, y: number): void {
    const burst = this.add.circle(x, y, 6, 0xffffff).setDepth(11);
    this.tweens.add({ targets: burst, scale: 2, alpha: 0, duration: 260, onComplete: () => burst.destroy() });
  }

  private clearSlipices(): void {
    for (const s of this.slipices) {
      s.sprite.destroy();
    }
    this.slipices.length = 0;
  }

  // --- icicles ------------------------------------------------------------

  private updateIcicles(delta: number): void {
    const phase = PHASES[this.phaseIndex];
    if (phase.icicles && this.icicles.length < ICICLE_MAX) {
      this.icicleSpawnTimer -= delta;
      if (this.icicleSpawnTimer <= 0) {
        this.spawnIcicle();
        this.icicleSpawnTimer = ICICLE_SPAWN_MS;
      }
    }
    for (let i = this.icicles.length - 1; i >= 0; i--) {
      const ic = this.icicles[i];
      ic.update(delta, this.groundSeg.y1);
      if (ic.done) {
        this.shatter(ic.sprite.x, ic.sprite.y);
        ic.sprite.destroy();
        this.icicles.splice(i, 1);
      }
    }
  }

  private spawnIcicle(): void {
    const taken = new Set(this.icicles.map((ic) => ic.anchorX));
    const free = icicleAnchors().filter((a) => !taken.has(a.x));
    if (free.length === 0) {
      return;
    }
    const a = Phaser.Utils.Array.GetRandom(free);
    this.icicles.push(new Icicle(this, a.x, a.y));
  }

  private touchedIcicle(p: Player): boolean {
    const mb = p.getBounds();
    return this.icicles.some(
      (ic) => ic.lethal && Phaser.Geom.Intersects.RectangleToRectangle(mb, ic.sprite.getBounds()),
    );
  }

  private clearIcicles(): void {
    for (const ic of this.icicles) {
      ic.sprite.destroy();
    }
    this.icicles.length = 0;
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
      if (!e.body.onGround) {
        continue; // POW never affects airborne enemies (e.g. a mid-hop fly)
      }
      if (e.isActive) {
        e.flipFor(SHELL_STUN_MS);
      } else if (e.isFlipped) {
        // Spec §3.3 caution: an already-flipped enemy is flipped back upright
        // (re-activated, possibly faster).
        e.recover();
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
    // Kick = 800 flat for every enemy (spec §3.4); the combo chain then governs
    // the actual points (800/1600/2400/3200 capped, §0 #2) — not the enemy kind.
    let points = e.kind.score;
    if (by) {
      points = by.registerKill();
      by.score += points;
      this.addScore(points); // keeps the persistent HI in sync
      this.checkExtraLife(by);
    }
    floatingText(this, e.sprite.x, e.sprite.y, String(points), { color, fontSize: '8px' });
  }

  /** Award the extra life at 20,000 once, and audio/HUD it (spec §0 #5). */
  private checkExtraLife(p: Player): void {
    if (p.grantExtraLifeIfDue() > 0) {
      this.audio.play('extra');
      this.refreshHud();
    }
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
      g.fillStyle(f.iced ? COLORS.iceBody : COLORS.platform, 1);
      g.fillRect(f.seg.x1, y, f.seg.x2 - f.seg.x1, PLATFORM_THICKNESS);
      g.fillStyle(f.iced ? COLORS.iceTop : COLORS.platformTop, 1);
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

  // --- test surface (dev/test only) --------------------------------------

  /** Non-Slipice enemies still on the board + still queued to spawn. */
  private targetsRemaining(): number {
    return this.enemies.length + this.spawnQueue.length;
  }

  private enemyState(e: Enemy): string {
    if (e.isShell) return 'shell';
    if (e.isFlipped) return 'flipped';
    return e.state; // 'walk' | 'angry'
  }

  /**
   * Stand up a deterministic single-player combat situation: clear the board,
   * make the world interactive, and put the scene in `playing`. Scenarios then
   * place enemies / drive bumps / kicks directly via hooks (the harness pauses
   * the live loop, so hooks do the work, not `updateGame`).
   */
  private testBeginPlay(): void {
    this.mode = 'solo';
    this.createPlayers();
    this.flow.transition('playing');
    this.clearEnemies();
    this.clearSlipices();
    this.clearIcicles();
    this.clearCoins();
    this.spawnQueue = [];
    this.powUses = POW_USES;
    this.drawPow();
    this.floors.forEach((f) => (f.iced = false));
    this.players.forEach((p) => {
      p.placeAtStart();
      p.score = 0;
      p.nextExtraLife = 20000;
    });
  }

  /** Place an enemy at an exact spot, grounded, facing `dir` (default right). */
  private testSpawnEnemy(kindId: EnemyKindId, x: number, y: number, dir: 1 | -1 = 1): number {
    const e = new Enemy(this, KINDS[kindId], x, y, dir);
    e.body.onGround = true;
    e.floorSeg = this.floorSegments().find(
      (s) => x >= s.x1 && x <= s.x2 && Math.abs(e.body.feet - surfaceY(s, x)) < 6,
    ) ?? null;
    this.enemies.push(e);
    return this.enemies.length - 1;
  }

  private buildTestSurface(): GameTestSurface {
    return {
      gameId: 'mariobros',
      sceneKey: 'game-mariobros',
      snapshot: () => {
        const p0 = this.players[0];
        return {
          score: p0 ? p0.score : 0,
          high: this.scores.high,
          lives: p0 ? p0.lives.count : 0,
          phase: this.phaseNumber(),
          phaseIndex: this.phaseIndex,
          loopCount: this.loopCount,
          flow: this.flow.state,
          mode: this.mode,
          combo: p0 ? p0.comboCount : 0,
          players: this.players.map((p) => ({
            x: Math.round(p.body.x),
            y: Math.round(p.body.y),
            onGround: p.body.onGround,
            alive: p.alive,
            invuln: p.invuln > 0,
            score: p.score,
            lives: p.lives.count,
            comboCount: p.comboCount,
          })),
          enemies: this.enemies.map((e) => ({
            kind: e.kind.id,
            x: Math.round(e.body.x),
            y: Math.round(e.body.y),
            state: this.enemyState(e),
            dir: e.dir,
            bumps: e.bumpCount,
            grounded: e.grounded,
            last: e.last,
            stun: Math.round(e.stun),
            effSpeed: Math.round(e.effSpeed * 100) / 100,
          })),
          enemyCount: this.enemies.length,
          targetsRemaining: this.targetsRemaining(),
          spawnQueueLength: this.spawnQueue.length,
          slipiceCount: this.slipices.length,
          icedPlatforms: this.floors.filter((f) => f.iced).length,
          icicleCount: this.icicles.length,
          coinCount: this.coins.length,
          bonusActive: this.flow.state === 'bonus',
          bonusTimer: Math.round(this.bonusTimer),
          bonusCompletions: this.bonusCompletions,
          powUsesRemaining: this.powUses,
        };
      },
      invariants: (): InvariantViolation[] => {
        const v: InvariantViolation[] = [];
        const p0 = this.players[0];
        if (p0 && p0.score < 0) {
          v.push({ rule: 'score-nonneg', detail: `${p0.score}` });
        }
        if (this.powUses < 0 || this.powUses > POW_USES) {
          v.push({ rule: 'pow-uses-range', detail: `${this.powUses}` });
        }
        if (this.icedPlatformCount() > 3) {
          v.push({ rule: 'iced-platforms-max-3', detail: `${this.icedPlatformCount()}` });
        }
        for (const e of this.enemies) {
          // No entity ever sits outside [0, W) once wrap has resolved.
          if (e.body.x < -1 || e.body.x > WIDTH + 1) {
            v.push({ rule: 'enemy-in-bounds', detail: `${e.kind.id}@${Math.round(e.body.x)}` });
          }
          // A flipped enemy is never simultaneously a sliding shell.
          if (e.isFlipped && e.isShell) {
            v.push({ rule: 'flipped-xor-shell', detail: e.kind.id });
          }
          // The last-enemy boost must never reach a Fighterfly (§0 #6).
          if (e.last && e.kind.id === 'fly' && e.effSpeed > e.kind.walkSpeed + 0.01) {
            v.push({ rule: 'fly-last-no-boost', detail: `${e.effSpeed}` });
          }
        }
        // Speed ordering: turtle < fly < crab at normal pace (§0 #8).
        if (!(KINDS.turtle.walkSpeed < KINDS.fly.walkSpeed && KINDS.fly.walkSpeed < KINDS.crab.walkSpeed)) {
          v.push({ rule: 'speed-ordering', detail: 'turtle<fly<crab violated' });
        }
        return v;
      },
      hooks: {
        // --- setup -------------------------------------------------------
        beginPlay: () => this.testBeginPlay(),
        seed: (n: number) => {
          // Deterministic RNG for spawn-pipe / recover-direction choices.
          (Phaser.Math.RND as Phaser.Math.RandomDataGenerator).sow([String(n)]);
        },
        skipToPhase: (n: number) => {
          // n is 1-based global phase; map into the unique table.
          this.phaseIndex = Math.max(0, Math.min(PHASES.length - 1, n - 1));
          this.loopCount = 0;
          this.startPhase(this.phaseIndex);
        },
        spawnEnemy: (kind: EnemyKindId, x: number, y: number, dir: 1 | -1) =>
          this.testSpawnEnemy(kind, x, y, dir ?? 1),
        setEnemyState: (i: number, state: 'walk' | 'angry' | 'flipped' | 'shell') => {
          const e = this.enemies[i];
          if (!e) return;
          if (state === 'flipped') e.flipFor(SHELL_STUN_MS);
          else if (state === 'shell') e.kick(1, 0);
          else e.recover();
        },
        // --- defeat sequence --------------------------------------------
        flipEnemy: (i: number) => {
          const e = this.enemies[i];
          return e ? e.bump(SHELL_STUN_MS) : false;
        },
        kickEnemy: (i: number, playerIdx: number) => {
          const e = this.enemies[i];
          if (!e || !e.isFlipped) return false;
          const p = this.players[playerIdx] ?? this.players[0];
          if (e.kick(e.body.x >= p.body.x ? 1 : -1, playerIdx)) {
            this.award(e, p); // turtle slides off as a shell
          } else {
            this.defeat(e, p);
          }
          return true;
        },
        forceRecover: (i: number) => {
          const e = this.enemies[i];
          if (e) {
            e.flipFor(0);
            e.recover();
          }
        },
        recoverReady: () => this.recoverEnemies(),
        makeLast: (i: number) => {
          const e = this.enemies[i];
          if (e) e.makeLast();
        },
        markLastIfAlone: () => this.updateLastEnemy(),
        tickEnemies: (ms: number) => {
          for (const e of this.enemies) e.update(ms, this.floorSegments());
        },
        setEnemyAirborne: (i: number, up: number) => {
          const e = this.enemies[i];
          if (e) {
            e.body.onGround = false;
            e.floorSeg = null;
            e.body.vy = -up;
          }
        },
        // --- POW --------------------------------------------------------
        activatePow: () => this.activatePow(),
        setPowUses: (n: number) => {
          this.powUses = n;
          this.drawPow();
        },
        // --- scoring / lives --------------------------------------------
        registerKick: (playerIdx: number) => {
          const p = this.players[playerIdx] ?? this.players[0];
          return p.registerKill();
        },
        setScore: (n: number) => {
          const p = this.players[0];
          if (p) p.score = n;
        },
        addScore: (playerIdx: number, n: number) => {
          const p = this.players[playerIdx] ?? this.players[0];
          p.score += n;
          this.addScore(n);
          this.checkExtraLife(p);
        },
        checkExtraLife: (playerIdx: number) => {
          const p = this.players[playerIdx] ?? this.players[0];
          this.checkExtraLife(p);
        },
        resetCombo: (playerIdx: number) => {
          const p = this.players[playerIdx] ?? this.players[0];
          // force the combo window closed, then tick it to expire
          p.tickCombo(999999);
        },
        // --- contact ----------------------------------------------------
        placePlayer: (playerIdx: number, x: number, y: number) => {
          const p = this.players[playerIdx] ?? this.players[0];
          p.body.x = x;
          p.body.setFeet(y);
          p.invuln = 0;
          p.syncSprite();
        },
        resolveContact: (playerIdx: number) => {
          const p = this.players[playerIdx] ?? this.players[0];
          const died = this.resolveEnemyContact(p, playerIdx);
          if (died) p.die();
          return died;
        },
        // --- movement (fixed jump arc) ----------------------------------
        setPlayerVx: (playerIdx: number, vx: number) => {
          const p = this.players[playerIdx] ?? this.players[0];
          p.vxDebug = vx;
        },
        setPlayerGround: (playerIdx: number, onGround: boolean) => {
          const p = this.players[playerIdx] ?? this.players[0];
          p.body.onGround = onGround;
        },
        stepHorizontal: (playerIdx: number, ms: number, dir: number) => {
          const p = this.players[playerIdx] ?? this.players[0];
          p.applyHorizontal(ms / 1000, dir, 1);
          return p.vxDebug;
        },
        // --- bonus phase ------------------------------------------------
        enterBonus: () => {
          this.phaseIndex = 2; // a bonus phase
          this.flow.transition('bonus');
        },
        collectAllCoins: (playerIdx: number) => {
          const p = this.players[playerIdx] ?? this.players[0];
          // Move the player over each coin and run the collector.
          for (const coin of [...this.coins]) {
            p.body.x = coin.x;
            p.body.setFeet(coin.y);
            p.syncSprite();
            this.collectCoins(p);
          }
        },
        // --- read-only helpers for the fuzz bot -------------------------
        flowState: () => this.flow.state,
        playerX: () => (this.players[0] ? this.players[0].body.x : 0),
        enemyXs: () => this.enemies.map((e) => Math.round(e.body.x)),
      },
    };
  }

  private icedPlatformCount(): number {
    return this.floors.filter((f) => f.iced).length;
  }
}
