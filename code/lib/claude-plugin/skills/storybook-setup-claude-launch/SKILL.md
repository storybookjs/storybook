---
name: storybook-setup-claude-launch
description: Create or repair Claude launch configuration so Claude can start the project's Storybook preview.
---

# Storybook Setup — Claude Launch

Use this skill when Storybook is configured but Claude needs a `.claude/launch.json` entry to start the dev server (for example when repair instructions mention missing launch config).

## Workflow

1. Inspect the project's Storybook scripts and preferred package manager.
2. Inspect any existing `.claude/launch.json`.
3. Add or repair a Storybook launch entry that runs the existing Storybook script from the Storybook invocation directory.
4. Keep other launch entries intact.
5. Verify the launch command manually or by running the equivalent shell command.

Use the project's existing Storybook script instead of inventing a new command whenever possible.
