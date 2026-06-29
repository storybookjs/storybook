---
name: rebuild-restart-storybook
description: Rebuild and restart the internal Storybook UI after changes to internal Storybook code (core, addons, frameworks, renderers, libs, etc.), then optionally display a UI review. Use after editing any package in the Storybook monorepo's code/ directory, or when the user asks to rebuild and/or restart Storybook.
allowed-tools: Bash, Read
---

# Rebuild and Restart Storybook

After making changes to internal Storybook code (core, addons or otherwise), follow this workflow.

## Step 1: Ask whether to rebuild and restart (in case of model invocation)

Unless the user explicitly ran `/rebuild-restart-storybook`, ask the user whether they want to rebuild and restart Storybook. If they decline, stop here.

## Step 2: Determine modified packages

Build a space-separated list of the monorepo packages that were modified in the conversation. For each modified package, find its Nx project name in the `project.json` file in that package's directory (the `name` field), not the `package.json` name.

For example, if `code/addons/review` and `code/addons/vitest` were modified, the list is `addon-review addon-vitest`.

## Step 3: Run the build and start commands in sequence

Run these in the `code` directory, in order. Substitute `<extra packages>` with the list from Step 2.

```bash
rm -rf node_modules/.cache
yarn
yarn build storybook <extra packages>
```

Then, run in the background:

```bash
NODE_OPTIONS="--preserve-symlinks" yarn storybook:ui --no-open
```

### Handle an occupied port

A Storybook may already be running. If the port is occupied, cancel the start, kill the old process to free the port, then start Storybook again.

## Step 4: Provide the URL and ask about a review

Once Storybook has started, give the user the URL. Then ask whether they want to display a review.

## Step 5: Display the review

If the user wants a review, use Storybook's `display-review` MCP tool to create a UI review of relevant stories. Pick a set of stories related to the entirety of the conversation so far.

If there are no relevant stories because no UI elements were touched, ask the user what they would like to see a review for.
