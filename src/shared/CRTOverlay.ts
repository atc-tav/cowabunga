import Phaser from 'phaser';

/**
 * DEFERRED — full CRT post-processing (scanlines, barrel curvature, phosphor
 * glow, vignette, chromatic aberration) is intentionally NOT implemented yet.
 *
 * Decision: the CRT look belongs on the final upscaled output, and most of it
 * will move to Unity's post-processing stack when the project is ported. So
 * this class exists now only as the wiring seam — every scene constructs one
 * and calls `apply()`, and we drop the real post-pipeline in here later without
 * touching any game code. See CLAUDE.md > CRT & Retro FX Layer.
 */
export class CRTOverlay {
  constructor(private readonly scene: Phaser.Scene) {}

  apply(): void {
    // Intentional no-op. When implemented, attach a WebGL post-pipeline to
    // `this.scene.cameras.main` sized to the upscaled output resolution.
    void this.scene;
  }
}
