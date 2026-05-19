# Storybook Codex Plugin

Private workspace package for the Storybook Codex plugin. It bundles Storybook MCP configuration with setup, init, and upgrade skills for UI component workflows.

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

The plugin currently points at `npx -y @storybook/mcp-proxy@latest`. Until that package is published, plugin installation, metadata, icon, MCP server configuration, and skills can be tested in Codex, but the MCP runtime will not fully connect.

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

The proxy package is expected to expose the stable Storybook MCP server for agentic development environments. It should discover running Storybook instances and proxy the seven Storybook MCP tools to the matching local `/mcp` endpoint.

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

- `storybook-mcp-setup`: Set up and use Storybook MCP in an existing project.
- `storybook-init`: Add Storybook to a project that does not have it yet.
- `storybook-upgrade`: Upgrade older Storybook projects and repair MCP readiness issues.
