---
name: open-pr
description: Opens a pull request from the current branch using the PR template. Use when the user asks to open a PR, create a pull request, or invokes /open-pr.
allowed-tools: Bash, Read, AskQuestion
---

# Open Pull Request

Opens a draft PR from the current branch following Storybook conventions.

## Workflow

### 1. Gather context

Run in parallel: `git status`, `git diff`, `git log --oneline <base>...HEAD` (after step 2), `git branch -vv`.

Push first if needed: `git push -u origin HEAD`.

### 2. Detect base branch

```bash
git fetch origin
bash .agents/skills/open-pr/scripts/detect-base-branch.sh
```

Detects base in order: tracked upstream → reflog checkout source → closest `origin/*` ancestor (fewest commits from branch tip to HEAD). Supports telescoped/stacked PRs off feature branches, not only `next`/`main`. Skips branches at the same commit as HEAD. Tie-break: feature branch over trunk, then `next` over `main`. Falls back to `next`. Tell the user the result.

### 3. Ask for labels

Use **AskQuestion** for three questions. Options from `.github/PULL_REQUEST_TEMPLATE.md`:

| Question | Options |
| -------- | ------- |
| CI label | `ci:normal`, `ci:merged`, `ci:daily`, or split labels: `ci:core` and/or framework/builder labels (`ci:react`, `ci:vue3`, `ci:angular`, `ci:vite`, `ci:webpack`, ...) |
| QA label | `qa:needed`, `qa:skip` |
| Type label | `bug`, `maintenance`, `dependencies`, `build`, `cleanup`, `documentation`, `feature request`, `BREAKING CHANGE`, `other` |

Verify the available labels with the PR template.

### 4. Draft title and body

**Title:** `[Area]: [Description]` — see the `pr` skill for format and examples.

**Body:** Read `.github/PULL_REQUEST_TEMPLATE.md`. Copy it **exactly** (keep all HTML comments). Fill in:

- `Closes #` when an issue is linked
- **What I did**
- Testing checkboxes and mandatory manual-testing steps (or state why none is needed)
- Documentation checkboxes when applicable
- Leave maintainer checklist items unchecked

### 5. Create the PR

```bash
gh pr create \
  --draft \
  --base "<detected-base>" \
  --title "<Area>: <Description>" \
  --body "$(cat <<'EOF'
<FILLED_TEMPLATE>
EOF
)" \
  --assignee @me \
  --label "<type>,<ci>,<qa>"
```

### 6. Report and offer canary

Share the PR URL. Then **AskQuestion**: "Do you want to create a canary release for this PR?"

- **Yes** — run `/canary <PR_NUMBER>` and report workflow status
- **No** — stop

## Notes

- Always draft; always assign `@me`.
- For canary details after publishing, see the `canary` skill.
