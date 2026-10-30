---
name: build-it
description: Builds a change end to end, from the issue to a reviewed draft PR. Implement, review, hunt invariants, QA in real projects, open the PR, act on the bot reviews, then hand over to a human.
disable-model-invocation: true
metadata:
  internal: true
---

# Build it

Takes a change from a spec to a draft PR that is ready for a human. Steps 1 to 9 run without the user: ask only for a design-level decision (a fix that changes a rule the spec states). Invoking this skill authorizes the draft PR, the review request on it, and the replies on bot threads.

Each step names the skill that does the work. Read that skill when you reach the step, not before.

## Steps

1. **Pin the spec.** The Linear issue the user named, or the decisions from this conversation. When the spec lives only in the conversation, write it into the Linear issue first, so the reviews in steps 3 and 7 can read it. Branch from `origin/next` and record the base SHA: `origin/next` moves during a session.

2. **Implement.** Follow `AGENTS.md` and the guidelines it points to. Run the focused tests and `cd code && yarn fmt:write`. Done when the focused tests pass and the tree has only the change.

3. **Review.** Run [`code-review`](../code-review/SKILL.md) since the base SHA. Fix the valid findings, and run it again until only findings judged and left on purpose remain.

4. **Hunt.** Run [`invariants-hunt`](../invariants-hunt/SKILL.md) since the base SHA. Fix what survives the evidence gate. Hold the design-level findings for step 9.

5. **QA in the real world.** Run [`real-world-qa`](../real-world-qa/SKILL.md). Fix the findings, and keep the evidence for the PR body.

6. **Shape the history.** Rebuild the commits as the [`pr` skill](../pr/SKILL.md) "Commit history" section says.

7. **Open the draft PR, and get two reviews in parallel.**
   - Open the PR with [`open-pr`](../open-pr/SKILL.md). Add no `ci:*` label; see [Pull requests](../../guidelines/pull-requests.md).
   - Ask Greptile for a review, as [Pull requests](../../guidelines/pull-requests.md) says.
   - Run [`second-opinion`](../second-opinion/SKILL.md) on the PR.

8. **Act on the reviews.** Handle each bot thread as the [`handle-pr-comments`](../handle-pr-comments/SKILL.md) "Bot comments" section says, and fix the confirmed findings of the second opinion. Push, and wait for Greptile to review the new head. Repeat until the bots are quiet. Then list the unresolved review threads of every open PR in the stack, not only this one: the bots review again on each push. Done when no bot thread is unresolved.

9. **Hand over.** Tell the user the PR is ready for review. Give the PR link and, per reviewer (code review, hunt, real-world QA, Greptile, second opinion), what it found, what you fixed, and what you dropped and why. Present each held design-level decision with a recommendation.

## After the hand-over

The human leads from here:

- **Human review.** Fix the feedback as new commits; the [`pr` skill](../pr/SKILL.md) "Commit history" section says why. After a big change, run steps 3 to 5 again.
- **CI and merge.** A maintainer adds the CI label, as [Pull requests](../../guidelines/pull-requests.md) says. When the user asks, watch the checks and fix the failures.
- **The next PR.** When the work needs several PRs, continue in the same conversation and start again at step 1 for the next one.
