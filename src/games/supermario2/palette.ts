// Super Mario Bros. 2 (NES) palette — authentic-arcade hexes from the spec §14.2.
// Each sprite grid is rendered with a per-sprite subset of these tokens, so the
// same letter (e.g. B) can mean different colours in different sprites.

export const COLORS = {
  // Characters
  red: 0xd82800, // Mario hat/shirt, Shy Guy red robe, cherry
  blue: 0x0058f8, // Mario/Luigi overalls
  skin: 0xfca044, // all characters' skin
  green: 0x00a800, // Luigi hat/shirt, grass, leaves
  white: 0xf8f8f8, // Toad cap, Shy Guy mask, turnip bulb
  toadVest: 0x2038ec,
  peachDress: 0xf878f8,
  crown: 0xf8b800,
  peachHair: 0xf8c000,
  eye: 0x000000,

  // Enemies
  shyPink: 0xf878c8,
  boot: 0x000000,
  tweeterBody: 0xf8d800,
  tweeterWing: 0xf87800,

  // World 1 — Grasslands terrain
  sky: 0x5c94fc,
  groundTop: 0x00a800,
  groundFill: 0xb85820,
  groundEdge: 0x7c3000,
  brick: 0xd87800,
  brickEdge: 0x884400,

  // Objects
  vaseBody: 0xd82800,
  vaseRim: 0xf8f8f8,
  vaseDark: 0x7c1800,
  maskGate: 0xc84000,
  maskGateDark: 0x7c2800,
  crystal: 0x3cbcfc,
  star: 0xf8d800,
} as const;
