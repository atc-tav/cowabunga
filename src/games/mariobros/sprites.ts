import Phaser from 'phaser';
import { drawPixelArt } from '../../shared/textures';
import { MARIO_PALETTE, COLORS } from './palette';

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

// Shellcreeper (turtle, 12x10). G=shell, D=shell pattern, T=head, W=eye, L=legs.
const SHELL_WALK_A: string[] = [
  '   GGGGGG   ',
  '  GGGGGGGG  ',
  ' GGGGGGGGGG ',
  ' GDGDGDGDGG ',
  ' GGGGGGGGTT ',
  ' GGGGGGGGTW ',
  ' GGGGGGGGGG ',
  '  GG    GG  ',
  '  GG    GG  ',
  '            ',
];
const SHELL_WALK_B: string[] = [
  '   GGGGGG   ',
  '  GGGGGGGG  ',
  ' GGGGGGGGGG ',
  ' GDGDGDGDGG ',
  ' GGGGGGGGTT ',
  ' GGGGGGGGTW ',
  ' GGGGGGGGGG ',
  '   GG  GG   ',
  '  GG    GG  ',
  '            ',
];
const SHELL_FLIP: string[] = [
  '  L      L  ',
  '  LL    LL  ',
  ' GGGGGGGGGG ',
  ' GDGDGDGDGG ',
  ' GGGGGGGGGG ',
  ' GGGGGGGGGG ',
  '  GGGGGGGG  ',
  '   GGGGGG   ',
  '            ',
  '            ',
];

// Sidestepper (crab, 14x10). C=body, D=pattern, W=eye, E=claw/leg.
const CRAB_WALK_A: string[] = [
  '  E        E  ',
  '  EE      EE  ',
  '  CCCCCCCCCC  ',
  ' WCCCCCCCCCCW ',
  ' CCCCCCCCCCCC ',
  ' CDCDCDCDCDCD ',
  ' CCCCCCCCCCCC ',
  '  CC  CC  CC  ',
  '  C   CC   C  ',
  '              ',
];
const CRAB_WALK_B: string[] = [
  '  E        E  ',
  '  EE      EE  ',
  '  CCCCCCCCCC  ',
  ' WCCCCCCCCCCW ',
  ' CCCCCCCCCCCC ',
  ' CDCDCDCDCDCD ',
  ' CCCCCCCCCCCC ',
  '  C  CCCC  C  ',
  ' C   C  C   C ',
  '              ',
];
const CRAB_FLIP: string[] = [
  '  E        E  ',
  ' E          E ',
  '  CC      CC  ',
  '   CCCCCCCC   ',
  '  CCCCCCCCCC  ',
  '  CDCDCDCDCC  ',
  '  CCCCCCCCCC  ',
  '   CCCCCCCC   ',
  '              ',
  '              ',
];

export const TX = {
  marioRun0: 'mb-mario-0',
  marioRun1: 'mb-mario-1',
  marioJump: 'mb-mario-jump',
  shellWalk0: 'mb-shell-0',
  shellWalk1: 'mb-shell-1',
  shellFlip: 'mb-shell-flip',
  crabWalk0: 'mb-crab-0',
  crabWalk1: 'mb-crab-1',
  crabFlip: 'mb-crab-flip',
} as const;

export function buildMarioBrosTextures(scene: Phaser.Scene): void {
  drawPixelArt(scene, TX.marioRun0, MARIO_RUN_A, MARIO_PALETTE);
  drawPixelArt(scene, TX.marioRun1, MARIO_RUN_B, MARIO_PALETTE);
  drawPixelArt(scene, TX.marioJump, MARIO_JUMP, MARIO_PALETTE);

  const shellPal = {
    G: COLORS.shell,
    D: COLORS.shellDark,
    T: COLORS.shellHead,
    W: COLORS.shellEye,
    L: COLORS.shellHead,
  };
  drawPixelArt(scene, TX.shellWalk0, SHELL_WALK_A, shellPal);
  drawPixelArt(scene, TX.shellWalk1, SHELL_WALK_B, shellPal);
  drawPixelArt(scene, TX.shellFlip, SHELL_FLIP, shellPal);

  const crabPal = {
    C: COLORS.crab,
    D: COLORS.crabDark,
    W: COLORS.crabEye,
    E: COLORS.crabClaw,
  };
  drawPixelArt(scene, TX.crabWalk0, CRAB_WALK_A, crabPal);
  drawPixelArt(scene, TX.crabWalk1, CRAB_WALK_B, crabPal);
  drawPixelArt(scene, TX.crabFlip, CRAB_FLIP, crabPal);
}
