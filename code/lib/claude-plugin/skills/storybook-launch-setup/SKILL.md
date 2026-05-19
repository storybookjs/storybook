---
name: storybook-launch-setup
description: Create or repair Claude launch configuration for starting a project's Storybook preview.
---

# Storybook Launch Setup

Use this skill when the user wants Claude Desktop or Claude Code launch entries to start the project's Storybook preview.

## Workflow

1. Inspect the project's Storybook scripts and preferred package manager.
2. Inspect any existing `.claude/launch.json`.
3. Add or repair a Storybook launch entry that runs the existing Storybook script from the project root.
4. Keep existing launch entries intact.
5. Verify the launch command manually or by running the equivalent shell command.

Use the project's existing Storybook script instead of inventing a new command whenever possible.
