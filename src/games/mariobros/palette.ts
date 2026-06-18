import type { PixelPalette } from '../../shared/textures';

/** Mario Bros. palette — icy-blue platforms, green pipes, classic Mario. */
export const COLORS = {
  platform: 0x2840e0, // platform body
  platformTop: 0x9cd0ff, // bright top edge
  pipe: 0x00a800,
  pipeRim: 0x00d800,
  pow: 0x00c0c0, // teal — distinct from the blue platforms
  powText: 0xffffff,
  capShirt: 0xff0000,
  skin: 0xfcb088,
  hair: 0x6a3000,
  overalls: 0x2038ec,
  boots: 0x6a3000,
  shell: 0x00a800,
  shellDark: 0x006000,
  shellHead: 0xfcd060,
  shellEye: 0xffffff,
} as const;

export const MARIO_PALETTE: PixelPalette = {
  R: COLORS.capShirt,
  S: COLORS.skin,
  N: COLORS.hair,
  O: COLORS.overalls,
  B: COLORS.boots,
};
