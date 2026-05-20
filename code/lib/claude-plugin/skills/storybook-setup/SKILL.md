---
name: storybook-setup
description: Use when configuring Storybook preview and writing example stories from real components in an existing React+Vite Storybook project.
---

# Storybook Setup

Use this skill when Storybook is already installed and the user wants a working `preview` file and colocated stories for real components.

## Prerequisites

1. Confirm Storybook exists (`package.json`, `.storybook/`). If not, switch to `/storybook-init`.
2. If Storybook is outdated or upgrade/repair is needed first, switch to `/storybook-upgrade`.

## Run the CLI

From the project root (or the Storybook package in a monorepo):

```sh
npx storybook ai setup
```

Use the repo's package manager when appropriate: `pnpm exec storybook ai setup`, `yarn exec storybook ai setup`.

**Follow the printed Markdown precisely.** Do not substitute your own plan.
