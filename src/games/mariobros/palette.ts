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
  crab: 0xf83800, // Sidestepper red
  crabDark: 0xa01000,
  crabEye: 0xffffff,
  crabClaw: 0xfca044,
  crabAngry: 0xff9090, // tint when sped-up after the first bump
  enemyLast: 0x4878ff, // the last enemy of a phase turns blue (super-fast)
  fly: 0x6868f8, // Fighter Fly body
  flyEye: 0xffffff,
  flyWing: 0xc0c0ff,
  slipice: 0x90d0f0, // Freezie ice body
  slipiceCrystal: 0xffffff,
  slipiceEye: 0x103048,
  iceTop: 0xe0f4ff, // iced-platform highlight
  iceBody: 0x68b0e0, // iced-platform body
} as const;

export const MARIO_PALETTE: PixelPalette = {
  R: COLORS.capShirt,
  S: COLORS.skin,
  N: COLORS.hair,
  O: COLORS.overalls,
  B: COLORS.boots,
};

/** Player 2 — Luigi: green cap/shirt, white overalls to read distinctly. */
export const LUIGI_PALETTE: PixelPalette = {
  R: 0x00a800,
  S: COLORS.skin,
  N: COLORS.hair,
  O: 0xe0e0e0,
  B: COLORS.boots,
};
