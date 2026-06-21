// Arkanoid fuzz bot: a dumb paddle-tracker. Launches caught balls, chases the
// lowest ball, and occasionally fires (in case the laser is armed). Not trying
// to win — just to generate lots of varied state (bricks, capsules, multiball)
// and trip an invariant or an exception.
export const fuzz = {
  gameId: 'arkanoid',
  sceneKey: 'game-arkanoid',
  async tick(d) {
    const balls = await d.hook('arkanoid', 'ballsInfo');
    if (!balls || balls.length === 0) {
      await d.tap('Space'); // between lives / launch
      return;
    }
    if (balls.some((b) => b.caught)) {
      await d.tap('Space'); // launch / release
      return;
    }
    const px = await d.hook('arkanoid', 'paddleX');
    const low = balls.reduce((a, b) => (b.y > a.y ? b : a));
    if (low.x < px - 3) await d.hold('ArrowLeft', 45);
    else if (low.x > px + 3) await d.hold('ArrowRight', 45);
    else await d.hold(Math.random() < 0.5 ? 'ArrowLeft' : 'ArrowRight', 18);
    if (Math.random() < 0.15) await d.tap('Space');
  },
};
