# `shared/world` — the scrolling-game foundation

The single-screen games (Pac-Man, Galaga, DK, Mario Bros., Arkanoid) all use a
**fixed camera**: the whole playfield fits on screen. The ambitious projects on
the roadmap — Super Mario Bros. 2, Kirby's Adventure — are **camera-scrolling**
platformer/adventures, which the foundation didn't support. This folder is that
missing layer: a small toolkit for building larger, scrolling levels on the same
ASCII-tile, procedural, RL-deterministic conventions as everything else.

> **Why a subfolder of `shared/` and not a new top-level folder?** `CLAUDE.md`
> makes `src/shared/` *the* reuse root ("games import only from `src/shared/`").
> Keeping this here preserves that rule. The new convention is just: a **cohesive
> feature-set** earns its own subfolder under `shared/` (this is the first), while
> one-off primitives stay flat. Future world/level/camera features land here;
> other feature clusters can get sibling folders.

## The pieces

| Module | Role | Engine? |
|--------|------|---------|
| `AsciiLevel.ts` | Parse an ASCII level + legend → a `TileWorld` and its entity spawn points. | pure |
| `TileWorld.ts` | A `Grid` of tile codes + which codes are solid; level pixel bounds; dig/clear. | pure |
| `TileBody.ts` | Gravity + **swept per-axis tile collision** (the scrolling counterpart to `PlatformerBody`). | pure |
| `WorldCamera.ts` | Thin wrapper over Phaser camera follow + level bounds + deadzone. | Phaser |
| `TileRenderer.ts` | Bake the static tile layer into one scrollable RenderTexture. | Phaser |

The **pure** modules import no Phaser, so the bug-prone maths (parsing, collision)
is unit-tested in plain Node — see `*.test.ts` here and `npm test`. This is the
"mode 1" layer described in `src/shared/testkit/README.md`.

## Putting it together (sketch)

```ts
import {
  parseAsciiLevel, TileBody, WorldCamera, renderTileLayer, colorTileDraw,
} from '../../shared/world';

const { world, spawns } = parseAsciiLevel(LEVEL_ROWS, LEGEND, { tileSize: 16 });

renderTileLayer(this, world, colorTileDraw({ X: 0x6b8cff, '=': 0x8b5a2b }));

const start = spawns.find((s) => s.char === 'P')!;
this.body = new TileBody(start.x, start.y, 12, 16);
this.sprite = this.add.image(start.x, start.y, 'player');

new WorldCamera(this).bindTo(world).follow(this.sprite, {
  deadzoneWidth: 48, lerpX: 1, lerpY: 1,
});

// each frame:
this.body.vx = input.x * RUN_SPEED;
if (input.jumpPressed) this.body.jump(JUMP_SPEED);
this.body.update(delta, GRAVITY, world);
this.sprite.setPosition(this.body.x, this.body.y);
```

## Conventions it keeps

- **Procedural everything.** Tiles are drawn in code (`TileDraw` / `colorTileDraw`),
  no asset files — same rule as `drawPixelArt`.
- **RL-deterministic.** `TileBody` is a pure function of inputs and time-step;
  `WorldCamera` derives from game state (the followed target), so it needs no
  juice gate. Pin HUD/UI with `setScrollFactor(0)` — the shared `BaseGameScene`
  HUD already does, so a scrolling game gets a correct HUD for free.
- **Composition over inheritance.** A scrolling game owns its scene and composes
  these primitives, exactly like the grid games compose `Grid` / `GridMover`.

## Known limitations / future work

- `TileBody` does not sub-step horizontal motion, so keep per-frame movement
  under ~one tile (same caveat as `PlatformerBody`). Add sub-stepping for very
  high speeds if a game needs it.
- `renderTileLayer` bakes one level-sized texture — simple and cheap to scroll,
  but memory scales with level size. Swap in chunked RenderTextures around the
  camera if a level gets huge; no game-code change required.
- One-way (drop-through) platforms and moving platforms aren't modelled yet —
  add them here when the first game needs them.
