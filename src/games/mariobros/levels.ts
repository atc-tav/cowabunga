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

/**
 * Horizontal corner pipes whose opening (light rim) faces the CENTRE of the
 * screen. Top pipes sit at the top-floor level (enemies walk out horizontally
 * onto it); bottom pipes sit at ground level (kicked shells exit there).
 */
export interface Pipe {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  open: 'left' | 'right'; // which side the opening faces (toward centre)
  role: 'top' | 'bottom';
}
export const PIPES: Pipe[] = [
  { x1: 0, x2: 30, y1: 44, y2: 64, open: 'right', role: 'top' }, // top-left, opens right
  { x1: 226, x2: 256, y1: 44, y2: 64, open: 'left', role: 'top' }, // top-right, opens left
  { x1: 0, x2: 30, y1: 188, y2: 208, open: 'right', role: 'bottom' },
  { x1: 226, x2: 256, y1: 188, y2: 208, open: 'left', role: 'bottom' },
];

/** Spawn just outside a top pipe's opening, walking toward centre, on the top floor. */
export interface SpawnPoint {
  x: number;
  feetY: number;
  dir: 1 | -1;
}
export function topPipeSpawns(): SpawnPoint[] {
  return PIPES.filter((p) => p.role === 'top').map((p) => ({
    x: p.open === 'right' ? p.x2 + 2 : p.x1 - 2,
    feetY: p.y2, // top floor surface
    dir: p.open === 'right' ? 1 : -1,
  }));
}

/** A kicked shell that reaches a bottom pipe's mouth is out of the game. */
export function bottomPipeZones(): [number, number][] {
  return PIPES.filter((p) => p.role === 'bottom').map((p) => [p.x1, p.x2]);
}

/** Coin positions for bonus phases, scattered across the platform surfaces. */
export function bonusCoinSpots(): { x: number; y: number }[] {
  return [
    { x: 40, y: 60 },
    { x: 84, y: 60 },
    { x: 172, y: 60 },
    { x: 216, y: 60 },
    { x: 112, y: 100 },
    { x: 148, y: 100 },
    { x: 52, y: 156 },
    { x: 204, y: 156 },
    { x: 96, y: 204 },
    { x: 160, y: 204 },
  ];
}

/** Anchor points for icicles on the underside of the top floor (y 64 + 10). */
export function icicleAnchors(): { x: number; y: number }[] {
  const y = 74;
  return [40, 70, 100, 156, 186, 216].map((x) => ({ x, y }));
}

export const POW = { x: 128, y: 152 };

export const MARIO_START = { x: 40, y: 208 } as const;
export const LUIGI_START = { x: 216, y: 208 } as const;
