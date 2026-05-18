---
name: storybook-mcp-setup
description: Use when setting up or using Storybook MCP from Claude Code in an existing Storybook project, including starting Storybook, checking MCP readiness, and following proxy repair instructions.
---

# Storybook MCP Setup

Use this skill when the user wants Claude Code to use Storybook MCP, preview stories, run story tests, or repair a Storybook MCP connection.

## Workflow

1. Identify the project root and the Storybook invocation directory. This directory is the `cwd` that must be passed to Storybook MCP proxy tools.
2. Inspect `package.json` and `.storybook/` to confirm Storybook is already configured.
3. If Storybook is missing, switch to `$storybook-init`.
4. If Storybook is older or the proxy reports an upgrade problem, switch to `$storybook-upgrade`.
5. Ensure the MCP addon is installed. If the proxy or project state reports that the addon is missing, run:

```sh
npx storybook add @storybook/addon-mcp
```

6. Start the project's Storybook dev server using the repo's existing script, usually one of:

```sh
npm run storybook
pnpm storybook
yarn storybook
```

7. When using Storybook MCP tools, pass the exact Storybook invocation directory as `cwd`.
8. If the proxy returns repair instructions, follow them before retrying the same tool.

## Notes

- The proxy never starts Storybook itself. Claude should start Storybook with the user's approval or use a Claude launch config when available.
- Storybook writes runtime instance records under `~/.storybook`; the proxy uses those records to find the matching Storybook `/mcp` endpoint.
- Prefer Storybook's real MCP tools over ad hoc filesystem guesses when discovering story IDs, component props, docs, previews, or test results.
