---
description: Lint a game spec for contradictions/gaps before building from it
argument-hint: <game-id or spec filename>
---

Lint the spec for **$ARGUMENTS** so it's safe to build an Oracle Ledger from.
A ledger is only as good as the spec it consumes — and several of our specs have
silent internal contradictions that would be faithfully implemented as bugs.

## Do this

1. Read `specs/SPEC_GUIDE.md` (the quality bar + checklist) and
   `docs/spec-driven-development.md` (why this matters — Step 0 of the pipeline).
2. Find and read `specs/$ARGUMENTS*.md` in full. If it's a delta spec, read its
   base first.
3. Work the lint checklist from `specs/SPEC_GUIDE.md` end to end:
   - internal contradictions (prose vs. tables vs. `✅ CHECK` callouts);
   - every constant has a numeric value;
   - every scoring event has a point value (incl. multipliers, extra-life);
   - every stage/level/phase enumerated and counted unambiguously;
   - every `✅ CHECK` is automatable (or explicitly human-only);
   - no mechanic described only by analogy;
   - sprite states complete;
   - no undeclared dependency on a missing shared primitive.

## Output

A report listing, per finding: the spec location, what's wrong, and the impact
on faithfulness if built as-is. Group by severity (blocker / should-fix / note).

For every **blocker** (contradiction or missing required value), use
`AskUserQuestion` to get the user's ruling — do not guess, and do not proceed to
building. Propose a concrete spec amendment for each, and offer to apply the
agreed fixes to `specs/$ARGUMENTS*.md`.
