import Phaser from 'phaser';
import { drawPixelArt } from '../shared/textures';

/**
 * The COWABUNGA title logo, recreated as pixel art (the project ships no asset
 * files): a red "CLASSIC ARCADE GAMES" banner above a green, black-outlined,
 * crack-textured, arched "COWABUNGA" wordmark with sparkle stars.
 *
 * The wordmark uses a small hand-drawn block font; the outline and crack
 * texture are generated programmatically from each glyph so the look stays
 * consistent and easy to retune. Letters are placed along a shallow valley
 * curve (axis-aligned, to keep edges crisp) for the arched feel.
 */
const GREEN = 0x86d52a;
const GREEN_CRACK = 0x3f7d1e;
const OUTLINE = 0x000000;
const PX = 2;

// 8x9 block glyphs ('#' = green body). Only the letters in COWABUNGA.
const GLYPHS: Record<string, string[]> = {
  C: [
    ' ###### ',
    '########',
    '##      ',
    '##      ',
    '##      ',
    '##      ',
    '##      ',
    '########',
    ' ###### ',
  ],
  O: [
    ' ###### ',
    '########',
    '##    ##',
    '##    ##',
    '##    ##',
    '##    ##',
    '##    ##',
    '########',
    ' ###### ',
  ],
  W: [
    '##    ##',
    '##    ##',
    '##    ##',
    '##    ##',
    '## ## ##',
    '## ## ##',
    '## ## ##',
    '########',
    ' ###  # ',
  ],
  A: [
    ' ###### ',
    '########',
    '##    ##',
    '##    ##',
    '########',
    '########',
    '##    ##',
    '##    ##',
    '##    ##',
  ],
  B: [
    '####### ',
    '########',
    '##    ##',
    '##    ##',
    '####### ',
    '####### ',
    '##    ##',
    '########',
    '####### ',
  ],
  U: [
    '##    ##',
    '##    ##',
    '##    ##',
    '##    ##',
    '##    ##',
    '##    ##',
    '##    ##',
    '########',
    ' ###### ',
  ],
  N: [
    '##    ##',
    '###   ##',
    '####  ##',
    '## ## ##',
    '## ## ##',
    '##  ####',
    '##   ###',
    '##    ##',
    '##    ##',
  ],
  G: [
    ' ###### ',
    '########',
    '##      ',
    '##      ',
    '##  ####',
    '##    ##',
    '##    ##',
    '########',
    ' ###### ',
  ],
};

const STAR = [
  '   #   ',
  '   #   ',
  '  ###  ',
  '#######',
  '  ###  ',
  '   #   ',
  '   #   ',
];

/**
 * Wrap a glyph in a 1px black outline and sprinkle a deterministic crack
 * pattern through its body, returning rows ready for `drawPixelArt`.
 */
function outlineGlyph(rows: string[]): string[] {
  const h = rows.length;
  const w = rows[0].length;
  const grid: string[][] = [];
  for (let y = 0; y < h + 2; y++) {
    grid.push(new Array<string>(w + 2).fill(' '));
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rows[y][x] === '#') {
        // Deterministic "cracks": a sparse, hashed scatter of darker pixels.
        grid[y + 1][x + 1] = (x * 7 + y * 13) % 12 === 0 ? 'c' : '#';
      }
    }
  }
  const filled = (c: string) => c === '#' || c === 'c';
  const out = grid.map((r) => r.slice());
  for (let y = 0; y < h + 2; y++) {
    for (let x = 0; x < w + 2; x++) {
      if (grid[y][x] !== ' ') continue;
      let adjacent = false;
      for (let dy = -1; dy <= 1 && !adjacent; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || nx < 0 || ny >= h + 2 || nx >= w + 2) continue;
          if (filled(grid[ny][nx])) {
            adjacent = true;
            break;
          }
        }
      }
      if (adjacent) out[y][x] = 'K';
    }
  }
  return out.map((r) => r.join(''));
}

/** Draw the full logo centered on `cx`, starting at `topY`. */
export function drawCowabungaLogo(scene: Phaser.Scene, cx: number, topY: number): void {
  const bannerH = drawBanner(scene, cx, topY);
  // Let the wordmark tuck up slightly under the banner (its black outline keeps
  // it legible over the red), like the reference.
  drawWordmark(scene, cx, topY + bannerH - 3);
}

/** Returns the banner height so the wordmark can be placed just beneath it. */
function drawBanner(scene: Phaser.Scene, cx: number, topY: number): number {
  const bannerW = 200;
  const bannerH = 16;
  const inset = 9;
  const left = cx - bannerW / 2;
  const g = scene.add.graphics().setDepth(20);

  // Trapezoid (wider at top), drawn twice for a chunky black border.
  const points = (o: number) => [
    new Phaser.Geom.Point(left - o, topY - o),
    new Phaser.Geom.Point(left + bannerW + o, topY - o),
    new Phaser.Geom.Point(left + bannerW - inset + o, topY + bannerH + o),
    new Phaser.Geom.Point(left + inset - o, topY + bannerH + o),
  ];
  g.fillStyle(OUTLINE, 1);
  g.fillPoints(points(2), true);
  g.fillStyle(0xd1232a, 1);
  g.fillPoints(points(0), true);

  scene.add
    .text(cx, topY + bannerH / 2, 'CLASSIC ARCADE GAMES', {
      fontFamily: 'monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
    })
    .setOrigin(0.5)
    .setDepth(21);

  return bannerH;
}

function drawWordmark(scene: Phaser.Scene, cx: number, topY: number): void {
  const word = 'COWABUNGA';
  const palette = { '#': GREEN, c: GREEN_CRACK, K: OUTLINE };

  // All glyphs share the same outlined footprint (8 body + 1px outline each
  // side = 10 cols). Scale the whole wordmark up to roughly fill the width.
  const cols = 10;
  const baseW = cols * PX;
  const naturalW = word.length * baseW + (word.length - 1) * PX;
  const scale = Math.min(1.35, 224 / naturalW);
  const letterW = baseW * scale;
  const gap = PX * scale;
  const totalW = word.length * letterW + (word.length - 1) * gap;

  const mid = (word.length - 1) / 2;
  const archDepth = 9 * scale;
  let x = cx - totalW / 2;
  for (let i = 0; i < word.length; i++) {
    // Arch (frown): middle rides high, ends sweep down — like the reference.
    const arch = Math.round(archDepth * ((i - mid) / mid) ** 2);
    const key = `logo_${word[i]}`;
    drawPixelArt(scene, key, outlineGlyph(GLYPHS[word[i]]), palette, PX);
    scene.add
      .image(x, topY + arch, key)
      .setOrigin(0, 0)
      .setScale(scale)
      .setDepth(20);
    x += letterW + gap;
  }

  // Sparkle stars around the wordmark (one left, two right), like the artwork.
  drawPixelArt(scene, 'logo_star', STAR, { '#': 0xfcfc00 }, 1);
  const place = (sx: number, sy: number, s: number) =>
    scene.add.image(sx, sy, 'logo_star').setOrigin(0.5).setScale(s).setDepth(21);
  place(cx - totalW / 2 - 1, topY + 12, 1.3);
  place(cx + totalW / 2 + 2, topY - 1, 1.6);
  place(cx + totalW / 2 - 1, topY + 25, 1.0);
}

