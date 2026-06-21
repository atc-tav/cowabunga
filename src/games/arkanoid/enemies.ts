import Phaser from 'phaser';
import { drawPixelArt } from '../../shared/textures';
import { GAME } from './constants';

/** The three enemy archetypes (Section 6). */
export type EnemyKind = 'unira' | 'convoy' | 'molester';

// Unira (8×8). S = spine (white), U = round body (grey).
const UNIRA: string[] = [
  ' S S S  ',
  'SUUUUUS ',
  'SUUUUUUS',
  ' UUUUUU ',
  ' UUUUUU ',
  'SUUUUUUS',
  ' S   S  ',
];

// ConvoyMover (10×6, two thruster frames). V = hull, C = cockpit, T = thruster.
const CONVOY_0: string[] = [
  '  CCCCC   ',
  ' VVVVVVVV ',
  'VVVVVVVVVV',
  ' VVVVVVVV ',
  ' TT    TT ',
  '          ',
];
const CONVOY_1: string[] = [
  '  CCCCC   ',
  ' VVVVVVVV ',
  'VVVVVVVVVV',
  ' VVVVVVVV ',
  '  T    T  ',
  ' T      T ',
];

// MoleSter (10×8). D = drill tip, M = body, W = wheel. Frame 0 faces left.
const MOLESTER_L: string[] = [
  'DDDMMMMM  ',
  'DDMMMMMMM ',
  'DDDMMMMM  ',
  ' WWMMMWW  ',
  '  WW WW   ',
  '          ',
  '          ',
  '          ',
];
const MOLESTER_R: string[] = [
  '  MMMMMDDD',
  ' MMMMMMMDD',
  '  MMMMMDDD',
  '  WWMMMWW ',
  '   WW WW  ',
  '          ',
  '          ',
  '          ',
];

const COL = {
  spine: 0xffffff,
  uniraBody: 0x9090b0,
  hull: 0xc0c0d0,
  cockpit: 0x3cbcfc,
  thruster: 0xfcb030,
  drill: 0xd0d0e0,
  moleBody: 0xa06030,
  wheel: 0x505060,
};

export function enemyTexture(kind: EnemyKind, frame = 0): string {
  return `ak-enemy-${kind}-${frame}`;
}

export function buildEnemyTextures(scene: Phaser.Scene): void {
  drawPixelArt(scene, enemyTexture('unira', 0), UNIRA, { S: COL.spine, U: COL.uniraBody });

  const convoyPal = { V: COL.hull, C: COL.cockpit, T: COL.thruster };
  drawPixelArt(scene, enemyTexture('convoy', 0), CONVOY_0, convoyPal);
  drawPixelArt(scene, enemyTexture('convoy', 1), CONVOY_1, convoyPal);

  const molePal = { D: COL.drill, M: COL.moleBody, W: COL.wheel };
  drawPixelArt(scene, enemyTexture('molester', 0), MOLESTER_L, molePal);
  drawPixelArt(scene, enemyTexture('molester', 1), MOLESTER_R, molePal);
}

export interface EnemySpec {
  /** base speed in px/frame */
  speed: number;
  /** laser-kill score */
  points: number;
  /** collision radius (px) */
  radius: number;
  /** earliest stage this kind appears */
  fromStage: number;
}

export const ENEMY_SPECS: Record<EnemyKind, EnemySpec> = {
  unira: { speed: GAME.uniraSpeed, points: GAME.uniraPoints, radius: 4, fromStage: 2 },
  convoy: { speed: GAME.convoySpeed, points: GAME.convoyPoints, radius: 5, fromStage: 6 },
  molester: { speed: GAME.molesterSpeed, points: GAME.molesterPoints, radius: 5, fromStage: 20 },
};
