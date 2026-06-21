import Phaser from 'phaser';
import { drawPixelArt } from '../../shared/textures';
import {
  COLORS,
  KIRBY_PALETTE,
  KIRBY_HIT_PALETTE,
  WADDLE_DEE_PALETTE,
  BRONTO_PALETTE,
  WADDLE_DOO_PALETTE,
  SPARKY_PALETTE,
} from './palette';

// ===========================================================================
// Kirby (§11). All grids are equal-length rows so drawPixelArt() reads a clean
// rectangle. Mirrored at draw time via setFlipX based on facing.
// ===========================================================================

const KIRBY_IDLE: string[] = [
  '   KKKKKK   ',
  '  KKCCKKKK  ',
  ' KKKKKKKKKKK',
  ' KKEKKKEKKKK',
  'KKKKKKKKKKKK',
  'KKKKKKKKKKKK',
  ' KKKKKKKKKK ',
  '   KK  KK   ',
  '  FKK  KKF  ',
  '            ',
];

const KIRBY_WALK_0: string[] = [
  '   KKKKKK   ',
  '  KKCCKKKK  ',
  ' KKKKKKKKKKK',
  ' KKEKKKEKKKK',
  'KKKKKKKKKKKK',
  'KKKKKKKKKKKK',
  ' KKKKKKKKKK ',
  '  KKK  KKK  ',
  ' FKK    KF  ',
  '            ',
];

const KIRBY_WALK_1: string[] = [
  '   KKKKKK   ',
  '  KKCCKKKK  ',
  ' KKKKKKKKKKK',
  ' KKEKKKEKKKK',
  'KKKKKKKKKKKK',
  'KKKKKKKKKKKK',
  ' KKKKKKKKKK ',
  ' KKK    KKK ',
  '  FK    KF  ',
  '            ',
];

const KIRBY_JUMP: string[] = [
  '  KKKKKKK   ',
  ' KKCCKKKKKK ',
  'KKKKKKKKKKKK',
  'KKEKKKEKKKK ',
  'KKKKKKKKKKKK',
  ' KKKKKKKKKK ',
  '  KKKKKKKK  ',
  '   KKKKKK   ',
  '  FK    KF  ',
  '            ',
];

const KIRBY_HOVER_0: string[] = [
  '   KKKKKKKK   ',
  '  KKCCCCKKKK  ',
  ' KKKKKKKKKKKKK',
  'KKKEKKKEKKKKKK',
  'KKKKKKKKKKKKKK',
  'KKKKKKKKKKKKKK',
  ' KKKKKKKKKKKK ',
  '  KKKKKKKKKK  ',
  '   KK    KK   ',
  '   FK    KF   ',
  '   K      K   ',
  '              ',
];

const KIRBY_HOVER_1: string[] = [
  '  KKKKKKKKKK  ',
  ' KKCCCCKKKKKK ',
  'KKKKKKKKKKKKK ',
  'KKKEKKKEKKKK  ',
  'KKKKKKKKKKKK  ',
  'KKKKKKKKKKKK  ',
  ' KKKKKKKKKKK  ',
  '  KKKKKKKKKK  ',
  '   KK    KK   ',
  '   FK    KF   ',
  '   K      K   ',
  '              ',
];

const KIRBY_INHALE: string[] = [
  '   KKKKKK   ',
  '  KKCCKKKK  ',
  ' KKKKKKKKKKK',
  ' KKEKKKEKKKK',
  'KKKMMMMKKKK ',
  'KKKKKKKKKKKK',
  ' KKKKKKKKKK ',
  '   KK  KK   ',
  '  FKK  KKF  ',
  '            ',
];

const KIRBY_HOLDING: string[] = [
  '   KKKKKKKK   ',
  '  KKCCCCKKKK  ',
  ' KKKKKKKKKKKK ',
  ' KKEKKKKEKKKK ',
  'KKKKKKKKKKKKKK',
  'KKKKKKKKKKKKKK',
  ' KKKKKKKKKKKK ',
  '   KK    KK   ',
  '  FKK    KKF  ',
  '              ',
];

const KIRBY_SLIDE: string[] = [
  '  KKKKKKKKKK  ',
  ' KKKCCKKKKKKKK',
  'KKKKKKKKKKKKKK',
  'KKEKKKEKKKKKK ',
  ' KKKKKKKKKKK  ',
  '  KFFFFFFF    ',
];

const KIRBY_DUCK: string[] = [
  '   KKKKKK   ',
  '  KKCCKKKK  ',
  ' KKEKKKEKKKK',
  'KKKKKKKKKKKK',
  'KKKKKKKKKKKK',
  ' KKKKKKKKKK ',
  '  FFKKKFF   ',
  '            ',
];

