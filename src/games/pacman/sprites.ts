import Phaser from 'phaser';
import { drawPixelArt } from '../../shared/textures';
import { COLORS } from './palette';

// All art is drawn facing RIGHT; the scene rotates Pac-Man per direction.
const PAC_OPEN: string[] = [
  '    YYYY    ',
  '  YYYYYYYY  ',
  ' YYYYYYYYYY ',
  'YYYYYYYYYYYY',
  'YYYYYYYYY   ',
  'YYYYYYY     ',
  'YYYYYYY     ',
  'YYYYYYYYY   ',
  'YYYYYYYYYYYY',
  ' YYYYYYYYYY ',
  '  YYYYYYYY  ',
  '    YYYY    ',
];

const PAC_CLOSED: string[] = [
  '    YYYY    ',
  '  YYYYYYYY  ',
  ' YYYYYYYYYY ',
  'YYYYYYYYYYYY',
  'YYYYYYYYYYYY',
  'YYYYYYYYYYYY',
  'YYYYYYYYYYYY',
  'YYYYYYYYYYYY',
  'YYYYYYYYYYYY',
  ' YYYYYYYYYY ',
  '  YYYYYYYY  ',
  '    YYYY    ',
];

// Ghost body — two frames sharing everything but the wavy feet (foot wobble).
// R = body, W = eye white, b = pupil.
const GHOST_TOP: string[] = [
  '    RRRRRR    ',
  '  RRRRRRRRRR  ',
  ' RRRRRRRRRRRR ',
  'RRRRRRRRRRRRRR',
  'RRWWRRRRRRWWRR',
  'RWWWWRRRRWWWWR',
  'RWWbWRRRRWWbWR',
  'RWWWWRRRRWWWWR',
  'RRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRR',
];

const GHOST_FEET_A: string[] = [...GHOST_TOP, 'RR  RR  RR  RR'];
const GHOST_FEET_B: string[] = [...GHOST_TOP, '  RR  RR  RR  '];

// Frightened ghost: small eyes + a wavy mouth. F = body, W = face.
const FRIGHT_TOP: string[] = [
  '    FFFFFF    ',
  '  FFFFFFFFFF  ',
  ' FFFFFFFFFFFF ',
  'FFFFFFFFFFFFFF',
  'FFFWWFFFFWWFFF',
  'FFFWWFFFFWWFFF',
  'FFFFFFFFFFFFFF',
  'FFWWFFWWFFWWFF',
  'FWFFWWFFWWFFWF',
  'FFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFF',
];
const FRIGHT_FEET_A: string[] = [...FRIGHT_TOP, 'FF  FF  FF  FF'];
const FRIGHT_FEET_B: string[] = [...FRIGHT_TOP, '  FF  FF  FF  '];

// Just the eyes — what an eaten ghost becomes while returning home.
const EYES_ART: string[] = [
  '              ',
  '              ',
  '              ',
  '              ',
  '   WW    WW   ',
  '  WWWW  WWWW  ',
  '  WbWW  WbWW  ',
  '  WWWW  WWWW  ',
  '   WW    WW   ',
  '              ',
  '              ',
  '              ',
  '              ',
  '              ',
];

// Fruit (10x10). R/O = body, G = stem/leaf, Y = seeds.
const CHERRY_ART: string[] = [
  '        G ',
  '       G  ',
  '   RR G   ',
  '  RRRRRR  ',
  ' RRRRRRRR ',
  ' RRRRRRRR ',
  ' RRRRRRRR ',
  '  RRRRRR  ',
  '   RRRR   ',
  '          ',
];

const STRAWBERRY_ART: string[] = [
  '   GGGG   ',
  '  GRRRRG  ',
  ' RRRRRRRR ',
  ' RYRRRRYR ',
  ' RRRRRRRR ',
  '  RRRRRR  ',
  '  RYRRYR  ',
  '   RRRR   ',
  '    RR    ',
  '          ',
];

