---
name: setup
description: Use this skill when Storybook is already installed and the user wants a working `preview` file and stories for real components.
---

Prerequisites:

1. Confirm Storybook exists (`package.json`, `.storybook/`). If not, switch to `$storybook:init`.
2. Storybook must be 11.0 or later. An 11.0 prerelease (`11.0.0-alpha.x`) or a canary build (`0.0.0-pr-*`) also counts. If it is older, or upgrade/repair is needed first, switch to `$storybook:upgrade`, but only if the user explicitly approved a Storybook upgrade.

Run `npx storybook skills setup` from the project root (or the Storybook package in a monorepo).

**Follow the printed Markdown precisely.** Do not substitute your own plan.
