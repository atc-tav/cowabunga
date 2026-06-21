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
  const n = word.length;
  const mid = (n - 1) / 2;

  // Outlined glyphs share a 10-col x 11-row footprint.
  const baseW = 10 * PX;
  const baseH = 11 * PX;
  const GAP = PX;

  // Arc text: every letter stands on ONE circle (baselines on the arc) and is
  // rotated tangent to it, so the wordmark reads as a single continuous arc.
  // Letters also grow toward the ends. The arc geometry naturally drops the
  // outer letters lower (bottoms much lower, tops a little lower than centre).
  const GROW = 0.38; // C/A noticeably taller than the centre; OW/NG transition
  const EXTRA = 1.5;
  const targetArc = 200; // arc-length budget for the whole word
  const endAngle = (36 * Math.PI) / 180; // tilt of the outermost letters

  const tiltAt = (i: number) => Math.abs((i - mid) / mid);
  const growth = Array.from({ length: n }, (_, i) => 1 + GROW * tiltAt(i));
  const gapAt = (i: number) => GAP + EXTRA * ((tiltAt(i) + tiltAt(i + 1)) / 2);

  // Lay out in unscaled units, scale to the arc-length budget, then bend.
  let raw = growth.reduce((s, g) => s + baseW * g, 0);
  for (let i = 0; i < n - 1; i++) raw += gapAt(i);
  const SC = targetArc / raw;
  const arcLen = raw * SC;
  const radius = arcLen / 2 / endAngle;
  // Centre letter's baseline; ends curve down from here.
  const baseY = topY + baseH * SC;

  let s = -arcLen / 2; // signed arc-length cursor from the centre
  let leftX = cx;
  let rightX = cx;
  for (let i = 0; i < n; i++) {
    const sc = SC * growth[i];
    const w = baseW * sc;
    const sCenter = s + w / 2;
    s += w + (i < n - 1 ? gapAt(i) * SC : 0);

    const a = sCenter / radius; // angle along the arc (rad), signed
    const x = cx + radius * Math.sin(a);
    const yBase = baseY + radius * (1 - Math.cos(a));
    const key = `logo_${word[i]}`;
    drawPixelArt(scene, key, outlineGlyph(GLYPHS[word[i]]), palette, PX);
    scene.add
      .image(x, yBase, key)
      .setOrigin(0.5, 1) // stand the letter on the arc
      .setScale(sc)
      .setAngle((a * 180) / Math.PI)
      .setDepth(20);
    if (i === 0) leftX = x - w / 2;
    if (i === n - 1) rightX = x + w / 2;
  }

  // Sparkle stars around the wordmark (one left, two right), like the artwork.
  drawPixelArt(scene, 'logo_star', STAR, { '#': 0xfcfc00 }, 1);
  const place = (sx: number, sy: number, st: number) =>
    scene.add.image(sx, sy, 'logo_star').setOrigin(0.5).setScale(st).setDepth(21);
  place(leftX - 4, baseY - 6, 1.3);
  place(rightX + 4, baseY - 10, 1.6);
  place(rightX + 1, baseY + 14, 1.0);
}

