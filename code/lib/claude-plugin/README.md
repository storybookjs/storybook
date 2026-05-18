# Storybook Claude Code Plugin

Build, preview, and test UI components from Claude Code.

This package installs Storybook-specific skills and configures Claude Code to start the Storybook MCP proxy. The proxy discovers running Storybook projects and connects Claude Code to the MCP server exposed by `@storybook/addon-mcp`.

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

The repository includes a Claude marketplace descriptor at `.claude-plugin/marketplace.json`.

Install the plugin from this checkout at user scope:

```sh
pnpm claude-plugin:install
```

This validates the marketplace and plugin manifests, adds this repository as the `storybook` Claude marketplace, and installs `storybook@storybook` at user scope so it is available in every project.

Verify the installed plugin:

```sh
pnpm claude-plugin:list
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

Until `@storybook/mcp-proxy` is published, this server is expected to fail to connect. The important signal for this package is that `plugin:storybook:storybook` appears in the MCP list.

To test in Claude Desktop, restart Claude Desktop after installing the plugin, open a new Code session in any project, and check that the Storybook skills are available from the `+` menu.

After changing plugin files, update the installed plugin cache:

```sh
pnpm claude-plugin:update
```

Remove the user-scoped plugin after testing:

```sh
claude plugin uninstall storybook@storybook --scope user
```

## Distribution

This package is private and is distributed through the repository's Claude marketplace entry. The marketplace points directly at this package directory.

The plugin directory must include these files:

- `.claude-plugin/plugin.json`
- `.mcp.json`
- `skills/**`
- `README.md`

## MCP server

The plugin's `.mcp.json` starts:

```sh
npx -y @storybook/mcp-proxy@latest
```

`@storybook/mcp-proxy` must be published before marketplace installs can use the default MCP configuration successfully.

## Included Skills

- `storybook-mcp-setup`: Set up and use Storybook MCP in an existing project.
- `storybook-init`: Add Storybook to a project that does not have it yet.
- `storybook-upgrade`: Upgrade older Storybook projects and repair MCP readiness issues.
- `storybook-launch-setup`: Create or repair Claude launch configuration for starting Storybook.
