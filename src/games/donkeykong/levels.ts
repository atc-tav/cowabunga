import { PlatformSegment, surfaceY } from '../../shared/Platformer';

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
