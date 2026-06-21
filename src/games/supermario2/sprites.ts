import Phaser from 'phaser';
import { drawPixelArt } from '../../shared/textures';
import { COLORS } from './palette';

// ===========================================================================
// Player characters — grids transcribed from spec §11 (run/jump/carry).
// Tokens vary per character; each gets its own palette in buildSM2Textures().
// ===========================================================================

// Mario (H=hat/M=shirt both red, S=skin, B=overalls blue, E=eye).
const MARIO_RUN_0 = [
  '   HHHH   ',
  '  HHHHHH  ',
  '  MSSSSM  ',
  ' MSESSSSSM',
  ' MSSSSSSM ',
  '  BBBBBB  ',
  ' MBBBBBMM ',
  ' MBBBBBM  ',
  '  BB  BB  ',
  '  MM  MM  ',
  ' MMM  MMM ',
  ' MM    MM ',
  ' M      M ',
  '          ',
];
const MARIO_RUN_1 = [
  '   HHHH   ',
  '  HHHHHH  ',
  '  MSSSSM  ',
  ' MSESSSSSM',
  ' MSSSSSSM ',
  '  BBBBBB  ',
  ' MBBBBBMM ',
  '  MBBBBM  ',
  '  BB  BB  ',
  ' MM    MM ',
  ' MMM  MMM ',
  '  MM  MM  ',
  '   M  M   ',
  '          ',
];
const MARIO_JUMP = [
  '   HHHH   ',
  '  HHHHHH  ',
  '  MSSSSM  ',
  ' MSESSSSSM',
  ' MSSSSSSM ',
  '  BBBBBB  ',
  ' MBBBBBBM ',
  'MM BBBB MM',
  '   BB BB  ',
  '  MM   MM ',
  ' MMM   MMM',
  ' MM     MM',
  '          ',
  '          ',
];
const MARIO_CARRY = [
  '   HHHH   ',
  '  HHHHHH  ',
  '  MSSSSM  ',
  ' MSESSSSSM',
  ' MSSSSSSM ',
  '  BBBBBB  ',
  ' MBBBBBMM ',
  '  MBBBBM  ',
  ' MM BBMM  ',
  ' MM    MM ',
  ' MMM  MMM ',
  '  MM  MM  ',
  '          ',
  '          ',
];

// Luigi (L=hat/shirt green, B=overalls, S=skin, E=eye) — taller.
const LUIGI_RUN_0 = [
  '   LLLL   ',
  '  LLLLLL  ',
  '  LSSSSL  ',
  ' LSESSSSSL',
  ' LSSSSSLL ',
  '  BBBBBB  ',
  ' LBBBBBLL ',
  ' LBBBBBLL ',
  '  BB  BB  ',
  '  LL  LL  ',
  ' LLL  LLL ',
  ' LL    LL ',
  ' L      L ',
  ' L      L ',
  ' L      L ',
  '          ',
];
const LUIGI_RUN_1 = [
  '   LLLL   ',
  '  LLLLLL  ',
  '  LSSSSL  ',
  ' LSESSSSSL',
  ' LSSSSSLL ',
  '  BBBBBB  ',
  ' LBBBBBLL ',
  '  LBBBBLL ',
  '  BB  BB  ',
  ' LL    LL ',
  ' LLL  LLL ',
  '  LL  LL  ',
  '   L  L   ',
  '   L  L   ',
  '   L  L   ',
  '          ',
];
const LUIGI_JUMP = [
  '   LLLL   ',
  '  LLLLLL  ',
  '  LSSSSL  ',
  ' LSESSSSSL',
  ' LSSSSSLL ',
  '  BBBBBB  ',
  ' LBBBBBBLL',
  'LL BBBB LL',
  '   BB BB  ',
  '  LL   LL ',
  ' LLL   LLL',
  ' LL     LL',
  '          ',
  '          ',
  '          ',
  '          ',
];
const LUIGI_CARRY = [
  '   LLLL   ',
  '  LLLLLL  ',
  '  LSSSSL  ',
  ' LSESSSSSL',
  ' LSSSSSLL ',
  '  BBBBBB  ',
  ' LBBBBBLL ',
  '  LBBBBLL ',
  ' LL BBLL  ',
  ' LL    LL ',
  ' LLL  LLL ',
  '  LL  LL  ',
  '   L  L   ',
  '   L  L   ',
  '          ',
  '          ',
];

