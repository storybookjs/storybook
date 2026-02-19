# Release Scripts

This directory contains scripts for automating Storybook releases. These scripts power the automated release process via GitHub Actions workflows.

## Overview

The release process has two main types:
1. **Non-patch releases** - Releasing content from `next` branch (prereleases or stable)
2. **Patch releases** - Cherry-picking fixes from `next` to `main` for the current stable minor

## Directory Structure

```
scripts/release/
├── version.ts              # Bump versions across all packages
├── publish.ts              # Build and publish to npm
├── write-changelog.ts      # Generate CHANGELOG.md entries
├── generate-pr-description.ts  # Create release PR descriptions
├── pick-patches.ts         # Cherry-pick patch PRs to main
├── label-patches.ts        # Add "patch:done" label after release
├── is-pr-frozen.ts         # Check if release PR has "freeze" label
├── is-prerelease.ts        # Check if version is a prerelease
├── unreleased-changes-exists.ts  # Check for releasable changes
├── cancel-preparation-runs.ts    # Cancel running prep workflows
├── get-current-version.ts  # Read version from code/package.json
├── get-changelog-from-file.ts    # Extract changelog entries
├── get-version-changelog.ts      # Get changelog for version
├── is-version-published.ts       # Check if version exists on npm
└── utils/
    ├── get-changes.ts      # Extract changes from git history
    ├── get-github-info.ts  # Fetch PR info from GitHub API
    ├── git-client.ts       # Git operations (simple-git)
    └── github-client.ts    # GitHub API clients (GraphQL + REST)
```

## Key Scripts

### `version.ts` - Version Bumping

Bumps versions across all packages in the monorepo.

```bash
cd scripts

# Bump by release type
yarn release:version --release-type <major|minor|patch|prerelease>

# With prerelease identifier
yarn release:version --release-type prerelease --pre-id alpha

# Set exact version
yarn release:version --exact 7.2.0-beta.0

# Deferred bump (writes to deferredNextVersion, doesn't bump yet)
yarn release:version --release-type minor --deferred

# Apply a deferred bump
yarn release:version --apply
```

**What it does:**
1. Reads current version from `code/package.json`
2. Calculates next version using semver
3. Updates `code/package.json` version
4. Updates `code/core/src/manager-api/version.ts`
5. Updates `code/core/src/common/versions.ts`
6. Updates all package.json files in workspaces
7. Runs `yarn install --mode=update-lockfile`

**Deferred mode:** Used in CI to separate version calculation from actual bumping. The preparation workflow sets `deferredNextVersion`, and the publish workflow applies it.

### `publish.ts` - Publishing to npm

Builds and publishes all packages to npm.

```bash
cd scripts

# Publish with tag
yarn release:publish --tag next

# Dry run
yarn release:publish --tag latest --dry-run
```

**What it does:**
1. Checks if version is already published on npm
2. Builds all packages via `yarn task --task=compile --start-from=compile --no-link`
3. Publishes with `yarn workspaces foreach --all --parallel --no-private npm publish --tolerate-republish --tag <tag>`
4. Retries up to 5 times on failure (npm can be flaky)

**Tags:**
- `next` - Prereleases from `next-release` branch
- `latest` - Stable releases from `latest-release` branch
- `canary` - PR-specific canary releases

### `write-changelog.ts` - Changelog Generation

Generates changelog entries based on merged PRs.

```bash
cd scripts

# Write changelog for version
yarn release:write-changelog 7.1.0-alpha.29

# From specific tag
yarn release:write-changelog 7.1.0 --from v7.0.20

# Dry run
yarn release:write-changelog 7.1.0-alpha.29 --dry-run
```

**What it does:**
1. Gets all commits between `from` tag and `HEAD`
2. Fetches PR info from GitHub API
3. Filters by releasable labels (see below)
4. Writes to `CHANGELOG.md` or `CHANGELOG.prerelease.md`
5. Also writes to `docs/versions/latest.json` or `docs/versions/next.json`

### `pick-patches.ts` - Cherry-Picking Patches

Automatically cherry-picks PRs with `patch:yes` label from `next` to `main`.

```bash
cd scripts
yarn release:pick-patches
```

**What it does:**
1. Finds all merged PRs with `patch:yes` label (excluding `patch:done`)
2. Cherry-picks each merge commit with `git cherry-pick -m 1 --keep-redundant-commits -x`
3. On conflict: aborts the pick and records it for manual handling
4. Outputs failed picks for the release PR description

