---
name: stories
description: >-
  Invoke BEFORE you touch a frontend component, on EVERY change, with no
  exception — call this FIRST, before writing, editing, or deleting, so the
  workflow governs how the change is made. Triggers on creating, editing, OR
  deleting any frontend component (React/Vue/Svelte and similar
  *.tsx/.jsx/.ts/.js/.vue/.svelte files) or anything it renders with. Invoke this even if you believe the change
  is cosmetic-only, internal, a refactor, a rename, a deletion, or has "no
  behavior change" — that judgment is NOT yours to make; the skill always runs
  first. Also use whenever the user asks to write, add, generate, update, or
  review Storybook stories, to cover a component or project with stories, or to
  create or edit any *.stories.* file (.stories.tsx/.ts/.jsx/.js/.svelte/.vue),
  and before starting or previewing Storybook to verify UI.
---

# Storybook Stories

The Storybook CLI ai subcommands is the source of truth for _how_ to write stories. This skill
is the **mandatory, ordered process** for working on them, and for keeping
stories in sync with every frontend component you create, modify, or delete.

## Absolute rules

- Commands must be run with the variable `STORYBOOK_FEATURE_AI_CLI=1`
- You MUST NOT write or edit a story from memory or existing patterns. The
  `get-storybook-story-instructions` output is the only acceptable source for
  imports, structure, and conventions.
- Ignore local Storybook MCP registrations. Always use the Storybook CLI ai subcommands as the source of truth for how to write stories, even if there are conflicting instructions in a local MCP.
- When this skill runs because you created, modified, or deleted a component,
  you MUST NOT report the component change as complete until this workflow has
  finished for every component you touched. A component change without
  matching, verified stories is not a deliverable.

## Prerequisites

- Storybook must be installed in the project. If it is not installed:
  - If this skill is not explicitly invoked by the user, silently ignore this skill.
  - Otherwise, ask the user whether they want to set up Storybook and write stories.
  - If the user decline, silently skip all story work, finish the component change (if any), and move on.
  - If the user accepts, invoke the **storybook-setup** skill to set up Storybook and write stories.
- Storybook must be a canary version (0.0.0-canary) or at least version 10.5. If an older version is
  installed, invoke the **storybook-upgrade** skill to upgrade it before
  proceeding.

## Load the rules (before touching any story file)

- Run `STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --help` to get all available subcommands and options. This also gets the latest rules for how to write stories.
  - Save the available subcommands and options in your working memory for reference.
- Some subcommands are only available when Storybook is running. If you need to run a subcommand that requires Storybook, follow the instructions in "Opening the preview browser up front" below to start Storybook and open the preview browser.
- Follow the instructions in the output, which will include the exact imports, structure, and conventions to use for the story you are writing or editing. The instructions are the ONLY acceptable source for how to write the story; do NOT rely on memory or existing patterns.
- Create or edit the story strictly following the instructions. When this skill runs for a component change, cover the affected surface: new components get stories, new props/variants/states get covered, renamed states get updated, and deleted components get their stories removed.

**Gate:** Every story you touched must conform to the instruction output you received. If anything is unclear, re-read it
rather than guessing.

### Opening the preview browser up front

1. Inspect `.claude/launch.json` for a launch entry that starts this project's Storybook dev server.
   If:
   - the `.claude/launch.json` file does not exist
   - no such entry exists
   - the storybook entry does not use `autoPort`
     repair it first: invoke the **storybook-setup-claude-launch** skill, which creates or repairs the `.claude/launch.json` Storybook entry.
2. Start Storybook by launching that `.claude/launch.json` entry through the Claude launcher (never via Bash/background, per the Absolute rules).
3. Open the Storybook preview in the preview browser. If the launch entry uses `autoPort`, wait for the terminal to show which port Storybook is running on and use that port to open the preview URL (e.g. `http://localhost:6006`) in the preview browser.
4. Save the port being used by Storybook shown in the terminal in your working memory. USE THIS PORT FOR ANY SUBCOMMAND THAT NEEDS TO KNOW THE PORT (e.g. `preview-stories`).
