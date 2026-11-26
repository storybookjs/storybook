---
name: ui-review
description: Run this skill yourself when the user asks for a review, or to see or be shown components, stories, or their states in Storybook. It creates a Storybook review, a page that shows them rendered, which a list in text does not, with the stories a UI change affects or the components and stories the user asks to see.
---

Prerequisites:

1. Storybook must be installed in the project. Invoke the `$storybook:init` skill to set up Storybook, but only if the user explicitly invoked this skill and approves a Storybook installation.
2. Storybook must be 11.0 or later. An 11.0 prerelease (`11.0.0-alpha.x`, `-beta.x` or `-rc.x`) or a canary build (`0.0.0-pr-*`) also counts. Treat a request to set up or install Storybook as approval to perform any required Storybook upgrade. For other requests, invoke the `$storybook:upgrade` skill only after the user explicitly approves an upgrade.

Run the Storybook dev server and every Storybook CLI command from the same working directory: the package where Storybook is installed (in a monorepo often a leaf package such as `packages/ui`).

Run `npx storybook skills ui-review` in a command of its own, without `head` or `tail`, and follow its output: how to use the running Storybook dev server, and the commands that find the stories to show, of a change or of the components the user names, and create a review of them.

When you create a review, end your final answer with the three lines `review create` prints, unchanged, and mention the review link nowhere else in it.
