import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { COLORS } from './palette';
import { TX, buildPrivacyTextures } from './sprites';
import * as C from './constants';

interface Star {
  img: Phaser.GameObjects.Image;
  speed: number;
}

interface Laser {
  obj: Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
}

type Phase = 'intro' | 'play' | 'over';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/**
 * Privacy Policy — a hidden Galaga riff. The "PRIVACY POLICY" logo zooms in
 * Star Wars-style, then the policy scrolls down as falling words the player
 * shoots (or dodges). One life. The longer you last the faster it falls. Past
 * 1000 pts a spinning chocolate-chip cookie hunts you (Galaga-style); every
 * 2500 pts the biggest word on screen becomes a colour-stepping laser boss.
 */
export class PrivacyPolicyScene extends BaseGameScene {
  private phase: Phase = 'intro';
  private mode: 'flow' | 'boss' = 'flow';

  private stars: Star[] = [];
  private player!: Phaser.GameObjects.Image;
  private bullets: Phaser.GameObjects.Image[] = [];

  private words: Phaser.GameObjects.Text[] = [];
  private wordList: string[] = [];
  private wordIndex = 0;
  private survived = 0; // seconds in the flow (frozen during a boss)
  private spawnTimer = 0;

  // cookie enemy
  private cookie?: Phaser.GameObjects.Image;
  private cookieDive = false;
  private cookieT = 0;
  private cookieNextScore = C.COOKIE_FIRST_MIN;

  // boss
  private boss?: Phaser.GameObjects.Text;
  private bossStage = 0;
  private bossDir = 1;
  private bossLasers: Laser[] = [];
  private bossShotsLeft = 0;
  private bossShotTimer = 0;
  private bossCycleTimer = 0;
  private bossDying = false;
  private nextBossScore = C.BOSS_SCORE_INTERVAL;

