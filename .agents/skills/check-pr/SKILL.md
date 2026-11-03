---
name: check-pr
description: Waits for a PR's checks and reviews to finish, then reports the unresolved review threads, the failing checks and the gaps in the PR description. Use when the user asks to check a PR, whether a PR is ready, or what the Greptile review found.
metadata:
  internal: true
---

# Check PR

Reports what is left on a pull request in `storybookjs/storybook`. It changes nothing. To act on the review threads, use [`handle-pr-comments`](../handle-pr-comments/SKILL.md).

[`queries.md`](./queries.md) has the commands and GraphQL queries for the steps below.

## Steps

1. **Find the PR.** Use the number the user gave, else the PR of the current branch: `gh pr view --json number -q .number`.

2. **Wait for the checks.** Poll `statusCheckRollup` every 30 seconds until no check is pending or in progress. Wait for "Greptile Review" too, when Greptile reviews the head commit. CI runs only when the PR has a `ci:*` label (see [Pull requests](../../guidelines/pull-requests.md)), so a PR without one has few checks.

3. **Collect.** For each area, list what needs action:
   - **Checks:** each failing check and the reason. Danger checks the title, the labels and the "Manual testing" section; see [Pull requests](../../guidelines/pull-requests.md).
   - **Review threads:** each unresolved thread, with its author, file and line. Use GraphQL, because only GraphQL gives a thread's id and whether it is resolved.
   - **Greptile summary:** Greptile edits one summary comment on each review. Read its latest version (newest `updated_at`), with the confidence score and the findings.
   - **Description:** placeholders, an empty "Manual testing" section, and "How to review" links to commits that are no longer on the branch.

4. **Report.** One table with these columns: area, item, author, and status. The status is one of: **needs action**, **for information**, or **already fixed** by a later commit. Put human comments before bot comments. End with the Greptile confidence score and the number of items that need action.

Done when all checks are finished and each unresolved thread is in the table.
