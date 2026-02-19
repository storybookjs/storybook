---
name: pr
description: Creates a pull request following Storybook conventions. Use when creating PRs, opening pull requests, or submitting changes for review.
allowed-tools: Bash, Read
---

# Create Pull Request

Creates a PR following Storybook conventions.

## Title format

`[Area]: [Description]`

- Area is capitalized, no spaces (dashes allowed)
- Examples:
  - `CSFFactories: Fix type export`
  - `Nextjs-Vite: Add support`
  - `CLI: Fix automigrate issue`

## Labels

Add these labels to the PR:

**Category (required, pick one):**

- `bug` - fixes incorrect behavior
- `maintenance` - user-facing maintenance
- `dependencies` - upgrading/downgrading deps
- `build` - internal build/test updates (no changelog)
- `cleanup` - minor cleanup (no changelog)
- `documentation` - docs only (no changelog)
- `feature request` - new feature
- `BREAKING CHANGE` - breaks compatibility
- `other` - doesn't fit above

**CI (required, pick one):**

- `ci:normal` - standard sandbox set
- `ci:merged` - merged sandbox set
- `ci:daily` - daily sandbox set

## PR body

@.github/PULL_REQUEST_TEMPLATE.md

Copy the template above **EXACTLY**, including all HTML comments (`<!-- ... -->`). Fill in the relevant sections based on the changes, but keep all comments intact.

## Command

```bash
gh pr create --title "<Area>: <Description>" --body "<FILLED_TEMPLATE>" --label "<category>,<ci>"
```
