---
name: stories
description: Invoke BEFORE you touch a frontend component, on EVERY change, with no exception — call this FIRST, before writing, editing, or deleting, so the workflow governs how the change is made. Also use whenever you write, add, update, or review Storybook stories, cover a component or project with stories, create or edit any *.stories.* file, or start or preview Storybook to verify UI.
---

Prerequisites:

1. Storybook must be installed in the project. Invoke the `$storybook:init` skill to set up Storybook, but only if the user explicitly invoked this skill and approves a Storybook installation.
2. Storybook must be >= 10.5 (or an alpha/canary version). Invoke the `$storybook:upgrade` skill to upgrade it, but only if the user
   explicitly approved a Storybook upgrade.
3. Ensure `@storybook/addon-mcp` is installed. If it is missing, install it with `npx storybook add @storybook/addon-mcp`.

Run `STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --help` and read the output in its **entirety** to get the **mandatory, ordered workflow** for working on UI changes, writing stories, and keeping stories in sync with every frontend component you create, modify, or delete. This workflow explains how to write stories, preview stories, and display a curated Storybook review.
