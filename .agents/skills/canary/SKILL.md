---
name: canary
description: Finds or publishes a pkg.pr.new canary release for a Storybook branch. Use when the user wants the canary package specifier for a branch or needs to trigger the canary workflow manually.
allowed-tools: Bash
---

# Find Or Publish Canary Release

Use this skill to get a branch-specific canary build from `pkg.pr.new`.

Canary publishes are driven by the `publish-canary.yml` workflow.

Automatic canary publishes:

- Every push to `next`
- In-repo PRs labeled `ci:canary` (a human must apply that label). While it remains, every push to the PR republishes. The label does nothing on fork PRs.

## Version string

The canary version string is constructed like this:

```text
storybook@https://pkg.pr.new/storybook@<SHA>
```

Replace `<SHA>` with the short commit SHA (first 7 characters). Compact URLs (`https://pkg.pr.new/storybook@<SHA>`) resolve to the same tarball as the owner/repo form. The pkg.pr.new dashboard is always `https://pkg.pr.new/~/storybookjs/storybook`.

## Check whether a canary already exists

```bash
SHA=$(git rev-parse --short=7 HEAD)
curl -I "https://pkg.pr.new/storybook@$SHA"
```

An HTTP `200` status code means the canary already exists for that commit.

## Decision flow

Use this skill with the following if-then behavior.

### A. If the branch already has a PR with the `ci:canary` label

Do not trigger anything manually. Read the canary heading and install commands from the PR body. That section is the current run status and the most recent release.

```bash
BRANCH=$(git branch --show-current)

gh pr list \
	--repo storybookjs/storybook \
	--head "$BRANCH" \
	--state open \
	--json number,title,labels,url \
	--jq '.[] | select(any(.labels[]?; .name == "ci:canary"))'
```

```bash
gh pr view <NUMBER> --repo storybookjs/storybook --json body --jq .body
```

Use the heading and the `CANARY_RELEASE_SECTION` commands as-is. A follow-up workflow (`publish-canary-pr-body.yml`) writes those sections after publish finishes, including after a maintainer manual run.

Fork PRs never use path A. Use path C.

- **Released** — use the install commands from the body
- **Failed** — the heading links to pkg.pr.new; the failure comment links to the workflow run
- **Not run** — publish is still in progress, unlabeled, or the follow-up has not run yet

### B. If the in-repo branch does not have a PR with the `ci:canary` label

Trigger the canary workflow manually on the branch and watch it finish. It usually takes 5-10 minutes. You can also use the GitHub Actions UI: open `publish-canary.yml`, click "Run workflow", and select the branch. Optional inputs `pr`, `branch`, and `sha` must agree when more than one is set.

```bash
BRANCH=$(git branch --show-current)

gh workflow run --repo storybookjs/storybook publish-canary.yml --ref "$BRANCH"
```

Find the new workflow run and watch it:

```bash
BRANCH=$(git branch --show-current)

RUN_ID=$(gh run list \
	--repo storybookjs/storybook \
	--workflow publish-canary.yml \
	--branch "$BRANCH" \
	--event workflow_dispatch \
	--json databaseId \
	--jq '.[0].databaseId')

gh run watch "$RUN_ID" --repo storybookjs/storybook
```

When it finishes successfully, read the canary heading from the PR body if a PR was updated. Otherwise construct the version string from the published SHA (the run's `headSha` is the workflow-source branch, which may differ when you passed `pr` or `sha`):

```bash
RUN_SHA=$(gh run view "$RUN_ID" --repo storybookjs/storybook --json jobs --jq '[.jobs[].steps[]?.name | select(startswith("canary-ref "))][0]' | sed -n 's/.*sha=\([0-9a-fA-F]\{7,40\}\).*/\1/p')
SHORT_SHA="${RUN_SHA:0:7}"
echo "storybook@https://pkg.pr.new/storybook@$SHORT_SHA"
```

### C. If the change is a fork PR

Do not add `ci:canary`. Dispatch the workflow from this repository with the PR number. The fork author does not need to do anything.

```bash
gh workflow run --repo storybookjs/storybook publish-canary.yml --ref next -f pr=<PR_NUMBER>
```

If you also pass `branch` or `sha`, they must be that PR's current head. A later push on the fork does not republish until you run the workflow again.

Optionally confirm the package is live:

```bash
curl -I "https://pkg.pr.new/storybook@$SHORT_SHA"
```


## Use the canary

For a new project:

```bash
npx --yes --allow-remote=all https://pkg.pr.new/create-storybook@<SHA>
```

For an existing project:

```bash
npx --yes --allow-remote=all https://pkg.pr.new/storybook@<SHA> upgrade
```

## Requirements

- You need `gh` CLI authenticated for `storybookjs/storybook`
- You need permission to run workflows in the repository for manual dispatch
- The canary workflow is `publish-canary.yml`

## Monitor progress

Workflow page:

- https://github.com/storybookjs/storybook/actions/workflows/publish-canary.yml

CLI:

```bash
gh run list --repo storybookjs/storybook --workflow publish-canary.yml
```
