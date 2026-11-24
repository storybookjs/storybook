---
name: build-it
description: Builds a change end to end, from the issue to a reviewed draft PR. Implement, review, hunt invariants, QA in real projects, open the PR, act on the bot reviews, then hand over to a human.
disable-model-invocation: true
metadata:
  internal: true
---

# Build it

Takes a change from a spec to a draft PR that is ready for a human. Steps 1 to 9 run without the user. Hold the decisions that belong to the user for step 9: a design-level fix (one that changes a rule the spec states), and a high-severity bot finding you disagree with. Invoking this skill authorizes the draft PR, the review request on it, the replies on bot threads, and the status change of the Linear issue.

Each step names the skill that does the work. Read that skill when you reach the step, not before.

Each step also names the principles from [Principles](../../guidelines/principles.md) that it applies. Read a principle's leaf skill when its trigger matches, not before, and keep a note of each decision it changed for step 9. Steps 1 to 8 follow [Never Block on the Human](../principle-never-block-on-the-human/SKILL.md): make each reversible call yourself and present it in step 9.

## Steps

1. **Pin the spec.** The problem to solve: an issue the user named (Linear, GitHub), a prompt, or a problem from earlier in this conversation. Write it to a spec file outside the checkout, with the decisions made so far, and give that file as the spec to the reviews in steps 3, 4 and 7: a subagent cannot read this conversation. When the spec adds a requirement to an existing design, apply [Redesign from First Principles](../principle-redesign-from-first-principles/SKILL.md); when it trades scope against the user's experience, apply [Experience First](../principle-experience-first/SKILL.md). When the spec comes from a Linear issue, set that issue to In Progress now, before any other work. Branch from `origin/next` and record the base SHA: `origin/next` moves during a session.

2. **Implement.** Follow `AGENTS.md` and the guidelines it points to. Name the data shape before you write logic ([Foundational Thinking](../principle-foundational-thinking/SKILL.md)), remove dead weight before you build ([Subtract Before You Add](../principle-subtract-before-you-add/SKILL.md)), and keep the diff to the smallest change that solves the problem ([Laziness Protocol](../principle-laziness-protocol/SKILL.md)). For a bug, reproduce it end to end and fix the first place the system went wrong ([Fix Root Causes](../principle-fix-root-causes/SKILL.md)). Write each test against what users of the code can observe ([Test Behavior, Not Implementation](../principle-test-behavior-not-implementation/SKILL.md)). Check the rest of the index for the triggers this change meets, such as types, boundaries, stateful logic, or a new internal API. Run the focused tests and `cd code && yarn fmt:write`, then commit. The reviews compare commits, so they do not see uncommitted work; commit each later fix too, and step 6 shapes the history. Done when the focused tests pass and the working tree is clean.

3. **Review.** Run [`code-review`](../code-review/SKILL.md) since the base SHA. Fix the valid findings, commit the fixes, and run it again until only findings judged and left on purpose remain. Fix each finding at its root cause, and find every other place with the same fault ([Fix Root Causes](../principle-fix-root-causes/SKILL.md)). When two fixes that share one premise fail the same check, apply [Attack the Premise](../principle-attack-the-premise/SKILL.md) before a third.

4. **Hunt.** Run [`invariants-hunt`](../invariants-hunt/SKILL.md) since the base SHA. Fix what survives the evidence gate. Hold the design-level findings for step 9.

5. **QA in the real world.** Run [`real-world-qa`](../real-world-qa/SKILL.md). Fix and commit the findings, and keep the evidence for the PR body. The evidence comes from the real artifact, not a proxy ([Prove It Works](../principle-prove-it-works/SKILL.md)). Before you report a number you measured, apply [Explain the Number](../principle-explain-the-number/SKILL.md).

6. **Shape the history.** Rebuild the commits as the [`pr` skill](../pr/SKILL.md) "Commit history" section says, in the order that proves the work: the subtraction before the reshape, the failing test before the fix ([Sequence Work into Verifiable Units](../principle-sequence-verifiable-units/SKILL.md)).

7. **Open the draft PR, and get two reviews in parallel.**
   - Open the PR with [`open-pr`](../open-pr/SKILL.md), without its questions: choose the type and QA labels yourself with the heuristics of the [`pr` skill](../pr/SKILL.md), and skip the canary. Add no `ci:*` label; see [Pull requests](../../guidelines/pull-requests.md).
   - Start the PR body with each issue the spec comes from, as a link to that issue: `Closes #<number>` for a GitHub issue, `Closes [SB-<number>](<Linear URL>)` for a Linear issue, and the same form for any other tracker. Write `Part of` when the PR does not finish the issue.
   - Assign the PR to the user who invoked this skill.
   - Ask Greptile for a review, as [Pull requests](../../guidelines/pull-requests.md) says.
   - Run [`second-opinion`](../second-opinion/SKILL.md) on the PR.

8. **Act on the reviews.** Wait for the Greptile review and collect its findings with [`check-pr`](../check-pr/SKILL.md). Handle each bot thread as the [`handle-pr-comments`](../handle-pr-comments/SKILL.md) "Bot comments" section says: reply before you resolve. Leave each human thread to the user, unchanged. Also fix the confirmed findings of the second opinion, and push. Then list the unresolved review threads of every open PR in the stack, not only this one. Done when the only unresolved bot threads are the high-severity findings you disagree with. When a reviewer flags a fault that this repo has no check for and that agents keep making, propose the check ([Encode Lessons in Structure](../principle-encode-lessons-in-structure/SKILL.md)).

9. **Hand over.** Tell the user the PR is ready for review. Give the PR link, the labels you chose, and, per reviewer (code review, hunt, real-world QA, Greptile, second opinion), what it found, what you fixed, and what you dropped and why. Name each principle that shaped a decision and the choice it changed; cite only principles whose leaf you read in this session. List the human comments that arrived. Present each held decision with a recommendation: the design-level fixes, and each high-severity bot finding you disagree with, with the bot's reasoning and yours side by side.

## After the hand-over

The human leads from here:

- **Human review.** Fix the feedback as new commits; the [`pr` skill](../pr/SKILL.md) "Commit history" section says why. After a big change, run steps 3 to 5 again.
- **CI and the review by a maintainer.** When the user approves the PR, they invoke [`ready-for-review`](../ready-for-review/SKILL.md) and name the reviewer.
- **The next PR.** When the work needs several PRs, continue in the same conversation and start again at step 1 for the next one.
