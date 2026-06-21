/**
 * Galaga palette — the white/red fighter, a bright bolt, and three star tints
 * for the parallax field.
 */
export const COLORS = {
  ship: 0xffffff,
  cockpit: 0xff0000,
  shipTrim: 0x3cbcfc,
  engine: 0xff7a18,
  bossAccent: 0xd82800,
  bullet: 0xfcff5e,
  enemyBullet: 0xff66ff,
  beam: 0x9cf0ff, // tractor-beam cone
  captive: 0x88aaff, // captured ship tint
  star1: 0x5566aa,
  star2: 0xaaaaaa,
  star3: 0xaa5566,
  eye: 0xffffff,
  beeBody: 0xffd000,
  beeWing: 0x2038ec,
  butterflyWing: 0xd82800,
  butterflyBody: 0xfcd8a8,
  bossBody: 0x00b800,
  bossWing: 0x2038ec,
  bossCrown: 0xfcff5e,
  explWhite: 0xffffff,
  explYellow: 0xfcff5e,
  explOrange: 0xffa020,
  explRed: 0xd82800,
} as const;
