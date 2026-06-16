import Phaser from 'phaser';
import { drawPixelArt } from '../../shared/textures';
import { COLORS } from './palette';

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

export const TX = {
  ship: 'galaga-ship',
  bullet: 'galaga-bullet',
  star: 'galaga-star',
} as const;

export function buildGalagaTextures(scene: Phaser.Scene): void {
  drawPixelArt(scene, TX.ship, SHIP_ART, { W: COLORS.ship, R: COLORS.cockpit });
  drawPixelArt(scene, TX.bullet, BULLET_ART, { Y: COLORS.bullet });
  drawPixelArt(scene, TX.star, STAR_ART, { W: 0xffffff });
}
