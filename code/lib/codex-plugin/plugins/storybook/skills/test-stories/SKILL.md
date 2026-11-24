---
name: test-stories
description: Run the Storybook story tests of a project, with their accessibility checks.
---

Prerequisites:

1. Storybook must be installed in the project. Invoke the `$storybook:init` skill to set up Storybook, but only if the user explicitly invoked this skill and approves a Storybook installation.
2. Storybook must be 11.0 or later. An 11.0 prerelease (`11.0.0-alpha.x`, `-beta.x` or `-rc.x`) or a canary build (`0.0.0-pr-*`) also counts. Treat a request to set up or install Storybook as approval to perform any required Storybook upgrade. For other requests, invoke the `$storybook:upgrade` skill only after the user explicitly approves an upgrade.

Run every Storybook CLI command from the package where Storybook is installed (in a monorepo often a leaf package such as `packages/ui`).

`npx storybook tools test run` opens a local port for the browser that runs the tests. If the sandbox blocks ports, request escalated permissions for that command on the first attempt; the other Storybook CLI commands run inside the sandbox.

Run `npx storybook skills test-stories` in a command of its own, without `head` or `tail`, and read its output: how to use the command that runs the story tests of this project.