const KIRBY_HIT: string[] = [
  '   BBBBB    ',
  '  BBCCBBBBB ',
  ' BBBBBBBBBBB',
  ' BBXBBBXBBBB',
  'BBBBBBBBBBBB',
  'BBBBBBBBBBBB',
  ' BBBBBBBBBB ',
  '   BB  BB   ',
  '  FBB  BBF  ',
  '            ',
];

// ===========================================================================
// Enemies
// ===========================================================================

const WADDLE_DEE_0: string[] = [
  '   DDDDDD   ',
  '  DDDDDDDD  ',
  ' DDAAAAAADD ',
  ' DDAEAAEADD ',
  ' DDAAAAAADD ',
  '  DDDDDDDD  ',
  '   DDDDDD   ',
  '   DD  DD   ',
  '  FDD  DDF  ',
  '            ',
];

const WADDLE_DEE_1: string[] = [
  '   DDDDDD   ',
  '  DDDDDDDD  ',
  ' DDAAAAAADD ',
  ' DDAEAAEADD ',
  ' DDAAAAAADD ',
  '  DDDDDDDD  ',
  '   DDDDDD   ',
  '  DD    DD  ',
  '  FD    DF  ',
  '            ',
];

const BRONTO_0: string[] = [
  '    PPPP    ',
  '   PPPPPP   ',
  'V  PPEPPP  V',
  'VV PPPPPP VV',
  'VVVPPPPPPVVV',
  'VV PPPPPP VV',
  'V  PPPPPP  V',
  '   PP  PP   ',
  '    P  P    ',
  '            ',
];

const BRONTO_1: string[] = [
  '    PPPP    ',
  '   PPPPPP   ',
  '   PPEPPP   ',
  'V  PPPPPP  V',
  'VV PPPPPP VV',
  'VVVPPPPPPVVV',
  'VV PPPPPP VV',
  '   PP  PP   ',
  '    P  P    ',
  '            ',
];

const WADDLE_DOO_0: string[] = [
  '   WWWWWW   ',
  '  WWWWWWWW  ',
  ' WWEEEEEEWW ',
  ' WWWEWWWWWW ',
  ' WWWWWWWWWW ',
  '  WWWWWWWW  ',
  '   WWWWWW   ',
  '   WW  WW   ',
  '  WFF  FFW  ',
  '            ',
];

const WADDLE_DOO_1: string[] = [
  '   WWWWWW   ',
  '  WWWWWWWW  ',
  ' WWEEEEEEWW ',
  ' WWWEWWWWWW ',
  ' WWWWWWWWWW ',
  '  WWWWWWWW  ',
  '    WWWW    ',
  '   WW  WW   ',
  '  WFF  FFW  ',
  '            ',
];

const SPARKY_0: string[] = [
  '  SSKKS   ',
  ' KKKKKKKK ',
  ' KKEKKKKK ',
  'KKKKKKKKKK',
  ' KKKKKKKK ',
  '  KKKKKK  ',
  '  KK  KK  ',
  '          ',
];

const SPARKY_1: string[] = [
  '   SKKSS  ',
  ' KKKKKKKK ',
  ' KKEKKKKK ',
  'KKKKKKKKKK',
  ' KKKKKKKK ',
  '  KKKKKK  ',
  '  K    K  ',
  '          ',
];

// ===========================================================================
// Props / FX
// ===========================================================================

const STAR: string[] = [
  '   YY   ',
  '   YY   ',
  'YYYYYYYY',
  ' YYYYYY ',
  '  YYYY  ',
  ' YY  YY ',
  ' Y    Y ',
  '        ',
];

const ABILITY_STAR: string[] = [
  '   SS   ',
  '  YSSY  ',
  'YYYSSYYY',
  ' YYYYYY ',
  '  YYYY  ',
  ' YY  YY ',
  ' Y    Y ',
  '        ',
];

const AIR_PELLET: string[] = [
  ' WWWW ',
  'WWWWWW',
  'WWWWWW',
  'WWWWWW',
  ' WWWW ',
  '      ',
];

const BEAM_BLOB: string[] = [
  ' YYY  ',
  'YYHYY ',
  'YHHHY ',
  'YYHYY ',
  ' YYY  ',
  '      ',
];

const SPARK_BIT: string[] = [
  ' S S ',
  'SSSSS',
  ' SSS ',
  'SSSSS',
  ' S S ',
];

const DOOR: string[] = [
  '                ',
  '   DDDDDDDDDD   ',
  '  DDDDDDDDDDDD  ',
  '  DHDDDDDDDDHD  ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDDDKDDDD  ',
  '  DDDDDDDKDDDD  ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDDDDDDDD  ',
  '  DDDDDDDDDDDD  ',
  '                ',
];

const HP_PIP: string[] = [
  ' P  P ',
  'PPPPPP',
  'PPPPPP',
  ' PPPP ',
  '  PP  ',
  '      ',
];

