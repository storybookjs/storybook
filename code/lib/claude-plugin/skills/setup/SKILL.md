---
name: setup
description: Set up or repair Storybook MCP for Claude Code in the current project. Use when the user wants to connect Claude Code to Storybook, install Storybook MCP, or verify the integration.
---

# Storybook MCP Setup

Use this skill to set up or repair Storybook MCP in the current project.

## Workflow

1. Inspect the project before changing files.
   - Check the package manager from the lockfile.
   - Check whether Storybook is already installed.
   - Check `.storybook/main.*` for existing addons.
   - Check whether `@storybook/addon-mcp` is already installed.
2. If Storybook is missing, use the `storybook:init` skill instead of continuing here.
3. If `@storybook/addon-mcp` is missing, install it with the detected package manager and add it to the Storybook addons array.
4. Start or ask the user to start Storybook with the project's existing Storybook script.
5. Verify that Storybook exposes MCP at its local `/mcp` endpoint.
6. If Claude Code cannot reach Storybook, check the `@storybook/mcp-proxy` output and repair the project setup it reports.

Prefer the project's existing scripts and Storybook config style. Keep edits focused on installing and configuring `@storybook/addon-mcp`.
