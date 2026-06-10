---
name: stories
description: Write, create, update, or review Storybook stories for a component or a whole project. Use whenever the user asks to write, add, or generate stories, to write Storybook stories for a component or project, to cover a component with stories, or to create or edit any *.stories.* file (.stories.tsx/.ts/.jsx/.js/.svelte/.vue) — and on EVERY edit to a frontend component, with no exception: its props, variants, states, markup, layout, styling, CSS/Tailwind/styled, themes, tokens, icons, or assets. Invoke this even if you believe the change is cosmetic-only, internal, a refactor, or has "no behavior change" — that judgment is not yours to make; the skill always runs. Also use before starting or previewing Storybook to verify UI. Pulls story-writing guidance from the Storybook MCP and keeps the preview running so stories can be verified.
---

# Storybook Stories

The Storybook CLI ai subcommands is the source of truth for _how_ to write stories. This skill
is the **mandatory, ordered process** for working on them.

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

## Step 0 — Prerequisites

- Storybook must be installed in the project. If it is not, invoke the
  **storybook-init** skill to set it up, or ask the user if they want to set it
  up before proceeding. If the user declines, STOP and report that Storybook is
  required for story work.
- Storybook must be a canary version (0.0.0-canary) or at least version 10.5. If an older version is
  installed, invoke the **storybook-upgrade** skill to upgrade it before
  proceeding.

## Step 1 — Guarantee a running preview browser

The Storybook preview MUST be running so the story can be verified.

Run `STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --help` subcommand to check for running Storybook instances. If there is a running instance, note its port and open the preview URL in the preview browser.
If there is no running instance, start it with the steps below:
  1. Start the project's existing Storybook dev script as a background task from
    the Storybook invocation directory
  2. Wait for the terminal to show which port Storybook is running on and use that port to open the preview URL (e.g. `http://localhost:6006`) in the preview browser.
  3. Save the port being used by Storybook shown in the terminal in your working memory. USE THIS PORT FOR ANY SUBCOMMAND THAT NEEDS TO KNOW THE PORT (e.g. `preview-stories`).

**Gate:** Do NOT proceed to Step 2 until the preview browser is open and has rendered the Storybook URL without
error. If launch setup reports an error, surface it to the user and STOP.

## Step 2 — Load the rules (before touching any story file)

- Run `STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --help` to get all available subcommands and options.
  - Save the available subcommands and options in your working memory for reference.
- Run the ai subcommand to get the story-writing instructions.
- Follow the instructions in the output, which will include the exact imports, structure, and conventions to use for the story you are writing or editing. The instructions are the ONLY acceptable source for how to write the story; do NOT rely on memory or existing patterns.

**Gate:** Do NOT create or edit any `*.stories.*` file until you are following its output. If you have not called it this task,
you are not allowed to write a story yet — go back and call it now.

## Step 3 — Write the story

Create or edit the story strictly following the Step 2 instructions.

**Gate:** Every story you touched must conform to the instruction output you received. If anything is unclear, re-read it
rather than guessing.

## Step 4 — Preview and verify

Produce a preview for every story you touched with **STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai preview-stories** (prefer
`{ storyId }` inputs). Before showing any returned URL to the user, navigate to
it in the preview browser and confirm the story renders without errors.

**Gate:** Every URL you put in your final response MUST have been opened in the
preview browser first — no exceptions, per the Absolute rules. Do NOT report the
story as done until each preview link has been navigated and verified.

## Step 5 — Publish the review page

Once the stories render cleanly, call **display-review** so the user can review
exactly what changed in one place. This tool does NOT just return a link — it
publishes a curated **review page** inside the already-running Storybook and
returns its `reviewUrl`. The review page IS the deliverable; the raw
`preview-stories` URLs from Step 4 are for your own verification.

**Gate:** Do NOT report the task as done until `display-review` has succeeded,
you have opened the returned `reviewUrl` in the preview browser, and that link is
the final element of your user-facing response.

