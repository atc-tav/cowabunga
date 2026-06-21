import type { InputAction } from './InputManager';

/**
 * On-screen touch controls for phones, laid out into the letterbox gaps that a
 * portrait-ish arcade canvas leaves on a landscape phone: a D-pad on the left,
 * A/B + Start/Select on the right.
 *
 * It is a DOM overlay (not a Phaser scene) on purpose — the gaps sit OUTSIDE
 * the FIT-scaled canvas, so only HTML can reach them. The overlay is a process-
 * wide singleton; every per-scene `InputManager` reads its pressed state as a
 * third input source alongside keyboard + gamepad.
 *
 * Critically, it only mounts on touch devices (`(hover: none) and (pointer:
 * coarse)`), so desktop never sees it. Force on/off in dev with `?touch=1|0`.
 */
type Control = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'select';

// Which on-screen controls feed each normalized action. Mirrors the gamepad
// mapping in InputManager so all three input sources behave identically.
const ACTION_CONTROLS: Record<InputAction, Control[]> = {
  up: ['up'],
  down: ['down'],
  left: ['left'],
  right: ['right'],
  fire: ['a'],
  confirm: ['a', 'start'],
  cancel: ['b', 'select'],
  pause: ['start'],
};

interface ButtonSpec {
  control: Control;
  label: string;
  cls: string;
}

export class TouchControls {
  /** The single live overlay, or null on desktop / before init. */
  static shared: TouchControls | null = null;

  private readonly pressed = new Set<Control>();
  private readonly elements = new Map<Control, HTMLElement>();

  /** Mount the overlay once, if this is a touch device. No-op otherwise. */
  static init(): void {
    if (TouchControls.shared || !TouchControls.shouldEnable()) {
      return;
    }
    TouchControls.shared = new TouchControls();
  }

