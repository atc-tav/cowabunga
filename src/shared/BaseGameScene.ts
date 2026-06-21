import Phaser from 'phaser';
import { InputManager } from './InputManager';
import { ScoreManager } from './ScoreManager';
import { SoundManager } from './SoundManager';
import { CRTOverlay } from './CRTOverlay';
import { screenShake, ImpactPreset } from './juice';
import { floatingText, FloatingTextOptions } from './popups';
import { HUD_STYLE, LABEL_STYLE } from './ui';
import { TouchControls } from './TouchControls';
import { fadeToScene, fadeSceneIn } from './transition';

export interface BaseGameSceneConfig {
  /** Phaser scene key (must be unique + match the registry entry). */
  key: string;
  /** Stable id used for the localStorage high-score namespace. */
  gameId: string;
  /** Native render resolution for this game (e.g. 224×288). */
  width: number;
  height: number;
}

/**
 * The reusable backbone every game extends. It owns the shared services
 * (input, score, audio, CRT), sets the per-game resolution, draws a common
 * HUD, and handles the universal "back to menu" flow — so a concrete game only
 * implements `createGame()` and `updateGame()`.
 */
export abstract class BaseGameScene extends Phaser.Scene {
  protected readonly gameId: string;
  protected readonly nativeWidth: number;
  protected readonly nativeHeight: number;

  protected controls!: InputManager;
  protected scores!: ScoreManager;
  protected audio!: SoundManager;
  protected crt!: CRTOverlay;

  private scoreText?: Phaser.GameObjects.Text;
  private highText?: Phaser.GameObjects.Text;
  private pauseText?: Phaser.GameObjects.Text;
  private paused = false;
  private transitioning = false;

  constructor(config: BaseGameSceneConfig) {
    super({ key: config.key });
    this.gameId = config.gameId;
    this.nativeWidth = config.width;
    this.nativeHeight = config.height;
  }

  /** Phaser lifecycle — concrete games override `createGame()` instead. */
  create(): void {
    this.scale.resize(this.nativeWidth, this.nativeHeight);
    this.cameras.main.setBackgroundColor('#000000');

    this.controls = new InputManager(this);
    this.scores = new ScoreManager(this.gameId);
    this.audio = new SoundManager();
    this.crt = new CRTOverlay(this);

    // Unlock the (deferred) audio context on the first input gesture.
    this.controls.onFirstInput(() => this.audio.unlock());

    this.paused = false;
    this.transitioning = false;
    fadeSceneIn(this);
    // Touch overlay: a game shows the Home (exit-to-menu) button.
    TouchControls.shared?.setHomeVisible(true);
    this.createHud();
    this.createGame();
    this.crt.apply();
  }

  /** Phaser lifecycle — concrete games override `updateGame()` instead. */
  update(time: number, delta: number): void {
    this.controls.update();
    if (this.transitioning) {
      return;
    }
    if (this.controls.justPressed('pause')) {
      this.togglePause();
    }
    if (this.paused) {
      return;
    }
    if (this.controls.justPressed('cancel')) {
      this.returnToMenu();
      return;
    }
    this.updateGame(time, delta);
  }

  /** Universal pause (Enter): freezes game update, tweens, and timers. */
  private togglePause(): void {
    this.paused = !this.paused;
    if (this.paused) {
      this.tweens.pauseAll();
      this.time.paused = true;
    } else {
      this.tweens.resumeAll();
      this.time.paused = false;
    }
    this.pauseText?.setVisible(this.paused);
  }

  /** Build the game world. Called once after services are ready. */
  protected abstract createGame(): void;

  /** Per-frame game logic. */
  protected abstract updateGame(time: number, delta: number): void;

  /** Add points and refresh the HUD. The common path for scoring. */
  protected addScore(points: number): void {
    this.scores.add(points);
    this.scoreText?.setText(`SCORE ${this.scores.score}`);
    this.highText?.setText(`HI ${this.scores.high}`);
  }

  /**
   * Score with feedback: bank the points AND float them from where they were
   * earned. The shared "reward popup" convention — use it for positioned score
   * events (a ghost eaten, a barrel smashed, an enemy shot) so confirmation is
   * consistent across games.
   */
  protected popScore(
    x: number,
    y: number,
    points: number,
    opts?: FloatingTextOptions,
  ): void {
    this.addScore(points);
    floatingText(this, x, y, String(points), opts);
  }

  /**
   * Screen-shake impact, gated by the global juice toggle (off for the RL
   * dojo). Reserve it for genuine impacts — a death, a slam, a POW — not every
   * point scored.
   */
  protected impact(preset: ImpactPreset = 'medium'): void {
    screenShake(this, preset);
  }

  /**
   * Hide (or show) the default single-score HUD. A game that draws its own HUD
   * — e.g. a two-player split score — calls this with `false` in createGame().
   */
  protected showDefaultHud(show: boolean): void {
    this.scoreText?.setVisible(show);
    this.highText?.setVisible(show);
  }

  protected returnToMenu(): void {
    if (this.transitioning) {
      return;
    }
    this.transitioning = true;
    // Tell the menu which game we came from, so it re-selects it.
    fadeToScene(this, 'MainMenu', { data: { lastGameId: this.gameId } });
  }

  private createHud(): void {
    this.scoreText = this.add
      .text(4, 4, 'SCORE 0', HUD_STYLE)
      .setDepth(1000);
    this.highText = this.add
      .text(this.nativeWidth - 4, 4, `HI ${this.scores.high}`, HUD_STYLE)
      .setOrigin(1, 0)
      .setDepth(1000);
    this.pauseText = this.add
      .text(this.nativeWidth / 2, this.nativeHeight / 2, 'PAUSE', LABEL_STYLE)
      .setOrigin(0.5)
      .setColor('#ffffff')
      .setDepth(2000)
      .setVisible(false);
  }
}
