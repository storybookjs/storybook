# Storybook Claude Code Plugin

You can use Storybook's plugin in Claude Code or Claude Desktop to connect agents to your Storybook. Agents can then use the plugin's skills and tools to generate UI, run tests, and preview their work in your Storybook. If you're using Claude Desktop, the agent can automatically open relevant stories in the Agentic Development Environment (ADE) preview, so you can review the agent's work.

## Requirements

- Storybook 10.5 or later
- [Claude Code](https://claude.ai/code) or [Claude Desktop](https://claude.ai/desktop)

## Installation

> [!NOTE]
> Because the plugins are [experimental](https://storybook.js.org/docs/releases/features#experimental), they have not yet been added to Claude's marketplace. These instructions guide you to add the Storybook marketplace to your harness and install the plugin from there.

<details>
<summary>Claude Code</summary>

1. Run this command to add the Storybook marketplace to Claude Code:

   ```bash
   claude plugin marketplace add storybookjs/storybook --scope user
   ```

2. Then install the plugin:

   ```bash
   claude plugin install storybook@storybook --scope user
   ```

3. Confirm the plugin is available:

   ```bash
   claude plugin list
   ```

You're all set!

</details>

<details>
<summary>Claude Desktop</summary>

1. Run this command to add the Storybook marketplace to Claude Desktop:

   ```bash
   /plugin marketplace add storybookjs/storybook --scope user
   ```

2. Then install the plugin:

   ```bash
   /plugin install storybook@storybook --scope user
   ```

3. Confirm the plugin is available:

   ```bash
   /plugin
   ```

   Then go to the Installed tab to confirm the plugin is listed.

You're all set!

</details>

### Update a plugin

Until the plugins are available in the official marketplaces, you can update a plugin by removing it and following the installation instructions again.

To remove a plugin:

<details>
<summary>Claude Code</summary>

1. Run this command to remove the Storybook marketplace, which will also uninstall the plugin:

   ```bash
   claude plugin marketplace remove storybook --scope user
   ```

2. Follow the [installation instructions above](#installation) (expand the "Claude Code" section) to re-add the marketplace and install the plugin again.

</details>

<details>
<summary>Claude Desktop</summary>

1. Run `/plugin` and go to the Marketplaces tab

2. Remove the "storybook" marketplace

3. Follow the [installation instructions above](#installation) (expand the "Claude Desktop" section) to re-add the marketplace and install the plugin again.

</details>

## Usage

The plugin includes instructions to help the agent understand how and when to use the [skills](#skills) and [tools](#tools) available to it. As your agent works on UI tasks, it can use the plugin to generate stories, run tests, and preview its work in your Storybook. You can also explicitly call the plugin's skills in prompts (e.g. `/upgrade`) to have the agent perform specific actions.

If you're using Claude Desktop, the agent will use the plugin to automatically open relevant stories or an [agentic review summary](https://storybook.js.org/docs/10.5/ai/agentic-review) in the ADE preview, so you can review the agent's work.

## Skills

These skills are available to agents that have the Storybook plugin installed. They can be referenced in prompts (e.g. `/upgrade`) or the agent can use them indirectly while working on a task.

### `init`

Initializes Storybook in your project (i.e. runs [`npm create storybook@latest`](https://storybook.js.org/docs/get-started/install)), installs [`@storybook/addon-mcp`](../../addons/mcp), then runs the [setup](#setup) skill.

### `setup`

Sets up your Storybook for agentic workflows, automatically configures your project to correctly render your components, and writes story files for a variety of component types. See the [agentic setup docs](https://storybook.js.org/docs/ai/agentic-setup) for more details.

### `stories`

Instructs the agent to use stories for all UI work.

### `upgrade`

Upgrades your Storybook to the latest version. This is the same as running [`npx storybook upgrade`](https://storybook.js.org/docs/releases/upgrading) in your project.

## Tools

All of [Storybook MCP server's tools](https://storybook.js.org/docs/ai/mcp/overview#toolsets) are available to agents that have the plugin installed.
