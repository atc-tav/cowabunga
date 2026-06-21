import Phaser from 'phaser';
import { drawPixelArt } from '../../shared/textures';
import { COLORS, BRICK_COLORS, CAPSULE_COLORS } from './palette';
import { CellCode, CapsuleType, GAME } from './constants';

/**
 * Texture-key registry. The spec's "TX" map, adapted to cowabunga's
 * programmatic-sprite convention: every value is a Phaser texture key built by
 * `buildArkanoidTextures()` via `drawPixelArt()`. `verifyTextures()` asserts at
 * startup that each key actually got a definition (spec Section 8 check).
 */
export const TX = {
  vausNormal: 'ak-vaus-normal',
  vausEnlarged: 'ak-vaus-enlarged',
  vausLaser: 'ak-vaus-laser',
  vausLaserEnlarged: 'ak-vaus-laser-lg',

  ball: 'ak-ball',
  ballCaught: 'ak-ball-caught',

  brickSilverHit: 'ak-brick-silver-hit',

  laserBeam: 'ak-laser',
} as const;

export type TXKey = keyof typeof TX;

/** Texture key for a brick of the given cell code (color/silver/gold). */
export function brickTexture(code: CellCode): string {
  return `ak-brick-${code}`;
}

/** Texture key for a falling capsule of the given type. */
export function capsuleTexture(type: CapsuleType): string {
  return `ak-cap-${type}`;
}

// --- shading -------------------------------------------------------------

