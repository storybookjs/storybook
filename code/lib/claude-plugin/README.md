# Storybook Claude Code Plugin

Build, preview, and test UI components from Claude.

This package installs Storybook-specific skills and configures Claude to start `@storybook/mcp-proxy`. In this milestone, that package is a minimal placeholder MCP server so Claude can discover and start the plugin-provided MCP entry before the real proxy implementation lands.

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

Run the local plugin contract test before pushing changes:

```sh
pnpm --filter @storybook/claude-code-plugin test:run
```

This checks the marketplace/plugin files and that `.mcp.json` points at a pkg.pr.new preview for `@storybook/mcp-proxy`. For Claude manifest validation and install testing, use `validate` and `plugin:install`.

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
pnpm --filter @storybook/claude-code-plugin run plugin:remove
pnpm --filter @storybook/claude-code-plugin run plugin:install
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
plugin:storybook:storybook: npx -y https://pkg.pr.new/storybookjs/mcp/@storybook/mcp-proxy@227
```

The current `@storybook/mcp-proxy` preview responds to MCP initialization and returns an empty tool list. The important signal for this package is that `plugin:storybook:storybook` appears and can be started from the pkg.pr.new preview URL.

To test in Claude Desktop, restart Claude Desktop after installing or updating the plugin, open a new Code session in any project, and check that the Storybook skills are available from the `+` menu.

Remove the user-scoped plugin after testing:

```sh
pnpm --filter @storybook/claude-code-plugin run plugin:remove
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

The plugin's `.mcp.json` starts the latest `@storybook/mcp-proxy` preview from pkg.pr.new:

```sh
npx -y https://pkg.pr.new/storybookjs/mcp/@storybook/mcp-proxy@227
```

The `@227` ref tracks the newest preview build for this PR.

> **TODO:** After this PR merges to `main`, switch `.mcp.json` to  
> `https://pkg.pr.new/storybookjs/mcp/@storybook/mcp-proxy@main`  
> **TODO:** After `@storybook/mcp-proxy` is published to npm, switch to `@storybook/mcp-proxy@latest`.

The package currently exposes no Storybook tools. Milestone 2 of storybookjs/storybook#34826 will replace the placeholder internals with the real proxy, which will discover running Storybook instances and proxy the seven Storybook MCP tools.

## Included Skills

- `storybook-mcp-setup`: Set up Storybook MCP readiness in an existing project.
- `storybook-init`: Add Storybook to a project that does not have it yet.
- `storybook-upgrade`: Upgrade older Storybook projects and repair MCP readiness issues.
- `storybook-launch-setup`: Create or repair Claude preview launch configuration for starting Storybook.
