# Storybook Claude Code Plugin

You can use Storybook's plugin in Claude Code or Claude Desktop to connect agents to your Storybook. Agents can then use the plugin's skills and tools to generate UI, run tests, and preview their work in your Storybook. If you're using Claude Desktop, the agent can automatically open relevant stories in the Agentic Development Environment (ADE) preview, so you can review the agent's work.

## Requirements

- Storybook 11.0 or later, an 11.0 prerelease (`11.0.0-alpha.x`), or a canary build
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

The plugin's [skills](#skills) tell the agent how to work with your Storybook: reuse your components, generate stories, run tests, and preview its work. You decide when the agent uses them. Add this section to the `AGENTS.md` of each project where the agent should use them. When you set up Storybook 11 with AI features, or accept the `skills` automigration when you upgrade, Storybook adds it for you (and to your `CLAUDE.md` or `CLAUDE.local.md`, if it does not import `AGENTS.md`):

```md
## Storybook

For each of these tasks, invoke its Storybook skill first, before you edit any file, and follow it:

- `ui-workflow`: you create, change, or delete a component, story, style, theme, or design token, or otherwise change how the UI looks; you run or fix story tests; or the user asks to see components or stories. It looks up the components to reuse, updates your stories, runs the tests, and publishes a review of the results.
- `component-docs`: you look for an existing component to reuse instead of building a new one, or the user asks about a component's props, API, or usage. It lists the project's components with their props and usage examples.
```

Edit that section to change when the agent uses the skills, for example to leave out the review, or remove it to stop the agent from using them on its own. You can also call the plugin's skills in prompts (e.g. `/upgrade`) to have the agent perform specific actions. See [Skills and plugins](https://storybook.js.org/docs/ai/skills) for more details.

If you're using Claude Desktop, the agent will use the plugin to automatically open relevant stories or an [agentic review summary](https://storybook.js.org/docs/ai/agentic-review) in the ADE preview, so you can review the agent's work.

## Skills

These skills are available to agents that have the Storybook plugin installed. They can be referenced in prompts (e.g. `/upgrade`) or the agent can use them indirectly while working on a task.

### `init`

Initializes Storybook in your project (i.e. runs [`npm create storybook@latest`](https://storybook.js.org/docs/get-started/install)), then runs the [setup](#setup) skill.

### `setup`

Sets up your Storybook for agentic workflows, automatically configures your project to correctly render your components, and writes story files for a variety of component types. See the [agentic setup docs](https://storybook.js.org/docs/ai/agentic-setup) for more details.

### `component-docs`

Looks up the components of your Storybook, with their props and usage examples, so the agent reuses them instead of building duplicates. Also answers questions about a component's props, API, and usage.

### `ui-workflow`

The workflow for UI changes: the agent looks up the components to reuse, writes and updates stories for every component it changes, runs the story tests, and publishes an [agentic review](https://storybook.js.org/docs/ai/agentic-review) of the result.

### `upgrade`

Upgrades your Storybook to the latest version. This is the same as running [`npx storybook upgrade`](https://storybook.js.org/docs/releases/upgrading) in your project.

## Tools

Agents with the plugin get the same tools as the [Storybook MCP server](https://storybook.js.org/docs/ai/mcp/overview#toolsets), through the `storybook tools` CLI.
