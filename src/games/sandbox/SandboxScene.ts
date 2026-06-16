import Phaser from 'phaser';
import { BaseGameScene } from '../../shared/BaseGameScene';
import { drawPixelArt } from '../../shared/textures';
import { HINT_STYLE } from '../../shared/ui';
import { PALETTE } from './palette';
import { PLAYER_ART, DOT_ART } from './sprites';

/**
 * Not a real game — a minimal interactive harness that exercises the whole
 * foundation end to end: programmatic textures, BaseGameScene lifecycle,
 * InputManager movement, ScoreManager + localStorage high score, the (no-op)
 * audio/CRT seams, and the return-to-menu flow. Move with arrows/WASD, eat the
 * dots to score, ESC back to the menu.
 */
export class SandboxScene extends BaseGameScene {
  private static readonly PLAYER_SPEED = 90; // px/sec
  private static readonly DOT_COUNT = 12;
  private static readonly PIXEL = 2;

  private player!: Phaser.GameObjects.Image;
  private dots: Phaser.GameObjects.Image[] = [];

  constructor() {
    super({ key: 'game-sandbox', gameId: 'sandbox', width: 224, height: 288 });
  }

  protected createGame(): void {
    drawPixelArt(this, 'sb-player', PLAYER_ART, PALETTE, SandboxScene.PIXEL);
    drawPixelArt(this, 'sb-dot', DOT_ART, PALETTE, SandboxScene.PIXEL);

    this.player = this.add.image(
      this.nativeWidth / 2,
      this.nativeHeight / 2,
      'sb-player',
    );

    this.dots = [];
    for (let i = 0; i < SandboxScene.DOT_COUNT; i++) {
      this.spawnDot();
    }

    this.add.text(4, this.nativeHeight - 12, 'ARROWS/WASD MOVE  ESC MENU', HINT_STYLE);
  }

  protected updateGame(_time: number, delta: number): void {
    const dir = this.controls.direction();
    const step = (SandboxScene.PLAYER_SPEED * delta) / 1000;
    this.player.x = Phaser.Math.Clamp(
      this.player.x + dir.x * step,
      8,
      this.nativeWidth - 8,
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y + dir.y * step,
      28,
      this.nativeHeight - 16,
    );

    for (const dot of this.dots) {
      if (!dot.active) {
        continue;
      }
      const dist = Phaser.Math.Distance.Between(
        dot.x,
        dot.y,
        this.player.x,
        this.player.y,
      );
      if (dist < 8) {
        dot.setActive(false).setVisible(false);
        this.addScore(10);
        this.audio.play('eat');
      }
    }

    // Respawn the field once every dot is eaten so the test loops forever.
    if (this.dots.every((d) => !d.active)) {
      for (const dot of this.dots) {
        dot.setPosition(...this.randomDotPosition()).setActive(true).setVisible(true);
      }
    }
  }

  private spawnDot(): void {
    const [x, y] = this.randomDotPosition();
    this.dots.push(this.add.image(x, y, 'sb-dot'));
  }

  private randomDotPosition(): [number, number] {
    return [
      Phaser.Math.Between(16, this.nativeWidth - 16),
      Phaser.Math.Between(40, this.nativeHeight - 24),
    ];
  }
}