  private logo?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'game-privacypolicy', gameId: 'privacypolicy', width: C.WIDTH, height: C.HEIGHT });
  }

  protected createGame(): void {
    buildPrivacyTextures(this);
    this.wordList = C.POLICY_TEXT.split(/\s+/).filter(Boolean);
    // Full reset — the scene instance is reused across runs, so leftover
    // objects/refs from a previous game must not bleed into this one.
    this.wordIndex = 0;
    this.survived = 0;
    this.spawnTimer = 0;
    this.bullets = [];
    this.words = [];
    this.stars = [];
    this.cookie?.destroy();
    this.cookie = undefined;
    this.cookieDive = false;
    this.cookieT = 0;
    this.boss?.destroy();
    this.boss = undefined;
    this.bossStage = 0;
    this.bossDir = 1;
    this.bossShotsLeft = 0;
    this.bossShotTimer = 0;
    this.bossCycleTimer = 0;
    this.bossDying = false;
    for (const l of this.bossLasers) l.obj?.destroy();
    this.bossLasers = [];
    this.cookieNextScore = Phaser.Math.Between(C.COOKIE_FIRST_MIN, C.COOKIE_FIRST_MAX);
    this.nextBossScore = C.BOSS_SCORE_INTERVAL;
    this.mode = 'flow';

    this.createStarfield();
    this.player = this.add.image(C.WIDTH / 2, C.PLAYER_Y, TX.ship).setDepth(10).setVisible(false);

    this.phase = 'intro';
    this.playIntro();
  }

  protected updateGame(_time: number, delta: number): void {
    this.updateStars(delta);

    if (this.phase === 'intro') {
      if (this.controls.justPressed('fire')) this.skipIntro();
      return;
    }
    if (this.phase === 'over') {
      if (this.controls.justPressed('fire')) this.returnToMenu();
      return;
    }

    this.movePlayer(delta);
    this.tryFire();
    this.updateBullets(delta);

    if (this.mode === 'boss') {
      this.updateBoss(delta);
    } else {
      this.survived += delta / 1000;
      this.spawnWords(delta);
      this.updateWords(delta);
      this.updateCookie(delta);
      this.maybeTriggerBoss();
    }

    this.resolveCollisions();
  }

  // --- starfield (mirrors Galaga) ----------------------------------------

  private createStarfield(): void {
    const tints = [COLORS.star1, COLORS.star2, COLORS.star3];
    for (let i = 0; i < C.STAR_COUNT; i++) {
      const tier = i % C.STAR_SPEEDS.length;
      const img = this.add
        .image(Phaser.Math.Between(0, C.WIDTH), Phaser.Math.Between(0, C.HEIGHT), TX.star)
        .setDepth(0)
        .setAlpha(C.STAR_ALPHA)
        .setTint(tints[tier]);
      this.stars.push({ img, speed: C.STAR_SPEEDS[tier] });
    }
  }

  private updateStars(delta: number): void {
    const dt = delta / 1000;
    for (const s of this.stars) {
      s.img.y += s.speed * dt;
      if (s.img.y > C.HEIGHT + 2) {
        s.img.y = -2;
        s.img.x = Phaser.Math.Between(0, C.WIDTH);
      }
    }
  }

  // --- intro: Star Wars-style logo zoom ----------------------------------

  private playIntro(): void {
    const gold = hex(COLORS.logo);
    const line = (y: number, text: string) =>
      this.add
        .text(0, y, text, {
          fontFamily: 'monospace',
          fontSize: '26px',
          fontStyle: 'bold',
          color: '#000000', // hollow interior over black → reads as outline
          stroke: gold,
          strokeThickness: 3,
        })
        .setOrigin(0.5);
    const logo = this.add
      .container(C.WIDTH / 2, C.HEIGHT / 2, [line(-16, 'PRIVACY'), line(16, 'POLICY')])
      .setDepth(20)
      .setScale(7);
    this.logo = logo;

    // Recede into the distance (scale), holding visible until it is small, then
    // fade out late so it really "disappears into the distance".
    this.tweens.add({ targets: logo, scale: 0.06, duration: C.INTRO_MS, ease: 'Sine.In' });
    this.tweens.add({
      targets: logo,
      alpha: 0,
      delay: C.INTRO_MS * 0.78,
      duration: C.INTRO_MS * 0.22,
      onComplete: () => this.startPlay(),
    });
  }

  private skipIntro(): void {
    if (this.logo) {
      this.tweens.killTweensOf(this.logo);
      this.logo.destroy();
      this.logo = undefined;
    }
    this.startPlay();
  }

  private startPlay(): void {
    if (this.phase !== 'intro') return;
    this.logo?.destroy();
    this.logo = undefined;
    this.phase = 'play';
    this.player.setVisible(true);
  }

  // --- player ------------------------------------------------------------

  private movePlayer(delta: number): void {
    const dir = this.controls.direction().x;
    if (dir !== 0) {
      const step = (C.PLAYER_SPEED * delta) / 1000;
      this.player.x = Phaser.Math.Clamp(
        this.player.x + dir * step,
        C.PLAYER_MARGIN,
        C.WIDTH - C.PLAYER_MARGIN,
      );
    }
  }

  private tryFire(): void {
    if (!this.controls.justPressed('fire') || this.bullets.length >= C.MAX_BULLETS) return;
    this.bullets.push(this.add.image(this.player.x, C.PLAYER_Y - 8, TX.bullet).setDepth(9));
    this.audio.play('shoot');
  }

  private updateBullets(delta: number): void {
    const step = (C.BULLET_SPEED * delta) / 1000;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y -= step;
      if (b.y < -4) {
        b.destroy();
        this.bullets.splice(i, 1);
      }
    }
  }

  // --- falling words -----------------------------------------------------

  private spawnWords(delta: number): void {
    this.spawnTimer -= delta;
    if (this.spawnTimer > 0) return;
    const gap = Math.max(C.WORD_SPAWN_MIN_MS, C.WORD_SPAWN_MS - this.survived * C.WORD_SPAWN_RAMP);
    this.spawnTimer = gap;

    const text = this.wordList[this.wordIndex % this.wordList.length];
    this.wordIndex++;
    const word = this.add
      .text(0, -6, text, { fontFamily: 'monospace', fontSize: '10px', color: hex(COLORS.word) })
      .setOrigin(0.5)
      .setDepth(5);
    const half = word.width / 2;
    word.x = Phaser.Math.Between(Math.ceil(half) + 2, C.WIDTH - Math.ceil(half) - 2);
    this.words.push(word);

    // A beat after each sentence: pause longer once a period goes by.
    if (text.endsWith('.')) {
      this.spawnTimer += C.BEAT_MS;
    }
  }

  private wordSpeed(): number {
    return Math.min(C.WORD_SPEED_MAX, C.WORD_SPEED_BASE + this.survived * C.WORD_SPEED_RAMP);
  }

  private updateWords(delta: number): void {
    const step = (this.wordSpeed() * delta) / 1000;
    for (let i = this.words.length - 1; i >= 0; i--) {
      const w = this.words[i];
      w.y += step;
      if (w.y > C.HEIGHT + 8) {
        w.destroy(); // reached the bottom — harmless
        this.words.splice(i, 1);
      }
    }
  }

  // --- cookie enemy ------------------------------------------------------

  private updateCookie(delta: number): void {
    if (!this.cookie) {
      if (this.scores.score >= this.cookieNextScore) this.spawnCookie();
      return;
    }
    const dt = delta / 1000;
    this.cookie.angle += C.COOKIE_SPIN * dt;
    this.cookieT += dt;

    if (this.cookieDive) {
      this.cookie.y += C.COOKIE_DIVE_SPEED * dt;
      this.cookie.x = C.WIDTH / 2 + Math.sin(this.cookie.y * 0.045) * C.COOKIE_DIVE_AMP;
      if (this.cookie.y > C.HEIGHT + 12) this.cookie.y = -12; // missed → loop the run
    } else if (this.cookie.y < C.COOKIE_HOVER_Y) {
      this.cookie.y += C.COOKIE_DESCEND_SPEED * dt;
    } else {
      this.cookie.y = C.COOKIE_HOVER_Y;
      this.cookie.x = C.WIDTH / 2 + Math.sin(this.cookieT * C.COOKIE_SWAY_FREQ) * C.COOKIE_SWAY_AMP;
    }
  }

  private spawnCookie(): void {
    this.cookieDive = Math.random() < 0.5;
    this.cookieT = 0;
    this.cookie = this.add.image(C.WIDTH / 2, -12, TX.cookie).setDepth(7);
  }

  private killCookie(): void {
    if (!this.cookie) return;
    this.boom(this.cookie.x, this.cookie.y, 0xffd0a0, 16);
    this.audio.play('explode');
    this.popScore(this.cookie.x, this.cookie.y, C.COOKIE_SCORE);
    this.cookie.destroy();
    this.cookie = undefined;
    this.cookieNextScore =
      this.scores.score + Phaser.Math.Between(C.COOKIE_RESPAWN_MIN, C.COOKIE_RESPAWN_MAX);
  }

  // --- boss --------------------------------------------------------------

  private maybeTriggerBoss(): void {
    if (this.scores.score < this.nextBossScore) return;
    this.nextBossScore += C.BOSS_SCORE_INTERVAL;
    this.startBoss();
  }

  private startBoss(): void {
    this.mode = 'boss';
    this.bossStage = 0;
    this.bossDying = false;
    this.bossDir = Math.random() < 0.5 ? 1 : -1;
    this.bossShotsLeft = 0;
    this.bossShotTimer = 0;
    this.bossCycleTimer = 650; // brief beat before the first volley

    // The cookie steps aside for the boss fight.
    if (this.cookie) {
      this.cookie.destroy();
      this.cookie = undefined;
      this.cookieNextScore = Math.max(this.cookieNextScore, this.scores.score + C.COOKIE_RESPAWN_MIN);
    }

    // Pick the largest word on screen; fade the rest to black.
    let chosen: Phaser.GameObjects.Text | undefined;
    for (const w of this.words) {
      if (!chosen || w.width > chosen.width) chosen = w;
    }
    for (const w of this.words) {
      if (w === chosen) continue;
      this.tweens.add({ targets: w, alpha: 0, duration: 350, onComplete: () => w.destroy() });
    }
    this.words = [];

    if (!chosen) {
      const longest = this.wordList.reduce((a, b) => (b.length > a.length ? b : a), 'POLICY');
      chosen = this.add
        .text(C.WIDTH / 2, C.BOSS_PATROL_Y, longest, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: hex(COLORS.word),
        })
        .setOrigin(0.5)
        .setDepth(5);
    }

    chosen.setDepth(12).setScale(2).setColor(hex(C.BOSS_COLORS[0])); // double size, blue
    chosen.y = C.BOSS_PATROL_Y;
    chosen.x = Phaser.Math.Clamp(chosen.x, C.BOSS_MARGIN, C.WIDTH - C.BOSS_MARGIN);
    this.boss = chosen;
  }

  private updateBoss(delta: number): void {
    const boss = this.boss;
    if (!boss) return;
    const dt = delta / 1000;

    // Patrol side to side.
    boss.x += this.bossDir * C.BOSS_MOVE_SPEED * dt;
    if (boss.x <= C.BOSS_MARGIN || boss.x >= C.WIDTH - C.BOSS_MARGIN) {
      this.bossDir *= -1;
      boss.x = Phaser.Math.Clamp(boss.x, C.BOSS_MARGIN, C.WIDTH - C.BOSS_MARGIN);
    }

    // Fire volleys; volley size grows with each colour stage.
    const burst = C.BOSS_BURSTS[this.bossStage];
    if (this.bossShotsLeft > 0) {
      this.bossShotTimer -= delta;
      if (this.bossShotTimer <= 0) {
        this.fireBossLaser();
        this.bossShotsLeft--;
        this.bossShotTimer = C.BOSS_SHOT_GAP;
        if (this.bossShotsLeft === 0) this.bossCycleTimer = C.BOSS_BURST_GAP;
      }
    } else {
      this.bossCycleTimer -= delta;
      if (this.bossCycleTimer <= 0) {
        this.bossShotsLeft = burst;
        this.bossShotTimer = 0;
      }
    }

    // Move lasers.
    for (let i = this.bossLasers.length - 1; i >= 0; i--) {
      const l = this.bossLasers[i];
      l.obj.x += l.vx * dt;
      l.obj.y += l.vy * dt;
      if (l.obj.y > C.HEIGHT + 8 || l.obj.x < -8 || l.obj.x > C.WIDTH + 8) {
        l.obj.destroy();
        this.bossLasers.splice(i, 1);
      }
    }
  }

  private fireBossLaser(): void {
    const boss = this.boss;
    if (!boss) return;
    const dx = this.player.x - boss.x;
    const dy = this.player.y - boss.y;
    const len = Math.hypot(dx, dy) || 1;
    const vx = (dx / len) * C.BOSS_LASER_SPEED;
    const vy = (dy / len) * C.BOSS_LASER_SPEED;
    const obj = this.add.rectangle(boss.x, boss.y, 2, 7, C.BOSS_LASER_COLOR).setDepth(8);
    obj.rotation = Math.atan2(dy, dx) + Math.PI / 2;
    this.bossLasers.push({ obj, vx, vy });
    this.audio.play('laser');
  }

  private hitBoss(): void {
    const boss = this.boss;
    if (!boss || this.bossDying) return;
    this.bossStage++;
    this.audio.play('hit');

    if (this.bossStage >= C.BOSS_HITS_TO_KILL) {
      // Flash red for a beat, then explode (so the final colour is seen).
      this.bossDying = true;
      boss.setColor(hex(C.BOSS_COLORS[3]));
      this.impact('light');
      this.tweens.add({ targets: boss, scaleX: 2.6, scaleY: 2.6, duration: 110, yoyo: true });
      this.time.delayedCall(150, () => this.killBoss());
      return;
    }

    // Subtle feedback: colour up, punch the scale, flash white briefly.
    boss.setColor(hex(C.BOSS_COLORS[this.bossStage]));
    this.tweens.add({ targets: boss, scaleX: 2.4, scaleY: 2.4, duration: 90, yoyo: true });
    boss.setColor('#ffffff');
    this.time.delayedCall(70, () => boss.setColor(hex(C.BOSS_COLORS[this.bossStage])));
    this.impact('light');
  }

  private killBoss(): void {
    const boss = this.boss;
    if (!boss) return;
    this.boom(boss.x, boss.y, C.BOSS_LASER_COLOR, 26);
    this.impact('heavy');
    this.audio.play('explode');
    this.popScore(boss.x, boss.y, C.BOSS_SCORE);
    boss.destroy();
    this.boss = undefined;

    for (const l of this.bossLasers) l.obj.destroy();
    this.bossLasers = [];

    // Resume the flow at the speed it was at (survived was frozen all fight).
    this.bossDying = false;
    this.mode = 'flow';
    this.spawnTimer = 0;
  }

  // --- collisions --------------------------------------------------------

  private resolveCollisions(): void {
    const player = this.player.getBounds();
    const overlaps = (a: Phaser.Geom.Rectangle, b: Phaser.Geom.Rectangle) =>
      Phaser.Geom.Intersects.RectangleToRectangle(a, b);

    // Falling words.
    for (let i = this.words.length - 1; i >= 0; i--) {
      const word = this.words[i];
      const box = word.getBounds();
      if (overlaps(box, player)) {
        this.die();
        return;
      }
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        if (overlaps(box, this.bullets[j].getBounds())) {
          this.popScore(word.x, word.y, C.WORD_SCORE);
          this.audio.play('hit');
          word.destroy();
          this.words.splice(i, 1);
          this.bullets[j].destroy();
          this.bullets.splice(j, 1);
          break;
        }
      }
    }

    // Cookie.
    if (this.cookie) {
      const box = this.cookie.getBounds();
      if (overlaps(box, player)) {
        this.die();
        return;
      }
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        if (overlaps(box, this.bullets[j].getBounds())) {
          this.bullets[j].destroy();
          this.bullets.splice(j, 1);
          this.killCookie();
          break;
        }
      }
    }

    // Boss + its lasers.
    if (this.boss && !this.bossDying) {
      const box = this.boss.getBounds();
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        if (overlaps(box, this.bullets[j].getBounds())) {
          this.bullets[j].destroy();
          this.bullets.splice(j, 1);
          this.hitBoss();
          break;
        }
      }
    }
    for (const l of this.bossLasers) {
      if (overlaps(l.obj.getBounds(), player)) {
        this.die();
        return;
      }
    }
  }

  // --- effects + death ---------------------------------------------------

  private boom(x: number, y: number, color: number, size: number): void {
    const ring = this.add.circle(x, y, size, color, 0).setStrokeStyle(2, color).setDepth(15);
    this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
    const flash = this.add.circle(x, y, size * 0.55, 0xffffff, 0.9).setDepth(15);
    this.tweens.add({ targets: flash, scale: 1.8, alpha: 0, duration: 240, onComplete: () => flash.destroy() });
  }

  private die(): void {
    this.phase = 'over';
    this.boom(this.player.x, this.player.y, 0xffd0a0, 16);
    this.player.setVisible(false);
    this.impact('heavy');
    this.audio.play('explode');

    this.add
      .text(C.WIDTH / 2, C.HEIGHT / 2 - 8, 'GAME OVER', {
        fontFamily: 'monospace',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.add
      .text(C.WIDTH / 2, C.HEIGHT / 2 + 14, 'FIRE TO EXIT', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#888888',
      })
      .setOrigin(0.5)
      .setDepth(30);
  }
}
