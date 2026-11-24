---
name: ready-for-review
description: Takes a draft PR that its author approved to a human review. Add the CI label, mark it ready, fix what CI and Greptile find, then request the named reviewer.
argument-hint: for <reviewer>
disable-model-invocation: true
metadata:
  internal: true
---

# Ready for review

Takes the PR of this conversation from the author's approval to a review request, for example `/ready-for-review for Valentin`. It is the step after [`build-it`](../build-it/SKILL.md). Invoking this skill authorizes the CI label, the ready state, the pushed fixes, the replies on bot threads and the review request. It does not authorize a merge.

## Steps

1. **Add the CI label.** Add `ci:docs` when the PR changes only documentation, agent instructions or code comments, and `ci:focus` for any other change. When the user names `ci:normal` or `ci:daily`, add that label instead. Add each other `ci:*` label that the user names, such as `ci:windows`, next to it.

2. **Mark the PR ready.** Run `gh pr ready <number>`. Greptile then reviews the PR by itself.

3. **Make it green.** Wait with [`check-pr`](../check-pr/SKILL.md), fix the failing checks, handle the review threads with [`handle-pr-comments`](../handle-pr-comments/SKILL.md), and push. Repeat until each check on the head commit passed, Greptile reviewed the head commit, and no bot thread is unresolved. When a decision for the user remains, present it and wait: request no review before the answer.

4. **Request the review.** The reviewer is a Storybook maintainer: find the GitHub login for the name the user gave, and run `gh pr edit <number> --add-reviewer <login>`.

5. **Ping the user.** Tell the user that the PR is ready for the reviewer. Give the PR link, the reviewer, and each change you made after the user's approval, with its reason: the user has not seen those.

## After the request

When the reviewer comments, handle the threads with [`handle-pr-comments`](../handle-pr-comments/SKILL.md), then do step 3 again and tell the user when the PR is green.
