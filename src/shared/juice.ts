import Phaser from 'phaser';

/**
 * Screen-shake "impact" — the cheapest, highest-impact juice lever we have.
 * Three calibrated intensities so a barrel-smash, a player death, and a coin
 * bonk all kick the screen by a consistent, tasteful amount across every game.
 *
 * Two deliberate properties keep this safe for the reinforcement-learning dojo:
 *  - Duration-based (ms), so it is frame-rate independent.
 *  - Purely cosmetic — it offsets the camera, never game state — and it routes
 *    through a global gate so a pixel-observation agent can disable the jitter
 *    (`setJuiceEnabled(false)`) for stable, reproducible frames.
 */
export type ImpactPreset = 'light' | 'medium' | 'heavy';

const PRESETS: Record<ImpactPreset, { durationMs: number; intensity: number }> = {
  light: { durationMs: 90, intensity: 0.006 },
  medium: { durationMs: 160, intensity: 0.012 },
  heavy: { durationMs: 280, intensity: 0.02 },
};

// Global juice gate. Visual-only flourishes read this so the dojo can turn off
// camera jitter without touching any game code. On by default for human play.
let juiceEnabled = true;

export function setJuiceEnabled(on: boolean): void {
  juiceEnabled = on;
}

export function isJuiceEnabled(): boolean {
  return juiceEnabled;
}

/** Shake the scene's main camera at one of the calibrated intensities. */
export function screenShake(scene: Phaser.Scene, preset: ImpactPreset = 'medium'): void {
  if (!juiceEnabled) {
    return;
  }
  const p = PRESETS[preset];
  scene.cameras.main.shake(p.durationMs, p.intensity);
}
