import { PlatformSegment, surfaceY } from '../../shared/Platformer';

export const SPAN_X1 = 12;
export const SPAN_X2 = 212;

/**
 * Level-1 girders, top -> bottom, sloped so barrels visibly roll downhill
 * toward the next ladder (alternating left/right like the original). The
 * bottom girder is flat.
 */
export const LEVEL1_GIRDERS: PlatformSegment[] = [
  { x1: SPAN_X1, x2: SPAN_X2, y1: 55, y2: 69 }, // 0 top — down-right (DK + Mario start at the high left)
  { x1: SPAN_X1, x2: SPAN_X2, y1: 107, y2: 93 }, // 1 down-left
  { x1: SPAN_X1, x2: SPAN_X2, y1: 131, y2: 145 }, // 2 down-right
  { x1: SPAN_X1, x2: SPAN_X2, y1: 183, y2: 169 }, // 3 down-left
  { x1: SPAN_X1, x2: SPAN_X2, y1: 207, y2: 221 }, // 4 down-right
  { x1: SPAN_X1, x2: SPAN_X2, y1: 234, y2: 234 }, // 5 ground (flat)
];

export interface Ladder {
  x: number;
  topY: number;
  bottomY: number;
  fromGirder: number; // index of the girder this ladder descends from
}

// Ladder x at each girder's LOW end (alternating right/left).
const LADDER_X = [196, 28, 196, 28, 196];

/** Ladders connecting each girder to the one below, anchored to the slopes. */
export function buildLadders(): Ladder[] {
  return LADDER_X.map((x, i) => ({
    x,
    topY: surfaceY(LEVEL1_GIRDERS[i], x),
    bottomY: surfaceY(LEVEL1_GIRDERS[i + 1], x),
    fromGirder: i,
  }));
}

export const MARIO_START_X = 30;
export const DK_X = 52;
