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

// Snake head (8x8). H=head (green), E=eye, F=fang/mouth.
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

// Pellet (8x8). P=pellet (amber).
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

// Venom blob (6x6). V=venom (color set per type).
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

// Player bullet (3x3). B=bullet core.
const BULLET: string[] = [
  ' B ',
  'BBB',
  ' B ',
];

export const TX = {
  ship: 'hy-ship',
  snakeHead: 'hy-head',
  snakeBody: 'hy-body',
  pellet: 'hy-pellet',
  venomGreen: 'hy-venom-green',
  venomRed: 'hy-venom-red',
  venomBlack: 'hy-venom-black',
  smoke: 'hy-smoke',
  bullet: 'hy-bullet',
} as const;

export function buildHydraTextures(scene: Phaser.Scene): void {
  drawPixelArt(scene, TX.ship, SHIP_UP, {
    P: COLORS.hull,
    C: COLORS.cockpit,
    E: COLORS.engine,
  });
  drawPixelArt(scene, TX.snakeHead, SNAKE_HEAD, {
    H: COLORS.headGreen,
    E: COLORS.eyeRed,
    F: COLORS.fang,
  });
  drawPixelArt(scene, TX.snakeBody, SNAKE_BODY, {
    B: COLORS.bodyOuter,
    S: COLORS.bodyInner,
  });
  drawPixelArt(scene, TX.pellet, PELLET, { P: COLORS.pellet });
  drawPixelArt(scene, TX.venomGreen, VENOM, { V: COLORS.venomGreen });
  drawPixelArt(scene, TX.venomRed, VENOM, { V: COLORS.venomRed });
  drawPixelArt(scene, TX.venomBlack, VENOM, { V: COLORS.venomBlack });
  drawPixelArt(scene, TX.smoke, SMOKE, { S: COLORS.smoke });
  drawPixelArt(scene, TX.bullet, BULLET, { B: COLORS.bullet });
}
