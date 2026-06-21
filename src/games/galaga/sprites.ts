import Phaser from 'phaser';
import { drawPixelArt } from '../../shared/textures';
import { COLORS } from './palette';
import { EnemyType } from './constants';

// Player fighter (13x14). F = hull (white), C = cockpit (cyan),
// R = swept wing (red), E = engine glow.
const SHIP_ART: string[] = [
  '      F      ',
  '      F      ',
  '     FFF     ',
  '     FCF     ',
  '     FFF     ',
  '    FFFFF    ',
  '    FFFFF    ',
  '  RRFFFFFRR  ',
  ' RRRFFFFFRRR ',
  'RRRRFFFFFRRRR',
  'RRR FFFFF RRR',
  '   FFFFFFF   ',
  '   FFF FFF   ',
  '   E     E   ',
];

// Player bolt (2x4).
const BULLET_ART: string[] = ['YY', 'YY', 'YY', 'YY'];

// Enemy bolt (5x5 diamond with a bright white core, for visibility).
const ENEMY_BULLET_ART: string[] = [
  '  M  ',
  ' MMM ',
  'MMWMM',
  ' MMM ',
  '  M  ',
];

// A single star — a short vertical streak, tinted per parallax tier.
const STAR_ART: string[] = ['W', 'W'];

// --- enemies (two wing-flap frames each) --------------------------------
// Bee (Zako, 13x11): Y=body (yellow), B=wing (blue), W=eye.
const BEE_A: string[] = [
  '  B       B  ',
  ' BBB     BBB ',
  ' BBBBB BBBBB ',
  '  BBYYYYYBB  ',
  '  BYWYYYWYB  ',
  '  BYYYYYYYB  ',
  '   YYYYYYY   ',
  '   YYYYYYY   ',
  '   YY Y YY   ',
  '    Y   Y    ',
  '             ',
];
const BEE_B: string[] = [
  '             ',
  '   BB   BB   ',
  '  BBBB BBBB  ',
  '  BBYYYYYBB  ',
  '  BYWYYYWYB  ',
  '  BYYYYYYYB  ',
  '   YYYYYYY   ',
  '   YYYYYYY   ',
  '   YY Y YY   ',
  '    Y   Y    ',
  '             ',
];

// Butterfly (Goei, 13x12): R=wing (red), Y=body (peach), W=eye.
const BUTTERFLY_A: string[] = [
  'R    YYY    R',
  'RR   YYY   RR',
  'RRR YWYWY RRR',
  'RRRRYYYYYRRRR',
  'RRRRYYYYYRRRR',
  ' RRRYYYYYRRR ',
  '  RRYYYYYRR  ',
  '   RYYYYYR   ',
  '    YYYYY    ',
  '    Y Y Y    ',
  '    Y   Y    ',
  '             ',
];
const BUTTERFLY_B: string[] = [
  'RR   YYY   RR',
  'RRR  YYY  RRR',
  'RRRRYWYWYRRRR',
  ' RRRYYYYYRRR ',
  ' RRRYYYYYRRR ',
  '  RRYYYYYRR  ',
  '  RRYYYYYRR  ',
  '   RYYYYYR   ',
  '    YYYYY    ',
  '    Y Y Y    ',
  '    Y   Y    ',
  '             ',
];

// Boss Galaga (15x14): G=body (green), B=wing (blue), Y=crown (yellow),
// W=eye, A=accent band (red).
const BOSS_A: string[] = [
  '     YYYYY     ',
  '    GGGGGGG    ',
  '   GGWGGGWGG   ',
  '   GGGGGGGGG   ',
  '  GAAAAAAAAAG  ',
  '  GGGGGGGGGGG  ',
  ' BBGGGGGGGGGBB ',
  'BBBGGGGGGGGGBBB',
  'BBBGGGGGGGGGBBB',
  ' BBGGGGGGGGGBB ',
  '  GGGGGGGGGGG  ',
  '   GGGG GGGG   ',
  '   GG     GG   ',
  '               ',
];
const BOSS_B: string[] = [
  '     YYYYY     ',
  '    GGGGGGG    ',
  '   GGWGGGWGG   ',
  '   GGGGGGGGG   ',
  '  GAAAAAAAAAG  ',
  'BB GGGGGGGGG BB',
  'BBBGGGGGGGGGBBB',
  ' BBGGGGGGGGGBB ',
  '  GGGGGGGGGGG  ',
  '  GGGGGGGGGGG  ',
  '   GGGG GGGG   ',
  '   GG     GG   ',
  '               ',
  '               ',
];

export const EXPLOSION_KEYS = [
  'galaga-expl-0',
  'galaga-expl-1',
  'galaga-expl-2',
  'galaga-expl-3',
];

