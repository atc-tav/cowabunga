/**
 * Arkanoid palette — authentic-ish arcade colors. The brick colors double as
 * scoring tiers; `BRICK_COLORS` is keyed by the stage-layout cell codes so
 * sprite generation and the layout data share one source of truth.
 */
import { CellCode } from './constants';

export const COLORS = {
  wall: 0x6868d8, // blue border frame
  wallHi: 0x9c9cf0,
  wallShadow: 0x3838a0,

  vausHull: 0xd8d8d8,
  vausEdge: 0xd82800, // red angle-edge zones
  vausCockpit: 0x3cbcfc,
  vausEngine: 0xfcb030,
  vausLaser: 0xfcfc00, // laser pods/beams

  ball: 0xffffff,
  ballCaught: 0xfcd8a8,

  capsuleText: 0xffffff,

  laser: 0xfcfc00,
} as const;

/** Base fill color for each destroyable/solid brick cell code. */
export const BRICK_COLORS: Partial<Record<CellCode, number>> = {
  W: 0xfcfcfc, // white
  O: 0xfc7460, // orange
  C: 0x3cbcfc, // cyan
  G: 0x00b800, // green
  R: 0xd82800, // red
  B: 0x2038ec, // blue
  V: 0xb040e0, // violet
  Y: 0xfcfc00, // yellow
  S: 0xb0b0c0, // silver
  X: 0xd0a020, // gold
};

/** Per-capsule body color (Section 5.2). */
export const CAPSULE_COLORS = {
  L: 0xd82800, // red
  E: 0x2038ec, // blue
  C: 0x00b800, // green
  S: 0xfc7460, // orange
  D: 0x3cbcfc, // cyan
  P: 0xb0b0c0, // silver/grey
  B: 0xb040e0, // violet
} as const;
