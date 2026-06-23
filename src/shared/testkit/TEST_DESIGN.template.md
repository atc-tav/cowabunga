<!--
  ORACLE LEDGER TEMPLATE  —  copy to src/games/<game>/test-design/TEST_DESIGN.md

  This is the "magical template": the artifact that turns a spec into an
  executable definition of done. Authored FROM specs/<game>.md, BEFORE the
  implementation chases it. Read these first:
    1. docs/spec-driven-development.md   — why this exists; the pipeline
    2. specs/SPEC_GUIDE.md               — the spec must pass lint first
    3. src/shared/testkit/README.md      — the framework + GameTestSurface
    4. src/games/arkanoid/test-design/   — the worked example to imitate

  Fill every <PLACEHOLDER>. Delete this comment. Every row must trace to a
  spec ref. The game is DONE when every non-`human` row is 🟢.
-->

# <GAME> — Oracle Ledger (Test Design)

> Derived from `specs/<game>.md` (spec lint passed on <DATE>; open questions:
> <LINK to DEVLOG entries / none>). This is the **definition of done**: the game
> is faithful when every non-`human` row below is 🟢.
>
> **Faithfulness = % of this ledger that is green.** Coverage is the point —
> if a spec section has no row here, this ledger is incomplete.

## 0. Spec coverage map (completeness gate)

List **every** section of `specs/<game>.md` and where it is covered below. A
spec section with no ledger row is a hole — fill it or justify it.

| Spec section | Covered by rows | Notes |
|--------------|-----------------|-------|
| <e.g. §3 Movement> | `movement/*` | |
| <e.g. §4 Enemies> | `enemy/*` | |
| <e.g. §5 Scoring> | `scoring/*` | |
| <e.g. §6 Stages>  | `stage/*`   | ⚠️ enumerate EVERY stage as its own row |
| <e.g. §10 Sprites>| `sprite/*` + human | |
| <every ✅ CHECK>  | mapped 1:1 below | |

## 1. Risk map — what to test, ranked

Rank by **(likelihood of a latent bug) × (impact if wrong)**. P0/P1 get
scenario *and* invariant coverage; P2 gets a smoke scenario; human-only goes to
the pack.

### P0 — correctness-critical and bug-prone
| Area | Why it's risky | Primary oracle |
|------|----------------|----------------|
| <area> | <failure mode> | unit / scenario / invariant |

### P1 — important, lower bug odds
- <mechanic + the value/rule it must satisfy, with spec ref>

### P2 — low risk, smoke only
- <mechanic>

### Human-only (the ~10%)
- <feel, fun, difficulty arc, sprite/colour readability, audio — things no
  oracle can judge>

## 2. The Oracle Ledger (every row traces to the spec)

The heart of the document. **Every spec claim is a row.** Status starts 🔴 and
goes 🟢 only when a real check verifies it.

| ID | Spec ref | Oracle | Assertion (state-based, no pixels) | Status |
|----|----------|--------|------------------------------------|:------:|
| `<area>/<name>` | `§x / ✅ CHECK / const` | unit\|scenario\|invariant\|human | <concrete predicate over snapshot> | 🔴 |

> Tips: lift every `✅ CHECK` from the spec into its own row. Lift every value
> from the spec's constants/scoring tables into a `unit` row. Lift every stage
> into a `stage/*` row. If you can't phrase an assertion, the spec is too vague
> — back to Step 0.

## 3. Invariant catalog (checked every frame in fuzz mode)

Properties that must hold **at all times** during random play. Any violation is
a bug, full stop. Return `[]` when healthy.

1. <e.g. `lives` decremented **iff** the last life-entity died this frame>
2. <e.g. all positions in-bounds unless legitimately exiting>
3. <e.g. counters never negative; no two entities share a cell>
4. <e.g. flow.state always known; **no exception ever thrown**>

> The fuzz bot is a dumb seeded policy — it's not meant to *win*, it's meant to
> generate cheap varied state and trip an invariant.

## 4. Scenario catalog (named, deterministic, set→act→assert)

- `<area>/<behavior>`
- ...

## 5. Pure logic to extract for mode-1 unit tests

Logic that should be lifted out of the scene into pure functions (fastest,
least flaky): scoring/threshold steppers, RNG/roll functions, layout/level
parsers, angle/physics math, AI decision functions.

- `<fn>` → `<where it should live>`

## 6. Deterministic seams the game must expose (`hooks`)

The minimum hooks the scenarios above need (also useful as a dev console).

| Hook | Purpose |
|------|---------|
| `seed(n)` | reset the shared RNG |
| `skipTo<Stage/Phase>(n)` | jump to any stage/phase |
| `spawn<Entity>(...)` | deterministic entity placement |
| `force<RandomThing>(...)` | bypass RNG for a scenario |
| ... | ... |

## 7. Snapshot shape

Flat, JSON-serialisable, cheap (read every frame in fuzz mode). What
`<Game>TestSurface.snapshot()` exposes:

```
{ score, high, lives, stage/phase, flow,
  <entities>:[{kind,x,y,state}], <counters>, <powerup/mode flags>, ... }
```

## 8. Auto vs. human — the split, explicitly

- **Automated:** every row of §2 that isn't `human`, every invariant of §3,
  every scenario of §4, all of §5. Target: one `npm run test:game -- <game>`
  an agent runs after any change, reading pass/fail + the first invariant
  violation with its seed for reproduction.
- **Human (the ~10%):** the mode-4 pack — screenshots of key states + a
  checklist. Does it *feel* right? Is the difficulty arc fair? Does it read?
  That verdict is the only thing the framework can't produce.

---

<!--
  Pair this with a DEVLOG.md in the same folder: a dated decision log, newest
  first, capturing the REASONING behind non-obvious choices and every open
  question raised to the human. Copy src/games/arkanoid/test-design/DEVLOG.md.
-->
