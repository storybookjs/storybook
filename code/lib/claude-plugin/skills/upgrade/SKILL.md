---
name: upgrade
description: Upgrade or repair an existing Storybook MCP installation.
---

# Storybook MCP Upgrade

Use this skill when the project already has Storybook MCP, but the user wants to update it or fix a stale integration.

## Workflow

1. Inspect installed Storybook packages and versions.
2. Inspect `@storybook/addon-mcp` and related Storybook addon versions.
3. Update packages with the project's package manager, keeping Storybook package versions aligned.
4. Check `.storybook/main.*` for obsolete or duplicate MCP addon entries.
5. Start Storybook and verify the local `/mcp` endpoint.
6. Run the most relevant project tests or Storybook checks available.

Avoid unrelated Storybook migrations unless they are required for the MCP integration to work.
