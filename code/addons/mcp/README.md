# Storybook MCP Addon

Storybook addon for MCP-powered UI development workflows.

<div align="center">
	<img src="./addon-mcp-claude-code-showcase.gif" alt="Storybook MCP Addon Demo" />
</div>

See [documentation](https://storybook.js.org/docs/next/ai/mcp/overview/?ref=readme) for installation instructions, usage examples, APIs, and more.

## Configuration

By default, the addon exposes its MCP server at `/mcp`. You can configure a
different literal endpoint path in `.storybook/main.ts`:

```ts
export default {
	addons: [
		{
			name: '@storybook/addon-mcp',
			options: {
				endpoint: '/custom-mcp',
			},
		},
	],
};
```

The endpoint must be a URL pathname such as `/custom-mcp` or `/tools/mcp`.

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).
