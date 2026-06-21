import Phaser from 'phaser';
import { TouchControls } from './TouchControls';

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

/**
 * Per-instance input configuration. Omit it for the default single-player
 * scheme (arrows + WASD, gamepad 0). Pass a `keys` override and/or `padIndex`
 * to bind a specific player — e.g. two InputManagers for local co-op/versus.
 */
export interface InputOptions {
  /** Key-code overrides per action. If given, ONLY these actions get keys. */
  keys?: Partial<Record<InputAction, number[]>>;
  /** Which connected gamepad to read (default 0). */
  padIndex?: number;
}

const K = Phaser.Input.Keyboard.KeyCodes;

/** Player 1: arrow keys to move, Up/Space to jump. */
export const PLAYER_ONE_KEYS: Partial<Record<InputAction, number[]>> = {
  left: [K.LEFT],
  right: [K.RIGHT],
  up: [K.UP],
  down: [K.DOWN],
  fire: [K.UP, K.SPACE],
};

/** Player 2: WASD to move, W to jump. */
export const PLAYER_TWO_KEYS: Partial<Record<InputAction, number[]>> = {
  left: [K.A],
  right: [K.D],
  up: [K.W],
  down: [K.S],
  fire: [K.W],
};

// Standard-mapping gamepad button indices (Gamepad API "standard" / X-input).
// Used for buttons Phaser doesn't expose by name (Start / Select / stick click).
const PAD_START = 9;
const PAD_SELECT = 8;
// Left analog-stick click (L3) — mapped to mirror the A button.
const PAD_L3 = 10;

// Analog-stick travel past which we treat it as a directional press.
const STICK_DEADZONE = 0.5;

export class InputManager {
  private readonly keys = new Map<InputAction, Phaser.Input.Keyboard.Key[]>();
  private firstInputFired = false;
  private firstInputCb?: () => void;

  // Per-frame action snapshots, so justPressed() can detect the rising edge of
  // a gamepad button or on-screen touch button the same way JustDown does for
  // the keyboard.
  private readonly padNow = new Map<InputAction, boolean>();
  private readonly padPrev = new Map<InputAction, boolean>();
  private readonly touchNow = new Map<InputAction, boolean>();
  private readonly touchPrev = new Map<InputAction, boolean>();
  private primed = false;

  // On-screen touch is a single shared overlay, so only the primary (pad 0)
  // manager reads it — a player-two scheme on pad 1 stays touch-free.
  private readonly usesTouch: boolean;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: InputOptions = {},
  ) {
    this.usesTouch = (options.padIndex ?? 0) === 0;
    const kb = scene.input.keyboard;
    if (kb) {
      const custom = options.keys;
      for (const action of ALL_ACTIONS) {
        const codes = custom ? custom[action] ?? [] : KEY_MAP[action];
        this.keys.set(
          action,
          codes.map((code) => kb.addKey(code, true, false)),
        );
      }
    }
    for (const action of ALL_ACTIONS) {
      this.padNow.set(action, false);
      this.padPrev.set(action, false);
      this.touchNow.set(action, false);
      this.touchPrev.set(action, false);
    }
  }

  /** True while the action is held (keyboard, gamepad, or touch). */
  isDown(action: InputAction): boolean {
    const list = this.keys.get(action);
    if (list && list.some((k) => k.isDown)) {
      return true;
    }
    return this.padDown(action) || this.touchDown(action);
  }

  /** True only on the frame the action was first pressed (any input source). */
  justPressed(action: InputAction): boolean {
    const list = this.keys.get(action);
    if (list && list.some((k) => Phaser.Input.Keyboard.JustDown(k))) {
      return true;
    }
    // Gamepad / touch rising edge: down this frame, up last frame.
    const padEdge = Boolean(this.padNow.get(action)) && !this.padPrev.get(action);
    const touchEdge = Boolean(this.touchNow.get(action)) && !this.touchPrev.get(action);
    return padEdge || touchEdge;
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
    // Snapshot gamepad + touch state so justPressed() can read this frame's
    // rising edges. On the first pump we prime prev = now, so a button still
    // held from the launching scene (e.g. A/Start) isn't read as a fresh press.
    for (const action of ALL_ACTIONS) {
      const padNow = this.padDown(action);
      this.padPrev.set(action, this.primed ? (this.padNow.get(action) ?? false) : padNow);
      this.padNow.set(action, padNow);

      const touchNow = this.touchDown(action);
      this.touchPrev.set(action, this.primed ? (this.touchNow.get(action) ?? false) : touchNow);
      this.touchNow.set(action, touchNow);
    }
    this.primed = true;

    if (this.firstInputFired || !this.firstInputCb) {
      return;
    }
    if (ALL_ACTIONS.some((a) => this.isDown(a))) {
      this.firstInputFired = true;
      this.firstInputCb();
    }
  }

  /** Current on-screen touch state for an action (primary manager only). */
  private touchDown(action: InputAction): boolean {
    if (!this.usesTouch) {
      return false;
    }
    return TouchControls.shared?.isDown(action) ?? false;
  }

  private activePad(): Phaser.Input.Gamepad.Gamepad | null {
    const gp = this.scene.input.gamepad;
    if (!gp || gp.total === 0) {
      return null;
    }
    return gp.getPad(this.options.padIndex ?? 0) ?? null;
  }

  /** True if a numbered standard-mapping button is currently pressed. */
  private buttonDown(pad: Phaser.Input.Gamepad.Gamepad, index: number): boolean {
    const button = pad.buttons[index];
    return button ? button.pressed : false;
  }

  /**
   * Current gamepad state for an action, mapped for a standard / X-input pad
   * (e.g. an 8BitDo Ultimate 2C in X-input mode). Face buttons use Phaser's
   * named accessors; Start/Select fall back to numbered indices.
   */
  private padDown(action: InputAction): boolean {
    const pad = this.activePad();
    if (!pad) {
      return false;
    }
    switch (action) {
      case 'left':
        return pad.left || pad.leftStick.x < -STICK_DEADZONE;
      case 'right':
        return pad.right || pad.leftStick.x > STICK_DEADZONE;
      case 'up':
        return pad.up || pad.leftStick.y < -STICK_DEADZONE;
      case 'down':
        return pad.down || pad.leftStick.y > STICK_DEADZONE;
      // Primary action (jump / shoot): the south or west face button, or L3.
      case 'fire':
        return pad.A || pad.X || this.buttonDown(pad, PAD_L3);
      // Menu confirm / launch: south face, Start, or L3.
      case 'confirm':
        return pad.A || this.buttonDown(pad, PAD_START) || this.buttonDown(pad, PAD_L3);
      // Back out: east face or Select/Back.
      case 'cancel':
        return pad.B || this.buttonDown(pad, PAD_SELECT);
      case 'pause':
        return this.buttonDown(pad, PAD_START);
      default:
        return false;
    }
  }
}
