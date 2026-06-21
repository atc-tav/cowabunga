import Phaser from 'phaser';

/**
 * Scene transitions. A fade keeps the hand-off legible: the outgoing scene
 * fades to black (optionally flashing the game's title with a little pop), and
 * the incoming scene fades up from black via `fadeSceneIn` in its create().
 *
 *   home -> game : fade to black, punch up the title, then fade into the game
 *   game -> home : fade to black, then fade back into the menu (no title)
 */
export const TRANSITION_FADE_MS = 300;

// Above every HUD / overlay in any scene.
const OVERLAY_DEPTH = 100000;

/**
 * Fade `scene` to black, then start `target`. With `opts.title`, a big title
 * pops in over the black (home -> game) before the game loads.
 */
export function fadeToScene(
  scene: Phaser.Scene,
  target: string,
  opts: { title?: string } = {},
): void {
  const cam = scene.cameras.main;
  const w = cam.width;
  const h = cam.height;
  const black = scene.add
    .rectangle(0, 0, w, h, 0x000000)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(OVERLAY_DEPTH)
    .setAlpha(0);

  // Transition "in": the screen fades to black.
  scene.tweens.add({
    targets: black,
    alpha: 1,
    duration: TRANSITION_FADE_MS,
    ease: 'Linear',
    onComplete: () => {
      if (!opts.title) {
        scene.time.delayedCall(200, () => scene.scene.start(target));
        return;
      }
      const label = scene.add
        .text(w / 2, h / 2, opts.title, {
          fontFamily: 'monospace',
          fontSize: '26px',
          fontStyle: 'bold',
          color: '#fcfc00',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(OVERLAY_DEPTH + 1)
        .setAlpha(0)
        .setScale(0.6);
      // Feedback: punch the title in to pump the player up.
      scene.tweens.add({
        targets: label,
        alpha: 1,
        scale: 1,
        duration: 200,
        ease: 'Back.Out',
      });
      // Hold, then transition "out": the title fades and the game loads.
      scene.time.delayedCall(TRANSITION_FADE_MS + 240, () => {
        scene.tweens.add({
          targets: label,
          alpha: 0,
          duration: 140,
          onComplete: () => scene.scene.start(target),
        });
      });
    },
  });
}

/** Fade the scene up from black. Call once from the target scene's create(). */
export function fadeSceneIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(TRANSITION_FADE_MS, 0, 0, 0);
}
