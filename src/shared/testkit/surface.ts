import type Phaser from 'phaser';

/**
 * The reusable test-surface contract (see `./README.md`). A game becomes
 * driveable by the headless harness by exposing one of these. The harness is
 * fully game-agnostic — it only ever reads `snapshot()` / `invariants()` and
 * calls named `hooks`.
 *
 * Wired only in dev/test builds; tree-shaken out of production.
 */
export interface InvariantViolation {
  /** stable id, e.g. "ball-speed-bounds". */
  rule: string;
  detail: string;
}

export interface GameTestSurface<S = Record<string, unknown>> {
  /** Matches the registry game id (e.g. "arkanoid"). */
  readonly gameId: string;
  /** The Phaser scene key, so the harness can (re)start the game. */
  readonly sceneKey: string;
  /** Flat, JSON-serialisable snapshot of everything assertions care about. */
  snapshot(): S;
  /** Properties that must hold this frame; [] when healthy. */
  invariants(): InvariantViolation[];
  /** Deterministic seams scenarios use to set up + drive situations. */
  readonly hooks: Readonly<Record<string, (...args: never[]) => unknown>>;
}

interface TestKit {
  game: Phaser.Game;
  surfaces: Record<string, GameTestSurface>;
}

declare global {
  interface Window {
    __testkit?: TestKit;
  }
}

/** Expose the running game to the node harness (call once, dev/test only). */
export function initTestKit(game: Phaser.Game): void {
  window.__testkit = { game, surfaces: {} };
}

/** Register a game's surface — call when its scene boots (dev/test only). */
export function registerTestSurface(surface: GameTestSurface): void {
  if (window.__testkit) {
    window.__testkit.surfaces[surface.gameId] = surface;
  }
}
