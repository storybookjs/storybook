# Storybook Codex Plugin

Private workspace package for the Storybook Codex plugin. It bundles Storybook setup, init, and upgrade skills with MCP configuration for UI component workflows.

This package is intentionally shaped like a Codex plugin while living under `packages/` so it can be tested from this repository and later submitted to the official Codex marketplace. Codex does not install plugins from npm directly; it discovers plugin folders through a marketplace catalog. For local development, this package includes `.agents/plugins/marketplace.json`, which points at `plugins/storybook/`.

## Package layout

```text
packages/codex-plugin/
  .agents/plugins/marketplace.json
  plugins/storybook/
    .codex-plugin/plugin.json
    .mcp.json
    skills/
    assets/
```

This matches the layout Codex expects for bundled marketplaces such as `openai-bundled`: the marketplace root contains `.agents/plugins/marketplace.json`, and each plugin lives under `plugins/<name>/`.

## Local Testing

Codex exposes marketplace lifecycle commands in the CLI. Installing the plugin itself happens in the Codex app after the marketplace is registered.

Run package scripts from the repository root with `pnpm --filter @storybook/codex-plugin run <script>`, or from this package directory with `pnpm run <script>`.

Run marketplace validation before pushing changes:

```sh
pnpm --filter @storybook/codex-plugin validate:marketplace
```

This checks the marketplace/plugin layout and that `codex plugin marketplace add` succeeds against a clean `CODEX_HOME`.

Add this package directory as the local Storybook marketplace:

```sh
pnpm --filter @storybook/codex-plugin run marketplace:add
```

Or from this directory:

```sh
pnpm run marketplace:add
```

Then test the plugin in the Codex app:

1. Restart Codex so it reloads `~/.codex/config.toml`.
2. Open the Codex plugin picker.
3. Select the `Storybook` marketplace.
4. Install the `Storybook` plugin from the Coding section.
5. Use one of the starter prompts, such as `Set up Storybook for Codex`, to verify the plugin metadata and bundled skills are available.

If you edit this package while testing, force a clean reinstall:

```sh
pnpm --filter @storybook/codex-plugin run remove
pnpm --filter @storybook/codex-plugin run marketplace:add
```

Then reinstall the Storybook plugin in the Codex app and restart Codex. Codex caches plugins under `~/.codex/plugins/cache/` and does not pick up file changes until you reinstall.

The plugin points at the latest `@storybook/mcp-proxy` preview from pkg.pr.new.

To test from a Git branch while the plugin still lives under `packages/`, sparse-checkout this package directory:

```sh
codex plugin marketplace add storybookjs/mcp --ref <branch> --sparse packages/codex-plugin
```

In the Codex **Add marketplace** UI, use the same values:

| Field        | Value                                                               |
| ------------ | ------------------------------------------------------------------- |
| Source       | `storybookjs/mcp`                                                   |
| Git ref      | your branch name, for example `kasper/create-claude-plugin-package` |
| Sparse paths | `packages/codex-plugin`                                             |

Do **not** use `plugins/codex` — that path does not exist in this repository.

For day-to-day development, prefer the local marketplace command instead of the Git UI:

```sh
pnpm --filter @storybook/codex-plugin run marketplace:add
```

After installing the plugin, Codex loads it from its plugin cache. If changes do not show up, run `remove` and `marketplace:add`, then reinstall the plugin in Codex.

## Scripts

- `validate:marketplace`: Validate layout and run a clean `CODEX_HOME` marketplace add smoke test.
- `marketplace:add`: Add this package directory as a Codex marketplace.
- `marketplace:remove`: Remove the configured `storybook` Codex marketplace.
- `remove`: Remove the marketplace, delete `[plugins."storybook@storybook"]` from `~/.codex/config.toml`, and delete `~/.codex/plugins/cache/storybook`.

Codex does not expose CLI commands for plugin install or update. Use the Codex app plugin picker to install after `marketplace:add`. Use `remove` for a full uninstall without manual config edits.

## MCP Runtime

The plugin's `plugins/storybook/.mcp.json` configures Codex to run the latest `@storybook/mcp-proxy` preview from pkg.pr.new:

```sh
npx -y https://pkg.pr.new/storybookjs/mcp/@storybook/mcp-proxy@main
```

The `@main` ref tracks the latest preview build from the `main` branch.

`@storybook/mcp-proxy` is ignored by Changesets in this milestone, so it is not on npm yet. PR previews use pkg.pr.new (`@main` tracks the default branch). When the proxy is ready for npm, remove it from the Changesets ignore list, switch `plugins/storybook/.mcp.json` to `@storybook/mcp-proxy@latest`, and add a changeset in that publishing PR.

## Smoke Test

Use a clean Codex config directory to verify that the marketplace descriptor is loadable without relying on existing local state. Run this from `packages/codex-plugin`:

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

The config should include a `[marketplaces.storybook]` entry whose `source` points at this package directory. After restarting Codex with your normal config and installing the plugin from the `Storybook` marketplace, the plugin card should show `Build, preview, and test UI components` and the plugin details should include the `storybook` MCP server from `plugins/storybook/.mcp.json`.

## Included Skills

- `init`: Add Storybook to a project that does not have it yet.
- `setup`: Run `storybook ai setup` and follow its output.
- `upgrade`: Upgrade older Storybook projects when repair or version checks require it.
