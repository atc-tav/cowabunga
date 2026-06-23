import type { PixelPalette } from '../../shared/textures';

/**
 * Kirby's Adventure palette — NES-approximated hex values from spec §14.2,
 * plus a few slice-local tokens (Waddle Dee, Bronto Burt, props) drawn in the
 * same authentic Dream Land register.
 */
export const COLORS = {
  // Kirby (§14.2)
  kirby: 0xf878f8, // body pink
  cheek: 0xf8b8f8, // cheek highlight
  hitBlue: 0x80d0f8, // blue tint while hit
  foot: 0xf83800, // foot / boot red
  mouth: 0xb02868, // open-mouth dark pink
  eye: 0x101038, // near-black eye

  // Enemies
  wdBody: 0xe07838, // Waddle Dee body orange
  wdFace: 0xf8c898, // Waddle Dee face tan
  brontoBody: 0xf85878, // Bronto Burt body
  brontoWing: 0xf8b8c8, // Bronto Burt wing
  wdooBody: 0x3068f0, // Waddle Doo body blue (§14.2)
  sparkyBody: 0xf8d800, // Sparky yellow (§14.2)
  sparkArc: 0xfcfcfc, // spark white (§14.2)
  hotBody: 0xf87830, // Hot Head orange (§14.2)
  hotFlame: 0xf8b800, // Hot Head flame yellow-orange (§14.2)
  hotEye: 0xfcfcfc, // Hot Head eye white
  kibbleShell: 0xa8a8a8, // Sir Kibble shell gray (§14.2)
  kibbleBlade: 0xd8d8d8, // Sir Kibble blade silver (§14.2)
  rockyBody: 0xa07050, // Rocky stone gray-brown (§14.2)
  rockyCrack: 0x603820, // Rocky cracks dark (§14.2)
  chillyBody: 0xf8f8f8, // Chilly snowman white (§14.2)
  chillyScarf: 0xd01038, // Chilly scarf red (§14.2)

  // Props / FX
  star: 0xf8d800, // spat / ability star body
  starHi: 0xfcfce0, // star highlight
  beam: 0xf8f800, // beam whip yellow
  beamHi: 0xfcfcc0,
  flame: 0xf87830, // Fire breath body
  flameHi: 0xf8d800, // Fire breath core
  ice: 0x90d0f8, // Freeze crystal body
  iceHi: 0xfcfcfc, // Freeze crystal highlight
  blade: 0xd8d8d8, // Cutter blade silver
  stoneBody: 0x9890a0, // Kirby Stone form
  stoneCrack: 0x504860,
  pelletHi: 0xfcfcfc, // air-pellet puff
  doorBody: 0x5038d0, // goal-door indigo
  doorHi: 0xa890f8,
  doorKnob: 0xf8d800,

  // World / terrain (Vegetable Valley greens + earth)
  sky: 0x68b0f8, // bright daytime sky
  ground: 0x60a020, // grass-top green
  groundDark: 0x386010, // earth body
  groundEdge: 0x98e048, // bright grass highlight
  block: 0xc88038, // star-block brown
  blockHi: 0xf0b860,

  // HUD
  hpFull: 0xf83800, // filled HP pip
  hpEmpty: 0x582020, // drained HP pip
} as const;

export const KIRBY_PALETTE: PixelPalette = {
  K: COLORS.kirby,
  C: COLORS.cheek,
  E: COLORS.eye,
  F: COLORS.foot,
  M: COLORS.mouth,
};

/** Kirby's hurt sprite: body recoloured blue, X eyes. */
export const KIRBY_HIT_PALETTE: PixelPalette = {
  B: COLORS.hitBlue,
  C: COLORS.cheek,
  F: COLORS.foot,
  X: COLORS.eye,
};

export const WADDLE_DEE_PALETTE: PixelPalette = {
  D: COLORS.wdBody,
  A: COLORS.wdFace,
  E: COLORS.eye,
  F: COLORS.foot,
};

export const BRONTO_PALETTE: PixelPalette = {
  P: COLORS.brontoBody,
  V: COLORS.brontoWing,
  E: COLORS.eye,
};

export const WADDLE_DOO_PALETTE: PixelPalette = {
  W: COLORS.wdooBody,
  E: COLORS.foot, // red cyclops eye reads against the blue body
  F: COLORS.wdooBody,
};

export const SPARKY_PALETTE: PixelPalette = {
  K: COLORS.sparkyBody,
  S: COLORS.sparkArc,
  E: COLORS.eye,
};

export const HOT_HEAD_PALETTE: PixelPalette = {
  H: COLORS.hotBody,
  F: COLORS.hotFlame,
  E: COLORS.hotEye,
};

export const SIR_KIBBLE_PALETTE: PixelPalette = {
  S: COLORS.kibbleShell,
  B: COLORS.kibbleBlade,
  E: COLORS.eye,
};

export const ROCKY_PALETTE: PixelPalette = {
  R: COLORS.rockyBody,
  C: COLORS.rockyCrack,
};

export const CHILLY_PALETTE: PixelPalette = {
  W: COLORS.chillyBody,
  S: COLORS.chillyScarf,
  E: COLORS.eye,
};

/** Kirby's Stone form (§5.1) — heavy invincible rock. */
export const KIRBY_STONE_PALETTE: PixelPalette = {
  G: COLORS.stoneBody,
  D: COLORS.stoneCrack,
};
