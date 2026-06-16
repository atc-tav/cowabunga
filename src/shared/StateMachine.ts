/**
 * A tiny, dependency-free finite state machine. Reused everywhere behavior is
 * stateful: ghost scatter/chase/frightened, enemy wander/chase, level flow,
 * attract mode, etc. `C` is the context object passed to each handler (usually
 * the entity or scene), `S` is the union of state names.
 */
export interface FsmState<C> {
  enter?: (ctx: C) => void;
  update?: (ctx: C, deltaMs: number) => void;
  exit?: (ctx: C) => void;
}

export class StateMachine<C, S extends string = string> {
  private readonly states = new Map<S, FsmState<C>>();
  private current?: S;

  constructor(private readonly ctx: C) {}

  add(name: S, state: FsmState<C>): this {
    this.states.set(name, state);
    return this;
  }

  get state(): S | undefined {
    return this.current;
  }

  transition(name: S): void {
    if (name === this.current) {
      return;
    }
    if (this.current !== undefined) {
      this.states.get(this.current)?.exit?.(this.ctx);
    }
    this.current = name;
    this.states.get(name)?.enter?.(this.ctx);
  }

  update(deltaMs: number): void {
    if (this.current === undefined) {
      return;
    }
    this.states.get(this.current)?.update?.(this.ctx, deltaMs);
  }
}
