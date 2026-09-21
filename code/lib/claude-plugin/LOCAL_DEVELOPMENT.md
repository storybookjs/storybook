# Local Development

This package includes a local Claude marketplace descriptor at `.claude-plugin/marketplace.json`. It points at this same directory so you can register, install, and update the plugin the same way users will once it ships through the official marketplace.

Claude has two lifecycle layers:

- the **marketplace** entry, which tells Claude where to find this plugin catalog
- the installed **plugin**, `storybook@storybook`, which is installed from that marketplace

Run package scripts from the repository root with `yarn workspace @storybook/claude-code-plugin run <script>`, or from this package directory with `yarn run <script>`.

Validate the marketplace and plugin manifests:

```sh
yarn workspace @storybook/claude-code-plugin run validate
```

Run the same validation in vitest before pushing changes (from the repository root):

```sh
yarn vitest run --project @storybook/claude-code-plugin
```

The test runs `claude plugin validate` for the marketplace and plugin manifests. It skips when the Claude CLI is not installed. Use `validate` for manual checks or CI, and `plugin:install` below for local install testing.

Install the plugin from this checkout at user scope:

```sh
yarn workspace @storybook/claude-code-plugin run plugin:install
```

This validates the manifests, adds this package directory as the `storybook` Claude marketplace, and installs `storybook@storybook` at user scope so it is available in every project.

After changing plugin files, refresh the installed plugin from the local marketplace:

```sh
yarn workspace @storybook/claude-code-plugin run marketplace:update
yarn workspace @storybook/claude-code-plugin run plugin:update
```

If the installed plugin cache still looks stale, reinstall it:

```sh
yarn workspace @storybook/claude-code-plugin run remove
yarn workspace @storybook/claude-code-plugin run plugin:install
```

To fully uninstall Storybook from Claude (plugin, marketplace, and local cache):

```sh
yarn workspace @storybook/claude-code-plugin run remove
```

Verify the installed plugin:

```sh
yarn workspace @storybook/claude-code-plugin run plugin:list
```

The output should include `storybook@storybook` with:

- `"scope": "user"`
- `"enabled": true`

Check that Claude Code picks up the plugin-provided MCP server:

```sh
claude mcp list
```

The output should include:

```text
plugin:storybook:storybook: (no MCP servers)
```

The important signal for this package is that `plugin:storybook:storybook` appears and the Storybook skills are available.

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
`claude plugin marketplace add storybookjs/storybook`. The local marketplace in
this package is for package-local development and validation. The plugin will
eventually ship through the official Claude plugin marketplace.

The plugin directory must include these files:

- `.claude-plugin/marketplace.json` (package-local testing only)
- `.claude-plugin/plugin.json`
- `.mcp.json`
- `skills/**`
- `README.md`
