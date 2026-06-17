import type { PlatformSegment } from '../../shared/Platformer';

/**
 * Single-screen floor layout: 5 levels of one-way platforms with alternating
 * centre gaps; floors reach the screen edges so you wrap across them. The
 * bottom floor is solid. (Pipes + POW are drawn for context; they get behaviour
 * in later slices.)
 */
export const FLOORS: PlatformSegment[] = [
  { x1: 0, x2: 112, y1: 48, y2: 48 },
  { x1: 144, x2: 256, y1: 48, y2: 48 },
  { x1: 0, x2: 96, y1: 88, y2: 88 },
  { x1: 160, x2: 256, y1: 88, y2: 88 },
  { x1: 0, x2: 112, y1: 128, y2: 128 },
  { x1: 144, x2: 256, y1: 128, y2: 128 },
  { x1: 0, x2: 96, y1: 168, y2: 168 },
  { x1: 160, x2: 256, y1: 168, y2: 168 },
  { x1: 0, x2: 256, y1: 208, y2: 208 }, // ground
];

/** Decorative pipes (enemy spawn/exit points later). */
export const PIPES = [
  { x: 0, y: 30, facing: 1 }, // top-left
  { x: 232, y: 30, facing: -1 }, // top-right
];

export const POW = { x: 128, y: 190 };

export const MARIO_START = { x: 40, y: 208 } as const;
