// Galaga fuzz bot: random drift + fire. Crude on purpose — the point is to
// generate long, varied play (fly-in, dives, captures, deaths, restarts) and
// trip an invariant (e.g. the bullet cap) or an exception.
export const fuzz = {
  gameId: 'galaga',
  sceneKey: 'game-galaga',
  async tick(d) {
    const r = Math.random();
    if (r < 0.42) await d.hold('ArrowLeft', 55);
    else if (r < 0.84) await d.hold('ArrowRight', 55);
    else await d.tap('Space');
  },
};