// Toad (P=cap white, S=skin/spots, T=body white, D=vest blue, E=eye).
const TOAD_RUN_0 = [
  '   PPPP   ',
  '  PPPPPP  ',
  ' PPSPSPPP ',
  '  PPPPPP  ',
  '  TTTTTT  ',
  ' TTSSSTT  ',
  ' TTSESTT  ',
  ' TDDDDDT  ',
  '  DDDDDD  ',
  '  DD  DD  ',
  '  TT  TT  ',
  '  TT  TT  ',
  '  T    T  ',
  '          ',
];
const TOAD_RUN_1 = [
  '   PPPP   ',
  '  PPPPPP  ',
  ' PPSPSPPP ',
  '  PPPPPP  ',
  '  TTTTTT  ',
  ' TTSSSTT  ',
  ' TTSESTT  ',
  ' TDDDDDT  ',
  '  DDDDDD  ',
  '  DD  DD  ',
  ' TT    TT ',
  ' TT    TT ',
  '  T    T  ',
  '          ',
];
const TOAD_JUMP = [
  '   PPPP   ',
  '  PPPPPP  ',
  ' PPSPSPPP ',
  '  PPPPPP  ',
  '  TTTTTT  ',
  ' TTSSSTT  ',
  ' TTSESTT  ',
  'TDDDDDDT  ',
  ' TDDDDDT  ',
  '  DD  DD  ',
  ' TT    TT ',
  'TT      TT',
  '          ',
  '          ',
];
const TOAD_CARRY = [
  '   PPPP   ',
  '  PPPPPP  ',
  ' PPSPSPPP ',
  '  PPPPPP  ',
  '  TTTTTT  ',
  ' TTSSSTT  ',
  ' TTSESTT  ',
  ' TDDDDDT  ',
  ' DD  DD   ',
  '  DDDDDD  ',
  '  DD  DD  ',
  '  TT  TT  ',
  '  T    T  ',
  '          ',
];

// Peach (C=crown, H=hair blonde, S=skin, P=dress pink, E=eye) — taller.
const PEACH_RUN_0 = [
  '   CCCCC  ',
  '  CHHHHHH ',
  ' SSSSSSSSS',
  ' SSSESSSS ',
  ' SSSSSSS  ',
  ' PPPPPPPP ',
  'PPPPPPPPPP',
  ' PPPPPPPP ',
  '  PPPPPP  ',
  '  PP  PP  ',
  '  PP  PP  ',
  ' PPP  PPP ',
  ' PPP  PPP ',
  '  PP  PP  ',
  '  P    P  ',
  '          ',
];
const PEACH_RUN_1 = [
  '   CCCCC  ',
  '  CHHHHHH ',
  ' SSSSSSSSS',
  ' SSSESSSS ',
  ' SSSSSSS  ',
  ' PPPPPPPP ',
  'PPPPPPPPPP',
  ' PPPPPPPP ',
  '  PPPPPP  ',
  '  PP  PP  ',
  ' PP    PP ',
  ' PPP  PPP ',
  '  PP  PP  ',
  '   P  P   ',
  '   P  P   ',
  '          ',
];
const PEACH_JUMP = [
  '   CCCCC  ',
  '  CHHHHHH ',
  ' SSSSSSSSS',
  ' SSSESSSS ',
  ' SSSSSSS  ',
  ' PPPPPPPP ',
  'PPPPPPPPPP',
  ' PPPPPPPP ',
  '  PPPPPP  ',
  '  PP  PP  ',
  ' PP    PP ',
  'PP      PP',
  '          ',
  '          ',
  '          ',
  '          ',
];
// Arms-out float / carry pose (spec PEACH_FLOAT).
const PEACH_CARRY = [
  '   CCCCC  ',
  '  CHHHHHH ',
  'SSS    SSS',
  ' SSSESSSS ',
  ' SSSSSSS  ',
  ' PPPPPPPP ',
  'PPPPPPPPPP',
  ' PPPPPPPP ',
  '  PPPPPP  ',
  '  PP  PP  ',
  '  PP  PP  ',
  ' PPP  PPP ',
  '  PP  PP  ',
  '  P    P  ',
  '          ',
  '          ',
];

