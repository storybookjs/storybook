# Storybook Codex Plugin

Private workspace package for the Storybook Codex plugin. It bundles Storybook setup, init, and upgrade skills with MCP configuration for UI component workflows.

This package is intentionally shaped like a Codex plugin while living under `packages/` so it can be tested from this repository and later referenced as a Git subdirectory. Codex does not install plugins from npm directly; it discovers plugin folders through a marketplace catalog. The repo-local marketplace at `../../.agents/plugins/marketplace.json` points at this package.

## Local Testing

Run the local marketplace script from the repository root:

```sh
pnpm codex-plugin:marketplace:add
```

Then test the plugin in the Codex app:

1. Restart Codex so it reloads `~/.codex/config.toml`.
2. Open the Codex plugin picker.
3. Select the `Storybook` marketplace.
4. Install the `Storybook` plugin from the Coding section.
5. Use one of the starter prompts, such as `Set up Storybook for Codex`, to verify the plugin metadata and bundled skills are available.

If you edit this package while testing, refresh the local marketplace by removing and adding it again:

```sh
pnpm codex-plugin:marketplace:remove
pnpm codex-plugin:marketplace:add
```

The plugin points at `npx -y @storybook/mcp-proxy@latest`. In this milestone, that package is a minimal placeholder MCP server that responds to initialization and returns an empty tool list. This lets plugin installation, metadata, icon, MCP server configuration, and skills be tested before the real proxy implementation exists.

To test from a Git branch while the plugin still lives under `packages/`, add the repo as a Git marketplace and sparse-checkout both the marketplace catalog and plugin package:

```sh
codex plugin marketplace add storybookjs/mcp --ref <branch> --sparse .agents/plugins --sparse packages/codex-plugin
```

To remove the local marketplace after testing, run:

```sh
pnpm codex-plugin:marketplace:remove
```

After installing the plugin, Codex loads it from its plugin cache. If changes do not show up, restart Codex and reinstall or refresh the plugin so the cache picks up the new contents.

## MCP Runtime

The plugin's `.mcp.json` configures Codex to run:

```sh
npx -y @storybook/mcp-proxy@latest
```

The package currently exposes no Storybook tools. Milestone 2 of storybookjs/storybook#34826 will replace the placeholder internals with the real proxy, which will expose the stable Storybook MCP server for agentic development environments.

Before `@storybook/mcp-proxy` is published to npm, use the pkg.pr.new URL from the `Publish preview` workflow if you want to test the MCP runtime from this PR:

```sh
npx -y --package https://pkg.pr.new/storybookjs/mcp/@storybook/mcp-proxy@<preview-id> storybook-mcp-proxy
```

## Smoke Test

Use a clean Codex config directory to verify that the marketplace descriptor is loadable without relying on existing local state:

```sh
CODEX_HOME=$(mktemp -d)
CODEX_HOME="$CODEX_HOME" codex plugin marketplace add "$(pwd)"
```

The command should report:

```text
Added marketplace `storybook`
```

Then inspect the clean config:

```sh
cat "$CODEX_HOME/config.toml"
```

The config should include a `[marketplaces.storybook]` entry whose `source` points at this repository. After restarting Codex with your normal config and installing the plugin from the `Storybook` marketplace, the plugin card should show `Build, preview, and test UI components` and the plugin details should include the `storybook` MCP server from `.mcp.json`.

## Included Skills

- `storybook-mcp-setup`: Set up Storybook MCP readiness in an existing project.
- `storybook-init`: Add Storybook to a project that does not have it yet.
- `storybook-upgrade`: Upgrade older Storybook projects and repair MCP readiness issues.
