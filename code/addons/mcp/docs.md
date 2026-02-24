# Storybook MCP Addon

This Storybook addon runs an MCP (Model Context Protocol) server to help develop UI components more efficiently.

It enables a workflow where for each UI component created, the agent will automatically generate and link to example stories. These stories let you visually verify the new UI in each of its key states, and provide documentation and component tests.

The addon provides tools to improve agents' UI development capabilities, retrieve story URLs, and access component documentation.

<div align="center">
   <img src="./addon-mcp-claude-code-showcase.gif" alt="Storybook MCP Addon Demo" />
</div>

## Getting Started

### Installation and Setup

> [!NOTE]
> This addon requires Storybook version 9.1.16 or higher.

Use Storybook's CLI to automatically install and configure the addon:

```bash
npx storybook add @storybook/addon-mcp
```

This command will install the addon and add it to your Storybook configuration automatically.

Start your Storybook development server:

```bash
npm run storybook
```

The MCP server will be available at `<your_storybook_dev_server_origin>/mcp` when Storybook is running.

### Configuration

#### Addon Options

You can configure which toolsets are enabled by default in your `.storybook/main.js`:

```javascript
// .storybook/main.js
export default {
	addons: [
		{
			name: '@storybook/addon-mcp',
			options: {
				toolsets: {
					dev: true, // Tools for story URL retrieval and UI building instructions (default: true)
					docs: true, // Tools for component manifest and documentation (default: true, requires experimental feature flag below 👇)
				},
			},
		},
	],
	features: {
		experimentalComponentsManifest: true, // Enable manifest generation for the docs toolset, only supported in React-based setups.
	},
};
```

**Available Toolsets:**

- `dev`: Enables [Dev Tools](#dev-tools)
- `docs`: Enables [Documentation Tools](#docs-tools-experimental)

Disabling the Dev Tools is useful when you want to try out the same experience that your external component consumers will get, because they only get the Component Documentation Tools.

#### Configuring toolsets with headers

You can also configure the available toolsets when setting up the MCP Server in your MCP Client by setting the `X-MCP-Toolsets` header. The header is a comma-separated list of toolset names, `X-MCP-Toolsets: dev,docs`. Eg. to configure your client to only have the Component Documentation Tools, the `.mcp.json`-file could look like this (format depends on the exact client you're using):

```json
{
	"storybook-mcp": {
		"url": "http://localhost:6006/mcp",
		"type": "http",
		"headers": {
			"X-MCP-Toolsets": "docs"
		}
	}
}
```

### Configuring Your Agent

> [!NOTE]
> This addon is primarily tested with Claude Code and GitHub Copilot. While it should work with other MCP clients, Claude Code is our main target for compatibility and testing.

#### Claude Code Setup

To use this addon with [Claude Code](https://claude.ai/code), use the built-in MCP configuration command:

1. **Add the MCP server**: Run the following command in your terminal:

   ```bash
   claude mcp add storybook-mcp --transport http http://localhost:6006/mcp --scope project
   ```

2. **Start Storybook**: Make sure your Storybook development server is running:

   ```bash
   npm run storybook
   ```

3. **Connect Claude Code**: Claude Code should automatically detect and connect to the MCP server when it's running. You can verify the connection by asking Claude to use Storybook-related tools.

4. **Configure Agent Behavior** (Optional but Recommended): Add the following system or project prompt to ensure your agent uses the Storybook tools when appropriate:

```
Before doing any UI, frontend or React development, ALWAYS call the storybook MCP server to get further instructions.
```

#### Other MCP Clients

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en-US/install-mcp?name=storybook-mcp&config=eyJ1cmwiOiJodHRwOi8vbG9jYWxob3N0OjYwMDYvbWNwIn0%3D)

This addon should work with any MCP-compatible client that supports the `tool` capability and the `streamable-http` transport. Here are setup guides for other popular clients:

- [GitHub Copilot](https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp/extend-copilot-chat-with-mcp)
- [Cursor](https://docs.cursor.com/en/context/mcp#installing-mcp-servers)
- [opencode](https://opencode.ai/docs/mcp-servers/)
- [Claude Desktop](https://modelcontextprotocol.io/quickstart/user)
- [Cline](https://docs.cline.bot/mcp/configuring-mcp-servers)
- [Zed Editor](https://zed.dev/docs/ai/mcp#as-custom-servers)
- [Continue](https://docs.continue.dev/customize/deep-dives/mcp#how-to-configure-mcp-servers)
- [Codex](https://github.com/openai/codex/blob/main/docs/config.md#mcp_servers)

For clients not listed above, consult their documentation for MCP server configuration. The server configuration typically requires:

- **Server Type**: `http`
- **URL**: `http://localhost:6006/mcp` (adjust port if your Storybook runs on a different port)
- ⚠️ Make sure your Storybook development server is running before your agent tries to connect.

## Usage

This addon provides MCP tools that your agent can use. The goal is that the agent uses these tools automatically when doing UI development, but agents are unreliable and unpredictable, so sometimes you might need to explicitly tell it to use the tools.

**If you are prompting from an IDE like VSCode or Cursor, be sure to use `Agent` mode and `sonnet-4.5` or better.**

### Dev Tools

These tools are always available when the addon is installed:

#### 1. UI Building Instructions (`get_ui_building_instructions`)

Provides agents with standardized instructions for UI component development within your project. This tool returns guidelines for:

- Writing Storybook stories using CSF3 format
- Component development best practices
- Story linking requirements

The instructions ensure agents follow your project's conventions when creating or modifying UI components and their corresponding stories.

#### 2. Preview Stories (`preview-stories`)

Allows agents to retrieve direct URLs to specific stories in your Storybook. The agent can request URLs for multiple stories by providing:

- `absoluteStoryPath`: Absolute path to the story file
- `exportName`: The export name of the story
- `explicitStoryName`: Optional explicit story name

Example agent usage:

```
Prompt: I need to see the primary variant of the Button component

Agent calls tool, gets response:
http://localhost:6006/?path=/story/example-button--primary
```

### Docs Tools (Experimental)

These additional tools are available when the **experimental** component manifest feature is enabled. They provide agents with detailed documentation about your UI components.

**Requirements:**

- Storybook version 10.1.0 or higher (currently only available as prereleases, `storybook@next`)
- React-based framework (`react-vite`, `nextjs-vite`, `nextjs`, `react-webpack5`)
- Feature flag `features.experimentalComponentsManifest` set to `true` in `.storybook/main.js`

**To enable:**

```javascript
// .storybook/main.js
export default {
	// ... other config
	features: {
		experimentalComponentsManifest: true,
	},
};
```

#### 3. List All Documentation (`list-all-documentation`)

Returns a list of all available UI components as well as standalone docs in your component library. Useful for the LLM as discovery and understanding what components are available to use.

#### 4. Get Documentation (`get-documentation`)

Retrieves detailed documentation for a specific component or docs entry.

The agent provides a component/docs ID to retrieve its documentation. To get documentation for multiple entries, call this tool multiple times.

## Contributing

We welcome contributions to improve Storybook's agent integration, within or outside of this addon! Here's how you can help:

1. **Ideas and feature requests**: If you have ideas for what else we could do to improve the Storybook experience when using agents, please [start a discussion](https://github.com/storybookjs/mcp/discussions/new?category=ideas) in this repository.

2. **Report Issues**: If you find bugs, please open an issue on our [GitHub repository](https://github.com/storybookjs/mcp), but keep in mind that this is currently highly experimental, explorative and probably filled with bugs.

3. **Development**:

See [the monorepo readme](https://github.com/storybookjs/mcp#-quick-start).