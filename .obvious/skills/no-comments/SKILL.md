---
name: no-comments
description: "Spawn the comment-sicko subagent, fix accepted findings, and offer encodings for claimed constraints."
metadata:
  internal: true
---

# No comments

Adapted from the `no-comments` skill of [pstack](https://github.com/cursor/plugins/tree/main/pstack), MIT licensed, see [LICENSE](./LICENSE).

Spawn comment-sicko. Act on accepted findings.

Defer to comment-sicko's fresh perspective.

The standard is [Comments and JSDoc](../../guidelines/comments-and-jsdoc.md). Comment-sicko's keep list narrows it; it never widens it.

## Scope

Use the caller's files or diff. Otherwise use the current diff against the merge-base with `origin/next`, confirmed with `git rev-parse`, including the working tree.

## Steps

1. Spawn one subagent, on the strongest model available, in the foreground, with [`comment-sicko.md`](./comment-sicko.md) pasted in full as its brief. Pass the scope: the checkout path, the diff command, and the files. The subagent cannot read this conversation.
2. Inspect its report and diff. Reject application-code edits, scope escapes, exception-protected deletions, misstated `MUST KILL` reasons, and flags that treat kept intentional code as guilty. Reshape flags on our-code surprises stay actionable. Do not restore those comments. A keep survives only with proof it is about something we cannot change. Audit missed scoped lint and TypeScript suppressions. Correctness or safety suppressions stay actionable `MUST KILL`s. Restore deletions only with exact exceptions and scoped proof. Before accepting thin `IMPORTANT` or `do not remove` kills or keeps, read the symbol's code, its callers, and its history (`git log -S`). If a kill is ambiguous, do not restore. If a keep is refuted or still ambiguous, delete it. Revert and rerun one rejected report with the failure named. Reject a second, report it open, and fail `/no-comments` for that report's rejected findings, not for the run.

   A `HOLD` that names a rule of a dependency, platform, vendor, or protocol and where to check it is not an ambiguous keep. Leave it in place and report it open. Any other `HOLD` is an ambiguous keep. Reject a kill of a comment that states such a rule unless the report cites a documentation page or source file that refutes the rule or shows it binds something else. Restore that comment as a `HOLD`, even where an ambiguous kill would otherwise stay deleted. After a second rejection, revert its rejected findings and finish steps 3 to 6 with every finding you accepted.

3. Fix trivial accepted flags directly by deleting a dead path, dropping a parameter, or using the real API. If any fix needs a shape, sketch it once for the accepted set and the surrounding code, and stop at the sketch. Step 4 implements.
4. Implement the smallest root-cause fix in scope. Remove every named workaround. If the root cause is out of scope, land the smallest in-scope fix and report the rest open. Fix the cause, not the symptom, but that intent authorizes neither widening the fence nor fixing instances outside it. Never bolt on symptom guards.
5. Constraint comments say `do not remove`, `do not change wording`, or `talk to X before changing`. Leave keeps about things we cannot change. Offer the cheapest in-scope type, runtime, test, or CI lint. Wait for interactive approval. Unattended runs require caller pre-approval. If approved, encode then delete. Otherwise delete, report the constraint open, and sketch out-of-scope work.
6. Report the deletion count, restored comments, `HOLD` comments, reruns, sketch, fixes, encoding offers, encodings, unenforced constraints, and other open work.

Done when every finding has a verdict, the accepted fixes are in the working tree, and the focused tests pass.
