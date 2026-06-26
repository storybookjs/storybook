---
name: update-pr-description
description: Evaluate a PR's title and description against its actual implementation, then iteratively suggest and apply updates. Use when the user asks to check, fix, or update a PR title or description.
---

# Update PR Description

## Workflow

1. **Resolve the PR.** Use the number/URL the user provided. If none, look up the PR for the current branch with `gh pr view`.
2. **Gather evidence:**
   - `gh pr view <pr> --json title,body`
   - `gh pr view <pr> --json commits` (commit messages)
   - `gh pr diff <pr>` (full diff against base)
3. **Evaluate divergence.** Compare the stated title/description against what the commits and diff actually do. Only flag *meaningful* divergence (wrong scope, missing major changes, stale claims, inaccurate summary). Ignore trivial wording.
4. **Report.** Tell the user whether the title and/or description meaningfully diverges. If not, stop here.
5. **Suggest iteratively.** Propose concrete updated title/description. Ask the user one change at a time whether to apply, accept edits, and refine.
6. **Apply.** Once agreed, update on the user's behalf with `gh pr edit <pr> --title ... --body ...`.

## Notes

- Match the repository's existing PR template/style if the body uses one.
- Don't rewrite a description that's already accurate.
- Update the state of checkboxes where appropriate.
- Remove section placeholders/reminders when filling out a section.
- Do not remove the canary release section.