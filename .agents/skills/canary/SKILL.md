---
name: canary
description: Finds or publishes a pkg.pr.new canary release for a Storybook branch. Use when the user wants the canary package specifier for a branch or needs to trigger the canary workflow manually.
allowed-tools: Bash
---

# Find Or Publish Canary Release

Use this skill to get a branch-specific canary build from `pkg.pr.new`.

Canary publishes are driven by the `publish-canary.yml` workflow.

Automatic canary publishes on PRs are triggered only by the `ci:canary` label. A human must apply that label. While it remains, every push to the PR republishes.

## Version string

The canary version string is constructed like this:

```text
storybook@https://pkg.pr.new/storybookjs/storybook/storybook@<SHA>
```

Replace `<SHA>` with the full commit SHA.

## Check whether a canary already exists

```bash
SHA=$(git rev-parse HEAD)
curl -I "https://pkg.pr.new/storybookjs/storybook/storybook@$SHA"
```

An HTTP `200` status code means the canary already exists for that commit.

## Decision flow

Use this skill with the following if-then behavior.

### A. If the branch already has a PR with the `ci:canary` label

If the branch already has an associated PR labeled `ci:canary`, do not trigger anything manually first. Reuse the workflow run that should already exist.

Find the labeled PR for the current branch:

```bash
BRANCH=$(git branch --show-current)

gh pr list \
	--repo storybookjs/storybook \
	--head "$BRANCH" \
	--state open \
	--json number,title,labels,url \
	--jq '.[] | select(any(.labels[]?; .name == "ci:canary"))'
```

Find the latest successful canary workflow run for that branch:

```bash
BRANCH=$(git branch --show-current)

RUN_ID=$(gh run list \
	--repo storybookjs/storybook \
	--workflow publish-canary.yml \
	--branch "$BRANCH" \
	--event pull_request \
	--json databaseId,conclusion \
	--jq '.[] | select(.conclusion == "success") | .databaseId' \
	| head -n 1)

gh run view "$RUN_ID" --repo storybookjs/storybook
```

Pull the SHA from that run and construct the version string from it:

```bash
RUN_SHA=$(gh run view "$RUN_ID" --repo storybookjs/storybook --json headSha --jq '.headSha')
echo "storybook@https://pkg.pr.new/storybookjs/storybook/storybook@$RUN_SHA"
```

Optionally confirm the package is live:

```bash
curl -I "https://pkg.pr.new/storybookjs/storybook/storybook@$RUN_SHA"
```

### B. If the branch does not have a PR with the `ci:canary` label

Trigger the canary workflow manually on the branch and watch it finish. It usually takes about 10 minutes. You can also use the GitHub Actions UI: open `publish-canary.yml`, click "Run workflow", and select the branch.

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

When it finishes successfully, pull the SHA from the run and construct the version string:

```bash
RUN_SHA=$(gh run view "$RUN_ID" --repo storybookjs/storybook --json headSha --jq '.headSha')
echo "storybook@https://pkg.pr.new/storybookjs/storybook/storybook@$RUN_SHA"
```

Optionally confirm the package is live:

```bash
curl -I "https://pkg.pr.new/storybookjs/storybook/storybook@$RUN_SHA"
```

## Use the canary

For a new project:

```bash
npx --yes --allow-remote=all https://pkg.pr.new/storybookjs/storybook/create-storybook@<SHA>
```

For an existing project:

```bash
npx --yes --allow-remote=all https://pkg.pr.new/storybookjs/storybook/storybook@<SHA> upgrade
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
