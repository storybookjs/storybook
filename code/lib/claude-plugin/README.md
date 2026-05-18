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

## Local marketplace testing

The repository includes a Claude marketplace descriptor at `.claude-plugin/marketplace.json`.

```sh
claude plugin validate .
claude plugin marketplace add .
claude plugin install storybook@storybook
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
npx -y @storybook/mcp-proxy
```

`@storybook/mcp-proxy` must be published before marketplace installs can use the default MCP configuration successfully.
