/**
 * Per-game score + high-score persistence via localStorage. One instance per
 * game scene, keyed by the game's id so each game keeps its own high score.
 */
export class ScoreManager {
  private readonly storageKey: string;
  private _score = 0;
  private _high = 0;

  constructor(gameId: string) {
    this.storageKey = `cowabunga:highscore:${gameId}`;
    this._high = this.loadHigh();
  }

  get score(): number {
    return this._score;
  }

  get high(): number {
    return this._high;
  }

  add(points: number): void {
    this.setScore(this._score + points);
  }

  setScore(value: number): void {
    this._score = value;
    if (value > this._high) {
      this._high = value;
      this.saveHigh(value);
    }
  }

  reset(): void {
    this._score = 0;
  }

  private loadHigh(): number {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private saveHigh(value: number): void {
    try {
      localStorage.setItem(this.storageKey, String(value));
    } catch {
      /* storage unavailable (private mode / quota) — non-fatal */
    }
  }
}
