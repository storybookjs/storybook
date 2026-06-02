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
3. Add or repair a Storybook launch entry that runs the existing Storybook script from the Storybook invocation directory.
4. Keep other launch entries intact.
5. Verify the launch entry by using the Claude launcher or by inspecting the saved launch config.

Use the project's existing Storybook script instead of inventing a new command whenever possible.

Do not start Storybook as an ad hoc Bash command or background task in Claude. The Claude flow should always start Storybook through `.claude/launch.json` and the Claude launcher.

## Claude Launch Config Details

- `autoPort` must be set to `true` to avoid port conflicts.
- Storybook command must have a `--port` flag set with the port used from `autoPort` (for example, `--port $PORT`) to ensure Storybook starts on the expected port.
- Storybook command must use `--ci` arguments to skip prompts and ensure it can run in a non-interactive environment.

## If this skill is invoked when creating stories

If this skill is invoked as part of the story creation flow, start the preview server immediately after repairing the launch config, so that the user can continue with story creation without needing to manually start Storybook.