const ORANGE_ART: string[] = [
  '      G   ',
  '     GG   ',
  '  OOOOOO  ',
  ' OOOOOOOO ',
  ' OOOOOOOO ',
  ' OOOOOOOO ',
  ' OOOOOOOO ',
  '  OOOOOO  ',
  '   OOOO   ',
  '          ',
];

const DOT_ART: string[] = ['DD', 'DD'];

const ENERGIZER_ART: string[] = [
  '  EE  ',
  ' EEEE ',
  'EEEEEE',
  'EEEEEE',
  ' EEEE ',
  '  EE  ',
];

import type { GhostName } from './constants';

/** Texture keys created by buildPacmanTextures(). */
export const TX = {
  pacOpen: 'pac-open',
  pacClosed: 'pac-closed',
  dot: 'pac-dot',
  energizer: 'pac-energizer',
} as const;

const GHOST_BODY_COLOR: Record<GhostName, number> = {
  blinky: COLORS.ghostBlinky,
  pinky: COLORS.ghostPinky,
  inky: COLORS.ghostInky,
  clyde: COLORS.ghostClyde,
};

/** The two foot-wobble frame keys for a given ghost. */
export function ghostFrames(name: GhostName): [string, string] {
  return [`ghost-${name}-0`, `ghost-${name}-1`];
}

/** Shared frightened / blink / eyes texture keys (not per-ghost). */
export const FRIGHT_TX = {
  body0: 'ghost-fright-0',
  body1: 'ghost-fright-1',
  blink0: 'ghost-fright-blink-0',
  blink1: 'ghost-fright-blink-1',
  eyes: 'ghost-eyes',
} as const;

export function buildPacmanTextures(scene: Phaser.Scene): void {
  drawPixelArt(scene, TX.pacOpen, PAC_OPEN, { Y: COLORS.pacman });
  drawPixelArt(scene, TX.pacClosed, PAC_CLOSED, { Y: COLORS.pacman });
  drawPixelArt(scene, TX.dot, DOT_ART, { D: COLORS.dot });
  drawPixelArt(scene, TX.energizer, ENERGIZER_ART, { E: COLORS.energizer });

  (Object.keys(GHOST_BODY_COLOR) as GhostName[]).forEach((name) => {
    const palette = { R: GHOST_BODY_COLOR[name], W: COLORS.ghostEye, b: COLORS.ghostPupil };
    const [frame0, frame1] = ghostFrames(name);
    drawPixelArt(scene, frame0, GHOST_FEET_A, palette);
    drawPixelArt(scene, frame1, GHOST_FEET_B, palette);
  });

  const fright = { F: COLORS.frightBody, W: COLORS.frightFace };
  const blink = { F: COLORS.frightBlinkBody, W: COLORS.frightBlinkFace };
  drawPixelArt(scene, FRIGHT_TX.body0, FRIGHT_FEET_A, fright);
  drawPixelArt(scene, FRIGHT_TX.body1, FRIGHT_FEET_B, fright);
  drawPixelArt(scene, FRIGHT_TX.blink0, FRIGHT_FEET_A, blink);
  drawPixelArt(scene, FRIGHT_TX.blink1, FRIGHT_FEET_B, blink);
  drawPixelArt(scene, FRIGHT_TX.eyes, EYES_ART, { W: COLORS.ghostEye, b: COLORS.ghostPupil });

  drawPixelArt(scene, fruitTexture('cherry'), CHERRY_ART, { R: COLORS.fruitRed, G: COLORS.fruitGreen });
  drawPixelArt(scene, fruitTexture('strawberry'), STRAWBERRY_ART, {
    R: COLORS.fruitStraw,
    G: COLORS.fruitGreen,
    Y: COLORS.fruitSeed,
  });
  drawPixelArt(scene, fruitTexture('orange'), ORANGE_ART, { O: COLORS.fruitOrange, G: COLORS.fruitGreen });
}

/** Texture key for a fruit by its def key. */
export function fruitTexture(key: 'cherry' | 'strawberry' | 'orange'): string {
  return `fruit-${key}`;
}
