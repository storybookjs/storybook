---
name: storybook-setup
description: Use this skill when Storybook is already installed and the user wants a working `preview` file and stories for real components.
---

Prerequisites:

1. Confirm Storybook exists (`package.json`, `.storybook/`). If not, switch to `/storybook-init`.
2. Storybook must be at least 10.5. If it is older, or upgrade/repair is needed first, switch to `/storybook-upgrade`.

From the project root (or the Storybook package in a monorepo), check the installed Storybook version (`npx storybook --version`) and run the matching command:

- Storybook 10.6.0-alpha.6 and newer: `npx storybook skills get setup`
- Storybook 10.5.x: `npx storybook ai setup`

**Follow the printed Markdown precisely.** Do not substitute your own plan.
