import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { COLORS } from './palette';
import { TX, buildPrivacyTextures } from './sprites';
import * as C from './constants';

interface Star {
  img: Phaser.GameObjects.Image;
  speed: number;
}

type Phase = 'intro' | 'play' | 'over';

/**
 * Privacy Policy — a hidden Galaga riff. The "PRIVACY POLICY" logo zooms in
 * Star Wars-style, then the policy scrolls down as falling words the player
 * shoots (or dodges). One life: a word touching the ship ends the run, words
 * that reach the bottom vanish harmlessly, and the longer you last the faster
 * the policy falls. Ship, bullets, and starfield mirror Galaga.
 */
export class PrivacyPolicyScene extends BaseGameScene {
  private phase: Phase = 'intro';
  private stars: Star[] = [];
  private player!: Phaser.GameObjects.Image;
  private bullets: Phaser.GameObjects.Image[] = [];
  private words: Phaser.GameObjects.Text[] = [];
  private wordList: string[] = [];
  private wordIndex = 0;
  private survived = 0; // seconds in the play phase
  private spawnTimer = 0;

  constructor() {
    super({ key: 'game-privacypolicy', gameId: 'privacypolicy', width: C.WIDTH, height: C.HEIGHT });
  }

  protected createGame(): void {
    buildPrivacyTextures(this);
    this.wordList = C.POLICY_TEXT.split(/\s+/).filter(Boolean);
    this.wordIndex = 0;
    this.survived = 0;
    this.spawnTimer = 0;
    this.bullets = [];
    this.words = [];

    this.createStarfield();
    this.player = this.add
      .image(C.WIDTH / 2, C.PLAYER_Y, TX.ship)
      .setDepth(10)
      .setVisible(false);

    this.phase = 'intro';
    this.playIntro();
  }

  protected updateGame(_time: number, delta: number): void {
    this.updateStars(delta);

    if (this.phase === 'intro') {
      if (this.controls.justPressed('fire')) {
        this.skipIntro();
      }
      return;
    }
    if (this.phase === 'over') {
      if (this.controls.justPressed('fire')) {
        this.returnToMenu();
      }
      return;
    }

    this.survived += delta / 1000;
    this.movePlayer(delta);
    this.tryFire();
    this.updateBullets(delta);
    this.spawnWords(delta);
    this.updateWords(delta);
    this.resolveHits();
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

  private logo?: Phaser.GameObjects.Container;

  private playIntro(): void {
    const gold = `#${COLORS.logo.toString(16).padStart(6, '0')}`;
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

    // Recede into the distance, then fade out — the Star Wars opening beat.
    this.tweens.add({ targets: logo, scale: 0.08, duration: C.INTRO_MS, ease: 'Sine.In' });
    this.tweens.add({
      targets: logo,
      alpha: 0,
      delay: C.INTRO_MS * 0.55,
      duration: C.INTRO_MS * 0.45,
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
    if (this.phase !== 'intro') {
      return;
    }
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
    if (!this.controls.justPressed('fire') || this.bullets.length >= C.MAX_BULLETS) {
      return;
    }
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
    if (this.spawnTimer > 0) {
      return;
    }
    const gap = Math.max(C.WORD_SPAWN_MIN_MS, C.WORD_SPAWN_MS - this.survived * C.WORD_SPAWN_RAMP);
    this.spawnTimer = gap;

    const text = this.wordList[this.wordIndex % this.wordList.length];
    this.wordIndex++;
    const word = this.add
      .text(0, -6, text, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: `#${COLORS.word.toString(16).padStart(6, '0')}`,
      })
      .setOrigin(0.5)
      .setDepth(5);
    const half = word.width / 2;
    word.x = Phaser.Math.Between(Math.ceil(half) + 2, C.WIDTH - Math.ceil(half) - 2);
    this.words.push(word);
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

  private resolveHits(): void {
    const playerBox = this.player.getBounds();
    for (let i = this.words.length - 1; i >= 0; i--) {
      const word = this.words[i];
      const box = word.getBounds();

      // Word reaches the ship → death.
      if (Phaser.Geom.Intersects.RectangleToRectangle(box, playerBox)) {
        this.die();
        return;
      }

      // Bullet shoots the word → score.
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        if (Phaser.Geom.Intersects.RectangleToRectangle(box, this.bullets[j].getBounds())) {
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
  }

  // --- death -------------------------------------------------------------

  private die(): void {
    this.phase = 'over';
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
