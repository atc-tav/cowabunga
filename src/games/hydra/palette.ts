import type { PixelPalette } from '../../shared/textures';

/**
 * HYDRA palette. Green serpent + weak blue serpents, a steel/cyan ship and a
 * pink ally wingman, amber pellets, a red bait-mine, and the venom colours
 * (green slow / red scramble / blue transform).
 */
export const COLORS = {
  bg: 0x0a0a14,
  gridLine: 0x16162a,

  // Player ship
  hull: 0xc8d0e0,
  cockpit: 0x3cbcfc,
  engine: 0xfca800,
  bullet: 0xfff0a0,
  smoke: 0x8890a0,

  // Wingman (ally ship)
  wingHull: 0xff8adf,
  wingCockpit: 0xffffff,
  wingEngine: 0xff3ca0,

  // Green snake (normal)
  headGreen: 0x5ec43a,
  eyeRed: 0xd1232a,
  fang: 0xf4f0d8,
  bodyOuter: 0x4a9e2c,
  bodyInner: 0x9be86a,

  // Blue snake (weak: one shot, never grows)
  headBlue: 0x3c7bff,
  bodyBlueOuter: 0x2b5fd0,
  bodyBlueInner: 0x9bc0ff,

  // Pellet / mine / egg
  pellet: 0xffd23c,
  mine: 0xff3030,
  mineCore: 0x2a0000,
  egg: 0xcfe0ff,

  // Venom
  venomGreen: 0x3adb5a, // slow + exposes you
  venomRed: 0xe23c3c, // speed + reversed controls
  venomBlue: 0x3cbcfc, // transform into a blue snake

  // Special shots
  fireShot: 0xff7a1a,
  iceShot: 0x7adfff,

  // UI
  meterFill: 0xffd23c,
  meterBg: 0x2a2a3a,
} as const;

export const HYDRA_PALETTE: PixelPalette = {
  H: COLORS.headGreen,
};
