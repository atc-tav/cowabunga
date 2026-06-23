# Spec-Driven, Oracle-Gated Development — the factory process

> **This is the most important doc in the repo.** Everything else tells you
> *how to build a game*. This tells you **how to build a game that is actually
> the game** — a recreation people look at and say "this *is* Arkanoid,"
> instead of "this looks like Arkanoid but feels fake."
>
> If you are an agent (or human) about to start, regenerate, or fix a game,
> **read this first and follow it.** It is not optional and it is not a
> suggestion. The process *is* the product right now.

## The one sentence

**Make the spec executable before you write the game. Don't write the game and
then test whatever you happened to write.**

That single discipline is the entire difference between our best clone and our
worst. Internalize it before reading further.

## What actually happened (the evidence)

We built five clones, audited four against their specs, and scored each on
faithfulness (how many spec mechanics, constants, and `✅ CHECK` callouts the
implementation actually satisfies):

| Game | Faithfulness | Spec length | Spec had CHECK callouts + constants tables? | Had an **Oracle Ledger** (`test-design/`)? |
|------|:---:|:---:|:---:|:---:|
| **Arkanoid** | **86 / 100** | 751 lines | ✅ | ✅ **yes** |
| Mario Bros | 68 / 100 | 727 lines | ✅ | — no |
| Galaga | 52 / 100 | 784 lines | ✅ | — no (had *tests*, no ledger) |
| Donkey Kong | 48 / 100 | **814 lines (longest)** | ✅ | — no |

Read that table twice. Two findings drive this whole document:

1. **The spec was not the differentiator.** All four specs are comparably rich
   and equally testable. Donkey Kong has the *longest* spec and the *worst*
   score. A great spec that nobody converts into oracles is just Galaga with
   more words. **Spec length, spec quality, and even "the spec has CHECK
   callouts" do not predict faithfulness.**

2. **Tests were not the differentiator either.** Galaga *ships a passing test
   suite* (a `testing/` surface + scenarios) and still scored 52. Its tests
   went green while morph enemies, the tractor-beam capture, and the entire
   challenge-stage scoring were *missing or wrong* — because **nobody had
   enumerated those as things that needed to be true.** The tests certified the
   skeleton that got built, not the game that was specified.

The **only** artifact Arkanoid had that the others lacked is the **Oracle
Ledger** (`src/games/arkanoid/test-design/TEST_DESIGN.md`): a complete,
spec-derived list of everything that must be true, each row an automatable
check, built *from the spec* and *before/independent of* the implementation,
then driven to green.

> **Tests written after the fact certify what you built.**
> **An Oracle Ledger certifies what you were *supposed* to build.**
> That gap is the entire distance from 52 to 86.

## The Oracle Ledger (define this precisely — it's the core concept)

An **Oracle Ledger** is a complete enumeration of *everything the spec says
must be true*, where **every entry is a checkable oracle**, authored **from the
spec** before the implementation chases it. It is the bridge that makes a spec
*executable*.

Each ledger **row** has these columns:

| Column | What it is |
|--------|-----------|
| **ID** | Stable name, e.g. `doh/sixteen-ball-hits-to-victory`. |
| **Spec ref** | The exact spec line / `✅ CHECK` / constant table cell it comes from. **Every row traces to the spec.** |
| **Oracle type** | `unit` \| `scenario` \| `invariant` \| `human`. The *cheapest mode that can catch it* (see [`testkit`](../src/shared/testkit/README.md)). |
| **Assertion** | The concrete, state-based check. Not "looks right" — a literal predicate over the snapshot (e.g. `score += 50 && destroyableRemaining -= 1`). |
| **Status** | `🔴 red` (not yet true) → `🟢 green` (verified). |

Three properties make it an oracle ledger and not a to-do list:

- **Spec-derived, not implementation-derived.** You write the rows by reading
  the *spec*, enumerating every mechanic, every constant, every scoring value,
  every stage, every sprite, every `✅ CHECK`. If a spec section has no row, the
  ledger is incomplete — *that's the bug Galaga and DK shipped.*
- **Complete before "done" is possible.** The ledger is the **definition of
  done**: the game is finished when every non-`human` row is 🟢. A missing
  Donkey Kong 75m stage is impossible to overlook when there's a red
  `stage/75m-elevators-present` row staring at you.
- **Risk-ranked.** Rows are tiered P0 (correctness-critical, bug-prone) → P1
  (important) → P2 (smoke) → **human-only** (feel/fun/aesthetics — the ~10% no
  oracle can judge). Higher tiers get scenario *and* invariant coverage.

The worked example to copy is Arkanoid's: `src/games/arkanoid/test-design/`
(`TEST_DESIGN.md` = the ledger; `DEVLOG.md` = the decision log). The blank
template is
[`src/shared/testkit/TEST_DESIGN.template.md`](../src/shared/testkit/TEST_DESIGN.template.md).

