import type { PlatformSegment } from '../../shared/Platformer';

/**
 * Standard Mario Bros. single-screen board (bottom -> top):
 *   - ground floor (solid) with pipes at both bottom corners
 *   - floor with two large platforms + centre gap (POW block in the gap)
 *   - floor with two small side platforms + a larger raised centre platform
 *   - floor with two large platforms + centre gap (same as the lower one)
 *   - spawn pipes at both top corners
 * Platforms are one-way and reach the screen edges so you wrap across them.
 */
export const FLOORS: PlatformSegment[] = [
  // top floor (two large platforms, centre gap)
  { x1: 0, x2: 104, y1: 64, y2: 64 },
  { x1: 152, x2: 256, y1: 64, y2: 64 },
  // middle floor: small sides + raised centre island
  { x1: 0, x2: 48, y1: 112, y2: 112 },
  { x1: 208, x2: 256, y1: 112, y2: 112 },
  { x1: 80, x2: 176, y1: 104, y2: 104 },
  // lower floor (two large platforms, centre gap with POW)
  { x1: 0, x2: 104, y1: 160, y2: 160 },
  { x1: 152, x2: 256, y1: 160, y2: 160 },
  // ground
  { x1: 0, x2: 256, y1: 208, y2: 208 },
];

/** Vertical pipes: top pair open downward, bottom pair open upward. */
export interface Pipe {
  x: number;
  y1: number;
  y2: number;
  opening: 'down' | 'up';
}
export const PIPE_WIDTH = 24;
export const PIPES: Pipe[] = [
  { x: 2, y1: 24, y2: 60, opening: 'down' },
  { x: 230, y1: 24, y2: 60, opening: 'down' },
  { x: 2, y1: 174, y2: 210, opening: 'up' },
  { x: 230, y1: 174, y2: 210, opening: 'up' },
];

export const POW = { x: 128, y: 152 };

export const MARIO_START = { x: 40, y: 208 } as const;
