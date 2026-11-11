---
name: write-stories
description: The rules for writing Storybook stories in a project. They cover which states get a story, the imports, play functions, and mocks for network requests and modules.
---

Prerequisites:

1. Storybook must be installed in the project. Invoke the `/storybook-init` skill to set up Storybook, but only if the user explicitly invoked this skill and approves a Storybook installation.
2. Storybook must be 11.0 or later. An 11.0 prerelease (`11.0.0-alpha.x`, `-beta.x` or `-rc.x`) or a canary build (`0.0.0-pr-*`) also counts. Treat a request to set up or install Storybook as approval to perform any required Storybook upgrade. For other requests, invoke the `/storybook-upgrade` skill only after the user explicitly approves an upgrade.

Run every Storybook CLI command from the package where Storybook is installed (in a monorepo often a leaf package such as `packages/ui`).

If the sandbox blocks network access, request escalated permissions for Storybook CLI commands.

Run `npx storybook skills write-stories` in a command of its own, without `head` or `tail`, before you write a component or a story, and follow its output: the rules for the stories of this project, with its imports, `play` functions, and mocks.
