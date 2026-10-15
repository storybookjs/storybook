---
name: ui-workflow
description: Storybook's workflow for UI changes in a project with Storybook - look up the components to reuse, write and update stories, run story tests, and publish a review of the result. Also shows existing components or stories in a review. Use when the project's agent instructions (such as AGENTS.md) or the user ask for it.
---

Prerequisites:

1. Storybook must be installed in the project. Invoke the `/storybook-init` skill to set up Storybook, but only if the user explicitly invoked this skill and approves a Storybook installation.
2. Storybook must be 11.0 or later. An 11.0 prerelease (`11.0.0-alpha.x`) or a canary build (`0.0.0-pr-*`) also counts. Treat a request to set up or install Storybook as approval to perform any required Storybook upgrade. For other requests, invoke the `/storybook-upgrade` skill only after the user explicitly approves an upgrade.

Run the Storybook dev server and every Storybook CLI command from the same working directory: the package where Storybook is installed (in a monorepo often a leaf package such as `packages/ui`).

If the sandbox blocks network access or ports, request escalated permissions for Storybook CLI commands; otherwise the dev server can fail in confusing ways (for example, it finds no free port to bind to).

Run `npx storybook skills ui-workflow` and read the output in its **entirety** to get the **mandatory, ordered workflow** for working on UI changes, writing stories, and keeping stories in sync with every frontend component you create, modify, or delete. This workflow explains how to write stories, preview stories, and display a curated Storybook review.

Some commands require a running Storybook dev server:

1. Probe the URL (usually `http://localhost:6006`) in a command of its own. If it serves this project's Storybook, reuse that dev server and never start a second one. Otherwise start one in the background with the project's preferred package manager and existing `package.json` Storybook script (e.g. `npm run storybook`), without adding flags, and wait until the URL responds before running commands that need it.
2. The dev server is part of the deliverable, not a temporary verification tool: leave it running when your work is done so the user can keep browsing stories. Never kill it after verification.