/** Texture key for an enemy type's wing frame. */
export function enemyFrame(type: EnemyType, frame: 0 | 1): string {
  return `galaga-${type}-${frame}`;
}

/** Boss Galaga after its first hit — same shape, red-tinted body. */
export const BOSS_HIT_KEY = 'galaga-boss-hit';

export const TX = {
  ship: 'galaga-ship',
  bullet: 'galaga-bullet',
  enemyBullet: 'galaga-ebullet',
  star: 'galaga-star',
} as const;

export function buildGalagaTextures(scene: Phaser.Scene): void {
  drawPixelArt(scene, TX.ship, SHIP_ART, {
    F: COLORS.ship,
    C: COLORS.shipTrim,
    R: COLORS.cockpit,
    E: COLORS.engine,
  });
  drawPixelArt(scene, TX.bullet, BULLET_ART, { Y: COLORS.bullet });
  drawPixelArt(scene, TX.enemyBullet, ENEMY_BULLET_ART, { M: COLORS.enemyBullet, W: 0xffffff });
  drawPixelArt(scene, TX.star, STAR_ART, { W: 0xffffff });

  const beePal = { Y: COLORS.beeBody, B: COLORS.beeWing, W: COLORS.eye };
  drawPixelArt(scene, enemyFrame('bee', 0), BEE_A, beePal);
  drawPixelArt(scene, enemyFrame('bee', 1), BEE_B, beePal);

  const butterflyPal = { R: COLORS.butterflyWing, Y: COLORS.butterflyBody, W: COLORS.eye };
  drawPixelArt(scene, enemyFrame('butterfly', 0), BUTTERFLY_A, butterflyPal);
  drawPixelArt(scene, enemyFrame('butterfly', 1), BUTTERFLY_B, butterflyPal);

  const bossPal = {
    G: COLORS.bossBody,
    B: COLORS.bossWing,
    Y: COLORS.bossCrown,
    W: COLORS.eye,
    A: COLORS.bossAccent,
  };
  drawPixelArt(scene, enemyFrame('boss', 0), BOSS_A, bossPal);
  drawPixelArt(scene, enemyFrame('boss', 1), BOSS_B, bossPal);
  // Damaged variant: red body, same wings/crown/eyes.
  drawPixelArt(scene, BOSS_HIT_KEY, BOSS_A, {
    G: 0xd83020,
    B: COLORS.bossWing,
    Y: COLORS.bossCrown,
    W: COLORS.eye,
    A: COLORS.bossAccent,
  });

  makeExplosionFrames(scene);
}

/** Procedural 4-frame explosion (expanding rings + sparks). */
function makeExplosionFrames(scene: Phaser.Scene): void {
  const size = 16;
  const c = 8;
  const draw = (key: string, fn: (g: Phaser.GameObjects.Graphics) => void): void => {
    if (scene.textures.exists(key)) {
      return;
    }
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    fn(g);
    g.generateTexture(key, size, size);
    g.destroy();
  };
  const dot = (g: Phaser.GameObjects.Graphics, color: number, r: number, points: [number, number][]): void => {
    g.fillStyle(color, 1);
    for (const [px, py] of points) {
      g.fillCircle(px, py, r);
    }
  };

  draw(EXPLOSION_KEYS[0], (g) => {
    g.fillStyle(COLORS.explYellow, 1);
    g.fillCircle(c, c, 3);
    g.fillStyle(COLORS.explWhite, 1);
    g.fillCircle(c, c, 1.5);
  });
  draw(EXPLOSION_KEYS[1], (g) => {
    g.lineStyle(2, COLORS.explOrange, 1);
    g.strokeCircle(c, c, 5);
    dot(g, COLORS.explYellow, 1, [
      [c, c - 5],
      [c + 5, c],
      [c, c + 5],
      [c - 5, c],
    ]);
  });
  draw(EXPLOSION_KEYS[2], (g) => {
    g.lineStyle(1, COLORS.explRed, 1);
    g.strokeCircle(c, c, 7);
    dot(g, COLORS.explOrange, 1, [
      [c - 4, c - 4],
      [c + 4, c - 4],
      [c - 4, c + 4],
      [c + 4, c + 4],
    ]);
  });
  draw(EXPLOSION_KEYS[3], (g) => {
    dot(g, COLORS.explRed, 1, [
      [c - 6, c - 6],
      [c + 6, c - 6],
      [c - 6, c + 6],
      [c + 6, c + 6],
      [c, c - 7],
      [c, c + 7],
      [c - 7, c],
      [c + 7, c],
    ]);
  });
}
