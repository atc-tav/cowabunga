import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { COLORS } from './palette';
import { TX, buildPrivacyTextures } from './sprites';
import * as C from './constants';

interface Star {
  img: Phaser.GameObjects.Image;
  speed: number;
}

interface Cookie {
  img: Phaser.GameObjects.Image;
  dive: boolean;
  t: number;
  baseX: number;
  phase: number;
  fireTimer: number;
}

interface Projectile {
  obj: Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
}

type Phase = 'intro' | 'play' | 'over';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const BEST_STREAK_KEY = 'pp-best-streak';

/**
 * Privacy Policy — a hidden Galaga riff. The "PRIVACY POLICY" logo zooms in
 * Star Wars-style, then the policy scrolls down as falling words to shoot or
 * dodge (one life). Spinning chocolate-chip cookies hunt you (the standard ones
 * shoot back; their max on screen grows with score); every ~1500 pts the
 * biggest word becomes a colour-stepping laser boss, and beating it advances a
 * level. A bottom stats bar tracks speed, streak, best streak, and accuracy.
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
  private survived = 0;
  private spawnTimer = 0;
  private levelPauseTimer = 0;
  private level = 1;

  private cookies: Cookie[] = [];
  private cookieBullets: Projectile[] = [];
  private cookieNextScore = 0;
  private firstCookieScore = 0;

  private boss?: Phaser.GameObjects.Text;
  private bossStage = 0;
  private bossDir = 1;
  private bossScale = 1;
  private bossSpeed = C.BOSS_MOVE_SPEED;
  private bossLasers: Projectile[] = [];
  private bossShotsLeft = 0;
  private bossShotTimer = 0;
  private bossCycleTimer = 0;
  private bossDying = false;
  private nextBossScore = 0;

  // stats
  private shotsFired = 0;
  private shotsHit = 0;
  private streak = 0;
  private bestStreak = 0;
  private statsText!: Phaser.GameObjects.Text;

  private logo?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'game-privacypolicy', gameId: 'privacypolicy', width: C.WIDTH, height: C.HEIGHT });
  }

  protected createGame(): void {
    buildPrivacyTextures(this);
    this.wordList = C.POLICY_TEXT.split(/\s+/).filter(Boolean);

    // Full reset — the scene instance is reused across runs.
    this.wordIndex = 0;
    this.survived = 0;
    this.spawnTimer = 0;
    this.levelPauseTimer = 0;
    this.level = 1;
    this.bullets = [];
    this.words = [];
    this.stars = [];
    this.cookies = [];
    this.cookieBullets = [];
    this.firstCookieScore = Phaser.Math.Between(C.COOKIE_FIRST_MIN, C.COOKIE_FIRST_MAX);
    this.cookieNextScore = this.firstCookieScore;
    this.boss?.destroy();
    this.boss = undefined;
    this.bossStage = 0;
    this.bossDir = 1;
    this.bossScale = 1;
    this.bossSpeed = C.BOSS_MOVE_SPEED;
    this.bossShotsLeft = 0;
    this.bossShotTimer = 0;
    this.bossCycleTimer = 0;
    this.bossDying = false;
    this.bossLasers = [];
    this.nextBossScore = Phaser.Math.Between(C.BOSS_INTERVAL_MIN, C.BOSS_INTERVAL_MAX);
    this.mode = 'flow';
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.streak = 0;
    this.bestStreak = this.loadBestStreak();

    this.createStarfield();
    this.player = this.add.image(C.WIDTH / 2, C.PLAYER_Y, TX.ship).setDepth(10).setVisible(false);
    this.statsText = this.add
      .text(C.WIDTH / 2, C.STATS_Y, '', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#9fb6c8',
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setDepth(1000)
      .setVisible(false);

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
      const paused = this.levelPauseTimer > 0;
      if (paused) {
        this.levelPauseTimer -= delta;
      } else {
        this.survived += delta / 1000;
        this.spawnWords(delta);
        this.maybeTriggerBoss();
      }
      this.updateWords(delta);
      this.updateCookies(delta, paused);
    }

    this.updateProjectiles(this.cookieBullets, delta);
    this.resolveCollisions();
    this.updateStats();
  }

  // --- starfield ---------------------------------------------------------

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

  // --- intro -------------------------------------------------------------

  private playIntro(): void {
    const gold = hex(COLORS.logo);
    const line = (y: number, text: string) =>
      this.add
        .text(0, y, text, {
          fontFamily: 'monospace',
          fontSize: '26px',
          fontStyle: 'bold',
          color: '#000000',
          stroke: gold,
          strokeThickness: 3,
        })
        .setOrigin(0.5);
    const logo = this.add
      .container(C.WIDTH / 2, C.HEIGHT / 2, [line(-16, 'PRIVACY'), line(16, 'POLICY')])
      .setDepth(20)
      .setScale(7);
    this.logo = logo;

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
    this.statsText.setVisible(true);
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
    this.shotsFired++;
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

  // --- words -------------------------------------------------------------

  private spawnWords(delta: number): void {
    this.spawnTimer -= delta;
    if (this.spawnTimer > 0) return;
    const gap = this.spawnGap();
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

    if (text.endsWith('.')) this.spawnTimer += C.BEAT_MS; // a breather per sentence
  }

  private spawnGap(): number {
    return Math.max(C.WORD_SPAWN_MIN_MS, C.WORD_SPAWN_MS - this.survived * C.WORD_SPAWN_RAMP);
  }

  private wordSpeed(): number {
    return Math.min(C.WORD_SPEED_MAX, C.WORD_SPEED_BASE + this.survived * C.WORD_SPEED_RAMP);
  }

  private updateWords(delta: number): void {
    const step = (this.wordSpeed() * delta) / 1000;
    for (let i = this.words.length - 1; i >= 0; i--) {
      const w = this.words[i];
      w.y += step;
      if (w.y > C.DESPAWN_Y) {
        w.destroy(); // slipped past — harmless, but it breaks the streak
        this.words.splice(i, 1);
        this.streak = 0;
      }
    }
  }

  // --- cookies -----------------------------------------------------------

  private maxCookies(): number {
    const score = this.scores.score;
    const unlocked = score >= this.firstCookieScore ? 1 : 0;
    return Math.max(unlocked, Math.floor(score / C.COOKIE_PER_SCORE));
  }

  private updateCookies(delta: number, paused: boolean): void {
    if (!paused && this.scores.score >= this.cookieNextScore && this.cookies.length < this.maxCookies()) {
      this.spawnCookie();
      this.cookieNextScore =
        this.scores.score + Phaser.Math.Between(C.COOKIE_RESPAWN_MIN, C.COOKIE_RESPAWN_MAX);
    }

    const dt = delta / 1000;
    for (const c of this.cookies) {
      c.img.angle += C.COOKIE_SPIN * dt;
      c.t += dt;
      if (c.dive) {
        c.img.y += C.COOKIE_DIVE_SPEED * dt;
        c.img.x = Phaser.Math.Clamp(
          c.baseX + Math.sin(c.img.y * 0.05) * C.COOKIE_DIVE_AMP,
          12,
          C.WIDTH - 12,
        );
        if (c.img.y > C.HEIGHT + 12) c.img.y = -12; // missed → loop the run
      } else {
        // Sway continuously (even while descending) so it never teleports.
        c.img.x = Phaser.Math.Clamp(
          c.baseX + Math.sin(c.t * C.COOKIE_SWAY_FREQ + c.phase) * C.COOKIE_SWAY_AMP,
          12,
          C.WIDTH - 12,
        );
        if (c.img.y < C.COOKIE_HOVER_Y) {
          c.img.y += C.COOKIE_DESCEND_SPEED * dt;
        } else {
          c.img.y = C.COOKIE_HOVER_Y;
          c.fireTimer -= delta;
          if (c.fireTimer <= 0) {
            this.fireCookieBullet(c);
            c.fireTimer = C.COOKIE_FIRE_MS + Math.random() * C.COOKIE_FIRE_JITTER;
          }
        }
      }
    }
  }

  private spawnCookie(): void {
    const baseX = Phaser.Math.Between(28, C.WIDTH - 28);
    const img = this.add.image(baseX, -12, TX.cookie).setDepth(7);
    this.cookies.push({
      img,
      dive: Math.random() < 0.5,
      t: 0,
      baseX,
      phase: Math.random() * Math.PI * 2,
      fireTimer: C.COOKIE_FIRE_MS + Math.random() * C.COOKIE_FIRE_JITTER,
    });
  }

  private fireCookieBullet(c: Cookie): void {
    this.cookieBullets.push(this.aimed(c.img.x, c.img.y, C.COOKIE_BULLET_SPEED, C.COOKIE_BULLET_COLOR));
    this.audio.play('laser');
  }

  private killCookie(index: number): void {
    const c = this.cookies[index];
    this.boom(c.img.x, c.img.y, 0xffd0a0, 16);
    this.audio.play('explode');
    this.shotsHit++;
    this.popScore(c.img.x, c.img.y, C.COOKIE_SCORE);
    c.img.destroy();
    this.cookies.splice(index, 1);
    this.cookieNextScore =
      this.scores.score + Phaser.Math.Between(C.COOKIE_RESPAWN_MIN, C.COOKIE_RESPAWN_MAX);
  }

  // --- boss --------------------------------------------------------------

  private maybeTriggerBoss(): void {
    if (this.scores.score < this.nextBossScore) return;
    this.nextBossScore += Phaser.Math.Between(C.BOSS_INTERVAL_MIN, C.BOSS_INTERVAL_MAX);
    this.startBoss();
  }

  private startBoss(): void {
    this.mode = 'boss';
    this.bossStage = 0;
    this.bossDying = false;
    this.bossScale = 1;
    this.bossSpeed = C.BOSS_MOVE_SPEED;
    this.bossDir = Math.random() < 0.5 ? 1 : -1;
    this.bossShotsLeft = 0;
    this.bossShotTimer = 0;
    this.bossCycleTimer = 650;

    // Cookies and their bullets step aside for the fight.
    for (const c of this.cookies) c.img.destroy();
    this.cookies = [];
    for (const b of this.cookieBullets) b.obj.destroy();
    this.cookieBullets = [];

    // Largest word becomes the boss; the rest fade to black.
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

    // Stays near the top at its normal size + blue; it expands on the first hit.
    chosen.setDepth(12).setScale(1).setColor(hex(C.BOSS_COLORS[0]));
    chosen.y = C.BOSS_PATROL_Y;
    chosen.x = Phaser.Math.Clamp(chosen.x, C.BOSS_MARGIN, C.WIDTH - C.BOSS_MARGIN);
    this.boss = chosen;
  }

  private updateBoss(delta: number): void {
    const boss = this.boss;
    if (!boss) return;
    const dt = delta / 1000;

    boss.x += this.bossDir * this.bossSpeed * dt;
    if (boss.x <= C.BOSS_MARGIN || boss.x >= C.WIDTH - C.BOSS_MARGIN) {
      this.bossDir *= -1;
      boss.x = Phaser.Math.Clamp(boss.x, C.BOSS_MARGIN, C.WIDTH - C.BOSS_MARGIN);
    }

    if (!this.bossDying) {
      const burst = C.BOSS_BURSTS[this.bossStage];
      if (this.bossShotsLeft > 0) {
        this.bossShotTimer -= delta;
        if (this.bossShotTimer <= 0) {
          this.bossLasers.push(this.aimed(boss.x, boss.y, C.BOSS_LASER_SPEED, C.BOSS_LASER_COLOR));
          this.audio.play('laser');
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
    }

    this.updateProjectiles(this.bossLasers, delta);
  }

  private hitBoss(): void {
    const boss = this.boss;
    if (!boss || this.bossDying) return;
    this.bossStage++;
    this.shotsHit++;
    this.audio.play('hit');

    if (this.bossStage >= C.BOSS_HITS_TO_KILL) {
      this.bossDying = true;
      boss.setColor(hex(C.BOSS_COLORS[3])); // red
      this.impact('light');
      this.tweens.add({ targets: boss, angle: 8, duration: 90, yoyo: true });
      this.time.delayedCall(160, () => this.killBoss());
      return;
    }

    // First hit reveals the full boss size; every hit then grows it +10%.
    if (this.bossStage === 1) this.bossScale = C.BOSS_SIZE;
    this.bossScale *= C.BOSS_GROW;
    this.bossSpeed *= C.BOSS_SPEED_GROW;
    boss.setColor(hex(C.BOSS_COLORS[this.bossStage]));
    this.tweens.add({
      targets: boss,
      scaleX: this.bossScale,
      scaleY: this.bossScale,
      duration: 200,
      ease: 'Back.Out',
    });
    this.impact('light');
  }

  private killBoss(): void {
    const boss = this.boss;
    if (!boss) return;
    this.boom(boss.x, boss.y, C.BOSS_LASER_COLOR, 28);
    this.impact('heavy');
    this.audio.play('explode');
    this.popScore(boss.x, boss.y, C.BOSS_SCORE);
    boss.destroy();
    this.boss = undefined;
    for (const l of this.bossLasers) l.obj.destroy();
    this.bossLasers = [];
    this.bossDying = false;

    // New level — flash a banner and hold the word flow for a breather.
    this.mode = 'flow';
    this.level++;
    this.spawnTimer = 0;
    this.levelPauseTimer = C.LEVEL_BANNER_MS;
    this.showLevelBanner();
  }

  private showLevelBanner(): void {
    const banner = this.add
      .text(C.WIDTH / 2, C.HEIGHT / 2, `LEVEL ${this.level}`, {
        fontFamily: 'monospace',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#fcfc00',
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setScale(0.4)
      .setAlpha(0);
    this.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 280, ease: 'Back.Out' });
    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: C.LEVEL_BANNER_MS - 320,
      duration: 320,
      onComplete: () => banner.destroy(),
    });
    this.impact('light');
  }

  // --- projectiles + collisions ------------------------------------------

  private aimed(x: number, y: number, speed: number, color: number): Projectile {
    const dx = this.player.x - x;
    const dy = this.player.y - y;
    const len = Math.hypot(dx, dy) || 1;
    const obj = this.add.rectangle(x, y, 3, 7, color).setDepth(8);
    obj.rotation = Math.atan2(dy, dx) + Math.PI / 2;
    return { obj, vx: (dx / len) * speed, vy: (dy / len) * speed };
  }

  private updateProjectiles(list: Projectile[], delta: number): void {
    const dt = delta / 1000;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.obj.x += p.vx * dt;
      p.obj.y += p.vy * dt;
      if (p.obj.y > C.HEIGHT + 8 || p.obj.y < -8 || p.obj.x < -8 || p.obj.x > C.WIDTH + 8) {
        p.obj.destroy();
        list.splice(i, 1);
      }
    }
  }

  private resolveCollisions(): void {
    const player = this.player.getBounds();
    const hit = (a: Phaser.Geom.Rectangle, b: Phaser.Geom.Rectangle) =>
      Phaser.Geom.Intersects.RectangleToRectangle(a, b);

    // Words.
    for (let i = this.words.length - 1; i >= 0; i--) {
      const word = this.words[i];
      const box = word.getBounds();
      if (hit(box, player)) return this.die();
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        if (hit(box, this.bullets[j].getBounds())) {
          this.shotsHit++;
          this.streak++;
          if (this.streak > this.bestStreak) {
            this.bestStreak = this.streak;
            this.saveBestStreak();
          }
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

    // Cookies.
    for (let i = this.cookies.length - 1; i >= 0; i--) {
      const box = this.cookies[i].img.getBounds();
      if (hit(box, player)) return this.die();
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        if (hit(box, this.bullets[j].getBounds())) {
          this.bullets[j].destroy();
          this.bullets.splice(j, 1);
          this.killCookie(i);
          break;
        }
      }
    }

    // Boss.
    if (this.boss && !this.bossDying) {
      const box = this.boss.getBounds();
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        if (hit(box, this.bullets[j].getBounds())) {
          this.bullets[j].destroy();
          this.bullets.splice(j, 1);
          this.hitBoss();
          break;
        }
      }
    }

    // Enemy fire.
    for (const p of [...this.cookieBullets, ...this.bossLasers]) {
      if (hit(p.obj.getBounds(), player)) return this.die();
    }
  }

  // --- stats -------------------------------------------------------------

  private updateStats(): void {
    const wpm = Math.round(60000 / this.spawnGap());
    const acc = this.shotsFired > 0 ? Math.round((this.shotsHit / this.shotsFired) * 100) : 100;
    this.statsText.setText(
      `WPM ${wpm}    ACC ${acc}%\nSTREAK ${this.streak}    BEST ${this.bestStreak}`,
    );
  }

  private loadBestStreak(): number {
    try {
      return parseInt(window.localStorage.getItem(BEST_STREAK_KEY) ?? '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  private saveBestStreak(): void {
    try {
      window.localStorage.setItem(BEST_STREAK_KEY, String(this.bestStreak));
    } catch {
      // ignore (private mode / disabled storage)
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
