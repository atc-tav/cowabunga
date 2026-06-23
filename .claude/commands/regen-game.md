---
description: Regenerate an existing clone the factory way when it came out "fake"
argument-hint: <game-id> (e.g. donkeykong, galaga, mariobros)
---

An existing clone went wrong — it looks like the game but feels fake, i.e. it
was built without an Oracle Ledger and diverged from its spec. Regenerate it the
factory way: **spec-driven, oracle-gated**. The game is: **$ARGUMENTS**

The root cause you are fixing: *the original was written first and tested
afterward, so it certified whatever got built instead of what the spec
required.* You are going to make the spec executable first, then close the gap.

## Required reading (in order)

1. `docs/spec-driven-development.md` — the process and the Oracle Ledger concept.
2. `specs/SPEC_GUIDE.md` — the spec quality bar + lint checklist.
3. `src/shared/testkit/README.md` — the test framework.
4. `src/games/arkanoid/test-design/` — the worked example to imitate (86%).
5. The current implementation: `src/games/$ARGUMENTS/` and its `specs/<...>.md`.

## Execute

**Step 0 — Lint the spec.** Run the lint checklist against `specs/$ARGUMENTS*.md`.
Surface every contradiction/gap to the user via `AskUserQuestion` and get a
ruling. (Known: the DK and Galaga specs have internal contradictions — expect
to ask.)

**Step 1 — Build the Oracle Ledger FROM THE SPEC, not from the current code.**
This is the whole point. Copy `src/shared/testkit/TEST_DESIGN.template.md` to
`src/games/$ARGUMENTS/test-design/TEST_DESIGN.md` and enumerate every spec
section as a risk-ranked, spec-traced row. Then audit the CURRENT
implementation against the ledger and mark each row 🔴/🟢. The red rows are
exactly the faithfulness gap (e.g. DK's missing 75m stage, Galaga's morphs/
capture, Mario's wrong scoring). **Present the ledger + the red-row gap list to
the user before changing code**, and confirm scope (incremental fix vs. rewrite
of a subsystem).

**Step 2 — Test surface.** Add/upgrade `buildTestSurface()` + `testing/` so
every ledger row has an oracle. (If the game already has a `testing/` surface,
extend it — don't just trust the existing green; it only covered what was
built.)

**Step 3 — Drive the red rows to green**, P0 first, smallest coherent commits.
Done = every non-`human` row 🟢, `test:game`/`fuzz:game` clean, `build` green.

**Step 4 — Human sign-off** on the human-only rows.

## Rules

- The ledger is built from the SPEC. Do not let the current (wrong)
  implementation define what "correct" means.
- An existing passing test suite is NOT evidence of faithfulness — re-derive
  coverage from the spec.
- Surface scope decisions (rewrite vs. patch a subsystem) to the user before
  doing them. Keep the DEVLOG current with reasoning.
