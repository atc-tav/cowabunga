import Phaser from 'phaser';

export interface FloatingTextOptions {
  color?: string;
  fontSize?: string;
  riseBy?: number;
  durationMs?: number;
  depth?: number;
}

/**
 * Spawn a short-lived text that rises a little and fades out, then cleans
 * itself up. The reusable "score popup" primitive — e.g. the points banked
 * from eating a ghost or fruit, floated from where it happened.
 */
export function floatingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  opts: FloatingTextOptions = {},
): Phaser.GameObjects.Text {
  const label = scene.add
    .text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: opts.fontSize ?? '9px',
      color: opts.color ?? '#ffffff',
    })
    .setOrigin(0.5)
    .setDepth(opts.depth ?? 2000);

  const rise = opts.riseBy ?? 12;
  const duration = opts.durationMs ?? 800;
  scene.tweens.add({ targets: label, y: y - rise, duration, ease: 'Sine.easeOut' });
  scene.tweens.add({
    targets: label,
    alpha: 0,
    delay: duration * 0.55,
    duration: duration * 0.45,
    onComplete: () => label.destroy(),
  });
  return label;
}
