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

// Mario climbing (back view, arms up on the rails), two leg poses.
const MARIO_CLIMB_A: string[] = [
  '   RRRR   ',
  '  RRRRRR  ',
  '  NNNNNN  ',
  '  NNNNNN  ',
  ' RROOOORR ',
  '  OOOOOO  ',
  '  OOOOOO  ',
  '  OOOOOO  ',
  '  OO  OO  ',
  '  OO  OO  ',
  '  BBOO    ',
  '  BBBB    ',
  '          ',
  '          ',
];

const MARIO_CLIMB_B: string[] = [
  '   RRRR   ',
  '  RRRRRR  ',
  '  NNNNNN  ',
  '  NNNNNN  ',
  ' RROOOORR ',
  '  OOOOOO  ',
  '  OOOOOO  ',
  '  OOOOOO  ',
  '  OO  OO  ',
  '  OO  OO  ',
  '    OOBB  ',
  '    BBBB  ',
  '          ',
  '          ',
];

export const TX = {
  marioWalk0: 'dk-mario-0',
  marioWalk1: 'dk-mario-1',
  marioJump: 'dk-mario-jump',
  marioClimb0: 'dk-mario-climb-0',
  marioClimb1: 'dk-mario-climb-1',
  kong: 'dk-kong',
} as const;

export const BARREL_KEYS = ['dk-barrel-0', 'dk-barrel-1', 'dk-barrel-2', 'dk-barrel-3'];

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
  drawPixelArt(scene, TX.marioClimb0, MARIO_CLIMB_A, pal);
  drawPixelArt(scene, TX.marioClimb1, MARIO_CLIMB_B, pal);

  makeKong(scene);
  makeBarrels(scene);
}

/** Donkey Kong himself — a chunky procedural gorilla (32x28). */
function makeKong(scene: Phaser.Scene): void {
  if (scene.textures.exists(TX.kong)) {
    return;
  }
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(COLORS.dkBody, 1);
  g.fillRoundedRect(4, 8, 24, 18, 4); // body
  g.fillCircle(16, 9, 8); // head
  g.fillRect(0, 12, 6, 11); // left arm
  g.fillRect(26, 12, 6, 11); // right arm
  g.fillStyle(COLORS.dkFace, 1);
  g.fillRoundedRect(11, 8, 10, 9, 3); // muzzle
  g.fillRect(9, 15, 14, 7); // chest
  g.fillStyle(COLORS.dkEye, 1);
  g.fillCircle(12, 7, 2);
  g.fillCircle(20, 7, 2);
  g.fillStyle(0x000000, 1);
  g.fillCircle(12, 7, 1);
  g.fillCircle(20, 7, 1);
  g.fillCircle(14, 13, 1);
  g.fillCircle(18, 13, 1);
  g.generateTexture(TX.kong, 32, 28);
  g.destroy();
}

/** Four rolling barrel frames (12x9) with shifting staves. */
function makeBarrels(scene: Phaser.Scene): void {
  for (let f = 0; f < BARREL_KEYS.length; f++) {
    const key = BARREL_KEYS[f];
    if (scene.textures.exists(key)) {
      continue;
    }
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(COLORS.barrelBody, 1);
    g.fillRect(1, 1, 10, 7);
    g.fillStyle(COLORS.barrelRim, 1);
    g.fillRect(0, 1, 1, 7);
    g.fillRect(11, 1, 1, 7);
    g.fillRect(1, 0, 10, 1);
    g.fillRect(1, 8, 10, 1);
    g.fillStyle(COLORS.barrelStave, 1);
    for (let k = 0; k < 3; k++) {
      const x = 1 + ((f * 3 + k * 4) % 10);
      g.fillRect(x, 1, 1, 7);
    }
    g.generateTexture(key, 12, 9);
    g.destroy();
  }
}
