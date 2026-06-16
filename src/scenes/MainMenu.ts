import Phaser from 'phaser';
import { GAMES } from '../registry';
import { InputManager } from '../shared/InputManager';
import { UI_COLORS, TITLE_STYLE, LABEL_STYLE, HINT_STYLE } from '../shared/ui';

/**
 * The arcade launcher. Builds a tile per registered game, supports arrow/WASD
 * + gamepad navigation, Enter/Space to launch, and a 1Hz "INSERT COIN" blink.
 * (Attract-mode mini animations per tile come later, per the brief.)
 */
export class MainMenu extends Phaser.Scene {
  private static readonly W = 256;
  private static readonly H = 288;
  private static readonly COLS = 2;
  private static readonly TILE_W = 100;
  private static readonly TILE_H = 52;
  private static readonly GAP_X = 16;
  private static readonly GAP_Y = 16;

  private controls!: InputManager;
  private selected = 0;
  private tiles: Phaser.GameObjects.Container[] = [];
  private coinText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MainMenu' });
  }

  create(): void {
    const { W, H } = MainMenu;
    this.scale.resize(W, H);
    this.cameras.main.setBackgroundColor('#000000');
    this.controls = new InputManager(this);

    this.add.text(W / 2, 24, 'COWABUNGA', TITLE_STYLE).setOrigin(0.5);
    this.add
      .text(W / 2, 46, 'A R C A D E', LABEL_STYLE)
      .setOrigin(0.5)
      .setColor('#3cbcfc');

    this.buildTiles();

    this.coinText = this.add
      .text(W / 2, H - 28, 'INSERT COIN', LABEL_STYLE)
      .setOrigin(0.5)
      .setColor('#fcfc00');
    this.add
      .text(W / 2, H - 12, 'ARROWS: SELECT    ENTER: PLAY', HINT_STYLE)
      .setOrigin(0.5);

    // 1Hz blink (toggle visibility twice per second).
    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => this.coinText.setVisible(!this.coinText.visible),
    });

    this.refreshSelection();
  }

  update(): void {
    this.controls.update();
    if (this.controls.justPressed('left')) {
      this.move(-1);
    } else if (this.controls.justPressed('right')) {
      this.move(1);
    } else if (this.controls.justPressed('up')) {
      this.move(-MainMenu.COLS);
    } else if (this.controls.justPressed('down')) {
      this.move(MainMenu.COLS);
    }
    if (this.controls.justPressed('confirm')) {
      this.scene.start(GAMES[this.selected].key);
    }
  }

  private buildTiles(): void {
    const { W, COLS, TILE_W, TILE_H, GAP_X, GAP_Y } = MainMenu;
    const rowWidth = COLS * TILE_W + (COLS - 1) * GAP_X;
    const startX = (W - rowWidth) / 2 + TILE_W / 2;
    const startY = 92;

    this.tiles = GAMES.map((game, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = startX + col * (TILE_W + GAP_X);
      const y = startY + row * (TILE_H + GAP_Y);

      const border = this.add
        .rectangle(0, 0, TILE_W, TILE_H, UI_COLORS.black)
        .setStrokeStyle(2, UI_COLORS.cyan);
      const label = this.add
        .text(0, 0, game.title, LABEL_STYLE)
        .setOrigin(0.5);

      return this.add.container(x, y, [border, label]);
    });
  }

  private move(delta: number): void {
    const n = GAMES.length;
    if (n === 0) {
      return;
    }
    this.selected = (this.selected + delta + n) % n;
    this.refreshSelection();
  }

  private refreshSelection(): void {
    this.tiles.forEach((tile, i) => {
      const border = tile.getAt(0) as Phaser.GameObjects.Rectangle;
      const active = i === this.selected;
      border.setStrokeStyle(active ? 3 : 2, active ? UI_COLORS.yellow : UI_COLORS.cyan);
      tile.setScale(active ? 1.06 : 1);
    });
  }
}
