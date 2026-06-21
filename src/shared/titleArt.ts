import Phaser from 'phaser';
import { drawPixelArt } from './textures';

/**
 * Title Art — reusable engine for arcade title screens.
 *
 * It composes three layers that together read as a hand-drawn arcade logo while
 * staying 100% programmatic (no asset files):
 *
 *   1. a trapezoid BANNER with a subtitle (e.g. "CLASSIC ARCADE GAMES"),
 *   2. an arc WORDMARK — a chunky pixel block font bent onto a single circle,
 *      growing and tilting toward the ends, and
 *   3. a twinkling STARFIELD confined to the black gaps around the wordmark.
 *
 * Everything is config-driven (`ArcTitleSpec`) so each game can define its own
 * title (palette, word, banner) and reuse the same engine — see
 * `docs/title-art.md` for the design rationale, parameters, and the
 * screenshot-driven iteration workflow that produced the COWABUNGA logo.
 *
 * NB: games import only from `src/shared/`, so this lives here (not in scenes/).
 */

/** A pixel block font: glyph char -> rows of '#'(body) / ' '(empty). */
export type BlockFont = Record<string, string[]>;

export interface BannerSpec {
  text: string;
  /** Top width of the trapezoid (it narrows by `inset` on each side at the bottom). */
  width: number;
  height: number;
  inset: number;
  fill: number;
  outline: number;
  textColor: string;
  fontSize: number;
}

export interface WordmarkSpec {
  text: string;
  font: BlockFont;
  fill: number;
  crack: number;
  outline: number;
  /** Generation pixel size for each glyph cell. */
  pixelSize: number;
  /** Extra height the outermost letters gain over the centre (0.5 = +50%). */
  grow: number;
  /** Growth exponent (>1 makes only the very ends pop; 1 is linear). */
  growExp: number;
  /** Negative tracking so neighbours share only their black outlines. */
  gapTight: number;
  /** Arc-length budget for the whole word (controls overall size). */
  targetArc: number;
  /** Tilt of the outermost letters, in degrees. */
  endAngleDeg: number;
}

export interface ArcTitleSpec {
  banner: BannerSpec;
  wordmark: WordmarkSpec;
  /** Star tint cycle (e.g. yellow / white / light-blue). */
  starColors: number[];
}

// Depth bands so the wordmark renders in front of the banner (covering only the
// red, never the subtitle) and stars sit behind the letters (so a stray star is
// hidden rather than drawn over a glyph).
const DEPTH_BANNER = 20;
const DEPTH_BANNER_TEXT = 21;
const DEPTH_STARS = 21;
const DEPTH_WORDMARK = 22;

const STAR_SHAPE = [
  '   #   ',
  '   #   ',
  '  ###  ',
  '#######',
  '  ###  ',
  '   #   ',
  '   #   ',
];

let starKeyCounter = 0;

/**
 * Compose a full arc title centred on `cx`, starting at `topY`. Returns the
 * approximate total height drawn, so the caller can lay out what follows.
 */
export function drawArcTitle(
  scene: Phaser.Scene,
  cx: number,
  topY: number,
  spec: ArcTitleSpec,
): number {
  const bannerH = drawBanner(scene, cx, topY, spec.banner);
  // Wordmark sits just below the banner's subtitle. It renders in front, so its
  // tops may cover a little of the banner fill but never the subtitle text.
  const geom = drawArcWordmark(scene, cx, topY + bannerH - 1, spec.wordmark);
  drawTwinkleStars(scene, cx, {
    topY: geom.topY,
    baseY: geom.baseY,
    half: geom.half,
    endBottom: geom.endBottom,
    colors: spec.starColors,
  });
  return geom.endBottom - topY;
}

/** Draw the trapezoid banner + subtitle. Returns its height. */
export function drawBanner(
  scene: Phaser.Scene,
  cx: number,
  topY: number,
  spec: BannerSpec,
): number {
  const left = cx - spec.width / 2;
  const g = scene.add.graphics().setDepth(DEPTH_BANNER);
  const points = (o: number) => [
    new Phaser.Geom.Point(left - o, topY - o),
    new Phaser.Geom.Point(left + spec.width + o, topY - o),
    new Phaser.Geom.Point(left + spec.width - spec.inset + o, topY + spec.height + o),
    new Phaser.Geom.Point(left + spec.inset - o, topY + spec.height + o),
  ];
  g.fillStyle(spec.outline, 1);
  g.fillPoints(points(2), true);
  g.fillStyle(spec.fill, 1);
  g.fillPoints(points(0), true);

  scene.add
    .text(cx, topY + spec.height / 2, spec.text, {
      fontFamily: 'monospace',
      fontSize: `${spec.fontSize}px`,
      fontStyle: 'bold',
      color: spec.textColor,
    })
    .setOrigin(0.5)
    .setDepth(DEPTH_BANNER_TEXT);

  return spec.height;
}

export interface WordmarkGeometry {
  topY: number;
  baseY: number;
  half: number;
  /** Lowest point of the (largest) end letters — no stars below this. */
  endBottom: number;
}

