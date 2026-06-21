import { PlatformSegment, surfaceY } from '../../shared/Platformer';
import { WIDTH } from './constants';

export const SPAN_X1 = 12;
export const SPAN_X2 = 212;

/**
 * Level-1 girders, top -> bottom: 7 platforms, sloped (alternating) so barrels
 * roll downhill. Spacing (~30px centres, ±5 slope) keeps every gap > the jump
 * height, so ladders can't be bypassed and each renders 2+ rungs. Bottom is
 * flat — Mario starts there, bottom-left; DK + Pauline are at the top.
 */
export const LEVEL1_GIRDERS: PlatformSegment[] = [
  { x1: SPAN_X1, x2: SPAN_X2, y1: 45, y2: 55 }, // 0 top — DK + Pauline
  { x1: SPAN_X1, x2: SPAN_X2, y1: 85, y2: 75 }, // 1
  { x1: SPAN_X1, x2: SPAN_X2, y1: 105, y2: 115 }, // 2
  { x1: SPAN_X1, x2: SPAN_X2, y1: 145, y2: 135 }, // 3
  { x1: SPAN_X1, x2: SPAN_X2, y1: 165, y2: 175 }, // 4
  { x1: SPAN_X1, x2: SPAN_X2, y1: 205, y2: 195 }, // 5
  { x1: SPAN_X1, x2: SPAN_X2, y1: 230, y2: 230 }, // 6 ground (flat) — Mario start
];

export interface Ladder {
  x: number;
  topY: number;
  bottomY: number;
  fromGirder: number;
}

// Ladder x at each girder's LOW end (alternating right/left), one per gap.
const LADDER_X = [196, 28, 196, 28, 196, 28];

export function buildLadders(): Ladder[] {
  return LADDER_X.map((x, i) => ({
    x,
    topY: surfaceY(LEVEL1_GIRDERS[i], x),
    bottomY: surfaceY(LEVEL1_GIRDERS[i + 1], x),
    fromGirder: i,
  }));
}

export const MARIO_START_X = 30; // bottom-left
export const DK_X = 52; // top girder
export const PAULINE_X = 100; // top girder, right of DK (rescue target)

// --- 100m (rivet stage) -------------------------------------------------

/**
 * 100m: a flat steel frame. A small DK platform on top, then four full-width
 * bars (a rivet at each end = 8), and the floor. Ladders climb both ends of
 * every gap. Removing all 8 rivets drops Donkey Kong.
 */
export const STAGE100_GIRDERS: PlatformSegment[] = [
  { x1: 80, x2: 144, y1: 40, y2: 40 }, // 0 DK + Pauline platform (top centre)
  { x1: 20, x2: 204, y1: 66, y2: 66 }, // 1 top bar
  { x1: 20, x2: 204, y1: 104, y2: 104 }, // 2
  { x1: 20, x2: 204, y1: 142, y2: 142 }, // 3
  { x1: 20, x2: 204, y1: 180, y2: 180 }, // 4 bottom bar
  { x1: 0, x2: WIDTH, y1: 214, y2: 214 }, // 5 floor — Mario start
];

export interface Rivet {
  x: number;
  girder: number;
}

const STAGE100_LADDER_GAPS = [1, 2, 3, 4]; // upper girder index of each climbable gap
const STAGE100_LADDER_XS = [34, 190]; // both ends

export function stage100Ladders(): Ladder[] {
  const ladders: Ladder[] = [];
  for (const fromG of STAGE100_LADDER_GAPS) {
    for (const x of STAGE100_LADDER_XS) {
      ladders.push({
        x,
        topY: surfaceY(STAGE100_GIRDERS[fromG], x),
        bottomY: surfaceY(STAGE100_GIRDERS[fromG + 1], x),
        fromGirder: fromG,
      });
    }
  }
  return ladders;
}

/** Two rivets per bar (girders 1–4), one near each end = 8 total. */
export function stage100Rivets(): Rivet[] {
  const out: Rivet[] = [];
  for (const g of [1, 2, 3, 4]) {
    out.push({ x: 44, girder: g });
    out.push({ x: 180, girder: g });
  }
  return out;
}
