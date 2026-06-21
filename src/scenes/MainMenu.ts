import Phaser from 'phaser';
import { GAMES, GameEntry } from '../registry';
import { InputManager } from '../shared/InputManager';
import { UI_COLORS, HINT_STYLE } from '../shared/ui';
import { buildPreview, Preview } from './previews';
import { drawCowabungaLogo } from './logo';
import { TouchControls } from '../shared/TouchControls';

/**
 * The arcade launcher. A single "channel" carousel: the selected game animates
 * inside an 80s-TV screen, its title sits above a left/right selector, and the
 * scroll wraps infinitely so the cabinet scales past one screenful of games.
 *
 * Enter (START) or Space (ACTION) launches; both map to the `confirm` action,
 * which also covers gamepad A / Start — so the controller works for free.
 */
export class MainMenu extends Phaser.Scene {
  private static readonly W = 256;
  private static readonly H = 288;

  // 80s-TV geometry (bezel outer, recessed screen inner). Sits below the logo.
  private static readonly BEZEL = { x: 16, y: 78, w: 224, h: 116, r: 14 };
  private static readonly SCREEN = { x: 28, y: 92, w: 160, h: 90, r: 8 };

  private static readonly TITLE_Y = 206;
  private static readonly SELECTOR_Y = 230;

  private controls!: InputManager;
  private games: GameEntry[] = [];
  private selected = 0;

  private gameTitle!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private dots: Phaser.GameObjects.Arc[] = [];
  private leftArrow!: Phaser.GameObjects.Triangle;
  private rightArrow!: Phaser.GameObjects.Triangle;

  private screenMask!: Phaser.Display.Masks.GeometryMask;
  private previewLayer?: Phaser.GameObjects.Container;
  private preview?: Preview;

  constructor() {
    super({ key: 'MainMenu' });
  }

  create(): void {
    const { W, H } = MainMenu;
    this.scale.resize(W, H);
    this.cameras.main.setBackgroundColor('#000000');
    this.controls = new InputManager(this);
    this.games = GAMES.filter((g) => !g.hidden);
    this.selected = 0;
    // The menu is "home" — hide the touch Home button here.
    TouchControls.shared?.setHomeVisible(false);

    drawCowabungaLogo(this, W / 2, 6);

    this.buildTV();
    this.buildSelector();

    this.coinText = this.add
      .text(W / 2, H - 30, 'INSERT COIN', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#fcfc00',
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.add
      .text(W / 2, H - 14, '< >: SELECT    ENTER/SPACE: PLAY', HINT_STYLE)
      .setOrigin(0.5)
      .setDepth(20);

    // 1Hz blink (toggle visibility twice per second).
    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => this.coinText.setVisible(!this.coinText.visible),
    });

