---
name: stories
description: Invoke FIRST, before creating, editing, or deleting components, stories, styles, CSS, themes, colors, or design tokens — anything that changes how the UI looks, no exceptions. Also for starting or previewing Storybook to verify UI, requests to show, browse, or list components, stories, or UI states, and docs, props, or usage lookups.
---

Prerequisites:

1. Storybook must be installed in the project. Invoke the `/storybook-init` skill to set up Storybook, but only if the user explicitly invoked this skill and approves a Storybook installation.
2. Storybook must be at least 10.6. (While 10.6 is unreleased, `next` satisfies this — 10.6.0-alpha.x. Any canary build, `0.0.0-pr-*`, also qualifies.) Treat a request to set up or install Storybook as approval to perform any required Storybook upgrade. For other requests, invoke the `/storybook-upgrade` skill only after the user explicitly approves an upgrade.
3. Ensure `@storybook/addon-mcp` is installed. If it is missing, install it with `npx storybook add @storybook/addon-mcp`.

Run the Storybook dev server and every Storybook CLI command from the same working directory: the package where Storybook is installed (in a monorepo often a leaf package such as `packages/ui`).

For docs, props, or usage questions, use `npx storybook tools docs list` followed by `npx storybook tools docs show` before inspecting source files. Fall back to source inspection only when the documentation commands are unavailable or return no relevant documentation.

Run `npx storybook skills stories` and read the output in its **entirety** to get the **mandatory, ordered workflow** for working on UI changes, writing stories, and keeping stories in sync with every frontend component you create, modify, or delete. This workflow explains how to write stories, preview stories, and display a curated Storybook review.

Before invoking any `npx storybook tools` command for the first time in a session, run it with `--help` appended and read the output fully. The workflow only names the commands; each command's argument shape and usage rules (which fields to include when) live in its own help output. Never guess a command's arguments from its name — a validation error only reports missing required fields, not the optional fields the workflow expects you to provide.

Some commands require a running Storybook dev server. When Claude preview tooling is available, start the dev server through that tooling:

1. Ensure there is a Storybook launch entry in `.claude/launch.json` (the `preview_start` tool description documents the file format) with `autoPort: true` and `port: 6006`. Use the project's preferred package manager and existing `package.json` Storybook script instead of inventing a new command whenever possible.
2. Start the Storybook launch entry with the `preview_start` tool.
