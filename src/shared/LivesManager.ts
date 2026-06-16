/**
 * Tracks remaining lives for a game session. Deliberately tiny and shared —
 * every game in the collection has the same "you have N lives" concept.
 */
export class LivesManager {
  private _count: number;

  constructor(private readonly initial = 3) {
    this._count = initial;
  }

  get count(): number {
    return this._count;
  }

  get isGameOver(): boolean {
    return this._count <= 0;
  }

  lose(): number {
    if (this._count > 0) {
      this._count--;
    }
    return this._count;
  }

  reset(): void {
    this._count = this.initial;
  }
}