/**
 * Bend a word onto a single circle: every letter stands on the arc (baseline on
 * the circle) and is rotated tangent to it, so the wordmark reads as one
 * continuous arc. Letters grow toward the ends and squish together.
 */
export function drawArcWordmark(
  scene: Phaser.Scene,
  cx: number,
  topY: number,
  spec: WordmarkSpec,
): WordmarkGeometry {
  const word = spec.text;
  const palette = { '#': spec.fill, c: spec.crack, K: spec.outline };
  const n = word.length;
  const mid = (n - 1) / 2;

  // Uniform outlined footprint (assumes a fixed-size font).
  const sample = outlineGlyph(spec.font[word[0]]);
  const baseW = sample[0].length * spec.pixelSize;
  const baseH = sample.length * spec.pixelSize;
  const endAngle = (spec.endAngleDeg * Math.PI) / 180;

  const tiltAt = (i: number) => Math.abs((i - mid) / mid);
  const growth = Array.from({ length: n }, (_, i) => 1 + spec.grow * tiltAt(i) ** spec.growExp);

  // Lay out in unscaled units, scale to the arc-length budget, then bend.
  const raw = growth.reduce((s, g) => s + baseW * g, 0) + spec.gapTight * (n - 1);
  const SC = spec.targetArc / raw;
  const arcLen = raw * SC;
  const radius = arcLen / 2 / endAngle;
  const baseY = topY + baseH * SC;

  let s = -arcLen / 2;
  let endBottom = baseY;
  for (let i = 0; i < n; i++) {
    const sc = SC * growth[i];
    const w = baseW * sc;
    const sCenter = s + w / 2;
    s += w + (i < n - 1 ? spec.gapTight * SC : 0);

    const a = sCenter / radius;
    const x = cx + radius * Math.sin(a);
    const yBase = baseY + radius * (1 - Math.cos(a));
    const key = `ta_${spec.fill.toString(16)}_${word.charCodeAt(i)}`;
    drawPixelArt(scene, key, outlineGlyph(spec.font[word[i]]), palette, spec.pixelSize);
    scene.add
      .image(x, yBase, key)
      .setOrigin(0.5, 1)
      .setScale(sc)
      .setAngle((a * 180) / Math.PI)
      .setDepth(DEPTH_WORDMARK);
    if (i === 0 || i === n - 1) {
      endBottom = Math.max(endBottom, yBase + (w / 2) * Math.abs(Math.sin(a)));
    }
  }

  return { topY, baseY, half: arcLen / 2, endBottom };
}

interface StarfieldOptions {
  topY: number;
  baseY: number;
  half: number;
  endBottom: number;
  colors: number[];
}

/**
 * Twinkling sparkle field confined to the black gaps: the wedges just under the
 * banner above the dipping outer letters, and the concave pocket beneath the
 * arc (never below the big end letters). Each star fades/scales in and out on a
 * staggered loop so the field shimmers.
 */
export function drawTwinkleStars(
  scene: Phaser.Scene,
  cx: number,
  opts: StarfieldOptions,
): void {
  const key = `ta_star_${starKeyCounter++}`;
  drawPixelArt(scene, key, STAR_SHAPE, { '#': 0xffffff }, 1);
  const { topY, baseY, half, endBottom, colors } = opts;
  const spots: { fx: number; y: number; s: number }[] = [
    { fx: -0.8, y: topY + 5, s: 0.9 },
    { fx: 0.8, y: topY + 5, s: 0.9 },
    { fx: -0.5, y: baseY + 16, s: 0.8 },
    { fx: -0.18, y: baseY + 21, s: 1.0 },
    { fx: 0.18, y: baseY + 21, s: 0.7 },
    { fx: 0.5, y: baseY + 16, s: 0.9 },
  ];
  spots.forEach((spot, i) => {
    const star = scene.add
      .image(cx + spot.fx * half, Math.min(spot.y, endBottom - 2), key)
      .setOrigin(0.5)
      .setTint(colors[i % colors.length])
      .setScale(spot.s)
      .setAlpha(0)
      .setDepth(DEPTH_STARS);
    scene.tweens.add({
      targets: star,
      alpha: { from: 0, to: 1 },
      scale: { from: spot.s * 0.3, to: spot.s },
      ease: 'Sine.InOut',
      duration: 520 + Math.random() * 520,
      hold: 160 + Math.random() * 320,
      yoyo: true,
      repeat: -1,
      repeatDelay: 700 + Math.random() * 1700,
      delay: Math.random() * 2400,
    });
  });
}

/**
 * Wrap a block glyph in a 1px black outline and sprinkle a deterministic crack
 * pattern through its body, returning rows ready for `drawPixelArt`.
 *   '#' body · 'c' crack · 'K' outline · ' ' transparent
 */
export function outlineGlyph(rows: string[]): string[] {
  const h = rows.length;
  const w = rows[0].length;
  const grid: string[][] = [];
  for (let y = 0; y < h + 2; y++) {
    grid.push(new Array<string>(w + 2).fill(' '));
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rows[y][x] === '#') {
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

/**
 * Block font for the title wordmarks. Currently the letters needed for
 * COWABUNGA; extend with more glyphs (same 8x9 footprint) to title other games.
 */
export const BLOCK_FONT: BlockFont = {
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
