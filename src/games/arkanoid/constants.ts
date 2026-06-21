/**
 * Arkanoid tuning constants. Everything the simulation needs lives here so the
 * scene stays free of magic numbers. Values follow the design spec's Section 11
 * table; a handful of derived helpers (frame timing, scoring maps) sit at the
 * bottom.
 */
export const GAME = {
  // Screen
  screenWidth: 224,
  screenHeight: 256,
  wallThickness: 8,
  headerHeight: 24, // score/HUD area at top

  // Brick grid
  gridCols: 13,
  gridRows: 18,
  brickWidth: 16,
  brickHeight: 8,
  brickGridOriginX: 8, // left wall offset
  brickGridOriginY: 32, // below header

  // Ball
  ballRadius: 4, // px
  ballBaseSpeed: 3.0, // px per frame (at 60fps)
  ballMaxSpeed: 7.0, // px per frame (after ceiling hits)
  ballSpeedIncrement: 0.25, // speed boost per ceiling hit
  minVerticalSpeed: 1.0, // |vy| never below this
  minBallAngleDeg: 30, // from horizontal baseline
  maxBallAngleDeg: 150,

  // Vaus
  vausNormalWidth: 28, // px
  vausEnlargedWidth: 44, // px
  vausHeight: 6, // px
  vausY: 240, // starting Y position
  vausSpeed: 160, // px per second (single-axis travel)
  vausEdgeZoneWidth: 6, // px — red edge zone each side
  vausEdgeAngleDeg: 30, // angle from horizontal when ball hits edge

  // Capsules
  capsuleFallSpeed: 1.5, // px per frame
  capsuleWidth: 16,
  capsuleHeight: 8,
  capsuleSpawnChance: 0.25, // ~25% of bricks seeded with a capsule

  // Laser
  laserSpeed: 6.0, // px per frame upward
  laserWidth: 2,
  laserCooldownMs: 220, // gap between auto-fire shots

  // Slow capsule
  slowSpeedMultiplier: 0.5, // fraction of base speed
  slowCreepRateMs: 8000, // time to return to base speed after Slow

  // Catch capsule
  catchAutoReleaseMs: 5000, // auto-release if player doesn't fire

  // Break portal
  breakBonusPoints: 10000,
  breakPortalY: 176, // center Y of the portal on the right wall
  breakPortalHalfH: 8, // vertical half-extent of the opening
  breakPortalFrameMs: 150, // shimmer animation cadence

  // Enemies
  uniraSpeed: 0.8,
  convoySpeed: 1.5,
  molesterSpeed: 1.2,
  uniraPoints: 100,
  convoyPoints: 200,
  molesterPoints: 300,
  enemyMaxOnscreen: 2,
  enemySpawnMinMs: 6000,
  enemySpawnMaxMs: 10000,
  enemyBallCooldownMs: 250,
  enemyFlapMs: 220,
  convoyDiveMs: 600,

  // DOH
  dohHitsRequired: 16,
  dohHitPoints: 1000, // per hit
  dohProjectileSpeed: 2.0,
  dohFireMs: 1500, // gap between mouth projectiles
  dohHitCooldownMs: 220, // per-ball debounce so one contact = one hit
  dohStage: 33,
  victoryMs: 4200,

  // Scoring
  capsuleCollectPoints: 1000, // any capsule caught = 1000 pts
  extraLifeAt: 20000,
  extraLifeEvery: 60000, // after the 20k threshold

  // Silver brick hits by stage group (index = stage - 1, stages 1..32)
  silverHitsTable: [
    2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 5,
    5, 5, 5, 5, 5, 5, 5,
  ],

  // Flow timings (ms)
  readyMs: 900,
  clearFlashMs: 700,
  deathPauseMs: 1100,
  gameoverMs: 2400,

  // Lives
  livesStart: 3,
} as const;

/** 60fps reference frame in ms — used to turn px/frame into px/ms. */
export const FRAME_MS = 1000 / 60;

/**
 * Cell type codes used by the stage layout strings.
 *   '.' empty   'X' gold (indestructible)   'S' silver (multi-hit)
 *   color bricks: W O C G R B V Y
 */
export type CellCode =
  | '.'
  | 'W'
  | 'O'
  | 'C'
  | 'G'
  | 'R'
  | 'B'
  | 'V'
  | 'Y'
  | 'S'
  | 'X';

/** Points awarded for destroying each color brick (Section 4.1). */
export const COLOR_BRICK_POINTS: Partial<Record<CellCode, number>> = {
  W: 50,
  O: 60,
  C: 70,
  G: 90,
  R: 100,
  B: 110,
  V: 120,
  Y: 50,
};

/** The seven capsule kinds (Section 5.2). */
export type CapsuleType = 'L' | 'E' | 'C' | 'S' | 'D' | 'P' | 'B';

/**
 * Capsule drop weights. B and P are half as likely as the rest (Section 5.1).
 */
export const CAPSULE_WEIGHTS: Partial<Record<CapsuleType, number>> = {
  L: 2,
  E: 2,
  C: 2,
  S: 2,
  D: 2,
  P: 1,
  B: 1,
};

/** Silver brick hit requirement for a given 1-based stage number. */
export function silverHitsForStage(stage: number): number {
  const idx = Math.min(Math.max(stage - 1, 0), GAME.silverHitsTable.length - 1);
  return GAME.silverHitsTable[idx];
}