// ===========================================================================
// Enemies (spec §4.4)
// ===========================================================================

// Shy Guy (S=mask white, E=eye holes, O=nose hole, R=robe, B=boot).
const SHYGUY_0 = [
  '  SSSSSS  ',
  ' SSSSSSSS ',
  ' SSEEOOSS ',
  ' SSSSSSSS ',
  '  RRRRRR  ',
  ' RRRRRRRR ',
  'RRRRRRRRRR',
  '  RR  RR  ',
  '  B    B  ',
  '  B    B  ',
  '  BBB BB  ',
  '          ',
];
const SHYGUY_1 = [
  '  SSSSSS  ',
  ' SSSSSSSS ',
  ' SSEEOOSS ',
  ' SSSSSSSS ',
  '  RRRRRR  ',
  ' RRRRRRRR ',
  'RRRRRRRRRR',
  '  RR  RR  ',
  '   B  B   ',
  '   B  B   ',
  '  BB BBB  ',
  '          ',
];

// Tweeter (M=mask white, E=eye, B=beak, T=body yellow, W=wing orange).
const TWEETER_0 = [
  '   MMMM   ',
  '  MMEEMM  ',
  '  MMBMM   ',
  '  TTTTTT  ',
  'WTTTTTTTTW',
  '  TTTTTT  ',
  '  TT  TT  ',
  '  TT  TT  ',
  '          ',
  '          ',
];
const TWEETER_1 = [
  '   MMMM   ',
  '  MMEEMM  ',
  '  MMBMM   ',
  '  TTTTTT  ',
  'WTTTTTTTTW',
  '  TTTTTT  ',
  '    TT    ',
  '    TT    ',
  '   TTTT   ',
  '          ',
];

// ===========================================================================
// Items & objects
// ===========================================================================

