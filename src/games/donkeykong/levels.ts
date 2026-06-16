import type { PlatformSegment } from '../../shared/Platformer';

/**
 * Level 1 girders (horizontal for this slice; sloped girders + ladders come
 * next). Top surfaces the player walks/lands on.
 */
export const LEVEL1_GIRDERS: PlatformSegment[] = [
  { x1: 8, x2: 216, y: 228 }, // ground
  { x1: 8, x2: 216, y: 196 },
  { x1: 8, x2: 216, y: 164 },
  { x1: 8, x2: 216, y: 132 },
  { x1: 8, x2: 216, y: 100 },
  { x1: 8, x2: 140, y: 64 }, // top (DK's girder)
];

export const MARIO_START = { x: 28, y: 228 } as const;
