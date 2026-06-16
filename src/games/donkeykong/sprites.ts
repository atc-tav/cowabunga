import Phaser from 'phaser';
import { drawPixelArt } from '../../shared/textures';
import { COLORS } from './palette';

// Mario, 10x14. R=cap/shirt, S=skin, N=hair, O=overalls, B=boots.
const MARIO_WALK_A: string[] = [
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

const MARIO_WALK_B: string[] = [
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
  marioWalk0: 'dk-mario-0',
  marioWalk1: 'dk-mario-1',
  marioJump: 'dk-mario-jump',
} as const;

export function buildDKTextures(scene: Phaser.Scene): void {
  const pal = {
    R: COLORS.capShirt,
    S: COLORS.skin,
    N: COLORS.hair,
    O: COLORS.overalls,
    B: COLORS.boots,
  };
  drawPixelArt(scene, TX.marioWalk0, MARIO_WALK_A, pal);
  drawPixelArt(scene, TX.marioWalk1, MARIO_WALK_B, pal);
  drawPixelArt(scene, TX.marioJump, MARIO_JUMP, pal);
}