// Turnip vegetable (W=bulb white, G=leaf green, E=eye).
const TURNIP = [
  '   G  G   ',
  '   GGGG   ',
  '  G GG G  ',
  '   WWWW   ',
  '  WWWWWW  ',
  ' WWWWWWWW ',
  ' WWEWWEWW ',
  ' WWWWWWWW ',
  '  WWWWWW  ',
  '   WWWW   ',
];
const HEART = [
  '  RR  RR  ',
  ' RRRRRRRR ',
  ' RRRRRRRR ',
  ' RRRRRRRR ',
  '  RRRRRR  ',
  '   RRRR   ',
  '    RR    ',
  '          ',
];
const CHERRY = [
  '    G   ',
  '   G    ',
  '  RRR   ',
  ' RRRRR  ',
  ' RRRRR  ',
  ' RRRRR  ',
  '  RRR   ',
  '        ',
];
const STAR = [
  '    YY    ',
  '    YY    ',
  '  YYYYYY  ',
  'YYYYYYYYYY',
  ' YYYYYYYY ',
  '  YYYYYY  ',
  '  YY  YY  ',
  ' YY    YY ',
  '          ',
  '          ',
];
// Vase / jar (R=rim white, V=body red) — open mouth at top.
const JAR = [
  '  RRRRRRRRRRRR  ',
  '  R          R  ',
  '  RVVVVVVVVVVR  ',
  '  RVVVVVVVVVVR  ',
  ' RRVVVVVVVVVVRR ',
  ' RVVVVVVVVVVVVR ',
  ' RVVVVVVVVVVVVR ',
  ' RVVVVVVVVVVVVR ',
  ' RVVVVVVVVVVVVR ',
  ' RVVVVVVVVVVVVR ',
  ' RVVVVVVVVVVVVR ',
  ' RRVVVVVVVVVVRR ',
  '  RVVVVVVVVVVR  ',
  '  RVVVVVVVVVVR  ',
  '  RRRRRRRRRRRR  ',
  '                ',
];
const GRASS = [
  '   G    G   G   ',
  '  GGG  GGG GGG  ',
  ' GGGGGGGGGGGGG  ',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  '                ',
];
const CRYSTAL = [
  '   CCCC   ',
  '  CCCCCC  ',
  ' CCCWCCCC ',
  ' CCCCCCCC ',
  'CCCCCCCCCC',
  'CCCCCCCCCC',
  ' CCCCCCCC ',
  ' CCCCCCCC ',
  '  CCCCCC  ',
  '   CCCC   ',
];
// Mask Gate / exit door (M=mask bronze, D=mouth dark, E=eye).
const MASK_GATE = [
  '  MMMMMMMMMMMM  ',
  ' MMMMMMMMMMMMMM ',
  ' MMMMMMMMMMMMMM ',
  ' MMEEEMMMMEEEMM ',
  ' MMEEEMMMMEEEMM ',
  ' MMMMMMMMMMMMMM ',
  ' MMMMMMMMMMMMMM ',
  ' MMMDDDDDDDDMMM ',
  ' MMMDDDDDDDDMMM ',
  ' MMMDDDDDDDDMMM ',
  ' MMMMMMMMMMMMMM ',
  ' MMMMMMMMMMMMMM ',
  ' MMMMMMMMMMMMMM ',
  '  MMMMMMMMMMMM  ',
  '  MMMMMMMMMMMM  ',
  '   MMMMMMMMMM   ',
  '   MMMMMMMMMM   ',
  '    MMMMMMMM    ',
  '    MMMMMMMM    ',
  '     MMMMMM     ',
  '     MMMMMM     ',
  '      MMMM      ',
  '      MMMM      ',
  '                ',
];

/** Stable texture keys. Characters reference these in characters.ts. */
export const TX = {
  marioRun0: 'sm2-mario-0',
  marioRun1: 'sm2-mario-1',
  marioJump: 'sm2-mario-jump',
  marioCarry: 'sm2-mario-carry',
  luigiRun0: 'sm2-luigi-0',
  luigiRun1: 'sm2-luigi-1',
  luigiJump: 'sm2-luigi-jump',
  luigiCarry: 'sm2-luigi-carry',
  toadRun0: 'sm2-toad-0',
  toadRun1: 'sm2-toad-1',
  toadJump: 'sm2-toad-jump',
  toadCarry: 'sm2-toad-carry',
  peachRun0: 'sm2-peach-0',
  peachRun1: 'sm2-peach-1',
  peachJump: 'sm2-peach-jump',
  peachCarry: 'sm2-peach-carry',
  shyRed0: 'sm2-shy-red-0',
  shyRed1: 'sm2-shy-red-1',
  shyPink0: 'sm2-shy-pink-0',
  shyPink1: 'sm2-shy-pink-1',
  tweeter0: 'sm2-tweeter-0',
  tweeter1: 'sm2-tweeter-1',
  turnip: 'sm2-turnip',
  heart: 'sm2-heart',
  cherry: 'sm2-cherry',
  star: 'sm2-star',
  jar: 'sm2-jar',
  grass: 'sm2-grass',
  crystal: 'sm2-crystal',
  maskGate: 'sm2-mask-gate',
} as const;

