---
name: pr
description: Creates a pull request following Storybook conventions. Use when creating PRs, opening pull requests, or submitting changes for review.
allowed-tools: Bash, Read
metadata:
  internal: true
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

**CI:** do not add a `ci:*` label. The review bot or a maintainer adds it once automated review has finished.

**Canary (optional):**

- `ci:canary` - publish pkg.pr.new canary packages for an in-repo PR; later pushes republish while the label remains. Does nothing on fork PRs. To canary a fork PR, a maintainer runs `publish-canary.yml` with the `pr` input; do not ask the fork author to publish. Do not add this label unless the user asks for a canary.

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

## Commit history

Shape the commits so a reviewer can skip the hard implementation and review the behaviour through the tests:

- One commit for each unrelated fix, one for core changes, then the implementation.
- One commit with only the test cases that show the behaviour, for example `test(svelte): the test cases for <feature>`.
- Snapshots contain no versions and no absolute paths. Use a snapshot serializer with placeholders (see `code/renderers/svelte/vitest-setup.ts`).

Until a human has reviewed the PR, fold each fix into the commit that owns it, also for bot feedback. After the first human review, add each fix for a human's feedback as a new commit on top, and link that commit in the reply on the human's thread: a folded fix is hard for the reviewer to find. A rebase onto the base branch is still fine, but keep those fix commits separate.

## PR body

Read `.github/PULL_REQUEST_TEMPLATE.md` from the repository root.

Copy that template **EXACTLY**, including all HTML comments (`<!-- ... -->`). Fill in the relevant sections based on the changes, but keep all comments intact.

Describe the change against the base branch only. Do not compare it with earlier or replaced PRs. When the PR is an alternative to another open PR, say so in one line at the top.

### How to review

Add a "How to review" section when the PR has more than one commit. Write one numbered item per commit, in order: the commit title as a link (`https://github.com/<owner>/<repo>/pull/<number>/commits/<full sha>`), how closely to review it (**Review this one**, **Skim**, or **Skip**), and what it changes, in one or two sentences. Update the links after each rebase or force-push, because the SHAs change.

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

For stories of another sandbox, use that sandbox's project from [Chromatic projects](../../guidelines/chromatic-projects.md). The links need a Chromatic login.

Replace `<branch>` with Chromatic's normalized slug (special chars → dashes, e.g. `feature/foo` → `feature-foo`) and `<story_id>` with the story path (e.g. `example-button--primary`).

## Command

Always create PRs in draft mode:

```bash
gh pr create --draft --title "<Area>: <Description>" --body "<FILLED_TEMPLATE>" --label "<category>,<qa>"
```
