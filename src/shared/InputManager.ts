import Phaser from 'phaser';

/**
 * Normalized input actions used across every game. Games never read raw keys
 * or gamepad buttons directly — they ask the InputManager for an action so we
 * can remap or add input sources (gamepad, touch) in one place.
 */
export type InputAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'confirm'
  | 'cancel'
  | 'fire'
  | 'pause';

const KEY_MAP: Record<InputAction, number[]> = {
  up: [Phaser.Input.Keyboard.KeyCodes.UP, Phaser.Input.Keyboard.KeyCodes.W],
  down: [Phaser.Input.Keyboard.KeyCodes.DOWN, Phaser.Input.Keyboard.KeyCodes.S],
  left: [Phaser.Input.Keyboard.KeyCodes.LEFT, Phaser.Input.Keyboard.KeyCodes.A],
  right: [Phaser.Input.Keyboard.KeyCodes.RIGHT, Phaser.Input.Keyboard.KeyCodes.D],
  confirm: [Phaser.Input.Keyboard.KeyCodes.ENTER, Phaser.Input.Keyboard.KeyCodes.SPACE],
  cancel: [Phaser.Input.Keyboard.KeyCodes.ESC],
  fire: [Phaser.Input.Keyboard.KeyCodes.SPACE, Phaser.Input.Keyboard.KeyCodes.Z],
  pause: [Phaser.Input.Keyboard.KeyCodes.ENTER, Phaser.Input.Keyboard.KeyCodes.P],
};

const ALL_ACTIONS: InputAction[] = [
  'up',
  'down',
  'left',
  'right',
  'confirm',
  'cancel',
  'fire',
  'pause',
];

export class InputManager {
  private readonly keys = new Map<InputAction, Phaser.Input.Keyboard.Key[]>();
  private firstInputFired = false;
  private firstInputCb?: () => void;

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (kb) {
      for (const action of ALL_ACTIONS) {
        this.keys.set(
          action,
          KEY_MAP[action].map((code) => kb.addKey(code, true, false)),
        );
      }
    }
  }

  /** True while the action is held (keyboard or gamepad). */
  isDown(action: InputAction): boolean {
    const list = this.keys.get(action);
    if (list && list.some((k) => k.isDown)) {
      return true;
    }
    return this.padDown(action);
  }

  /** True only on the frame the action was first pressed (keyboard). */
  justPressed(action: InputAction): boolean {
    const list = this.keys.get(action);
    return Boolean(list && list.some((k) => Phaser.Input.Keyboard.JustDown(k)));
  }

  /** Normalized -1/0/1 movement vector. Useful for free movement games. */
  direction(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.isDown('left')) x -= 1;
    if (this.isDown('right')) x += 1;
    if (this.isDown('up')) y -= 1;
    if (this.isDown('down')) y += 1;
    return { x, y };
  }

  /**
   * Registers a callback fired on the very first input of the scene. Used to
   * unlock the (deferred) audio context, which browsers gate behind a gesture.
   */
  onFirstInput(cb: () => void): void {
    this.firstInputCb = cb;
  }

  /** Pump once per frame from the owning scene's update(). */
  update(): void {
    if (this.firstInputFired || !this.firstInputCb) {
      return;
    }
    if (ALL_ACTIONS.some((a) => this.isDown(a))) {
      this.firstInputFired = true;
      this.firstInputCb();
    }
  }

  private padDown(action: InputAction): boolean {
    const gp = this.scene.input.gamepad;
    if (!gp || gp.total === 0) {
      return false;
    }
    const pad = gp.getPad(0);
    if (!pad) {
      return false;
    }
    switch (action) {
      case 'left':
        return pad.left || pad.leftStick.x < -0.5;
      case 'right':
        return pad.right || pad.leftStick.x > 0.5;
      case 'up':
        return pad.up || pad.leftStick.y < -0.5;
      case 'down':
        return pad.down || pad.leftStick.y > 0.5;
      case 'confirm':
        return pad.A;
      case 'cancel':
        return pad.B;
      case 'fire':
        return pad.A;
      default:
        return false;
    }
  }
}
