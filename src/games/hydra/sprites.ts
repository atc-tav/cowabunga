import Phaser from 'phaser';
import { drawPixelArt } from '../../shared/textures';
import { COLORS } from './palette';

// All directional art is drawn facing UP; the scene rotates per facing.

// Player ship (8x8). P=hull, C=cockpit, E=engine glow.
const SHIP_UP: string[] = [
  '   PP   ',
  '  PPPP  ',
  '  PCCP  ',
  ' PPCCPP ',
  ' PPPPPP ',
  'PP PP PP',
  'P  PP  P',
  '   EE   ',
];

// Snake head (8x8). H=head, E=eye, F=fang/mouth.
const SNAKE_HEAD: string[] = [
  ' HHHHHH ',
  'HHHHHHHH',
  'HEEHHEEH',
  'HEEHHEEH',
  'HHHHHHHH',
  'HHFFFFHH',
  'HHHHHHHH',
  ' HHHHHH ',
];

// Snake body segment (8x8). B=scale outer, S=scale inner.
const SNAKE_BODY: string[] = [
  '        ',
  ' BBBBBB ',
  'BBSSSSBB',
  'BBSSSSBB',
  'BBSSSSBB',
  'BBSSSSBB',
  ' BBBBBB ',
  '        ',
];

// Pellet (8x8). P=pellet.
const PELLET: string[] = [
  '        ',
  '  PPPP  ',
  ' PPPPPP ',
  ' PPPPPP ',
  ' PPPPPP ',
  ' PPPPPP ',
  '  PPPP  ',
  '        ',
];

// Mine (8x8) — looks like a red pellet with a dark core. M=mine, K=core.
const MINE: string[] = [
  '        ',
  '  MMMM  ',
  ' MMMMMM ',
  ' MMKKMM ',
  ' MMKKMM ',
  ' MMMMMM ',
  '  MMMM  ',
  '        ',
];

// Egg (8x8). E=egg shell.
const EGG: string[] = [
  '        ',
  '   EE   ',
  '  EEEE  ',
  '  EEEE  ',
  '  EEEE  ',
  '  EEEE  ',
  '   EE   ',
  '        ',
];

// Venom blob (6x6). V=venom (colour per type).
const VENOM: string[] = [
  '  VV  ',
  ' VVVV ',
  'VVVVVV',
  'VVVVVV',
  ' VVVV ',
  '  VV  ',
];

// Smoke puff (8x8). S=smoke.
const SMOKE: string[] = [
  '        ',
  '  SS S  ',
  ' S SS S ',
  'S S  SS ',
  ' SS S S ',
  '  S SS  ',
  ' S  S   ',
  '        ',
];

// Bullet (3x3). B=core.
const BULLET: string[] = [
  ' B ',
  'BBB',
  ' B ',
];

export const TX = {
  ship: 'hy-ship',
  wingman: 'hy-wingman',
  snakeHead: 'hy-head',
  snakeBody: 'hy-body',
  snakeHeadBlue: 'hy-head-blue',
  snakeBodyBlue: 'hy-body-blue',
  pellet: 'hy-pellet',
  mine: 'hy-mine',
  egg: 'hy-egg',
  venomGreen: 'hy-venom-green',
  venomRed: 'hy-venom-red',
  venomBlue: 'hy-venom-blue',
  smoke: 'hy-smoke',
  bullet: 'hy-bullet',
  fireBullet: 'hy-bullet-fire',
  iceBullet: 'hy-bullet-ice',
} as const;

export function buildHydraTextures(scene: Phaser.Scene): void {
  drawPixelArt(scene, TX.ship, SHIP_UP, { P: COLORS.hull, C: COLORS.cockpit, E: COLORS.engine });
  drawPixelArt(scene, TX.wingman, SHIP_UP, {
    P: COLORS.wingHull,
    C: COLORS.wingCockpit,
    E: COLORS.wingEngine,
  });

  drawPixelArt(scene, TX.snakeHead, SNAKE_HEAD, { H: COLORS.headGreen, E: COLORS.eyeRed, F: COLORS.fang });
  drawPixelArt(scene, TX.snakeBody, SNAKE_BODY, { B: COLORS.bodyOuter, S: COLORS.bodyInner });
  drawPixelArt(scene, TX.snakeHeadBlue, SNAKE_HEAD, { H: COLORS.headBlue, E: COLORS.eyeRed, F: COLORS.fang });
  drawPixelArt(scene, TX.snakeBodyBlue, SNAKE_BODY, { B: COLORS.bodyBlueOuter, S: COLORS.bodyBlueInner });

  drawPixelArt(scene, TX.pellet, PELLET, { P: COLORS.pellet });
  drawPixelArt(scene, TX.mine, MINE, { M: COLORS.mine, K: COLORS.mineCore });
  drawPixelArt(scene, TX.egg, EGG, { E: COLORS.egg });

  drawPixelArt(scene, TX.venomGreen, VENOM, { V: COLORS.venomGreen });
  drawPixelArt(scene, TX.venomRed, VENOM, { V: COLORS.venomRed });
  drawPixelArt(scene, TX.venomBlue, VENOM, { V: COLORS.venomBlue });

  drawPixelArt(scene, TX.smoke, SMOKE, { S: COLORS.smoke });
  drawPixelArt(scene, TX.bullet, BULLET, { B: COLORS.bullet });
  drawPixelArt(scene, TX.fireBullet, BULLET, { B: COLORS.fireShot });
  drawPixelArt(scene, TX.iceBullet, BULLET, { B: COLORS.iceShot });
}
