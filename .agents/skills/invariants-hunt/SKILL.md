---
name: invariants-hunt
description: Adversarial hunt for broken invariants in the changes since a fixed point. A subagent writes inputs that try to break each property the design promises, and a finding counts only with a test that fails on this head. Use when the user asks for an invariants hunt, to break or stress a change, or to prove that a design holds.
metadata:
  internal: true
---

# Invariants hunt

A review of the diff asks whether the code follows the rules. The hunt asks whether the rules hold: code can implement a rule faithfully and still break a property the design promises, and a reader of the diff will not see it. So the hunt reads the invariants, not the diff, and a finding counts only after it fails on this head.

Run it after [`code-review`](../code-review/SKILL.md) is quiet: fixes from that review change the code the hunt runs against.

## Steps

1. **Pin the target.** The fixed point the user gave, or the merge-base with `origin/next`, confirmed with `git rev-parse`, and the commit list `git log --oneline <fixed-point>..HEAD`. The working tree is clean, and nothing else runs against it: no dev server, no E2E, no compile. The hunt edits files and runs tests, and anything else that shares the tree corrupts both.

2. **Write the invariants.** From the spec, the design notes and the PR body, write the properties the design promises as claims that a test can falsify. Each one names what stays true and the "regardless of" clause it must survive: input order, timing, failure, concurrency, partial state. Four to eight lines. Add each deferral from earlier reviews of this change as its own line: a deferral is a claim nobody has tested. When the tracker's discussion overrules the spec, save the spec to a file with a dated "Later decisions that supersede lines in this spec" section at the top, one decision per line. The subagent cannot read the tracker, and a stale spec makes it defend a rule that is already gone. Show the list to the user: a wrong invariant is cheaper to correct now than after the hunt.

3. **Dispatch the hunt.** One subagent, on the strongest model available, in the background, with the brief below filled in. Nothing else touches the tree until it reports.

4. **Gate on evidence.** A finding enters judgement only with all five parts: the invariant, the minimal input, the observed state on this head, the expected state, and a test that fails on this head. Send anything less back with "reproduce or drop". Judge each survivor:
   - **Valid:** fix it.
   - **Out of scope:** it breaks "Real inputs only" in [`.agents/guidelines/code-review.md`](../../guidelines/code-review.md). Drop it and say why.
   - **Design-level:** the fix changes a rule the spec states. That is the user's decision: keep it out of the commits, and present it in one paragraph with a recommendation and the reproduction.
   - **Wrong:** say why.

5. **Apply.** Apply the accepted hunks from the saved patch by hand, without the held ones. Run the focused suites. Commit them as the [`pr` skill](../pr/SKILL.md) "Commit history" section says.

6. **Record.** Add a dated comment on the tracker issue for each accepted rule change, and for each held design decision, marked open. The next hunt on this change takes the deferrals as invariants in step 2.

Done when every finding has a verdict, the accepted fixes are committed, and the focused suites pass.

## Brief

Replace the angle-bracket fields. Keep the rest.

```text
You are reviewing <repo> at commit <sha> on branch <branch>, checked out at <path>. The change
under review is `git log --oneline <fixed-point>..HEAD`. The code lives in <directories>. Read
<design docs> and <spec file> first; the spec file's "Later decisions" section supersedes the body
where they disagree.

Do NOT review the diff for style, naming, comments, or spec conformance. Other reviewers do that.
Your job is to break the design's invariants and to prove each break by executing it.

The design rests on these invariants. Treat each as a claim to falsify:

<numbered invariants, each with its "regardless of" clause>

For each invariant, construct concrete adversarial inputs: <the domain's concrete knobs: specific
values, orderings, sizes, failure injections, concurrency>. Run them, against the unit under test
directly (<pattern file>) or through <harness / integration path>. Try EVERY ordering of small
input sets, not one ordering; write a permutation loop. Read the spec's own rules as suspects: a
rule the code implements faithfully can still break an invariant. Pay particular attention to rules
that landed in separate changes acting together.

Practical rules:
- Focused tests: <command>. Never run the full suite or a type check in parallel with another heavy
  process. Run the full relevant directory at most once, at the end.
- You may add probe tests and edit source to apply your fixes, but at the end the working tree must
  be exactly as you found it: `git status --short` shows <expected output>. Save your changes as
  <patch path> (git diff plus new files via `git add -N`) before reverting. Do not commit, push, or
  touch branches. Do not touch <off-limits paths>.

Stay with inputs real projects produce. Do not report a break that needs a state no user, editor,
build tool or framework creates (a hand-corrupted file, an impossible event order, a value the types
rule out); a guard against an imaginary edge case is code to maintain for nothing. If you are unsure
whether an input is realistic, name where it would come from in real life, or drop it.

Report only what you reproduced. For each finding: the invariant, the minimal input, the observed
state on this head, the expected state, and a test that fails on this head. Propose the source fix,
apply all fixes together, confirm the focused suites pass with them and that exactly your new tests
fail without them. List what you tried that held under "Held", one line each. Report nothing you
could not make fail; nothing about style, naming, or comments. Finish with a two-line verdict:
number of confirmed breaks, and whether the change is safe to merge as-is.
```