    this.loadPreview();
    this.refresh();
  }

  update(time: number, delta: number): void {
    this.controls.update();
    if (this.controls.justPressed('left')) {
      this.move(-1);
    } else if (this.controls.justPressed('right')) {
      this.move(1);
    }
    if (this.controls.justPressed('confirm') && this.games.length > 0) {
      this.scene.start(this.games[this.selected].key);
      return;
    }
    this.preview?.update(time, delta);
  }

  /** Draw the TV cabinet: bezel, recessed screen, control knobs, scanlines. */
  private buildTV(): void {
    const { BEZEL, SCREEN } = MainMenu;
    const g = this.add.graphics().setDepth(0);
    // Bezel.
    g.fillStyle(0x4a4a4a, 1);
    g.fillRoundedRect(BEZEL.x, BEZEL.y, BEZEL.w, BEZEL.h, BEZEL.r);
    g.lineStyle(2, 0x202020, 1);
    g.strokeRoundedRect(BEZEL.x, BEZEL.y, BEZEL.w, BEZEL.h, BEZEL.r);
    // Recessed dark screen (fills the rounded corners behind the preview).
    g.fillStyle(0x05140a, 1);
    g.fillRoundedRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, SCREEN.r);
    g.lineStyle(2, 0x0c2c18, 1);
    g.strokeRoundedRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, SCREEN.r);

    // Control panel on the right: two knobs, a power LED, a speaker grille.
    const panelX = SCREEN.x + SCREEN.w + 26;
    const knobs = this.add.graphics().setDepth(1);
    for (const ky of [SCREEN.y + 20, SCREEN.y + 48]) {
      knobs.fillStyle(0x2a2a2a, 1);
      knobs.fillCircle(panelX, ky, 9);
      knobs.lineStyle(2, 0x111111, 1);
      knobs.strokeCircle(panelX, ky, 9);
      knobs.lineStyle(2, 0x888888, 1);
      knobs.beginPath();
      knobs.moveTo(panelX, ky);
      knobs.lineTo(panelX + 6, ky - 5);
      knobs.strokePath();
    }
    knobs.fillStyle(0x00ff66, 1);
    knobs.fillCircle(panelX, SCREEN.y + 72, 3);
    knobs.lineStyle(2, 0x222222, 1);
    for (let i = 0; i < 4; i++) {
      const gy = SCREEN.y + 82 + i * 4;
      knobs.beginPath();
      knobs.moveTo(panelX - 9, gy);
      knobs.lineTo(panelX + 9, gy);
      knobs.strokePath();
    }

    // Masked overlay: CRT scanlines + a slow shimmer band.
    const maskG = this.make.graphics({ x: 0, y: 0 }, false);
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRoundedRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, SCREEN.r);
    this.screenMask = maskG.createGeometryMask();

    const fx = this.add.container(SCREEN.x, SCREEN.y).setDepth(8);
    fx.setMask(this.screenMask);
    const lines = this.add.graphics();
    lines.fillStyle(0x000000, 0.18);
    for (let y = 0; y < SCREEN.h; y += 2) {
      lines.fillRect(0, y, SCREEN.w, 1);
    }
    fx.add(lines);
    const band = this.add.rectangle(0, 0, SCREEN.w, 14, 0xffffff, 0.05).setOrigin(0, 0);
    fx.add(band);
    this.tweens.add({
      targets: band,
      y: SCREEN.h,
      duration: 2600,
      repeat: -1,
      ease: 'Linear',
    });
  }

  /** Build the game title + the left/right selector row with position dots. */
  private buildSelector(): void {
    const { W, TITLE_Y, SELECTOR_Y } = MainMenu;
    this.gameTitle = this.add
      .text(W / 2, TITLE_Y, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(20);

    // Triangle arrows flanking the dot strip.
    this.leftArrow = this.add
      .triangle(W / 2 - 70, SELECTOR_Y, 10, 0, 10, 12, 0, 6, UI_COLORS.cyan)
      .setDepth(20);
    this.rightArrow = this.add
      .triangle(W / 2 + 70, SELECTOR_Y, 0, 0, 0, 12, 10, 6, UI_COLORS.cyan)
      .setDepth(20);

    const n = this.games.length;
    const spacing = 10;
    const startX = W / 2 - ((n - 1) * spacing) / 2;
    this.dots = this.games.map((_, i) =>
      this.add
        .circle(startX + i * spacing, SELECTOR_Y, 2, UI_COLORS.gray)
        .setDepth(20),
    );
  }

  private move(dir: number): void {
    const n = this.games.length;
    if (n === 0) {
      return;
    }
    this.selected = (this.selected + dir + n) % n;
    this.loadPreview();
    this.refresh();
    const arrow = dir < 0 ? this.leftArrow : this.rightArrow;
    arrow.setFillStyle(UI_COLORS.yellow);
    this.tweens.add({
      targets: arrow,
      scale: { from: 1.4, to: 1 },
      duration: 160,
      onComplete: () => arrow.setFillStyle(UI_COLORS.cyan),
    });
  }

  /** Swap the TV channel: tear down the old vignette, build the selected one. */
  private loadPreview(): void {
    const { SCREEN } = MainMenu;
    this.preview?.destroy();
    this.previewLayer?.destroy();
    if (this.games.length === 0) {
      return;
    }

    const layer = this.add.container(SCREEN.x, SCREEN.y).setDepth(5);
    layer.setMask(this.screenMask);
    this.preview = buildPreview(this.games[this.selected].id, this, layer, {
      width: SCREEN.w,
      height: SCREEN.h,
    });
    this.previewLayer = layer;

    // Brief "channel change" static flash.
    const flash = this.add
      .rectangle(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, 0xffffff, 0.7)
      .setOrigin(0)
      .setDepth(7);
    flash.setMask(this.screenMask);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy(),
    });
  }

  private refresh(): void {
    if (this.games.length === 0) {
      this.gameTitle.setText('NO GAMES');
      return;
    }
    this.gameTitle.setText(this.games[this.selected].title);
    this.dots.forEach((dot, i) =>
      dot.setFillStyle(i === this.selected ? UI_COLORS.yellow : UI_COLORS.gray),
    );
  }
}
