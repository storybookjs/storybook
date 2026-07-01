---
name: storybook-setup-claude-launch
description: >-
  Create or repair the .claude/launch.json so Claude can start the project's
  Storybook dev server. Use when the user asks to set up or repair launch
  config, detect dev servers, create or update .claude/launch.json, or start
  Storybook through the Claude launcher — or when repair instructions mention
  a missing launch entry.
---

# Storybook Setup — Claude Launch

Use this skill when Storybook is configured but Claude needs a `.claude/launch.json` entry to start the dev server (for example when repair instructions mention missing launch config).

## Workflow

1. Inspect the project's Storybook scripts and preferred package manager.
2. Inspect any existing `.claude/launch.json`.
3. Add or repair a Storybook launch entry with `autoPort: true` that runs the existing Storybook script from the Storybook invocation directory.
4. Keep other launch entries intact.
5. Verify the launch entry by using the Claude launcher or by inspecting the saved launch config.

Use the project's existing Storybook script instead of inventing a new command whenever possible.

NEVER start Storybook with a Bash command or background task — not `npm run storybook`, not `storybook dev`, not `run_in_background`, not a detached process. "Start the preview" always means invoking the **Claude launcher** on the `.claude/launch.json` Storybook entry. A backgrounded dev server is not a launcher-managed preview and will not satisfy the story workflow.

## If this skill is invoked when creating stories

If this skill is invoked as part of the story creation flow, start the preview immediately after repairing the launch config — by launching the `.claude/launch.json` Storybook entry through the Claude launcher — so the user can continue with story creation without manually starting Storybook.
