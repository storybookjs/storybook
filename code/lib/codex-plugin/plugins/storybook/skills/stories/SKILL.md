---
name: stories
description: Invoke FIRST, before creating, editing, or deleting components, stories, styles, CSS, themes, colors, or design tokens — anything that changes how the UI looks, no exceptions. Also for starting or previewing Storybook to verify UI, requests to show, browse, or list components, stories, or UI states, and docs, props, or usage lookups.
---

Prerequisites:

1. Storybook must be installed in the project. Invoke the `$storybook:init` skill to set up Storybook, but only if the user explicitly invoked this skill and approves a Storybook installation.
2. Storybook must be at least 10.5 (or `next` while 10.5 is not yet released). Invoke the `$storybook:upgrade` skill to upgrade it, but only if the user
   explicitly approved a Storybook upgrade.
3. Ensure `@storybook/addon-mcp` is installed. If it is missing, install it with `npx storybook add @storybook/addon-mcp`.

In sandboxed Codex environments, run every Storybook CLI command with `require_escalated` — sandbox network/port restrictions can otherwise cause confusing failures (e.g. the dev server finds no free port to bind to).

Run the Storybook dev server and every `storybook ai` command from the same working directory: the package where Storybook is installed (in a monorepo often a leaf package such as `packages/ui`).

Run `STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --help` and read the output in its **entirety** to get the **mandatory, ordered workflow** for working on UI changes, writing stories, and keeping stories in sync with every frontend component you create, modify, or delete. This workflow explains how to write stories, preview stories, and display a curated Storybook review.

Before invoking any `storybook ai` command for the first time in a session, run `STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai <command> --help` and read it fully. The top-level help only lists the commands; each command's payload shape and usage rules (which fields to include when) live in its own help output. Never guess a `--json` payload from the command name — a validation error only reports missing required fields, not the optional fields the workflow expects you to provide.

Some commands require a running Storybook dev server:

1. Reuse a dev server that already serves this project's Storybook (probe the URL, usually `http://localhost:6006`) instead of starting a second one. Otherwise start one in the background, using the project's preferred package manager and existing `package.json` Storybook script (e.g. `npm run storybook`) instead of inventing a new command whenever possible. Wait until the URL responds before running commands that need it.
2. The dev server is part of the deliverable, not a temporary verification tool: leave it running when your work is done so the user can keep browsing stories. Never kill it after verification.
3. When the `control-in-app-browser` skill is available, finish by opening the Storybook review or story preview URL you will include in your final response in the in-app browser through that skill, so the user sees the result side by side inside Codex.
