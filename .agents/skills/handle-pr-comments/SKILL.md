---
name: handle-pr-comments
description: Triage and resolve GitHub PR review comments one by one, interactively for humans and without asking for review bots. Use when the user asks to handle, address, respond to, or resolve PR review comments, or mentions reviewer feedback on a pull request.
metadata:
  internal: true
---

# Handle PR Comments

Evaluate review comments on the PR (from the current branch, or a PR number/URL if given). For each unresolved comment from a human: summarize the feedback, suggest a resolution, ask the user how to resolve it, apply their choice, commit if needed, and resolve the thread.

1. **Find the PR.** Use the given number/URL, else derive it from the current branch (`gh pr view`). Stop if no PR exists.

2. **Fetch unresolved review threads** via the GraphQL `reviewThreads` field on the pull request — request each thread's `id`, `isResolved`, `isOutdated`, `path`, `line`, and comments. Filter to `isResolved == false`. (Use GraphQL, not REST: only it exposes thread `id`s and resolution state.)

3. **Loop one comment at a time.** Handle bot comments as the "Bot comments" section says. For each human comment: (a) summarize the feedback + file/line, reading surrounding code; (b) suggest a concrete fix; (c) ask via AskQuestion with options — apply suggested fix / apply a different fix / reply only / skip; (d) apply the choice; (e) if applicable, summarize what was changed and ask whether to commit; (f) resolve the thread via the GraphQL `resolveReviewThread` mutation. 

4. **Report** an overview of what was changed, committed, replied to, skipped, and resolved. Include links.

## Notes

- Handle real-user comments before addressing AI agents' (Copilot, CodeRabbit).
- Group duplicate comments; when the same/similar issue is mentioned multiple times, handle them all at once.
- Make a separate commit for each change.

## Bot comments

For comments from review bots (Greptile, Copilot), do not ask the user. Judge each comment against [Code review](../../guidelines/code-review.md), including "Real inputs only". Then fix it, or decide not to and say why. Reply in the thread with what you did, and resolve the thread. Fold the fixes into the commits that own them, as the [`pr` skill](../pr/SKILL.md) "Commit history" section says. The bots review again on each push, so fetch the threads again after you push.
