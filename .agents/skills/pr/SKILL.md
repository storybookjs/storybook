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

- `ci:normal` - standard sandbox set; default for most code changes
- `ci:merged` - merged sandbox set
- `ci:daily` - daily sandbox set; use this when changes affect prerelease sandboxes or sandboxes pinned to a framework or React version other than latest
- `ci:docs` - documentation-only changes (use with `documentation` category)

**QA (required, pick one):**

Tells the release team whether manual QA is needed before the next minor release.

- `qa:needed` — a human must manually verify this PR at release time
- `qa:skip` — no per-PR manual QA needed at release time

Heuristics:

- User explicitly asked for manual QA before release → `qa:needed`
- Part of a larger project that gets holistic QA (not per-PR) → `qa:skip`
- Touches paths, filesystem, or anything that could break on Windows → `qa:needed`
- Complex change spanning multiple areas that must work together → `qa:needed`
- Small change in central/shared code with high side-effect risk (e.g. layout CSS in shared UI) → `qa:needed`
- Simple, straightforward change → `qa:skip`
- Unsure → ask the user whether manual QA before minor release is necessary

## PR body

Read `.github/PULL_REQUEST_TEMPLATE.md` from the repository root.

Copy that template **EXACTLY**, including all HTML comments (`<!-- ... -->`). Fill in the relevant sections based on the changes, but keep all comments intact.

### Manual testing (required)

The **Manual testing** section is mandatory — never leave it empty. Write steps for a separate maintainer, not a log of how you tested.

Each step should be:

- Clear and easy to follow
- Copy-pasteable shell commands where applicable
- Explicit about what behavior to inspect (expected outcome, not just "check it works")
- Linked to specific stories for UI changes, or to build artifacts when relevant
- Lists areas most likely to regress and worth extra scrutiny

**Verify your own steps first** — run through them locally before opening the PR.

When useful, link to published Chromatic Storybooks (CI must finish first; links won't work immediately after opening the PR):

- Internal UI: `https://<branch>--635781f3500dd2c49e189caf.chromatic.com/?path=/story/<story_id>`
- React Vite TS: `https://<branch>--630511d655df72125520f051.chromatic.com/?path=/story/<story_id>`

Replace `<branch>` with Chromatic's normalized slug (special chars → dashes, e.g. `feature/foo` → `feature-foo`) and `<story_id>` with the story path (e.g. `example-button--primary`).

## Command

Always create PRs in draft mode:

```bash
gh pr create --draft --title "<Area>: <Description>" --body "<FILLED_TEMPLATE>" --label "<category>,<ci>,<qa>"
```
