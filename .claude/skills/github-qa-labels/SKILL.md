---
name: github-qa-labels
description: Label GitHub issues and PRs found during QA testing. Use when organizing QA findings with proper labels.
allowed-tools: Bash
---

# GitHub QA Labels

When creating or organizing issues/PRs found during QA testing, apply these labels.

## QA tracking label

Add `upgrade:<version>` label to track all QA findings for a release:

```bash
# Create label if it doesn't exist
gh label create "upgrade:10.2" --repo storybookjs/storybook --color "0E8A16" --description "Issues/PRs found during 10.2 upgrade QA"

# Add to issue/PR
gh issue edit <NUMBER> --repo storybookjs/storybook --add-label "upgrade:10.2"
gh pr edit <NUMBER> --repo storybookjs/storybook --add-label "upgrade:10.2"
```

## Severity labels

Add `sev:S1` through `sev:S4` to **bugs only** (not docs or feature requests):

```bash
gh issue edit <NUMBER> --repo storybookjs/storybook --add-label "sev:S2"
```

Severity levels:

- **sev:S1**: Critical, blocking, no workaround
- **sev:S2**: Significant issue, may have workaround
- **sev:S3**: Moderate issue, workaround exists
- **sev:S4**: Minor issue, edge case, easy workaround

## What gets severity labels

| Type                    | Severity label? |
| ----------------------- | --------------- |
| Bug (runtime error)     | Yes             |
| Bug (type error)        | Yes             |
| Bug (automigrate issue) | Yes             |
| Documentation issue     | No              |
| Feature request         | No              |
| Enhancement             | No              |

## Batch labeling

Label multiple issues at once:

```bash
gh issue edit 33524 --repo storybookjs/storybook --add-label "upgrade:10.2" && \
gh issue edit 33527 --repo storybookjs/storybook --add-label "upgrade:10.2" && \
gh pr edit 33526 --repo storybookjs/storybook --add-label "upgrade:10.2"
```
