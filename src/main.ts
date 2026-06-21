import Phaser from 'phaser';
import { MainMenu } from './scenes/MainMenu';
import { GAMES } from './registry';
import { TouchControls } from './shared/TouchControls';

/**
 * Game bootstrap. The canvas starts at the menu's size; each scene resizes the
 * scale manager to its own native resolution on entry (so games with different
 * arcade dimensions all upscale crisply via FIT + pixelArt). Adding a game is a
 * one-line registry edit — every entry is registered as a scene here.
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 256,
  height: 288,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    gamepad: true,
  },
};

const game = new Phaser.Game(config);

// Mount on-screen controls on touch devices (no-op on desktop).
TouchControls.init();

game.scene.add('MainMenu', MainMenu, false);
for (const entry of GAMES) {
  game.scene.add(entry.key, entry.SceneClass, false);
}

game.scene.start('MainMenu');
