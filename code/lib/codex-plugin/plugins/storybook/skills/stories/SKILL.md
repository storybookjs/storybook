---
name: stories
description: Invoke BEFORE you touch a frontend component, on EVERY change, with no exception — call this FIRST, before writing, editing, or deleting, so the workflow governs how the change is made. Triggers on creating, editing, OR deleting any frontend component (React/Vue/Svelte and similar *.tsx/.jsx/.ts/.js/.vue/.svelte files) or anything it renders with. Invoke this even if you believe the change is cosmetic-only, internal, a refactor, a rename, a deletion, or has "no behavior change" — that judgment is NOT yours to make; the skill always runs first. Also use whenever the user asks to write, add, generate, update, or review Storybook stories, to cover a component or project with stories, or to create or edit any *.stories.* file (.stories.tsx/.ts/.jsx/.js/.svelte/.vue), and before starting or previewing Storybook to verify UI. Pulls story-writing guidance from the Storybook CLI ai subcommands and keeps the preview running so stories can be verified.
---

# Storybook Stories

The Storybook CLI ai subcommands are the source of truth for _how_ to write stories. This skill
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
- When this skill runs because you created, modified, or deleted a component,
  you MUST NOT report the component change as complete until this workflow has
  finished for every component you touched. A component change without
  matching, verified stories is not a deliverable.
- In sandboxed Codex environments, when running any
  Storybook CLI command, treat it as a
  likely sandbox/network permission issue and rerun the exact command with
  `require_escalated` before concluding Storybook is unavailable.

## Step 0 — Prerequisites

- Storybook must be installed in the project. If it is not, go to
  "When Storybook is not installed" below and stop here unless the user opts in.
- Storybook must be a canary version (0.0.0-canary) or at least version 10.5. If an older version is
  installed, invoke the **upgrade** skill to upgrade it before
  proceeding.

### When Storybook is not installed

Installing and configuring Storybook is invasive, so it is the **user's choice**.
Never set it up on your own initiative as a side effect of a component change.

Before asking the user anything, check whether they have already declined. A
decline can apply at two scopes:

- **User-level** — the user never wants Storybook set up in any project.
- **Project-level** — the user only declined for this project.

1. **Look for a previously recorded decline.** If you find one that applies here
   (at either scope), the user has ALREADY refused Storybook. Do NOT ask again —
   silently skip all story work, finish the component change (if any), and move
   on.
2. **If there is no recorded decline**, briefly tell the user the project has no
   Storybook and ask whether they want to set it up (and write stories). Offer
   three choices:
   - **Yes** — set it up for this project.
   - **No, not for this project** — decline at the project level.
   - **No, and don't ask me again in any project** — decline at the user level.
3. **If the user declines**, remember that decision durably so future
   invocations don't re-ask, recording the scope they chose (this project vs.
   all projects) and a short paraphrase of their reason. Choose an appropriate
   place and format yourself — but do NOT commit it to the project's version
   control; if the only durable option lives inside the repo, keep it out of
   commits (e.g. via `.gitignore`). Then finish the component change (if any)
   without any story work. If the user explicitly asked for story work, STOP and
   report that Storybook is required for it.

4. **If the user opts in**, set Storybook up via the setup skills
   (`init` / `setup`), then resume this workflow from
   Step 1. If you recorded a decline at either scope from a previous "no", clear
   it.

**Gate:** Do NOT install Storybook, scaffold `.storybook/`, add Storybook
dependencies, or invoke the setup skills unless the user has explicitly opted in
this time. A recorded decline at either scope MUST be respected on every later
invocation without re-prompting.

## Step 1 — Guarantee a running preview browser

The Storybook preview MUST be running so the story can be verified.

Run `STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --help` subcommand with `require_escalated` to check for running Storybook instances.

If there is a running instance:
- Note its port and save it in your working memory. USE THIS PORT FOR ANY SUBCOMMAND THAT NEEDS TO KNOW THE PORT (e.g. `preview-stories`).
- Open the preview URL in the preview browser.
- Make the preview browser visible to the user.

If there is no running instance, start it with the steps below:
1. Start the project's existing Storybook dev script as a background task from
   the Storybook invocation directory
2. Wait for the terminal to show which port Storybook is running on and use that port to open the preview URL (e.g. `http://localhost:6006`) in the preview browser.
3. Make the preview browser visible to the user.
4. Save the port being used by Storybook shown in the terminal in your working memory. USE THIS PORT FOR ANY SUBCOMMAND THAT NEEDS TO KNOW THE PORT (e.g. `preview-stories`).
5. Open the preview URL in the preview browser.

**Gate:** Do NOT proceed to Step 2 until the preview browser is visible to the user and has rendered the Storybook URL without
error.

## Step 2 — Load the rules (before touching any story file)

- Run `STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --help` with `require_escalated` to get all available subcommands and options.
  - Save the available subcommands and options in your working memory for reference.
- Run the ai subcommand with `require_escalated` to get the story-writing instructions.
- Follow the instructions in the output, which will include the exact imports, structure, and conventions to use for the story you are writing or editing. The instructions are the ONLY acceptable source for how to write the story; do NOT rely on memory or existing patterns.
- Create or edit the story strictly following the instructions. When this skill runs for a component change, cover the affected surface: new components get stories, new props/variants/states get covered, renamed states get updated, and deleted components get their stories removed.

**Gate:** Every story you touched must conform to the instruction output you received. If anything is unclear, re-read it
rather than guessing.
