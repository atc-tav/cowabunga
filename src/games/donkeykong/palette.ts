/** Donkey Kong palette — shaded salmon girders, classic red Mario. */
export const COLORS = {
  girder: 0xfca89c, // beam face
  girderHi: 0xffd0c4, // top edge highlight (light catch)
  girderLo: 0xc0503c, // bottom shadow (gives the beam depth)
  girderStud: 0x6a2010, // dark rivet/bolt on the beam (was a stray blue dot)
  rivet: 0x2038ec, // gameplay pull-rivet (rivet stage) — distinct from beam studs
  ladder: 0x4cd6e6,
  capShirt: 0xff0000, // cap + shirt red
  skin: 0xfcb088,
  hair: 0x6a3000,
  overalls: 0x2038ec, // blue overalls
  boots: 0x6a3000,
  dkBody: 0x6a3000,
  dkFace: 0xd0a070,
  dkEye: 0xffffff,
  barrelBody: 0xd0a050,
  barrelRim: 0x5a2c00,
  barrelStave: 0x8a5a18,
  paulineHair: 0x8a2c00,
  paulineDress: 0xff66c4,
  hammerHead: 0xc8a050,
  hammerHandle: 0x8a5a18,
  fireOuter: 0xff6010,
  fireInner: 0xffd040,
} as const;
