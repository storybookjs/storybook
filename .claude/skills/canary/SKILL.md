---
name: canary
description: Triggers a canary release for a Storybook PR. Use when the user wants to publish a canary version, create a pre-release, or test a PR via npm.
allowed-tools: Bash
---

# Publish Canary Release

Publishes a canary version of Storybook from a PR to npm.

## Usage

To trigger a canary release, run:

```bash
gh workflow run --repo storybookjs/storybook publish.yml --field pr=<PR_NUMBER>
```

## What happens

1. GitHub Actions builds and publishes the PR as `0.0.0-pr-<PR_NUMBER>-sha-<SHORT_SHA>`
2. The version is published to npm with the `canary` tag
3. The PR body is updated with the exact version and install instructions

## Version format

The canary version follows a **predictable structure**:

```
0.0.0-pr-<PR_NUMBER>-sha-<SHORT_SHA>
```

- `<PR_NUMBER>`: The PR number (e.g., `33526`)
- `<SHORT_SHA>`: First 8 characters of the commit SHA (e.g., `a2e09fa2`)

**Example:** For PR #33526 with commit `a2e09fa284a...`, the canary version is:
`0.0.0-pr-33526-sha-a2e09fa2`

You can construct the version yourself if you know the PR number and the latest commit SHA on that PR.

## After publishing

Check the PR body for the published version. It will show something like:

> This pull request has been released as version `0.0.0-pr-33365-sha-b6656566`

Then test with:

```bash
npx storybook@<VERSION_FROM_PR> sandbox
```

Or upgrade a

```bash
npx storybook@<VERSION_FROM_PR> upgrade
```

## Requirements

- You must have admin permissions on the storybookjs/storybook repo
- The PR must exist and be open
- You need `gh` CLI authenticated

## Monitor progress

Watch the workflow run at:
https://github.com/storybookjs/storybook/actions/workflows/publish.yml
