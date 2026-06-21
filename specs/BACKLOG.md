# Specs — Backlog & Known Issues

Deferred work and known defects for the `specs/` system. This is a living
to-do list, not a description of current state. Add to it freely; check items
off as they're done.

> **Standing priority (2026-06):** Port more games before extracting/refactoring
> shared mechanics. The specs are validated by *building from them*; the right
> shared primitives only become clear after several concrete ports exist. Most
> items below are intentionally deferred behind that priority. See "Sequencing"
> at the bottom.

---

## 1. Known spec defects (caught by `npm run lint:specs`)

The six original specs predate the linter and the authoring standard, so they
currently report defects. **These are low-urgency:** each only matters when
someone actually ports that game, and at that point the porter is editing those
sprites anyway. Fix opportunistically, per-game, as ports happen — not as a
big-bang cleanup.

9 errors as of this writing:

| File | Line | Sprite / item | Defect |
|------|------|---------------|--------|
| `arkanoid.md` | 302 | `UNIRA` | label `(8x8)` but 7 rows |
| `arkanoid.md` | 558 | `VAUS_NORMAL` | label width 28 but rows are 27 |
| `arkanoid.md` | 568 | `VAUS_ENLARGED` | ragged rows (36 vs 35); label also says 44 |
| `arkanoid.md` | 578 | `VAUS_LASER` | label width 28 but rows are 26 |
| `arkanoid.md` | 735 | checklist line | contains a Dig Dug "rock crush" line (copy-paste leak) |
| `dig-dug-arcade.md` | 418 | `FYGAR_INFLATE_1` | ragged rows (two are 13 wide, rest 12) |
| `dig-dug-arcade.md` | 429 | `FYGAR_INFLATE_2` | ragged rows (two are 13 wide, rest 12) |
| `galaga-nes.md` | 314 | `BOSS_0` | trailing blank rows are 12 wide, body is 16 |
| `galaga-nes.md` | 347 | `BOSS_HIT` | Cyrillic `Д` (U+0414) instead of Latin `D` |

Note: fixing a `sprite-shape` (ragged) error can reveal a previously-masked
`sprite-dims` error (e.g. `VAUS_ENLARGED`). Make the grid rectangular first,
then reconcile width/height with the `(WxH)` label.

Plus ~64 warnings, mostly the newer-standard sections the originals lack
(Canonical vs. Tunable §13, Level/Content Data §14, palette tables) and
per-frame sprites missing `(WxH)` labels.

## 2. Bring the original six up to the authoring standard

`AUTHORING.md` promoted several things to mandatory that the originals don't
have. When a game is ported (or revisited), bring its spec up to standard:

- [ ] Add **Canonical vs. Tunable** (§13) split
- [ ] Add complete **Level / Content Data** (§14) — the big one; today levels,
      paths, and layouts are sampled, not complete (Galaga fly-in waypoints,
      Arkanoid's 32 stage grids, DK geometry, Dig Dug rock/cave positions)
- [ ] Add **palette tables** (token → hex)
- [ ] `mario-bros-arcade.md`: add the missing **player-sprite** art and a
      **Reference Sources** section
- [ ] `dig-dug-nes.md`: it's a delta doc — confirm it inherits the player
      sprite / TX / constants from the arcade spec rather than flagging them
      missing (may just need a linter exemption for delta docs)
- [ ] Rename `PHYSICS` → `GAME` in `mario-bros-arcade.md` and `donkey-kong-nes.md`

## 3. Linter follow-ups

- [ ] `--fix` mode for the *unambiguous* class only: non-ASCII homoglyph swaps
      (e.g. Cyrillic `Д` → `D`) and trailing-whitespace normalization. Size
      mismatches and contamination stay human-reviewed (the linter can't know
      whether the label or the art is the source of truth).
- [ ] **Delta-doc awareness:** a delta spec (e.g. `dig-dug-nes.md`) legitimately
      omits sections it inherits from its parent. Teach the linter to detect
      "delta" specs (from the header) and downgrade/suppress the inherited-section
      warnings.
- [ ] **CI workflow:** run `npm run lint:specs` on every PR that touches
      `specs/`. Consider `--strict` (warnings fail) only after the originals are
      brought up to standard, so the gate starts green.
- [ ] Optional deeper checks (currently manual review): internal numeric
      contradictions across prose/formula/constants (e.g. Arkanoid silver-brick
      hit counts disagree between the prose table, the formula, and the
      `silverHitsTable` constant).

---

## Sequencing — why most of the above is deferred

The decision (2026-06) is to **prioritize porting more games over going deep on
shared mechanics or spec cleanup.** Rationale:

- Shared primitives are discovered, not designed up front. With only one or two
  games built, any "shared mechanics" layer is a guess; with 3–5 ports it
  becomes obvious what actually recurs. Abstracting early tends to produce the
  wrong abstraction.
- The specs are reference material; their real test is being *built from*. Each
  port surfaces gaps and validates (or corrects) its spec — which is more
  valuable feedback than polishing specs in the abstract.
- The spec *tooling* (authoring guide + linter) was worth doing now because it's
  cheap and pays off on every future spec/port. The spec *content cleanup*
  (§1–§2 above) is not — it's best done lazily, per game, when that game is
  actually being ported.

So: port games, fix each spec's defects as you build it, and revisit
shared-mechanics extraction once there are enough concrete games to generalize
from.
