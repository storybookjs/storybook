---
name: storybook-upgrade
description: Upgrade Storybook to a specific version (canary or release). Use this when upgrading Storybook packages in a project.
allowed-tools: Bash
---

# Storybook Upgrade

Upgrades all Storybook packages in a project to a specific version.

## Usage

```bash
npx storybook@<VERSION> upgrade
```

## Examples

### Upgrade to canary version

```bash
npx storybook@0.0.0-pr-33526-sha-a2e09fa2 upgrade
```

### Upgrade to latest stable

```bash
npx storybook@latest upgrade
```

### Upgrade to specific release

```bash
npx storybook@8.5.0 upgrade
```

## What it does

1. Detects all `@storybook/*` packages in your project
2. Upgrades them all to the specified version
3. Handles peer dependencies automatically
4. Works with npm, yarn, and pnpm

## Important

- **DO NOT** manually install storybook packages with `npm add` / `yarn add` / `pnpm add`
- Always use `npx storybook@<version> upgrade` to ensure all packages stay in sync
- The upgrade command handles version resolution across all storybook packages
- **ALWAYS upgrade only 1 major version at a time!**
  - Example: 8.x → 9.x → 10.x → canary of 10
  - Never skip major versions (e.g., don't go from 8.x directly to 10.x)

