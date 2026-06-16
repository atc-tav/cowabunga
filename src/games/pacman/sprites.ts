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
}