### `label-patches.ts` - Labeling Done Patches

Adds `patch:done` label to PRs that have been cherry-picked.

```bash
cd scripts

# Label patches found in git log
yarn release:label-patches

# Label all unpicked PRs (use carefully)
yarn release:label-patches --all
```

## Labels System

### Releasable Labels
Changes with these labels appear in changelogs and trigger version bumps:
- `BREAKING CHANGE` - ❗ Breaking Change
- `feature request` - ✨ Feature Request
- `bug` - 🐛 Bug
- `maintenance` - 🔧 Maintenance
- `dependencies` - 📦 Dependencies

### Unreleasable Labels
Changes with these labels don't trigger releases:
- `documentation` - 📝 Documentation
- `build` - 🏗️ Build

### Patch Labels
- `patch:yes` - PR should be cherry-picked to `main`
- `patch:done` - PR has been cherry-picked (added automatically)

## GitHub Actions Integration

These scripts are called from three workflows:

### `prepare-non-patch-release.yml`
Triggered on push to `next`. Creates release PR targeting `next-release`.

### `prepare-patch-release.yml`
Triggered on push to `next`. Cherry-picks patches and creates PR targeting `latest-release`.

### `publish.yml`
Triggered on merge to `latest-release` or `next-release`. Publishes and merges back.

## Utility Scripts

### `is-pr-frozen.ts`
Checks if a release PR has the `freeze` label (stops auto-regeneration).

```bash
yarn release:is-pr-frozen          # Check next PR
yarn release:is-pr-frozen --patch  # Check patch PR
```

### `is-prerelease.ts`
Checks if a version is a prerelease.

```bash
yarn release:is-prerelease              # Check current version
yarn release:is-prerelease 7.1.0-alpha.5  # Check specific version
```

### `unreleased-changes-exists.ts`
Checks if there are releasable changes since last release.

```bash
yarn release:unreleased-changes-exists
```

### `cancel-preparation-runs.ts`
Cancels any running preparation workflows (used when starting a new prep).

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GH_TOKEN` | Yes (for GitHub) | GitHub API access |
| `YARN_NPM_AUTH_TOKEN` | Yes (for publish) | npm registry auth |
| `GITHUB_ACTIONS` | Auto | Set by GitHub Actions, enables output setting |

## Utils

### `get-changes.ts`
Core logic for extracting changes from git history:
- Finds commits between tags
- Fetches PR info from GitHub
- Maps commits to PRs
- Generates changelog text

### `git-client.ts`
Configured `simple-git` instance with semver-aware tag sorting:
```typescript
// Ensures prereleases sort before stable
// v7.1.0 > v7.1.0-rc.2 > v7.1.0-rc.1
config: ['versionsort.suffix=-']
```

### `github-client.ts`
Two clients for GitHub API:
- `githubGraphQlClient` - For complex queries (PR info, labels)
- `githubRestClient` - For REST endpoints (workflow runs)

## Common Workflows

### Manual Emergency Release

```bash
git checkout next
git fetch --tags origin
yarn task --task=install --start-from=install
cd scripts

# Version
yarn release:version --release-type prerelease --pre-id alpha

# Changelog
yarn release:write-changelog <VERSION>

git add .
git commit -m "Bump version to <VERSION>"

# Merge to release branch
git checkout next-release
git pull
git merge <branch>
git push

# Publish
YARN_NPM_AUTH_TOKEN=<token> yarn release:publish --tag next
```

### Canary Release (from PR)

Triggered via GitHub Actions UI or CLI:
```bash
gh workflow run --repo storybookjs/storybook publish.yml --field pr=<PR_NUMBER>
```

Version format: `0.0.0-pr-<PR_NUMBER>-sha-<COMMIT_SHA>`

## Branch Strategy

```
next ─────────────────────────────────────────────► (development)
  │
  ├── version-non-patch-from-X ─┐
  │                              │
  └──────────────────────────────┴─► next-release ──► (publish) ──► back to next

main ─────────────────────────────────────────────► (stable)
  │
  ├── version-patch-from-X ─────┐
  │                              │
  └──────────────────────────────┴─► latest-release ─► (publish) ─► back to main
```

## Related Documentation

- [CONTRIBUTING/RELEASING.md](../../CONTRIBUTING/RELEASING.md) - Full release process guide
- [.github/workflows/](../../.github/workflows/) - GitHub Actions workflow files
