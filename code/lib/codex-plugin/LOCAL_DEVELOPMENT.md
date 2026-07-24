# Local Development

## Package layout

This package is intentionally shaped like a Codex plugin while living under `code/lib/` so it can be tested from this repository and later submitted to the official Codex marketplace. Codex does not install plugins from npm directly; it discovers plugin folders through a marketplace catalog. The repository root contains the GitHub-installable marketplace, and this package includes `.agents/plugins/marketplace.json` for package-local development.

```text
code/lib/codex-plugin/
  .agents/plugins/marketplace.json
  plugins/storybook/
    .codex-plugin/plugin.json
    .mcp.json
    skills/
    assets/
```

This matches the layout Codex expects for bundled marketplaces such as `openai-bundled`: the marketplace root contains `.agents/plugins/marketplace.json`, and each plugin lives under `plugins/<name>/`.

## Local Testing

Codex exposes marketplace lifecycle and plugin install commands in the CLI.

Run package scripts from the repository root with `yarn workspace @storybook/codex-plugin run <script>`, or from this package directory with `yarn run <script>`.

Run marketplace validation before pushing changes:

```sh
yarn workspace @storybook/codex-plugin run validate:marketplace
```

This checks the marketplace/plugin layout and that `codex plugin marketplace add` succeeds against a clean `CODEX_HOME`.

Add this package directory as the local Storybook marketplace:

```sh
yarn workspace @storybook/codex-plugin run marketplace:add
```

Or from this directory:

```sh
yarn run marketplace:add
```

Then test the plugin in the Codex app:

1. Restart Codex so it reloads `~/.codex/config.toml`.
2. Open the Codex plugin picker.
3. Select the `Storybook` marketplace.
4. Install the `Storybook` plugin from the Coding section.
5. Use one of the starter prompts, such as `Set up Storybook for Codex`, to verify the plugin metadata and bundled skills are available.

If you edit this package while testing, force a clean reinstall:

```sh
yarn workspace @storybook/codex-plugin run remove
yarn workspace @storybook/codex-plugin run marketplace:add
```

Then reinstall the Storybook plugin in the Codex app and restart Codex. Codex caches plugins under `~/.codex/plugins/cache/` and does not pick up file changes until you reinstall.

The plugin uses CLI-based skills and does not require a running MCP server.

To test from a Git branch, install the repository-level marketplace and pin the
branch:

```sh
codex plugin marketplace add storybookjs/storybook --ref <branch>
codex plugin add storybook@storybook
```

In the Codex **Add marketplace** UI, use the same values:

| Field   | Value                                                               |
| ------- | ------------------------------------------------------------------- |
| Source  | `storybookjs/storybook`                                             |
| Git ref | your branch name, for example `kasper/create-claude-plugin-package` |

Do **not** use `plugins/codex` — that path does not exist in this repository.

For day-to-day development, prefer the local marketplace command instead of the Git UI:

```sh
yarn workspace @storybook/codex-plugin run marketplace:add
```

After installing the plugin, Codex loads it from its plugin cache. If changes do not show up, run `remove` and `marketplace:add`, then reinstall the plugin in Codex.

## Scripts

- `validate:marketplace`: Validate layout and run a clean `CODEX_HOME` marketplace add smoke test.
- `marketplace:add`: Add this package directory as a local Codex marketplace.
- `marketplace:remove`: Remove the configured `storybook` Codex marketplace.
- `remove`: Remove the marketplace, delete `[plugins."storybook@storybook"]` from `~/.codex/config.toml`, and delete `~/.codex/plugins/cache/storybook`.

Use `remove` for a full uninstall without manual config edits.

## MCP Runtime

The plugin's `plugins/storybook/.mcp.json` contains no MCP servers; the plugin's skills invoke the `storybook ai` CLI instead.

## Smoke Test

Use a clean Codex config directory to verify that the marketplace descriptor is loadable without relying on existing local state. Run this from `code/lib/codex-plugin`:

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
