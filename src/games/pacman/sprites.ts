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

const DOT_ART: string[] = ['DD', 'DD'];

const ENERGIZER_ART: string[] = [
  '  EE  ',
  ' EEEE ',
  'EEEEEE',
  'EEEEEE',
  ' EEEE ',
  '  EE  ',
];

/** Texture keys created by buildPacmanTextures(). */
export const TX = {
  pacOpen: 'pac-open',
  pacClosed: 'pac-closed',
  dot: 'pac-dot',
  energizer: 'pac-energizer',
} as const;

export function buildPacmanTextures(scene: Phaser.Scene): void {
  drawPixelArt(scene, TX.pacOpen, PAC_OPEN, { Y: COLORS.pacman });
  drawPixelArt(scene, TX.pacClosed, PAC_CLOSED, { Y: COLORS.pacman });
  drawPixelArt(scene, TX.dot, DOT_ART, { D: COLORS.dot });
  drawPixelArt(scene, TX.energizer, ENERGIZER_ART, { E: COLORS.energizer });
}
