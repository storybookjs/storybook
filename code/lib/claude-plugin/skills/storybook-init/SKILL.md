---
name: storybook-init
description: Use when adding Storybook to a project that does not have Storybook configured yet, especially before enabling Storybook MCP workflows.
---

# Storybook Init

Use this skill when a project does not already have Storybook configured.

## Workflow

1. Inspect the project to understand its framework, package manager, and workspace layout. Prefer the package manager already used by the repo.
2. Run Storybook's official initializer from the project root:

```sh
npm create storybook@latest
```

Use the matching package-manager command when appropriate, such as `pnpm create storybook@latest` or `yarn create storybook`.

3. Prefer the recommended setup unless the user asks for a minimal setup.
4. If auto-detection fails, rerun the initializer with the closest explicit `--type` value.
5. Add the MCP addon:

```sh
npx storybook add @storybook/addon-mcp
```

6. Use `/storybook-setup-claude-launch` to configure `.claude/launch.json` and start Storybook through that launch entry.
7. Note the Storybook invocation directory (where `storybook dev` runs) as `cwd` when using Storybook MCP proxy tools.

## Guardrails

- Do not hand-write a full Storybook config when the official initializer can do it.
- Preserve existing app source and package manager choices.
