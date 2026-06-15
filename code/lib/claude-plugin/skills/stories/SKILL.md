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

This is a STRICT, GATED workflow. You MUST execute the steps below in order and
satisfy each step's **Gate** before moving to the next. Do NOT skip, reorder, or
batch steps. Do NOT write or edit any `*.stories.*` file until Steps 1 and 2 are
complete. If a gate cannot be satisfied, STOP and report to the user instead of
working around it. Treat any shortcut as a failure of this workflow.

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

## Step 0 — Prerequisites

- Storybook must be installed in the project. If it is not, go to
  "When Storybook is not installed" below and stop here unless the user opts in.
- Storybook must be a canary version (0.0.0-canary) or at least version 10.5. If an older version is
  installed, invoke the **storybook-upgrade** skill to upgrade it before
  proceeding.

### When Storybook is not installed

Installing and configuring Storybook is invasive, so it is the **user's choice**.
Never set it up on your own initiative as a side effect of a component change.

Before asking the user anything, check whether they have already declined:

1. **Read the saved decision** at `.claude/storybook-optout.json` (project-local).
   If it exists with `{ "storybookOptOut": true }`, the user has ALREADY refused
   Storybook for this project. Do NOT ask again — silently skip all story work,
   finish the component change (if any), and move on.
2. **If there is no opt-out file**, briefly tell the user the project has no
   Storybook and ask whether they want to set it up (and write stories) for it.
3. **If the user declines**, persist that choice so future invocations don't
   re-ask: write `.claude/storybook-optout.json` with:

   ```json
   {
   	"storybookOptOut": true,
   	"reason": "<short paraphrase of what the user said>"
   }
   ```

   Then finish the component change (if any) without any story work. If the
   user explicitly asked for story work, STOP and report that Storybook is
   required for it.

4. **If the user opts in**, set Storybook up via the setup skills
   (`storybook-init` / `storybook-setup`), then resume this workflow from
   Step 1. If an opt-out file existed from a previous "no", delete it.

**Gate:** Do NOT install Storybook, scaffold `.storybook/`, add Storybook
dependencies, or invoke the setup skills unless the user has explicitly opted in
this time. A saved opt-out MUST be respected on every later invocation without
re-prompting.

## Step 1 — Open the preview browser up front

1. Inspect `.claude/launch.json` for a launch entry that starts this project's Storybook dev server.
   If:
   - the `.claude/launch.json` file does not exist
   - no such entry exists
   - the storybook entry does not use `autoPort`
     repair it first: invoke the **storybook-setup-claude-launch** skill, which creates or repairs the `.claude/launch.json` Storybook entry.
2. Start Storybook by launching that `.claude/launch.json` entry through the Claude launcher (never via Bash/background, per the Absolute rules).
3. Open the Storybook preview in the preview browser. If the launch entry uses `autoPort`, wait for the terminal to show which port Storybook is running on and use that port to open the preview URL (e.g. `http://localhost:6006`) in the preview browser.
4. Save the port being used by Storybook shown in the terminal in your working memory. USE THIS PORT FOR ANY SUBCOMMAND THAT NEEDS TO KNOW THE PORT (e.g. `preview-stories`).

**Gate:** Do NOT proceed to Step 2 until the preview browser is open and has rendered the Storybook URL without
error. If launch setup reports an error, surface it to the user and STOP.

## Step 2 — Load the rules (before touching any story file)

- Run `STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --help` to get all available subcommands and options.
  - Save the available subcommands and options in your working memory for reference.
- Run `STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai <subcommand> --port <port>` to get the story-writing instructions.
  - If the subcommand allows a port option, use the port you saved in Step 1.
- Follow the instructions in the output, which will include the exact imports, structure, and conventions to use for the story you are writing or editing. The instructions are the ONLY acceptable source for how to write the story; do NOT rely on memory or existing patterns.

**Gate:** Do NOT create or edit any `*.stories.*` file until this tool has
returned and you are following its output. If you have not called it this task,
you are not allowed to write a story yet — go back and call it now.
