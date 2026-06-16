/**
 * DEFERRED — procedural Web Audio SFX/music will live here later.
 *
 * For now this is a no-op seam: game code can call `audio.play('eat')` today
 * and we fill in the implementation later with zero refactor. `unlock()` is
 * wired to the scene's first input (browsers gate AudioContext behind a user
 * gesture). See CLAUDE.md > Sound for the eventual design.
 */
export type SoundName = string;

export class SoundManager {
  private unlocked = false;

  unlock(): void {
    if (this.unlocked) {
      return;
    }
    this.unlocked = true;
    // TODO: create/resume AudioContext here once we implement audio.
  }

  play(_name: SoundName): void {
    // TODO: build an OscillatorNode + GainNode envelope per sound name.
  }

  stop(_name: SoundName): void {
    // TODO: stop a looping sound (e.g. background music).
  }
}
