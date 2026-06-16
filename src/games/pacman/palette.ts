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
  ghostBlinky: 0xff0000, // Blinky — red (chaser)
  ghostPinky: 0xffb8ff, // Pinky — pink (ambusher)
  ghostInky: 0x00ffff, // Inky — cyan (flanker)
  ghostClyde: 0xffb852, // Clyde — orange (random)
  ghostEye: 0xffffff,
  ghostPupil: 0x2121ff,
  frightBody: 0x2121ff, // frightened ghost — deep blue
  frightFace: 0xffffff, // frightened eyes/mouth
  frightBlinkBody: 0xffffff, // blink-warning body
  frightBlinkFace: 0xff0000, // blink-warning face
  fruitRed: 0xff0000, // cherry
  fruitStraw: 0xff4444, // strawberry
  fruitOrange: 0xffa020, // orange
  fruitGreen: 0x33cc33, // stems / leaves
  fruitSeed: 0xffe060, // strawberry seeds
} as const;

export const PAC_PALETTE: PixelPalette = {
  Y: COLORS.pacman,
};