/** Stable texture keys for every Kirby sprite. */
export const TX = {
  kirbyIdle: 'kb-idle',
  kirbyWalk0: 'kb-walk0',
  kirbyWalk1: 'kb-walk1',
  kirbyJump: 'kb-jump',
  kirbyHover0: 'kb-hover0',
  kirbyHover1: 'kb-hover1',
  kirbyInhale: 'kb-inhale',
  kirbyHolding: 'kb-holding',
  kirbySlide: 'kb-slide',
  kirbyDuck: 'kb-duck',
  kirbyHit: 'kb-hit',

  waddleDee0: 'kb-wdee0',
  waddleDee1: 'kb-wdee1',
  bronto0: 'kb-bronto0',
  bronto1: 'kb-bronto1',
  waddleDoo0: 'kb-wdoo0',
  waddleDoo1: 'kb-wdoo1',
  sparky0: 'kb-sparky0',
  sparky1: 'kb-sparky1',

  star: 'kb-star',
  abilityStar: 'kb-abilitystar',
  airPellet: 'kb-pellet',
  beam: 'kb-beam',
  spark: 'kb-spark',
  door: 'kb-door',
  hpFull: 'kb-hp-full',
  hpEmpty: 'kb-hp-empty',
} as const;

/** Render every Kirby texture once. Idempotent (drawPixelArt skips existing). */
export function buildKirbyTextures(scene: Phaser.Scene): void {
  drawPixelArt(scene, TX.kirbyIdle, KIRBY_IDLE, KIRBY_PALETTE);
  drawPixelArt(scene, TX.kirbyWalk0, KIRBY_WALK_0, KIRBY_PALETTE);
  drawPixelArt(scene, TX.kirbyWalk1, KIRBY_WALK_1, KIRBY_PALETTE);
  drawPixelArt(scene, TX.kirbyJump, KIRBY_JUMP, KIRBY_PALETTE);
  drawPixelArt(scene, TX.kirbyHover0, KIRBY_HOVER_0, KIRBY_PALETTE);
  drawPixelArt(scene, TX.kirbyHover1, KIRBY_HOVER_1, KIRBY_PALETTE);
  drawPixelArt(scene, TX.kirbyInhale, KIRBY_INHALE, KIRBY_PALETTE);
  drawPixelArt(scene, TX.kirbyHolding, KIRBY_HOLDING, KIRBY_PALETTE);
  drawPixelArt(scene, TX.kirbySlide, KIRBY_SLIDE, KIRBY_PALETTE);
  drawPixelArt(scene, TX.kirbyDuck, KIRBY_DUCK, KIRBY_PALETTE);
  drawPixelArt(scene, TX.kirbyHit, KIRBY_HIT, KIRBY_HIT_PALETTE);

  drawPixelArt(scene, TX.waddleDee0, WADDLE_DEE_0, WADDLE_DEE_PALETTE);
  drawPixelArt(scene, TX.waddleDee1, WADDLE_DEE_1, WADDLE_DEE_PALETTE);
  drawPixelArt(scene, TX.bronto0, BRONTO_0, BRONTO_PALETTE);
  drawPixelArt(scene, TX.bronto1, BRONTO_1, BRONTO_PALETTE);
  drawPixelArt(scene, TX.waddleDoo0, WADDLE_DOO_0, WADDLE_DOO_PALETTE);
  drawPixelArt(scene, TX.waddleDoo1, WADDLE_DOO_1, WADDLE_DOO_PALETTE);
  drawPixelArt(scene, TX.sparky0, SPARKY_0, SPARKY_PALETTE);
  drawPixelArt(scene, TX.sparky1, SPARKY_1, SPARKY_PALETTE);

  drawPixelArt(scene, TX.star, STAR, { Y: COLORS.star, S: COLORS.starHi });
  drawPixelArt(scene, TX.abilityStar, ABILITY_STAR, {
    Y: COLORS.star,
    S: COLORS.starHi,
  });
  drawPixelArt(scene, TX.airPellet, AIR_PELLET, { W: COLORS.pelletHi });
  drawPixelArt(scene, TX.beam, BEAM_BLOB, { Y: COLORS.beam, H: COLORS.beamHi });
  drawPixelArt(scene, TX.spark, SPARK_BIT, { S: COLORS.sparkArc });
  drawPixelArt(scene, TX.door, DOOR, {
    D: COLORS.doorBody,
    H: COLORS.doorHi,
    K: COLORS.doorKnob,
  });
  drawPixelArt(scene, TX.hpFull, HP_PIP, { P: COLORS.hpFull });
  drawPixelArt(scene, TX.hpEmpty, HP_PIP, { P: COLORS.hpEmpty });
}
