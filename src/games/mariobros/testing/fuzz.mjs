// Mario Bros. fuzz bot: drives the live attract/play loop with random input to
// generate lots of varied state (spawns, flips, kicks, POW, wraps, bonus) and
// trip an invariant or an exception. Not trying to win — just to churn state.
//
// The scene boots into the attract screen; a couple of taps start a solo game.
export const fuzz = {
  gameId: 'mariobros',
  sceneKey: 'game-mariobros',
  async tick(d) {
    const flow = await d.hook('mariobros', 'flowState').catch(() => null);

    // Front end: tap to advance attract -> mode select -> ready.
    if (flow === 'attract' || flow === 'modeselect' || flow === 'gameover') {
      await d.tap('Space');
      return;
    }

    // In play: chase an enemy, jump under it, occasionally hit the POW (center).
    const r = Math.random();
    if (r < 0.30) {
      await d.tap('Space'); // jump (bump platforms / POW)
    } else if (r < 0.65) {
      await d.hold('ArrowLeft', 60);
    } else if (r < 0.95) {
      await d.hold('ArrowRight', 60);
    } else {
      // dash to center and jump to whack the POW block.
      await d.hold('ArrowRight', 30);
      await d.tap('Space');
    }
  },
};
