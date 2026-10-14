---
name: component-docs
description: Look up the components of a project with Storybook, with their props and usage examples, to reuse them instead of building duplicates or to answer questions about them. Use when the project's agent instructions (such as AGENTS.md) or the user ask for it. For a UI change, use ui-workflow, which includes the same component lookup.
---

Prerequisites:

1. Storybook must be installed in the project. If it is not, read the components' source files instead.
2. Storybook must be 11.0 or later. An 11.0 prerelease (`11.0.0-alpha.x`) or a canary build (`0.0.0-pr-*`) also counts. If it is older, invoke the `/storybook-upgrade` skill only after the user explicitly approves an upgrade; until then, read the components' source files instead.

Run every Storybook CLI command from the package where Storybook is installed (in a monorepo often a leaf package such as `packages/ui`).

If the sandbox blocks network access, request escalated permissions for Storybook CLI commands.

Run `npx storybook skills component-docs` and follow its output: it lists the commands that show this project's components, props, and usage examples, and when to use them.
