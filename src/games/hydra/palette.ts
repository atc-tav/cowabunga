import type { PixelPalette } from '../../shared/textures';

/**
 * HYDRA palette — neon grid arena. Serpent greens for the AI snake, a cool
 * steel/cyan ship, amber pellets, and the three venom colors (paralyze green,
 * insanity red, death black). Mirrors the token→hex table in
 * `specs/hydra-original.md` §14.5.
 */
export const COLORS = {
  bg: 0x0a0a14, // arena background
  gridLine: 0x16162a, // faint grid lines

  // Ship
  hull: 0xc8d0e0,
  cockpit: 0x3cbcfc,
  engine: 0xfca800,
  bullet: 0xfff0a0,
  smoke: 0x8890a0,

  // Snake
  headGreen: 0x5ec43a,
  eyeRed: 0xd1232a,
  fang: 0xf4f0d8,
  bodyOuter: 0x4a9e2c,
  bodyInner: 0x9be86a,

  // Pellet + venom
  pellet: 0xffd23c,
  venomGreen: 0x3adb5a, // paralyze
  venomRed: 0xe23c3c, // insanity
  venomBlack: 0x202028, // death poison
} as const;

export const HYDRA_PALETTE: PixelPalette = {
  H: COLORS.headGreen,
};
