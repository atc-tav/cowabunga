import Phaser from 'phaser';

/** Maps a single character in an art grid to a 24-bit RGB color. */
export type PixelPalette = Record<string, number>;

/**
 * The core programmatic-sprite primitive every game's `sprites.ts` builds on.
 *
 * Renders a pixel-art grid into a Phaser texture via the Graphics API +
 * generateTexture(). `rows` is an array of equal-length strings; each character
 * is looked up in `palette`. Any character not in the palette (e.g. a space)
 * is left transparent.
 *
 *   drawPixelArt(scene, 'dot', [' WW ', 'WWWW', 'WWWW', ' WW '], { W: 0xffffff });
 *
 * `pixelSize` scales each art cell into N×N device pixels at generation time;
 * combined with Phaser's `pixelArt: true` this keeps edges crisp when upscaled.
 */
export function drawPixelArt(
  scene: Phaser.Scene,
  key: string,
  rows: string[],
  palette: PixelPalette,
  pixelSize = 1,
): void {
  if (scene.textures.exists(key)) {
    return;
  }

  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (color === undefined) {
        continue;
      }
      gfx.fillStyle(color, 1);
      gfx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    }
  }

  const width = (rows[0]?.length ?? 0) * pixelSize;
  const height = rows.length * pixelSize;
  gfx.generateTexture(key, width, height);
  gfx.destroy();
}
