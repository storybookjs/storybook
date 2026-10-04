---
name: storybook-setup
description: Use this skill when Storybook is already installed and the user wants a working `preview` file and stories for real components.
---

Prerequisites:

1. Confirm Storybook exists (`package.json`, `.storybook/`). If not, switch to `/storybook-init`.
2. Storybook must be at least 11.0. (While 11.0 is unreleased, this means the latest 11.0 alpha release, published as `storybook@next`. Any canary build, `0.0.0-pr-*`, also qualifies.) If it is older, or upgrade/repair is needed first, switch to `/storybook-upgrade`, but only if the user explicitly approved a Storybook upgrade.

Run `npx storybook skills setup` from the project root (or the Storybook package in a monorepo).

**Follow the printed Markdown precisely.** Do not substitute your own plan.