export function buildSM2Textures(scene: Phaser.Scene): void {
  const eye = COLORS.eye;

  const marioPal = { H: COLORS.red, M: COLORS.red, S: COLORS.skin, B: COLORS.blue, E: eye };
  drawPixelArt(scene, TX.marioRun0, MARIO_RUN_0, marioPal);
  drawPixelArt(scene, TX.marioRun1, MARIO_RUN_1, marioPal);
  drawPixelArt(scene, TX.marioJump, MARIO_JUMP, marioPal);
  drawPixelArt(scene, TX.marioCarry, MARIO_CARRY, marioPal);

  const luigiPal = { L: COLORS.green, B: COLORS.blue, S: COLORS.skin, E: eye };
  drawPixelArt(scene, TX.luigiRun0, LUIGI_RUN_0, luigiPal);
  drawPixelArt(scene, TX.luigiRun1, LUIGI_RUN_1, luigiPal);
  drawPixelArt(scene, TX.luigiJump, LUIGI_JUMP, luigiPal);
  drawPixelArt(scene, TX.luigiCarry, LUIGI_CARRY, luigiPal);

  const toadPal = { P: COLORS.white, S: COLORS.skin, T: COLORS.white, D: COLORS.toadVest, E: eye };
  drawPixelArt(scene, TX.toadRun0, TOAD_RUN_0, toadPal);
  drawPixelArt(scene, TX.toadRun1, TOAD_RUN_1, toadPal);
  drawPixelArt(scene, TX.toadJump, TOAD_JUMP, toadPal);
  drawPixelArt(scene, TX.toadCarry, TOAD_CARRY, toadPal);

  const peachPal = { C: COLORS.crown, H: COLORS.peachHair, S: COLORS.skin, P: COLORS.peachDress, E: eye };
  drawPixelArt(scene, TX.peachRun0, PEACH_RUN_0, peachPal);
  drawPixelArt(scene, TX.peachRun1, PEACH_RUN_1, peachPal);
  drawPixelArt(scene, TX.peachJump, PEACH_JUMP, peachPal);
  drawPixelArt(scene, TX.peachCarry, PEACH_CARRY, peachPal);

  const shyRed = { S: COLORS.white, E: eye, O: eye, R: COLORS.red, B: COLORS.boot };
  drawPixelArt(scene, TX.shyRed0, SHYGUY_0, shyRed);
  drawPixelArt(scene, TX.shyRed1, SHYGUY_1, shyRed);
  const shyPink = { ...shyRed, R: COLORS.shyPink };
  drawPixelArt(scene, TX.shyPink0, SHYGUY_0, shyPink);
  drawPixelArt(scene, TX.shyPink1, SHYGUY_1, shyPink);

  const tweeterPal = { M: COLORS.white, E: eye, B: COLORS.tweeterWing, T: COLORS.tweeterBody, W: COLORS.tweeterWing };
  drawPixelArt(scene, TX.tweeter0, TWEETER_0, tweeterPal);
  drawPixelArt(scene, TX.tweeter1, TWEETER_1, tweeterPal);

  drawPixelArt(scene, TX.turnip, TURNIP, { W: COLORS.white, G: COLORS.green, E: eye });
  drawPixelArt(scene, TX.heart, HEART, { R: COLORS.red });
  drawPixelArt(scene, TX.cherry, CHERRY, { R: COLORS.red, G: COLORS.green });
  drawPixelArt(scene, TX.star, STAR, { Y: COLORS.star });
  drawPixelArt(scene, TX.jar, JAR, { R: COLORS.vaseRim, V: COLORS.vaseBody });
  drawPixelArt(scene, TX.grass, GRASS, { G: COLORS.green });
  drawPixelArt(scene, TX.crystal, CRYSTAL, { C: COLORS.crystal, W: COLORS.white });
  drawPixelArt(scene, TX.maskGate, MASK_GATE, { M: COLORS.maskGate, D: COLORS.maskGateDark, E: eye });
}
