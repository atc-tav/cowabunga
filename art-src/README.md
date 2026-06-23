# `art-src/` — design-time sprite authoring

**The principle:** *no runtime asset files; the shipped game stays 100%
code-drawn and deterministic.* Authoring a sprite in an external tool (PixelLab,
Aseprite, a transcription by hand) is fine **at design time** — but nothing here
ships. Instead, the bake tool quantizes a PNG export down to a game's palette and
emits a **pixel-grid** (the `string[]` rows + `{ char: 0xRRGGBB }` legend that
[`drawPixelArt()`](../src/shared/textures.ts) already consumes). You paste that
grid into the game's `sprites.ts`; the PNG itself never enters the build.

## Layout

Tool exports and references live per-sprite:

```
art-src/
├── README.md
├── .gitignore
├── contact-sheet.html          open in a browser to eyeball candidates at 1x/4x
└── <game>/<sprite>/
    ├── reference.png           the source-of-truth arcade frame (kept in git)
    ├── pixellab.export.png     a PixelLab export (kept — *.export.png)
    ├── handcraft.export.png    a by-hand candidate (kept)
    └── work/                   scratch / large raw working files (gitignored)
```

Only `reference.png` and `*.export.png` are committed (see `.gitignore`).
Everything else (raw layered files, huge intermediate renders) is scratch.

## Baking an export into a grid

```
npm run sprites:bake -- --game donkeykong \
  --src art-src/donkeykong/barrel/pixellab.export.png \
  --name BARREL_ROLL_A \
  [--cell 8] [--out src/games/donkeykong/_baked/barrel.txt]
```

- `--game <id>` — reads `src/games/<id>/palette.ts` as the quantize target.
- `--src <png>` — the export to bake.
- `--name <SPRITE>` — the identifier in the emitted snippet.
- `--cell <n>` — downsample: average each `n×n` source-pixel block to **one
  grid cell**. Use this when the export is drawn at e.g. 8 device-px per art
  cell. Omit (or `1`) when 1 source pixel already equals 1 cell.
- `--out <file>` — write the snippet to a file (default: stdout).

The output is a provenance header + the `const <NAME>: string[] = [...]` grid +
a `const <NAME>_PALETTE = { ... }` legend. Pixels with alpha `< 128` become
transparent `' '`. Each used color gets a stable single-char key (the uppercased
first letter of its palette name when free, else the next free `A–Z`/`0–9`).

## Feeding a PixelLab export through it

1. Author/transcribe the sprite against `reference.png` in PixelLab.
2. Export a **flat PNG** (no extra layers/padding). If it's drawn at NxN px per
   intended art cell, note that N — you'll pass `--cell N`.
3. Make sure the colors are close to the game's palette (the quantizer snaps to
   the *nearest* palette color, so off-palette art may collapse neighbors).
4. Run `sprites:bake` and paste the grid + legend into `sprites.ts`.
5. Eyeball it in `contact-sheet.html` alongside the reference.

## Verifying the tool

`npm run sprites:selftest` renders a known grid to a PNG and bakes it back,
asserting the grid + legend round-trip **exactly**. Run it after touching the
quantizer.
