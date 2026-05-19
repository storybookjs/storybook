# Storybook Claude Code Plugin

Build, preview, and test UI components from Claude.

This package installs Storybook-specific skills and configures Claude to start `@storybook/mcp-proxy`. In this milestone, that package is a minimal placeholder MCP server so Claude can discover and start the plugin-provided MCP entry before the real proxy implementation lands.

## Local development

Load this plugin from the monorepo while developing it:

```sh
claude --plugin-dir packages/claude-plugin
```

After editing plugin files in a running Claude Code session, reload plugins:

```text
/reload-plugins
```

## Testing

This package includes a local Claude marketplace descriptor at `.claude-plugin/marketplace.json` for development. It points at this same directory so you can register and install the plugin without repo-root marketplace files.

Claude has two lifecycle layers:

- the **marketplace** entry, which tells Claude where to find this plugin catalog
- the installed **plugin**, `storybook@storybook`, which is installed from that marketplace

Run package scripts from the repository root with `pnpm --filter @storybook/claude-code-plugin run <script>`, or from this package directory with `pnpm run <script>`.

Validate the marketplace and plugin manifests:

```sh
pnpm --filter @storybook/claude-code-plugin run validate
```

Install the plugin from this checkout at user scope:

```sh
pnpm --filter @storybook/claude-code-plugin run plugin:install
```

This validates the manifests, adds this package directory as the `storybook` Claude marketplace, and installs `storybook@storybook` at user scope so it is available in every project.

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
plugin:storybook:storybook: npx -y @storybook/mcp-proxy@latest
```

The current `@storybook/mcp-proxy` implementation responds to MCP initialization and returns an empty tool list. The important signal for this package is that `plugin:storybook:storybook` appears and can be started once the package is available from npm or a pkg.pr.new preview URL.

To test in Claude Desktop, restart Claude Desktop after installing the plugin, open a new Code session in any project, and check that the Storybook skills are available from the `+` menu.

After changing plugin files, update the installed plugin cache:

```sh
pnpm --filter @storybook/claude-code-plugin run plugin:update
```

Remove the user-scoped plugin after testing:

```sh
pnpm --filter @storybook/claude-code-plugin run plugin:remove
```

If you only need to refresh the marketplace checkout without changing the installed plugin, use:

```sh
pnpm --filter @storybook/claude-code-plugin run marketplace:update
```

To remove the marketplace entry itself, run:

```sh
pnpm --filter @storybook/claude-code-plugin run marketplace:remove
```

## Scripts

- `validate`: Validate this package's marketplace and plugin manifests.
- `marketplace:add`: Add this package directory as the `storybook` marketplace at user scope.
- `marketplace:update`: Update the configured `storybook` marketplace checkout.
- `marketplace:remove`: Remove the configured `storybook` marketplace.
- `plugin:install`: Validate, add the marketplace, and install `storybook@storybook` at user scope.
- `plugin:update`: Update the installed `storybook@storybook` plugin cache.
- `plugin:remove`: Uninstall `storybook@storybook` from user scope.
- `plugin:list`: Print installed Claude plugins as JSON.

## Distribution

This package is private during development. The local marketplace in `.claude-plugin/marketplace.json` is for testing only; the plugin will eventually ship through the official Claude plugin marketplace.

The plugin directory must include these files:

- `.claude-plugin/marketplace.json` (local testing only)
- `.claude-plugin/plugin.json`
- `.mcp.json`
- `skills/**`
- `README.md`

## MCP server

The plugin's `.mcp.json` starts:

```sh
npx -y @storybook/mcp-proxy@latest
```

The package currently exposes no Storybook tools. Milestone 2 of storybookjs/storybook#34826 will replace the placeholder internals with the real proxy, which will discover running Storybook instances and proxy the seven Storybook MCP tools.

Before `@storybook/mcp-proxy` is published to npm, use the pkg.pr.new URL from the `Publish preview` workflow if you want to test the MCP runtime from this PR:

```sh
npx -y --package https://pkg.pr.new/storybookjs/mcp/@storybook/mcp-proxy@<preview-id> storybook-mcp-proxy
```

## Included Skills

- `storybook-mcp-setup`: Set up Storybook MCP readiness in an existing project.
- `storybook-init`: Add Storybook to a project that does not have it yet.
- `storybook-upgrade`: Upgrade older Storybook projects and repair MCP readiness issues.
- `storybook-launch-setup`: Create or repair Claude preview launch configuration for starting Storybook.