> **Faithfulness ≈ % of the ledger that is green.** That is not a metaphor —
> it is literally how we scored these games. The ledger turns "is it faithful?"
> from a human gut-check into a number you can watch climb.

## The pipeline (the sequence that feeds the machine)

Follow these in order. **Do not start a step before the previous one is signed
off.** The `testkit` machinery already exists; this is the discipline that
feeds it.

### Step 0 — Lint the spec (and call out to a human)
Before anything, read `specs/<game>.md` against
[`specs/SPEC_GUIDE.md`](../specs/SPEC_GUIDE.md). A ledger is only as good as the
spec it consumes. **Stop and ask the human** (don't guess) when:
- the spec **contradicts itself** (the DK spec disagrees with itself about which
  stages exist; the Arkanoid spec's silver-hit prose contradicts its own table);
- a required value, sprite, timing, or stage is **absent or vague**;
- a `✅ CHECK` **cannot be turned into an automatable assertion** (it may be a
  human-only row — confirm);
- the spec describes a mechanic you **don't have a primitive for** and that
  would need new shared code.

See "Calling out to humans" below — this is a first-class part of the job, not
a failure.

### Step 1 — Build the Oracle Ledger (`test-design/TEST_DESIGN.md`)
Convert the linted spec into the ledger described above. Enumerate **every**
spec section. Every row traces to a spec ref. Risk-rank them. **Get the ledger
reviewed before writing game code** — this is where faithfulness is won or lost.

### Step 2 — Stand up the test surface
Implement `buildTestSurface()` on the scene (snapshot + invariants + hooks,
gated behind `import.meta.env.DEV`) and `testing/scenarios.mjs` +
`testing/fuzz.mjs`. Follow the adaptation checklist in
[`src/shared/testkit/README.md`](../src/shared/testkit/README.md). The hooks and
snapshot are dictated by what the ledger's assertions need to read and drive.

### Step 3 — Implement to green
Now write the game — **chasing the ledger to green**, P0 first. "Done" is not
"it runs" or "it looks right." **Done is: every non-human row is 🟢, and
`npm run test:game -- <game>` + `npm run fuzz:game -- <game>` pass clean.** A
red row is unfinished work, full stop.

### Step 4 — Human signs off the ~10%
Generate the human pack (screenshots + the human-only checklist rows) and get a
person to judge feel, fun, difficulty arc, and readability. That verdict is the
only thing the framework cannot produce — so it's the only thing we spend human
attention on.

### Throughout — keep a DEVLOG
Append a dated entry with *reasoning* for every non-obvious decision
(`test-design/DEVLOG.md`). Future agents continue the work without
re-litigating settled questions. Copy Arkanoid's format.

## Calling out to humans (mandatory, not optional)

You (the agent) are expected to **actively surface what you're missing** rather
than quietly guessing and shipping a plausible-looking fake. Escalate to the
human — using `AskUserQuestion` — the moment you hit any of:

- a spec contradiction or gap (Step 0);
- an ambiguous value where guessing wrong silently corrupts faithfulness;
- a `✅ CHECK` you cannot make automatable (is it human-only, or is the design
  wrong?);
- a mechanic that needs a new shared primitive / architectural decision;
- a tension between this doc and another (`docs/`) imperative you can't resolve.

A clarifying question costs minutes. A silently-wrong assumption costs a 52.
**When in doubt, ledger the question as a red row and ask.** Reporting "here is
what I could not verify and why" is a *successful* outcome, not a failure.

## Definition of done (the factory version)

A game is faithfully done when **all** hold:

1. Spec passed the lint (Step 0); open questions resolved with the human.
2. The Oracle Ledger enumerates every spec section, risk-ranked, every row
   tracing to a spec ref.
3. Every non-`human` ledger row is 🟢; `test:game` and `fuzz:game` pass clean.
4. The human signed off the human-only rows (feel/fun/difficulty/readability).
5. `npm run build` is green; `DEVLOG.md` is current.

Anything less is a draft, no matter how good it looks in motion.

## TL;DR for a busy agent

1. **Read the spec → lint it → ask the human about every gap/contradiction.**
2. **Write the Oracle Ledger from the spec, before the game. Every spec section
   = a row. Get it reviewed.**
3. **Build the test surface, then implement until every row is green.**
4. **Green ledger = faithful game. Red row = unfinished. A passing test that
   doesn't trace to the spec proves nothing.**

Worked example: [`src/games/arkanoid/test-design/`](../src/games/arkanoid/test-design/).
Template: [`src/shared/testkit/TEST_DESIGN.template.md`](../src/shared/testkit/TEST_DESIGN.template.md).
Spec bar: [`specs/SPEC_GUIDE.md`](../specs/SPEC_GUIDE.md).
