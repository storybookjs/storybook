# Storybook Claude Code Plugin

You can use Storybook's plugin in Claude Code or Claude Desktop to connect agents to your Storybook. Agents can then use the plugin's skills and tools to generate UI, run tests, and preview their work in your Storybook. If you're using Claude Desktop, the agent can open relevant stories in the Agentic Development Environment (ADE) preview when you ask to see them, so you can review the agent's work.

## Requirements

- Storybook 11.0 or later, an 11.0 prerelease (`11.0.0-alpha.x`, `-beta.x` or `-rc.x`), or a canary build
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

The plugin's [skills](#skills) tell the agent how to work with your Storybook: reuse your components, generate stories, run tests, and preview its work. The `AGENTS.md` section below is the workflow that tells the agent which skill to use at which step. Add it to the `AGENTS.md` of each project where the agent should follow it. When you set up Storybook 11 with AI features, or accept the `skills` automigration when you upgrade, Storybook adds it for you (and to your `CLAUDE.md` or `CLAUDE.local.md`, if it does not import `AGENTS.md`):

```md
<!-- BEGIN:storybook-skills -->
<!-- Storybook updates this section on upgrade. Remove both markers to keep your own edits. -->

## Storybook

For every change to how the UI looks (you create, change, or delete a component, story, style, theme, or design token), follow these steps in order. First invoke the skills of steps 1 and 2, before you edit any file. Then follow each skill at its step.

1. `component-docs`: look up the components to reuse, with their props and usage examples, before you edit any file. Also when the user asks about a component's props, API, or usage.
2. `write-stories`: every component you create or change gets stories.
3. Run the story tests after every change, and fix what fails. Also when the user asks to run or fix story tests. Run them only with this command, from the package where Storybook is installed, never a `package.json` test script or `vitest`. Pass the files you changed:
   - `npx storybook tools test run <Button.stories.tsx>`: the stories in that story file.
   - `npx storybook tools test run <Button.tsx>`: every story that depends on that file.
   - `npx storybook tools test run`: every story.

<!-- END:storybook-skills -->
```

Storybook replaces the text between the markers when you upgrade. The section is the workflow: the first two steps name the skill the agent uses for them, and the third is the test command itself, so the agent runs the tests from that line alone. A project without `@storybook/addon-vitest` cannot run story tests and gets no test step. To change the workflow, for example to have the agent publish a review after every change, remove both markers and edit the section. Remove the whole section to stop the agent from following the workflow: it then uses a skill only when you ask for it, or when it finds one that fits its task. You can also call the plugin's skills in prompts (e.g. `/upgrade`) to have the agent perform specific actions. See [Skills and plugins](https://storybook.js.org/docs/ai/skills) for more details.

If you're using Claude Desktop and ask to see stories or for a review, the agent will use the plugin to open relevant stories or an [agentic review summary](https://storybook.js.org/docs/ai/agentic-review) in the ADE preview, so you can review the agent's work.

## Skills

These skills are available to agents that have the Storybook plugin installed. They can be referenced in prompts (e.g. `/upgrade`) or the agent can use them indirectly while working on a task.

### `init`

Initializes Storybook in your project (i.e. runs [`npm create storybook@latest`](https://storybook.js.org/docs/get-started/install)), then runs the [setup](#setup) skill.

### `setup`

Sets up your Storybook for agentic workflows, automatically configures your project to correctly render your components, and writes story files for a variety of component types. See the [agentic setup docs](https://storybook.js.org/docs/ai/agentic-setup) for more details.

### `component-docs`

Looks up the components of your Storybook, with their props and usage examples, so the agent reuses them instead of building duplicates. Also answers questions about a component's props, API, and usage.

### `write-stories`

The rules for the stories of your project: which states get a story, and how to write the imports, `play` functions, and mocks.

### `test-stories`

Runs the story tests of the story files or component files you changed, with their accessibility checks, and fixes what fails. The `AGENTS.md` section names the test command itself, so the agent needs this skill only when you call it by name.

### `ui-review`

Finds the stories a change affects and publishes an [agentic review](https://storybook.js.org/docs/ai/agentic-review) of them. Also shows the components or stories you ask to see. The agent uses it when you ask for a review or to see stories, not after every change: ask for example "Use the ui-review skill to publish a Storybook review of the stories that changed."

### `upgrade`

Upgrades your Storybook to the latest version. This is the same as running [`npx storybook upgrade`](https://storybook.js.org/docs/releases/upgrading) in your project.

## Tools

Agents with the plugin get the same tools as the [Storybook MCP server](https://storybook.js.org/docs/ai/mcp/overview#toolsets), through the `storybook tools` CLI.
