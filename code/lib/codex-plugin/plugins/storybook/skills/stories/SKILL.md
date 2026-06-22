---
name: stories
description: Invoke BEFORE you touch a frontend component, on EVERY change, with no exception — call this FIRST, before writing, editing, or deleting, so the workflow governs how the change is made. Triggers on creating, editing, OR deleting any frontend component (React/Vue/Svelte and similar *.tsx/.jsx/.ts/.js/.vue/.svelte files) or anything it renders with. Invoke this even if you believe the change is cosmetic-only, internal, a refactor, a rename, a deletion, or has "no behavior change" — that judgment is NOT yours to make; the skill always runs first. Also use whenever the user asks to write, add, generate, update, or review Storybook stories, to cover a component or project with stories, or to create or edit any *.stories.* file (.stories.tsx/.ts/.jsx/.js/.svelte/.vue), and before starting or previewing Storybook to verify UI. Pulls story-writing guidance from the Storybook CLI ai subcommands and keeps the preview running so stories can be verified.
---

# Storybook Stories

The Storybook CLI ai subcommands are the source of truth for _how_ to write stories. This skill
is the **mandatory, ordered process** for working on them, and for keeping
stories in sync with every frontend component you create, modify, or delete.

## Absolute rules

- Commands must be run with the variable `STORYBOOK_FEATURE_AI_CLI=1`
- You MUST NOT write or edit a story from memory or existing patterns. The
  `get-storybook-story-instructions` output is the only acceptable source for
  imports, structure, and conventions.
- When this skill runs because you created, modified, or deleted a component,
  you MUST NOT report the component change as complete until this workflow has
  finished for every component you touched. A component change without
  matching, verified stories is not a deliverable.
- In sandboxed Codex environments, run any Storybook CLI command with `require_escalated` (sandbox/network permissions may otherwise prevent localhost access).

## Prerequisites

- Storybook must be installed in the project. If it is not installed:
  - If this skill is not explicitly invoked by the user, silently ignore this skill.
  - Otherwise, ask the user whether they want to set up Storybook and write stories.
    - If the user decline, silently skip all story work, finish the component change (if any), and move on.
    - If the user accepts, invoke the **init** skill to set up Storybook and write stories.
- Storybook must be a canary version (0.0.0-canary) or at least version 10.5. If an older version is
  installed, invoke the **upgrade** skill to upgrade it before
  proceeding.

## Load the rules (before touching any story file)

- Run `STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --help` with `require_escalated` to get all available subcommands and options. This also gets the latest rules for how to write stories.
  - Save the available subcommands and options in your working memory for reference.
- Some subcommands are only available when Storybook is running. If you need to run a subcommand that requires Storybook, follow the instructions in "Guarantee a running preview browser" below to start Storybook and open the preview browser.
- Follow the instructions in the output, which will include the exact imports, structure, and conventions to use for the story you are writing or editing. The instructions are the ONLY acceptable source for how to write the story; do NOT rely on memory or existing patterns.
- Create or edit the story strictly following the instructions. When this skill runs for a component change, cover the affected surface: new components get stories, new props/variants/states get covered, renamed states get updated, and deleted components get their stories removed.

**Gate:** Every story you touched must conform to the instruction output you received. If anything is unclear, re-read it
rather than guessing.

### Guarantee a running preview browser

The Storybook preview MUST be running so the story can be verified.

Run `STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --help` subcommand with `require_escalated` to check for running Storybook instances.

If there is a running instance:

- Open the preview URL in the preview browser.
- Make the preview browser visible to the user.

If there is no running instance, start it with the steps below:

1. Start the project's existing Storybook dev script as a background task from
   the Storybook invocation directory
2. Wait for the terminal and storybook to be ready and show the preview URL in the terminal.
3. Make the preview browser visible to the user.
