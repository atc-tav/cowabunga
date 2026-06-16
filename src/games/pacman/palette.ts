import type { PixelPalette } from '../../shared/textures';

/**
 * Pac-Man palette — authentic arcade colours: the deep maze blue, the pink
 * ghost-house door, peach pellets, and the unmistakable yellow.
 */
export const COLORS = {
  wall: 0x2121de, // maze blue
  door: 0xffb8de, // ghost-house door pink
  dot: 0xffb897, // pellet peach
  energizer: 0xffb897,
  pacman: 0xffff00,
  ghostBlinky: 0xff0000, // Blinky red
  ghostEye: 0xffffff,
  ghostPupil: 0x2121ff,
} as const;

export const PAC_PALETTE: PixelPalette = {
  Y: COLORS.pacman,
};
