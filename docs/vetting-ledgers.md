# Vetting a ledger — a human's guide to good vs. bad assertions

> **Who this is for:** you (and any human) reviewing an Oracle Ledger an agent
> produced, *before* the agent writes game code. Vetting the ledger is the
> single highest-leverage thing a human does in this factory — it's where you
> catch a misunderstanding in five minutes of reading instead of after a
> two-thousand-line rebuild.
>
> New to ledgers? Read the
> [worked comparison](./spec-driven-development.md#spec-vs-ledger--a-worked-comparison)
> first. This guide goes deeper on the one column that decides whether a row is
> worth anything: the **assertion**.

## What you're actually checking

A ledger row claims "this part of the spec is satisfied." The **assertion** is
the sentence that says *how you'd prove it*. A row is only as good as its
assertion — a vague assertion lets a wrong game pass review while the checklist
turns green. (That's not hypothetical: one of our games shipped a fully green
test suite at 52% faithful, because its checks didn't pin down what "correct"
meant.)

So when you read a ledger, you are mostly **pressure-testing assertions**.

## What a good assertion looks like (six plain-language tests)

Read each assertion and ask:

1. **Is it specific?** Does it name exact numbers and exact game state — not
   "correctly," "properly," "as expected"?
2. **Is it observable?** Does it check something the game actually exposes — a
   score, a count, a flag, a position — rather than a feeling or a look?
3. **Is it decisive?** Would two different people score the same run pass/fail
   the same way? There must be one unambiguous answer.
4. **Does it say set-up, action, and result?** Good assertions read like a tiny
   lab experiment: *set this up → do this → observe exactly that.*
5. **Does it trace to the spec?** Can you point at the spec line or value it
   came from?
6. **Is it at the right level?** Does it check the *rule* (observable behavior),
   not the *plumbing* (a private function name)? Tests that name internals
   break when code is tidied and prove nothing about faithfulness.

If an assertion misses any of these, rewrite it before approving the ledger.

## Weasel words — scan for these first

When skimming a ledger fast, search (literally Ctrl-F) for these. Each one
almost always marks an assertion that isn't really checking anything:

> **correctly · properly · as expected · works · handled · appropriately ·
> looks right · should be · reasonable · good · etc. · and so on · various ·
> sometimes · enough**

A row that says "enemies are flipped **correctly**" is a placeholder wearing a
costume. The word "correctly" is doing the job that a real assertion should do —
and it defers the definition of correct to whoever reads it later, which is how
wrong builds slip through.

## Worked examples (spec → row → bad → good → what the test does)

Seven real mechanics from our games, each showing the same five steps. Notice
the bad assertions all *sound* fine in a meeting and all fail the six tests
above.

---

### 1. A flat point value — Mario Bros. flipping and kicking

- **Spec says:** "Flip enemy → **10** points. Kick enemy off platform → **800**
  points."
- **Ledger row:** `scoring/flip-and-kick` — flipping a target enemy scores 10;
  kicking the flipped enemy scores 800.
- **❌ Weak assertion:** "Flipping and kicking enemies awards the correct
  points."
- **Why it's dangerous:** "correct" names no number. An implementation that pays
  **0** for a flip and **1,200** for a kick passes this review unchanged — which
  is exactly the bug our real build shipped.
- **✅ Strong assertion:** "Bump a grounded enemy from below → score increases by
  **exactly 10**. Then run into that flipped enemy → score increases by
  **exactly 800** more."
- **What the test does:** place one enemy on a platform; trigger the flip;
  assert the score went up by 10; trigger the kick; assert it went up by 800.
  Any other numbers → fail.

---

### 2. A formula / parameterized value — Arkanoid silver bricks

- **Spec says:** "Silver brick score = **50 × stage number**."
- **Ledger row:** `scoring/silver-brick` — a silver brick destroyed on stage N
  scores 50 × N.
- **❌ Weak assertion:** "Silver bricks are worth more on later stages." *(or the
  opposite failure:* "Silver brick is worth 50 points." *— hard-codes one stage
  and misses the formula.)*
- **Why it's dangerous:** the first only checks a direction, so a build where the
  value barely changes still passes; the second locks to stage 1 and never
  notices later stages are wrong.
- **✅ Strong assertion:** "Destroying a silver brick on stage N raises the score
  by exactly 50 × N. Checked at N = 1 (50), N = 5 (250), N = 10 (500)."
- **What the test does:** jump to each stage, destroy a silver brick, assert the
  score delta equals 50 × N at every point. Catches both a wrong constant and a
  wrong formula.

---

### 3. Presence / coverage — Donkey Kong's three stages

- **Spec says:** "The stage order is **25m → 75m → 100m**. There is **no** 50m
  stage. After 100m, loop back to 25m."
- **Ledger row:** `stages/three-stage-loop` — all three stages exist, in order,
  and loop.
- **❌ Weak assertion:** "The game has the right stages."
- **Why it's dangerous:** it never says *which* stages or *how many*. A build
  that ships only 25m and 100m — skipping a third of the game — sails through.
  That is precisely what happened: our real build is missing the 75m stage.
- **✅ Strong assertion:** "Clearing each stage in turn produces the sequence
  [25m, 75m, 100m, 25m, …]; the set of reachable stage names is exactly {25m,
  75m, 100m} and contains no 50m."
- **What the test does:** drive 'stage complete' repeatedly, record each stage
  name, assert the ordered list. A missing 75m fails on the first lap because
  the recorded sequence is [25m, 100m, …].

> Presence rows are how the ledger makes *omissions* impossible to overlook.
> Every stage, every enemy type, every power-up should have one.

---

### 4. A counter / state rule — Galaga's two-shot limit

- **Spec says:** "When the player already has **2** bullets in flight, pressing
  fire does nothing."
- **Ledger row:** `firing/two-bullet-cap`.
- **❌ Weak assertion:** "The player can't fire too many bullets at once."
- **Why it's dangerous:** "too many" is undefined. A build that caps at four
  passes — and the game feels wrong but the checklist is green.
- **✅ Strong assertion:** "With 2 player bullets on screen, pressing fire creates
  no new bullet (count stays 2). After one bullet leaves the screen (count 1),
  pressing fire raises it back to 2."
- **What the test does:** spawn 2 bullets, press fire, assert count unchanged;
  remove one, press fire, assert count returns to 2.

---

### 5. Conditional logic — Galaga's capture-beam gating

- **Spec says:** the elite enemy "will **only** perform the tractor-beam attack
  if: no fighter is currently captured **and** the player does not already have a
  dual fighter."
- **Ledger row:** `boss/capture-beam-gating`.
- **❌ Weak assertion:** "The enemy uses its capture beam under the right
  conditions."
- **Why it's dangerous:** it restates the spec heading and checks none of the
  actual condition. Both branches of the rule are untested.
- **✅ Strong assertion:** "When a fighter is already captured **or** the player
  has a dual fighter, the enemy never starts a capture beam (it dives instead).
  When neither is true, the capture beam is allowed to occur." — both branches
  checked.
- **What the test does:** force 'a fighter is captured', run the enemy's
  attack-choice many times, assert zero capture beams; then force 'nothing
  captured, no dual fighter' and assert capture beams can happen.

> Any spec sentence with "only if," "unless," "and," or "or" needs an assertion
> that checks **every branch** — the true case *and* the false case.

---

### 6. A geometric / always-true rule — Arkanoid's ball angle

- **Spec says:** "The ball's angle should never be within ~15° of horizontal …
  enforce a minimum vertical speed at all times," so it can't bounce sideways
  forever along the bottom.
- **Ledger row:** `ball/never-horizontal` — an *invariant* (must hold on every
  frame), plus one scenario for the worst case.
- **❌ Weak assertion:** "The ball doesn't get stuck bouncing sideways."
- **Why it's dangerous:** "stuck" is a human impression you can't read off a
  single frame, and there's no threshold to compare against.
- **✅ Strong assertion (invariant):** "On every frame, every ball's vertical
  speed is at least the spec's minimum-vertical value." **Plus a scenario:** "Fire
  the ball almost horizontally between two walls with no bricks; within N frames
  its vertical speed is back at or above the minimum."
- **What the test does:** the invariant is sampled every frame during random
  play and flags the exact frame any ball goes too sideways; the scenario forces
  the nightmare case and confirms it self-corrects.

> "Always true" rules belong in the invariant list, where they're checked
> continuously — not as a one-time scenario.

---

### 7. Randomness — Donkey Kong's barrels choosing a ladder

- **Spec says:** "Each time a barrel reaches a ladder, roll a **50%** chance it
  rolls down … verify this creates genuinely varied paths."
- **Ledger row:** `barrel/ladder-descent-probability`.
- **❌ Weak assertion:** "A barrel at a ladder rolls down the ladder." *(asserts
  one outcome of a coin flip — passes or fails at random)* — or "Barrels
  sometimes go down ladders" *(unmeasurable).*
- **Why it's dangerous:** you cannot test a probability with a single trial. The
  first version is flaky (fails ~half the time for no reason); the second checks
  nothing.
- **✅ Strong assertion (two valid styles):**
  - **Seeded/deterministic:** "With the random seed fixed to S, barrels descend
    at exactly these ladders/frames […]." — exact and repeatable.
  - **Statistical:** "Across 1,000 barrels reaching a ladder (varied seeds), the
    descend rate is between **0.45 and 0.55**."
- **What the test does:** either replay a fixed seed and assert the exact path,
  or run many trials and assert the rate lands in the band. The statistical
  version is how you'd catch our real build that used 0.6 — the measured rate
  lands ~0.60, outside the window, fail.

> **Rule for any randomness:** never assert a single random outcome. Either fix
> the seed and assert the exact result, or run many trials and assert a rate or
> range. The factory's seeded-random support exists exactly so the first style
> is possible.

---

## Three traps that look fine until they don't

- **Feeling smuggled in as a number.** "The ball feels fast" can't be automated —
  mark it `human`. But beware the reverse: an agent writing "the ball feels
  right" as an *automated* row is hiding an un-checkable claim in the green
  count. Feel, fun, difficulty, and readability are human rows, always.
- **Testing the plumbing, not the rule.** "The function `enrage()` is called" is
  weaker than "after the flip timer expires, the enemy's speed increases and its
  color state changes." Assert what's observable in game state; internals get
  renamed and the test rots.
- **Restating the spec instead of asserting it.** "Enemies behave per section
  3.2" is not an assertion — it's a bookmark. If you can't read a concrete
  pass/fail from the sentence, it isn't one.

## The vetting pass (run this down a fresh ledger)

1. **Coverage:** does every spec section appear in the row list? Walk the spec
   headings; any with no row is a hole (this is where missing stages/enemies
   hide). Use the ledger's coverage map.
2. **Weasel-word scan:** Ctrl-F the list above. Rewrite every hit.
3. **Numbers present:** every scoring, constant, timing, and count row cites the
   spec's exact value, not a direction ("more," "faster").
4. **Branches covered:** every "only if / unless / and / or" rule checks both the
   true and false case.
5. **Randomness handled:** no row asserts a single random outcome; each is seeded
   or statistical.
6. **Right altitude:** no row depends on a private function name; all read game
   state.
7. **Human rows are honest:** feel/fun/look are marked `human`, not faked into an
   automated number.

If a ledger passes this, the agent understood the spec and you can let it build.
If it doesn't, **fix the assertions now** — that conversation is far cheaper
before code than after.

## How to give feedback

Don't tell an agent "make the assertions better" — that produces more weasel
words. **Rewrite one or two assertions yourself as examples**, name the test
they failed ("this one isn't specific — give me the exact point value from the
spec"), and have it redo the rest to match. The strong assertions above are the
target shape.
