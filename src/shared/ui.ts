import Phaser from 'phaser';

/**
 * Shared UI constants. A handful of common arcade colors and text styles used
 * by the menu + HUD across all games.
 *
 * NOTE: Phaser text uses the system monospace font (not a bundled font file),
 * which is fine for the scaffold/HUD. The brief's "no font files" rule is
 * satisfied; if we later want a true pixel font we'll render glyphs
 * programmatically via the same drawPixelArt primitive.
 */
export const UI_COLORS = {
  white: 0xffffff,
  black: 0x000000,
  red: 0xd82800,
  yellow: 0xfcfc00,
  cyan: 0x3cbcfc,
  green: 0x00b800,
  gray: 0x888888,
} as const;

export const HUD_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '10px',
  color: '#ffffff',
};

export const TITLE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '24px',
  color: '#fcfc00',
};

export const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '12px',
  color: '#ffffff',
};

export const HINT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '8px',
  color: '#888888',
};
