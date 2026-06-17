import Phaser from 'phaser';
import { drawPixelArt } from '../../shared/textures';
import { MARIO_PALETTE } from './palette';

// Mario, 10x14 (R=cap/shirt, S=skin, N=hair, O=overalls, B=boots).
const MARIO_RUN_A: string[] = [
  '   RRRR   ',
  '  RRRRRR  ',
  '  NNSSNN  ',
  '  NSSSSN  ',
  '   SSSS   ',
  '  RRRRRR  ',
  ' RROOOORR ',
  ' RROOOORR ',
  '  OOOOOO  ',
  '  OO  OO  ',
  '  OO  OO  ',
  '  BB  BB  ',
  ' BBB  BBB ',
  '          ',
];

const MARIO_RUN_B: string[] = [
  '   RRRR   ',
  '  RRRRRR  ',
  '  NNSSNN  ',
  '  NSSSSN  ',
  '   SSSS   ',
  '  RRRRRR  ',
  ' RROOOORR ',
  ' RROOOORR ',
  '  OOOOOO  ',
  '  OO  OO  ',
  '  OOOO    ',
  '   BBBB   ',
  '  BB  BB  ',
  '          ',
];

const MARIO_JUMP: string[] = [
  '   RRRR   ',
  '  RRRRRR  ',
  '  NNSSNN  ',
  '  NSSSSN  ',
  '   SSSS   ',
  '  RRRRRR  ',
  'RROOOOOORR',
  ' ROOOOOOR ',
  '  OOOOOO  ',
  '  OO  OO  ',
  ' OO    OO ',
  'BB      BB',
  'BB      BB',
  '          ',
];

export const TX = {
  marioRun0: 'mb-mario-0',
  marioRun1: 'mb-mario-1',
  marioJump: 'mb-mario-jump',
} as const;

export function buildMarioBrosTextures(scene: Phaser.Scene): void {
  drawPixelArt(scene, TX.marioRun0, MARIO_RUN_A, MARIO_PALETTE);
  drawPixelArt(scene, TX.marioRun1, MARIO_RUN_B, MARIO_PALETTE);
  drawPixelArt(scene, TX.marioJump, MARIO_JUMP, MARIO_PALETTE);
}
