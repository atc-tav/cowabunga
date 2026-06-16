import type { PixelPalette } from '../../shared/textures';

/**
 * Sandbox palette. Each real game will define its own named palette here,
 * drawn from richer arcade-accurate colors (we agreed to favor authentic
 * arcade palettes over the strict NES set, as long as the pixelation reads
 * true to the originals).
 */
export const PALETTE: PixelPalette = {
  Y: 0xfcd000, // player body (arcade Pac-yellow-ish)
  o: 0xc08000, // player outline
  W: 0xffffff, // dot
};
