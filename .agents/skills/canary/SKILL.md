---
name: canary
description: Finds or publishes a pkg.pr.new preview release for a Storybook branch. Use when the user wants the preview package specifier for a branch or needs to trigger the preview workflow manually.
allowed-tools: Bash
---

# Find Or Publish Preview Release

Use this skill to get a branch-specific preview build from `pkg.pr.new`.

Preview publishes are driven by the `publish-preview.yml` workflow.

The labels that trigger automatic preview publishes on PRs are:

- `ci:normal`
- `ci:merged`
- `ci:daily`

## Version string

The preview version string is constructed like this:

```text
storybook@https://pkg.pr.new/storybookjs/storybook/storybook@<SHA>
```

Replace `<SHA>` with the full commit SHA.

## Check whether a preview already exists

```bash
SHA=$(git rev-parse HEAD)
curl -I "https://pkg.pr.new/storybookjs/storybook/storybook@$SHA"
```

An HTTP `200` status code means the preview already exists for that commit.

## Decision flow

Use this skill with the following if-then behavior.

### A. If the branch already has a PR with one of the CI labels

If the branch already has an associated PR labeled `ci:normal`, `ci:merged`, or `ci:daily`, do not trigger anything manually first. Reuse the workflow run that should already exist.

Find the labeled PR for the current branch:

```bash
BRANCH=$(git branch --show-current)

gh pr list \
	--repo storybookjs/storybook \
	--head "$BRANCH" \
	--state open \
	--json number,title,labels,url \
	--jq '.[] | select(any(.labels[]?; .name == "ci:normal" or .name == "ci:merged" or .name == "ci:daily"))'
```

Find the latest successful preview workflow run for that branch:

```bash
BRANCH=$(git branch --show-current)

RUN_ID=$(gh run list \
	--repo storybookjs/storybook \
	--workflow publish-preview.yml \
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

### B. If the branch does not have a PR with one of the CI labels

Trigger the preview workflow manually on the branch and watch it finish. It usually takes about 10 minutes.

```bash
BRANCH=$(git branch --show-current)

gh workflow run --repo storybookjs/storybook publish-preview.yml --ref "$BRANCH"
```

Find the new workflow run and watch it:

```bash
BRANCH=$(git branch --show-current)

RUN_ID=$(gh run list \
	--repo storybookjs/storybook \
	--workflow publish-preview.yml \
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

## Use the preview

For a new project:

```bash
npm create storybook@https://pkg.pr.new/storybookjs/storybook/storybook@<SHA>
```

For an existing project:

```bash
npx storybook@https://pkg.pr.new/storybookjs/storybook/storybook@<SHA> upgrade
```

## Requirements

- You need `gh` CLI authenticated for `storybookjs/storybook`
- You need permission to run workflows in the repository for manual dispatch
- The preview workflow is `publish-preview.yml`

## Monitor progress

Workflow page:

- https://github.com/storybookjs/storybook/actions/workflows/publish-preview.yml

CLI:

```bash
gh run list --repo storybookjs/storybook --workflow publish-preview.yml
```
