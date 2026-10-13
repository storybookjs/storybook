# Storybook Codex Plugin

You can use Storybook's Codex plugin to connect agents to your Storybook. Agents can then use the plugin's skills and tools to generate UI, run tests, and preview their work in your Storybook. The agent can automatically open relevant stories in the ADE preview, so you can inspect the components and their code.

## Requirements

- Storybook 11.0 or later, an 11.0 prerelease (`11.0.0-alpha.x`), or a canary build
- [Codex](https://openai.com/codex/)

## Installation

> [!NOTE]
> Because the plugin is [experimental](https://storybook.js.org/docs/releases/features#experimental), it has not yet been added to Codex's marketplace. These instructions guide you to add the Storybook marketplace to Codex and install the plugin from there.

1. Run this command to add the Storybook marketplace to Codex:

   ```bash
   codex plugin marketplace add storybookjs/storybook
   ```

2. Then install the plugin:

   ```bash
   codex plugin add storybook@storybook
   ```

3. Confirm the plugin is available:

   ```bash
   codex plugin list --marketplace storybook
   ```

You're all set!

### Update a plugin

Until the plugins are available in the official marketplaces, you can update a plugin by removing it and following the installation instructions again.

To remove a plugin:

1. Run this command to remove the plugin from Codex:

   ```bash
   codex plugin remove storybook@storybook
   ```

2. Then remove the Storybook marketplace:

   ```bash
   codex plugin marketplace remove storybook
   ```

3. Follow the [installation instructions above](#installation) to re-add the marketplace and install the plugin again.

## Usage

The plugin's [skills](#skills) tell the agent how to work with your Storybook: reuse your components, generate stories, run tests, and preview its work. You decide when the agent uses them. When you set up or upgrade to Storybook 11 with AI features, Storybook adds this section to the `AGENTS.md` of your project (and to your `CLAUDE.md`, if it does not import `AGENTS.md`):

```md
## Storybook

Whenever you make updates that could affect the UI:

- Reuse existing components: look them up with the `component-docs` skill.
- Update your stories, run the tests, and publish a review of the results with the `ui-workflow` skill.
```

Edit that section to change when the agent uses the skills, for example to leave out the review, or remove it to stop the agent from using them on its own. You can also call the plugin's skills in prompts (e.g. `/upgrade`) to have the agent perform specific actions. See [Skills and plugins](https://storybook.js.org/docs/ai/skills) for more details.

The agent will use the plugin to automatically open relevant stories or an [agentic review summary](https://storybook.js.org/docs/ai/agentic-review) in the ADE preview, so you can review the agent's work.

## Skills

These skills are available to agents that have the Storybook plugin installed. They can be referenced in prompts (e.g. `/upgrade`) or the agent can use them indirectly while working on a task.

### `init`

Initializes Storybook in your project (i.e. runs [`npm create storybook@latest`](https://storybook.js.org/docs/get-started/install)), then runs the [setup](#setup) skill.

### `setup`

Sets up your Storybook for agentic workflows, automatically configures your project to correctly render your components, and writes story files for a variety of component types. See the [agentic setup docs](https://storybook.js.org/docs/ai/agentic-setup) for more details.

### `component-docs`

Looks up the components of your Storybook, with their props and usage examples, so the agent reuses them instead of building duplicates. The agent also uses it to answer questions about a component's props, API, or usage.

### `upgrade`

Upgrades your Storybook to the latest version. This is the same as running [`npx storybook upgrade`](https://storybook.js.org/docs/releases/upgrading) in your project.

### `ui-workflow`

The workflow for UI changes: the agent writes and updates stories for every component it changes, runs the story tests, and publishes an [agentic review](https://storybook.js.org/docs/ai/agentic-review) of the result.

## Tools

Agents with the plugin get the same tools as the [Storybook MCP server](https://storybook.js.org/docs/ai/mcp/overview#toolsets), through the `storybook tools` CLI.
