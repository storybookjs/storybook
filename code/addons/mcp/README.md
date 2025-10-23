# Storybook MCP Addon

This Storybook addon runs an MCP (Model Context Protocol) server to help develop UI components more efficiently.

It enables a workflow where for each UI component created, the agent will automatically generate and link to example stories. These stories let you visually verify the new UI in each of its key states, and provide documentation and component tests.

The server currently exposes two tools: one to provide UI development instructions to the agent, and the other to retrieve story URLs directly from your running Storybook.

> [!IMPORTANT]
> This addon currently only supports Vite-based Storybook setups, such as [`@storybook/react-vite`](https://storybook.js.org/docs/get-started/frameworks/react-vite), [`@storybook/nextjs-vite`](https://storybook.js.org/docs/get-started/frameworks/nextjs#with-vite), and [`@storybook/sveltekit`](https://storybook.js.org/docs/get-started/frameworks/sveltekit).

<div align="center">
   <img src="https://storybook.js.org/embed/addon-mcp-claude-code-showcase.gif" alt="Storybook MCP Addon Demo" />
</div>

## Getting Started

### Installation and Setup

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

### Configuring Your Agent

> [!NOTE]
> This addon is primarily tested with Claude Code. While it should work with other MCP clients, Claude Code is our main target for compatibility and testing.

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

This addon should work with any MCP-compatible client that supports the `tool` capability and the `streamable-http` transport. Here are setup guides for other popular clients:

- [GitHub Copilot](https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp/extend-copilot-chat-with-mcp)
- [Cursor](https://docs.cursor.com/en/context/mcp#installing-mcp-servers)
- [opencode](https://opencode.ai/docs/mcp-servers/)
- [Claude Desktop](https://modelcontextprotocol.io/quickstart/user)
- [Cline](https://docs.cline.bot/mcp/configuring-mcp-servers)
- [Zed Editor](https://zed.dev/docs/ai/mcp#as-custom-servers)
- [Continue](https://docs.continue.dev/customize/deep-dives/mcp#how-to-configure-mcp-servers)

For clients not listed above, consult their documentation for MCP server configuration. The server configuration typically requires:

- **Server Type**: `http`
- **URL**: `http://localhost:6006/mcp` (adjust port if your Storybook runs on a different port)
- ⚠️ Make sure your Storybook development server is running before your agent tries to connect.

## Usage

This addon provides two main MCP tools that your agent can use. The goal is that the agent uses these tools automatically when doing UI development, but agents are unreliable and unpredictable, so sometimes you might need to explicitly tell it to use the tools.

**If you are prompting from an IDE like VSCode or Cursor, be sure to use `Agent` mode and `sonnet-4.5` or better.**

### 1. UI Building Instructions (`get_ui_building_instructions`)

Provides agents with standardized instructions for UI component development within your project. This tool returns guidelines for:

- Writing Storybook stories using CSF3 format
- Component development best practices
- Story linking requirements

The instructions ensure agents follow your project's conventions when creating or modifying UI components and their corresponding stories.

### 2. Get Story URLs (`get_story_urls`)

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

## Contributing

We welcome contributions to improve Storybook's agent integration, within or outside of this addon! Here's how you can help:

1. **Ideas and feature requests**: If you have ideas for what else we could do to improve the Storybook experience when using agents, please [start a discussion](https://github.com/storybookjs/mcp/discussions/new?category=ideas) in this repository.

2. **Report Issues**: If you find bugs, please open an issue on our [GitHub repository](https://github.com/storybookjs/mcp), but keep in mind that this is currently highly experimental, explorative and probably filled with bugs.

3. **Development Setup**:

   This repository uses a monorepo structure with [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turborepo.com) for task orchestration.

   ```bash
   # Clone the repository
   git clone https://github.com/storybookjs/mcp.git
   cd addon-mcp

   # Install dependencies (installs for all packages in the workspace)
   pnpm install

   # Build all packages
   pnpm build

   # Start development (runs the addon-mcp package)
   pnpm start
   ```

   The main addon package is located in `packages/addon-mcp`.

4. **Testing**: Run the MCP inspector to test the server functionality (requires that the Storybook dev server is running):

```bash
pnpm run inspect
```

Run the unit test suite:

```bash
# Run tests in watch mode
pnpm test

# Run tests once
pnpm test run

# Run tests with coverage
pnpm test run --coverage
```
