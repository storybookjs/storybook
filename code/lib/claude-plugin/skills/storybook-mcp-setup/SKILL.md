---
name: storybook-mcp-setup
description: Use when setting up Storybook MCP readiness from Claude in an existing Storybook project, including starting Storybook, checking addon readiness, and preparing for proxy-based workflows.
---

# Storybook MCP Setup

Use this skill when the user wants Claude to set up Storybook MCP readiness, preview stories, run story tests, or repair a Storybook setup.

## Workflow

1. Identify the project root and the Storybook invocation directory. The future proxy will use this directory as the required `cwd`.
2. Inspect `package.json` and `.storybook/` to confirm Storybook is already configured.
3. If Storybook is missing, switch to `$storybook-init`.
4. If Storybook is older or the project needs MCP-related repairs, switch to `$storybook-upgrade`.
5. Ensure the MCP addon is installed. If project state shows that the addon is missing, run:

```sh
npx storybook add @storybook/addon-mcp
```

6. Start the project's Storybook dev server using the repo's existing script, usually one of:

```sh
npm run storybook
pnpm storybook
yarn storybook
```

7. When the real proxy is available, pass the exact Storybook invocation directory as `cwd` when using Storybook MCP tools.
8. Until the real proxy implementation exists, use the `@storybook/mcp-proxy` placeholder as a connection smoke test and use Storybook's browser UI or CLI commands for preview and test workflows.

## Notes

- The current `@storybook/mcp-proxy` package is a placeholder that exposes no tools.
- The future proxy will not start Storybook itself. Claude should start Storybook with the user's approval or use a Claude launch config when available.
- The future proxy will use Storybook runtime records under `~/.storybook` to find the matching Storybook `/mcp` endpoint.
