import Phaser from 'phaser';
import { InputManager } from './InputManager';
import { ScoreManager } from './ScoreManager';
import { SoundManager } from './SoundManager';
import { CRTOverlay } from './CRTOverlay';
import { HUD_STYLE } from './ui';

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

    this.createHud();
    this.createGame();
    this.crt.apply();
  }

  /** Phaser lifecycle — concrete games override `updateGame()` instead. */
  update(time: number, delta: number): void {
    this.controls.update();
    if (this.controls.justPressed('cancel')) {
      this.returnToMenu();
      return;
    }
    this.updateGame(time, delta);
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

  protected returnToMenu(): void {
    this.scene.start('MainMenu');
  }

  private createHud(): void {
    this.scoreText = this.add
      .text(4, 4, 'SCORE 0', HUD_STYLE)
      .setDepth(1000);
    this.highText = this.add
      .text(this.nativeWidth - 4, 4, `HI ${this.scores.high}`, HUD_STYLE)
      .setOrigin(1, 0)
      .setDepth(1000);
  }
}
