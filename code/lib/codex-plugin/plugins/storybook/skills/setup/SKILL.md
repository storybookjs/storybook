---
name: setup
description: Use this skill when Storybook is already installed and the user wants a working `preview` file and stories for real components.
---

Prerequisites:

1. Confirm Storybook exists (`package.json`, `.storybook/`). If not, switch to `$storybook:init`.
2. Storybook must be at least 10.5 (or `next` while 10.5 is not yet released). If it is older, or upgrade/repair is needed first, switch to `$storybook:upgrade`.

Run `npx storybook ai setup` from the project root (or the Storybook package in a monorepo).

**Follow the printed Markdown precisely.** Do not substitute your own plan.
