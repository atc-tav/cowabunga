import Phaser from 'phaser';
import { TileWorld } from './TileWorld';

/**
 * Draws one tile into the shared graphics buffer. Implementations look up the
 * tile `code` and paint a cell at world-local (px,py) of side `size`. Codes the
 * implementation doesn't recognise should draw nothing (stay transparent).
 */
export type TileDraw = (
  gfx: Phaser.GameObjects.Graphics,
  code: string,
  px: number,
  py: number,
  size: number,
) => void;

/**
 * The simplest `TileDraw`: a flat colour per tile code. Codes absent from the
 * map render nothing. For richer tiles (bevels, edges) pass your own `TileDraw`.
 */
export function colorTileDraw(colors: Record<string, number>): TileDraw {
  return (gfx, code, px, py, size) => {
    const color = colors[code];
    if (color === undefined) {
      return;
    }
    gfx.fillStyle(color, 1);
    gfx.fillRect(px, py, size, size);
  };
}

/**
 * Bake the static tile layer of `world` into a single level-sized RenderTexture
 * positioned at the world offset. The `WorldCamera` then scrolls over it
 * (scrollFactor 1) — one draw at create time, cheap to scroll afterwards.
 *
 * This trades GPU memory (a texture the size of the whole level) for simplicity;
 * fine at arcade level sizes. If a level grows huge, swap this for chunked
 * RenderTextures around the camera without changing any game code.
 */
export function renderTileLayer(
  scene: Phaser.Scene,
  world: TileWorld,
  draw: TileDraw,
  depth = 0,
): Phaser.GameObjects.RenderTexture {
  const ts = world.tileSize;
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
  world.forEach((code, col, row) => {
    draw(gfx, code, col * ts, row * ts, ts);
  });

  const rt = scene.add
    .renderTexture(world.offsetX, world.offsetY, world.pixelWidth, world.pixelHeight)
    .setOrigin(0, 0)
    .setDepth(depth);
  rt.draw(gfx, 0, 0);
  gfx.destroy();
  return rt;
}
