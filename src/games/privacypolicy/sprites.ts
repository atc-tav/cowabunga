import Phaser from 'phaser';
import { drawPixelArt } from '../../shared/textures';
import { COLORS } from './palette';

// Ship / bullet / star art are copied from Galaga (not imported — games stay
// self-contained) so this easter egg looks and feels identical to it.

// Player fighter (11x10). W = hull, R = cockpit.
const SHIP_ART: string[] = [
  '     W     ',
  '    WWW    ',
  '    WRW    ',
  '   WWWWW   ',
  '  WWWWWWW  ',
  ' WWWWWWWWW ',
  'WWWWWWWWWWW',
  'WWW WWW WWW',
  ' W  WWW  W ',
  '    W W    ',
];

// Player bolt (2x4).
const BULLET_ART: string[] = ['YY', 'YY', 'YY', 'YY'];

// A single star — a short vertical streak, tinted per parallax tier.
const STAR_ART: string[] = ['W', 'W'];

// Spinning chocolate-chip cookie (16x16). D = dough, C = chip.
const COOKIE_ART: string[] = [
  '      DDDD      ',
  '    DDDDDDDD    ',
  '   DDDDDDDDDD   ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDCDDDDDD  ',
  ' DDDDDDDDCDDDDD ',
  ' DDDDDDDDDDDDDD ',
  'DDDCDDDDDDDDDDDD',
  'DDDDDDDDDDDCDDDD',
  ' DDDDDCDDDDDDDD ',
  ' DDDDDDDDDDDDDD ',
  '  DDDDDDDCDDDD  ',
  '  DDDDDDDDDDDD  ',
  '   DDDDCDDDDD   ',
  '    DDDDDDDD    ',
  '      DDDD      ',
];

export const TX = {
  ship: 'pp-ship',
  bullet: 'pp-bullet',
  star: 'pp-star',
  cookie: 'pp-cookie',
} as const;

export function buildPrivacyTextures(scene: Phaser.Scene): void {
  drawPixelArt(scene, TX.ship, SHIP_ART, { W: COLORS.ship, R: COLORS.cockpit });
  drawPixelArt(scene, TX.bullet, BULLET_ART, { Y: COLORS.bullet });
  drawPixelArt(scene, TX.star, STAR_ART, { W: 0xffffff });
  drawPixelArt(scene, TX.cookie, COOKIE_ART, { D: 0xc8853f, C: 0x4a2607 });
}
