# Game Specs

Reference design specifications for arcade-game clones, authored by an external
consultant. These are **source material / research** — the authoritative,
detailed description of each game's mechanics, scoring, sprites, and constants
to build (or validate) a faithful clone.

> These specs are reference inputs, not a description of what's currently built.
> Where a spec and the live implementation differ, the spec is the *target* to
> reason from — not a guarantee of current behavior. Build/architecture
> conventions still live in the root `CLAUDE.md`; product strategy lives in
> `docs/`.

> **Writing a new spec?** Read [`AUTHORING.md`](./AUTHORING.md) first — it's the
> house style guide (structure, conventions, required sections, standing
> decisions) for producing specs consistent with the ones already here.

> **Known issues & deferred work** (spec defects, linter follow-ups, the
> port-first sequencing decision) live in [`BACKLOG.md`](./BACKLOG.md).

## Index

| Spec | Platform / Source | File |
|------|-------------------|------|
| Dig Dug | Arcade (Namco, 1982) | [dig-dug-arcade.md](./dig-dug-arcade.md) |
| Dig Dug | NES (Namco, 1985 — Japan-only) | [dig-dug-nes.md](./dig-dug-nes.md) |
| Galaga | NES (Bandai, 1985; arcade Namco 1981) | [galaga-nes.md](./galaga-nes.md) |
| Donkey Kong | NES (1983) | [donkey-kong-nes.md](./donkey-kong-nes.md) |
| Arkanoid | Arcade (Taito, 1986) | [arkanoid.md](./arkanoid.md) |
| Mario Bros. | Arcade (Nintendo, 1983) | [mario-bros-arcade.md](./mario-bros-arcade.md) |

**Notes**
- The **NES Dig Dug** spec is a *delta* on top of the **arcade Dig Dug** spec —
  read the arcade one first for shared mechanics, then the NES one for the
  differences (flagged `⚠️ NES DIFF:`).
- Each spec embeds `> ✅ CHECK:` callouts — self-verification notes intended to
  validate an implementation against the spec.

## Adding a spec

Drop the markdown here with a clear, lowercase-kebab filename
(e.g. `pac-man-arcade.md`) and add a row to the index table above. New specs
should follow [`AUTHORING.md`](./AUTHORING.md) so they stay consistent with the
existing set.
