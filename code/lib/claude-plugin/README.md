# Storybook Claude Code Plugin

Build, preview, and test UI components from Claude.

This package installs Storybook-specific skills and configures Claude to start `@storybook/mcp-proxy`.

## Testing from GitHub

Install the Storybook marketplace directly from this repository's `main` branch:

```sh
claude plugin marketplace add storybookjs/mcp@main --scope user
claude plugin install storybook@storybook --scope user
```

Verify the installed plugin:

```sh
claude plugin list --json
claude mcp list
```

The output should include `storybook@storybook` with `"enabled": true`, and
`claude mcp list` should show `plugin:storybook:storybook` using the
`@storybook/mcp-proxy` preview URL from `pkg.pr.new`.

## Local development

This package includes a local Claude marketplace descriptor at `.claude-plugin/marketplace.json`. It points at this same directory so you can register, install, and update the plugin the same way users will once it ships through the official marketplace.

Claude has two lifecycle layers:

- the **marketplace** entry, which tells Claude where to find this plugin catalog
- the installed **plugin**, `storybook@storybook`, which is installed from that marketplace

Run package scripts from the repository root with `pnpm --filter @storybook/claude-code-plugin run <script>`, or from this package directory with `pnpm run <script>`.

Validate the marketplace and plugin manifests:

```sh
pnpm --filter @storybook/claude-code-plugin run validate
```

Run the same validation in vitest before pushing changes (from the repository root):

```sh
pnpm vitest run --project=@storybook/claude-code-plugin
```

The test runs `claude plugin validate` for the marketplace and plugin manifests. It skips when the Claude CLI is not installed. Use `validate` for manual checks or CI, and `plugin:install` below for local install testing.

Install the plugin from this checkout at user scope:

```sh
pnpm --filter @storybook/claude-code-plugin run plugin:install
```

This validates the manifests, adds this package directory as the `storybook` Claude marketplace, and installs `storybook@storybook` at user scope so it is available in every project.

After changing plugin files, refresh the installed plugin from the local marketplace:

```sh
pnpm --filter @storybook/claude-code-plugin run marketplace:update
pnpm --filter @storybook/claude-code-plugin run plugin:update
```

If the installed plugin cache still looks stale, reinstall it:

```sh
pnpm --filter @storybook/claude-code-plugin run remove
pnpm --filter @storybook/claude-code-plugin run plugin:install
```

To fully uninstall Storybook from Claude (plugin, marketplace, and local cache):

```sh
pnpm --filter @storybook/claude-code-plugin run remove
```

Verify the installed plugin:

```sh
pnpm --filter @storybook/claude-code-plugin run plugin:list
```

The output should include `storybook@storybook` with:

- `"scope": "user"`
- `"enabled": true`
- an MCP server named `storybook`

Check that Claude Code picks up the plugin-provided MCP server:

```sh
claude mcp list
```

The output should include:

```text
plugin:storybook:storybook: npx -y https://pkg.pr.new/storybookjs/mcp/@storybook/mcp-proxy@main
```

The important signal for this package is that `plugin:storybook:storybook` appears and can be started from the pkg.pr.new preview URL.

To test in Claude Desktop, restart Claude Desktop after installing or updating the plugin, open a new Code session in any project, and check that the Storybook skills are available from the `+` menu.

## Scripts

- `validate`: Validate this package's marketplace and plugin manifests.
- `marketplace:add`: Add this package directory as the `storybook` marketplace at user scope.
- `marketplace:update`: Update the configured `storybook` marketplace checkout.
- `marketplace:remove`: Remove the configured `storybook` marketplace.
- `plugin:install`: Validate, add the marketplace, and install `storybook@storybook` at user scope.
- `plugin:update`: Update the installed `storybook@storybook` plugin cache.
- `plugin:remove`: Uninstall `storybook@storybook` from user scope.
- `remove`: Uninstall the plugin, remove the marketplace, and delete `~/.claude/plugins/cache/storybook`.
- `plugin:list`: Print installed Claude plugins as JSON.

## Distribution

This package is private during development. The repository root includes
`.claude-plugin/marketplace.json` so testers can install from GitHub with
`claude plugin marketplace add storybookjs/mcp@main`. The local marketplace in
this package is for package-local development and validation. The plugin will
eventually ship through the official Claude plugin marketplace.

The plugin directory must include these files:

- `.claude-plugin/marketplace.json` (package-local testing only)
- `.claude-plugin/plugin.json`
- `.mcp.json`
- `skills/**`
- `README.md`

## MCP server

The plugin's `.mcp.json` starts the latest `@storybook/mcp-proxy` preview from pkg.pr.new:

```sh
npx -y --prefer-online https://pkg.pr.new/storybookjs/mcp/@storybook/mcp-proxy@main
```

The `@main` ref tracks the latest preview build from the `main` branch.

`@storybook/mcp-proxy` is ignored by Changesets in this milestone, so it is not on npm yet. PR previews use pkg.pr.new (`@main` tracks the default branch). When the proxy is ready for npm, remove it from the Changesets ignore list, switch `.mcp.json` to `@storybook/mcp-proxy@latest`, and add a changeset in that publishing PR.

## Included Skills

- `storybook-init`: Add Storybook to a project that does not have it yet.
- `storybook-setup`: Run `storybook ai setup` and follow its output.
- `storybook-setup-claude-launch`: Create or repair `.claude/launch.json` for starting Storybook from Claude.
- `storybook-upgrade`: Upgrade older Storybook projects when repair or version checks require it.