/** Multiply a packed RGB color by `f` (per channel, clamped) — bevel shading. */
function shade(color: number, f: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((color & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

// --- brick art -----------------------------------------------------------

/**
 * Build a `w×h` brick grid with a bevel: 'H' highlight along the top/left,
 * 'D' shadow along the bottom/right, 'F' fill in the middle.
 */
function brickArt(cracked = false): string[] {
  const w = GAME.brickWidth;
  const h = GAME.brickHeight;
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = '';
    for (let x = 0; x < w; x++) {
      if (y === 0 || x === 0) {
        line += 'H';
      } else if (y === h - 1 || x === w - 1) {
        line += 'D';
      } else {
        line += 'F';
      }
    }
    rows.push(line);
  }
  if (cracked) {
    // Scratch a diagonal crack through the interior (dark cells).
    const crack: [number, number][] = [
      [3, 2],
      [4, 3],
      [5, 4],
      [6, 3],
      [9, 5],
      [10, 4],
      [11, 5],
      [12, 6],
    ];
    for (const [cx, cy] of crack) {
      if (cy < h && cx < w) {
        rows[cy] = rows[cy].substring(0, cx) + 'D' + rows[cy].substring(cx + 1);
      }
    }
  }
  return rows;
}

// --- ball ----------------------------------------------------------------

const BALL_ART: string[] = [
  '  WWWW  ',
  ' WWWWWW ',
  'WWWWWWWW',
  'WWWWWWWW',
  'WWWWWWWW',
  'WWWWWWWW',
  ' WWWWWW ',
  '  WWWW  ',
];

// --- vaus ----------------------------------------------------------------

const VIS_EDGE = 5; // pixels of red cap drawn at each end (visual)

/**
 * Generate the Vaus paddle art for a given width. Rounded hull with red angle
 * caps, a cyan cockpit dome, and an engine glow. With `laser`, two emitter pods
 * and barrels are added on top (taller grid).
 */
function vausArt(width: number, laser: boolean): string[] {
  const w = width;
  const hullH = GAME.vausHeight;
  const topPad = laser ? 2 : 0;
  const h = hullH + topPad;
  const rows: string[] = [];
  const cockOuter = Math.floor(w / 2) - 3;
  const podL = 2;
  const podR = w - 4;

  for (let y = 0; y < h; y++) {
    let line = '';
    for (let x = 0; x < w; x++) {
      const hy = y - topPad; // row within the hull
      if (hy < 0) {
        // pod/barrel rows above the hull (laser only)
        const onPod = laser && (x === podL || x === podL + 1 || x === podR || x === podR + 1);
        line += onPod ? 'L' : ' ';
        continue;
      }
      // rounded corners
      if ((hy === 0 || hy === hullH - 1) && (x === 0 || x === w - 1)) {
        line += ' ';
        continue;
      }
      let ch: string;
      if (x < VIS_EDGE || x >= w - VIS_EDGE) {
        ch = 'R'; // red angle cap
      } else {
        ch = 'V'; // hull
      }
      // cockpit dome (top two hull rows, centered)
      if (hy <= 1 && x >= cockOuter && x < cockOuter + 6 && ch === 'V') {
        ch = 'C';
      }
      // engine glow (bottom hull row, centered)
      if (hy === hullH - 1 && x >= cockOuter + 1 && x < cockOuter + 5) {
        ch = 'E';
      }
      // laser pods bracket the hull edges
      if (laser && (x === podL || x === podL + 1 || x === podR || x === podR + 1)) {
        ch = 'L';
      }
      line += ch;
    }
    rows.push(line);
  }
  return rows;
}

// --- capsule art ---------------------------------------------------------

// 3×5 glyphs for the capsule letters. 'X' = lit pixel.
const GLYPHS: Record<CapsuleType, string[]> = {
  L: ['X..', 'X..', 'X..', 'X..', 'XXX'],
  E: ['XXX', 'X..', 'XXX', 'X..', 'XXX'],
  C: ['XXX', 'X..', 'X..', 'X..', 'XXX'],
  S: ['XXX', 'X..', 'XXX', '..X', 'XXX'],
  D: ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
  P: ['XXX', 'X.X', 'XXX', 'X..', 'X..'],
  B: ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'],
};

/** Compose a 16×8 capsule pill ('B' body, 'H' highlight band, 'T' glyph). */
function capsuleArt(type: CapsuleType): string[] {
  const w = GAME.capsuleWidth;
  const h = GAME.capsuleHeight;
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = '';
    for (let x = 0; x < w; x++) {
      // rounded pill ends
      if ((x === 0 || x === w - 1) && (y === 0 || y === h - 1)) {
        line += ' ';
      } else if (y === 0) {
        line += 'H'; // highlight strip across the top
      } else {
        line += 'B';
      }
    }
    rows.push(line);
  }
  // stamp the glyph centered (3 wide at x=6, 5 tall at y=2)
  const glyph = GLYPHS[type];
  const gx = Math.floor((w - 3) / 2);
  const gy = 2;
  for (let r = 0; r < glyph.length; r++) {
    for (let c = 0; c < 3; c++) {
      if (glyph[r][c] === 'X') {
        const rx = gx + c;
        const ry = gy + r;
        rows[ry] = rows[ry].substring(0, rx) + 'T' + rows[ry].substring(rx + 1);
      }
    }
  }
  return rows;
}

// --- build + verify ------------------------------------------------------

export function buildArkanoidTextures(scene: Phaser.Scene): void {
  // Vaus variants
  drawPixelArt(scene, TX.vausNormal, vausArt(GAME.vausNormalWidth, false), vausPalette(false));
  drawPixelArt(scene, TX.vausEnlarged, vausArt(GAME.vausEnlargedWidth, false), vausPalette(false));
  drawPixelArt(scene, TX.vausLaser, vausArt(GAME.vausNormalWidth, true), vausPalette(true));
  drawPixelArt(scene, TX.vausLaserEnlarged, vausArt(GAME.vausEnlargedWidth, true), vausPalette(true));

  // Ball
  drawPixelArt(scene, TX.ball, BALL_ART, { W: COLORS.ball });
  drawPixelArt(scene, TX.ballCaught, BALL_ART, { W: COLORS.ballCaught });

  // Laser beam
  const beam = ['L', 'L', 'L', 'L', 'L', 'L'];
  drawPixelArt(scene, TX.laserBeam, beam, { L: COLORS.laser });

  // Bricks — one texture per cell code plus the silver damage frame.
  for (const code of Object.keys(BRICK_COLORS) as CellCode[]) {
    const base = BRICK_COLORS[code];
    if (base === undefined) {
      continue;
    }
    drawPixelArt(scene, brickTexture(code), brickArt(), {
      F: base,
      H: shade(base, 1.4),
      D: shade(base, 0.55),
    });
  }
  const silver = BRICK_COLORS.S as number;
  drawPixelArt(scene, TX.brickSilverHit, brickArt(true), {
    F: shade(silver, 0.75),
    H: shade(silver, 1.1),
    D: shade(silver, 0.4),
  });

  // Capsules
  for (const type of Object.keys(CAPSULE_COLORS) as CapsuleType[]) {
    const body = CAPSULE_COLORS[type];
    drawPixelArt(scene, capsuleTexture(type), capsuleArt(type), {
      B: body,
      H: shade(body, 1.5),
      T: 0x101010,
    });
  }

  verifyTextures(scene);
}

function vausPalette(laser: boolean): Record<string, number> {
  const pal: Record<string, number> = {
    V: COLORS.vausHull,
    R: COLORS.vausEdge,
    C: COLORS.vausCockpit,
    E: COLORS.vausEngine,
  };
  if (laser) {
    pal.L = COLORS.vausLaser;
  }
  return pal;
}

/** Spec Section 8 check: every registered TX key must have a real texture. */
function verifyTextures(scene: Phaser.Scene): void {
  for (const key of Object.values(TX)) {
    if (!scene.textures.exists(key)) {
      throw new Error(`Missing sprite definition for key: ${key}`);
    }
  }
}