  /** True on touch-primary devices; `?touch=1|0` overrides for dev/testing. */
  static shouldEnable(): boolean {
    const forced = new URLSearchParams(window.location.search).get('touch');
    if (forced === '1') return true;
    if (forced === '0') return false;
    const mq = window.matchMedia?.('(hover: none) and (pointer: coarse)');
    if (mq) return mq.matches;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /** True while any control bound to this action is held. */
  isDown(action: InputAction): boolean {
    return ACTION_CONTROLS[action].some((c) => this.pressed.has(c));
  }

  private constructor() {
    this.injectStyles();
    this.buildDom();
    // Safety net: never leave a button stuck if focus/visibility is lost.
    const clearAll = () => {
      this.pressed.clear();
      for (const el of this.elements.values()) {
        el.classList.remove('tc-on');
      }
    };
    window.addEventListener('blur', clearAll);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearAll();
    });
  }

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'tc-root';

    const pad = document.createElement('div');
    pad.className = 'tc-pad';
    const dirs: ButtonSpec[] = [
      { control: 'up', label: '▲', cls: 'tc-dir tc-up' },
      { control: 'left', label: '◀', cls: 'tc-dir tc-left' },
      { control: 'right', label: '▶', cls: 'tc-dir tc-right' },
      { control: 'down', label: '▼', cls: 'tc-dir tc-down' },
    ];
    dirs.forEach((d) => pad.appendChild(this.makeButton(d)));

    const right = document.createElement('div');
    right.className = 'tc-right';
    const menu = document.createElement('div');
    menu.className = 'tc-menu';
    [
      { control: 'select' as Control, label: 'SELECT', cls: 'tc-pill' },
      { control: 'start' as Control, label: 'START', cls: 'tc-pill' },
    ].forEach((b) => menu.appendChild(this.makeButton(b)));
    const face = document.createElement('div');
    face.className = 'tc-face';
    // B before A so B sits lower-left and A upper-right (the NES diagonal).
    [
      { control: 'b' as Control, label: 'B', cls: 'tc-ab tc-b' },
      { control: 'a' as Control, label: 'A', cls: 'tc-ab tc-a' },
    ].forEach((b) => face.appendChild(this.makeButton(b)));
    right.append(menu, face);

    const rotate = document.createElement('div');
    rotate.className = 'tc-rotate';
    rotate.innerHTML = '<div>↻</div><div>ROTATE TO PLAY</div>';

    root.append(pad, right, rotate);
    document.body.appendChild(root);
  }

  private makeButton(spec: ButtonSpec): HTMLElement {
    const el = document.createElement('div');
    el.className = spec.cls;
    el.textContent = spec.label;
    el.setAttribute('role', 'button');
    this.elements.set(spec.control, el);

    const press = (e: PointerEvent) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      this.pressed.add(spec.control);
      el.classList.add('tc-on');
    };
    const release = () => {
      this.pressed.delete(spec.control);
      el.classList.remove('tc-on');
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    return el;
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
#tc-root {
  position: fixed; inset: 0; z-index: 2000; pointer-events: none;
  font-family: monospace; font-weight: bold;
  --d: clamp(36px, 11.5vmin, 74px);
  --ab: clamp(52px, 16vmin, 104px);
  --pill-h: clamp(20px, 4.5vmin, 32px);
}
#tc-root * {
  box-sizing: border-box; -webkit-user-select: none; user-select: none;
  -webkit-tap-highlight-color: transparent;
}
#tc-root .tc-dir, #tc-root .tc-ab, #tc-root .tc-pill {
  pointer-events: auto; touch-action: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.22);
  color: rgba(255, 255, 255, 0.5);
  transition: background 60ms linear, border-color 60ms linear, color 60ms linear;
}
#tc-root .tc-on {
  background: rgba(255, 255, 255, 0.26);
  border-color: rgba(255, 255, 255, 0.75);
  color: #fff;
}
.tc-pad {
  position: absolute; top: 50%;
  left: calc(env(safe-area-inset-left, 0px) + 3vmin);
  transform: translateY(-50%);
  display: grid;
  grid-template-columns: repeat(3, var(--d));
  grid-template-rows: repeat(3, var(--d));
}
.tc-dir { width: var(--d); height: var(--d); font-size: calc(var(--d) * 0.42); }
.tc-up { grid-area: 1 / 2; border-radius: 8px 8px 0 0; }
.tc-left { grid-area: 2 / 1; border-radius: 8px 0 0 8px; }
.tc-right { grid-area: 2 / 3; border-radius: 0 8px 8px 0; }
.tc-down { grid-area: 3 / 2; border-radius: 0 0 8px 8px; }
.tc-right {
  position: absolute; top: 50%;
  right: calc(env(safe-area-inset-right, 0px) + 3vmin);
  transform: translateY(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 3vmin;
}
.tc-menu { display: flex; gap: 2vmin; }
.tc-pill {
  height: var(--pill-h); padding: 0 2.6vmin;
  border-radius: calc(var(--pill-h) / 2);
  font-size: calc(var(--pill-h) * 0.42); letter-spacing: 0.05em;
}
.tc-face { display: flex; align-items: center; gap: 3vmin; }
.tc-ab {
  width: var(--ab); height: var(--ab); border-radius: 50%;
  font-size: calc(var(--ab) * 0.34);
}
.tc-a { align-self: flex-start; border-color: rgba(60, 188, 252, 0.45); color: rgba(60, 188, 252, 0.7); }
.tc-b { align-self: flex-end; border-color: rgba(216, 40, 0, 0.5); color: rgba(255, 120, 90, 0.75); }
.tc-a.tc-on { border-color: rgba(60, 188, 252, 1); color: #fff; }
.tc-b.tc-on { border-color: rgba(255, 90, 60, 1); color: #fff; }
.tc-rotate {
  position: absolute; inset: 0; display: none;
  flex-direction: column; align-items: center; justify-content: center;
  gap: 2vmin; background: rgba(0, 0, 0, 0.88);
  color: #fcfc00; font-size: 5vmin; text-align: center; pointer-events: auto;
}
@media (orientation: portrait) {
  .tc-pad, .tc-right { display: none !important; }
  .tc-rotate { display: flex; }
}
`;
    document.head.appendChild(style);
  }
}
