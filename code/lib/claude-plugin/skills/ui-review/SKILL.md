---
name: ui-review
description: Publish a Storybook review that shows the user the stories a UI change affects, or the components and stories they ask to see.
---

Prerequisites:

1. Storybook must be installed in the project. Invoke the `/storybook-init` skill to set up Storybook, but only if the user explicitly invoked this skill and approves a Storybook installation.
2. Storybook must be 11.0 or later. An 11.0 prerelease (`11.0.0-alpha.x`, `-beta.x` or `-rc.x`) or a canary build (`0.0.0-pr-*`) also counts. Treat a request to set up or install Storybook as approval to perform any required Storybook upgrade. For other requests, invoke the `/storybook-upgrade` skill only after the user explicitly approves an upgrade.

Run the Storybook dev server and every Storybook CLI command from the same working directory: the package where Storybook is installed (in a monorepo often a leaf package such as `packages/ui`).

If the sandbox blocks network access or ports, request escalated permissions for Storybook CLI commands; otherwise the dev server can fail in confusing ways (for example, it finds no free port to bind to).

Run `npx storybook skills ui-review` in a command of its own, without `head` or `tail`, and follow its output: how to use the running Storybook dev server, and the commands that find the stories your change affects and publish a review of them.

When you publish a review, end your final answer with the three lines `review create` prints, unchanged, and mention the review link nowhere else in it.
