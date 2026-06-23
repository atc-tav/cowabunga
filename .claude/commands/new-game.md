---
description: Build a new arcade clone the factory way — spec-driven, oracle-gated
argument-hint: <game-id> (must have specs/<game-id>*.md)
---

You are building a new faithful arcade clone for the Cowabunga factory. The
game is: **$ARGUMENTS**

This is **spec-driven, oracle-gated development**. The process is the product.
Follow it exactly — do NOT write game code before the Oracle Ledger exists and
is reviewed. A passing test that doesn't trace to the spec proves nothing.

## Required reading (read these first, in order)

1. `docs/spec-driven-development.md` — the process, the Oracle Ledger concept,
   the definition of done. **This governs everything below.**
2. `specs/SPEC_GUIDE.md` — the spec quality bar + lint checklist.
3. `src/shared/testkit/README.md` — the test framework + `GameTestSurface`.
4. `src/games/arkanoid/test-design/` — the worked example (our best clone, 86%).
5. `CLAUDE.md` — build/architecture conventions.

## Execute the pipeline

**Step 0 — Lint the spec.** Find `specs/$ARGUMENTS*.md`. If none exists, STOP and
tell the user a spec must exist first (point them at `specs/SPEC_GUIDE.md`). Run
the lint checklist. For EVERY contradiction, gap, or non-automatable CHECK, use
`AskUserQuestion` to get a human ruling — do not guess. Calling out missing
inputs is the job, not a failure.

**Step 1 — Build the Oracle Ledger.** Copy
`src/shared/testkit/TEST_DESIGN.template.md` to
`src/games/$ARGUMENTS/test-design/TEST_DESIGN.md` and fill it from the spec:
enumerate every section, every constant, every scoring value, every stage,
every sprite, every `✅ CHECK` as a risk-ranked row tracing to a spec ref. Start
a `DEVLOG.md` beside it. **Present the ledger to the user for review before
writing any game code.**

**Step 2 — Stand up the test surface.** Add `buildTestSurface()` to the scene
(snapshot + invariants + hooks, gated behind `import.meta.env.DEV`) and
`testing/scenarios.mjs` + `testing/fuzz.mjs`, per the testkit adaptation
checklist. Register the game in `src/registry.ts`.

**Step 3 — Implement to green.** Build the game chasing the ledger to green, P0
first. Done = every non-`human` row 🟢, `npm run test:game -- $ARGUMENTS` and
`npm run fuzz:game -- $ARGUMENTS` pass clean, `npm run build` green.

**Step 4 — Human sign-off.** Generate the human pack and ask the user to judge
the human-only rows (feel, difficulty, readability).

## Rules

- Never mark the game done while any non-`human` ledger row is 🔴.
- When in doubt, add a red row and ask the user. A clarifying question costs
  minutes; a silent wrong assumption costs a faithfulness score.
- Keep the DEVLOG current with the *reasoning* behind non-obvious decisions.
