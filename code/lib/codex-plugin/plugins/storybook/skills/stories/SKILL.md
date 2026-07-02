---
name: stories
description: Invoke FIRST, before touching any frontend component — every create, edit, or delete, no exceptions. Also for adding or updating stories (*.stories.* files), covering components with stories, starting or previewing Storybook to verify UI, and read-only asks to see, show, browse, or list components, stories, or UI states.
---

Prerequisites:

1. Storybook must be installed in the project. Invoke the `$storybook:init` skill to set up Storybook, but only if the user explicitly invoked this skill and approves a Storybook installation.
2. Storybook must be >= 10.5 (or an alpha/canary version). Invoke the `$storybook:upgrade` skill to upgrade it, but only if the user
   explicitly approved a Storybook upgrade.
3. Ensure `@storybook/addon-mcp` is installed. If it is missing, install it with `npx storybook add @storybook/addon-mcp`.

Run `STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --help` and read the output in its **entirety** to get the **mandatory, ordered workflow** for working on UI changes, writing stories, and keeping stories in sync with every frontend component you create, modify, or delete. This workflow explains how to write stories, preview stories, and display a curated Storybook review.

Before invoking any `storybook ai` command for the first time in a session, run `STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai <command> --help` and read it fully. The top-level help only lists the commands; each command's payload shape and usage rules (which fields to include when) live in its own help output. Never guess a `--json` payload from the command name — a validation error only reports missing required fields, not the optional fields the workflow expects you to provide.
