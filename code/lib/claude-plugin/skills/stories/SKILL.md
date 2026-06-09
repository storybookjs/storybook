---
name: stories
description: >-
  Write, create, update, or review Storybook stories. Use whenever the user asks
  to write, add, or generate stories, to write Storybook stories for a component
  or project, to cover a component with stories, or to create or edit any
  *.stories.* file (.stories.tsx/.ts/.jsx/.js/.svelte/.vue) — and on EVERY edit
  to a frontend component, with no exception: its props, variants, states,
  markup, layout, styling, CSS/Tailwind/styled, themes, tokens, icons, or
  assets. Invoke this even if you believe the change is cosmetic-only, internal,
  a refactor, or has "no behavior change" — that judgment is not yours to make;
  the skill always runs. Also use before starting or previewing Storybook to
  verify UI. Pulls story-writing guidance from the Storybook MCP, keeps the
  preview running so stories can be verified, and repairs the Claude launch
  config when Storybook is not running.
---

# Storybook Stories

The Storybook MCP is the source of truth for _how_ to write stories. This skill
is the **mandatory, ordered process** for working on them.

This is a STRICT, GATED workflow. You MUST execute the steps below in order and
satisfy each step's **Gate** before moving to the next. Do NOT skip, reorder, or
batch steps. Do NOT write or edit any `*.stories.*` file until Steps 1 and 2 are
complete. If a gate cannot be satisfied, STOP and report to the user instead of
working around it. Treat any shortcut as a failure of this workflow.

## Absolute rules

- FOLLOW THE WORKFLOW SEQUENTIALLY
- ALL TOOL CALLS MUST GO THROUGH STORYBOOK MCP PROXY
- You MUST NOT write or edit a story from memory or existing patterns. The
  `get-storybook-story-instructions` output is the only acceptable source for
  imports, structure, and conventions.
- YOU MUST USE THE PORT INPUT WHENEVER AVAILABLE FOR ANY TOOL CALL THAT SUPPORTS IT, to ensure your calls are routed through the Storybook MCP Proxy and not directly to the server.
- IGNORE PROJECT LOCAL STORYBOOK MCP. ONLY USE THE STORYBOOK MCP PROXY SERVER FOR ALL STORYBOOK-RELATED TOOL CALLS, to ensure you are following the MCP's instructions and your calls are routed through the proxy for accurate port handling and preview integration.

## Step 1 — Open the preview browser up front

1. Inspect `.claude/launch.json` for a launch entry that starts this project's Storybook dev server.
   If:
   - the `.claude/launch.json` file does not exist
   - no such entry exists
   - the storybook entry does not use `autoPort`
     repair it first: invoke the **storybook-setup-claude-launch** skill, which creates or repairs the `.claude/launch.json` Storybook entry.
2. Start Storybook by launching that `.claude/launch.json` entry through the Claude launcher (never via Bash/background, per the Absolute rules).
3. Open the Storybook preview in the preview browser. If the launch entry uses `autoPort`, wait for the terminal to show which port Storybook is running on and use that port to open the preview URL (e.g. `http://localhost:6006`) in the preview browser.
4. Save the port being used by Storybook shown in the terminal in your working memory. USE THIS PORT FOR ALL TOOL CALLS in the following steps to ensure they are routed through the MCP Proxy.

**Gate:** Do NOT proceed to Step 2 until the preview browser is open and has rendered the Storybook URL without
error. If launch setup reports an error, surface it to the user and STOP.

## Step 2 — Load the rules (before touching any story file)

USE THE STORYBOOK MCP PROXY SERVER.

Call **get-storybook-story-instructions** and read it fully. Look components up
with **list-all-documentation** / **get-documentation** rather than assuming
props or APIs.

**Gate:** Do NOT create or edit any `*.stories.*` file until this tool has
returned and you are following its output. If you have not called it this task,
you are not allowed to write a story yet — go back and call it now.

## Step 3 — Write the story

Create or edit the story strictly following the Step 2 instructions.

**Gate:** Every story you touched must conform to the
`get-storybook-story-instructions` output. If anything is unclear, re-read it
rather than guessing.

## Step 4 — Preview and verify

USE THE STORYBOOK MCP PROXY SERVER.

Produce a preview for every story you touched with **preview-stories** (prefer
`{ storyId }` inputs). Before showing any returned URL to the user, navigate to
it in the preview browser and confirm the story renders without errors.

**Gate:** Every URL you put in your final response MUST have been opened in the
preview browser first — no exceptions, per the Absolute rules. Do NOT report the
story as done until each preview link has been navigated and verified.

## Step 5 — Publish the review page

USE THE STORYBOOK MCP PROXY SERVER.

Once the stories render cleanly, call **display-review** so the user can review
exactly what changed in one place. This tool does NOT just return a link — it
publishes a curated **review page** inside the already-running Storybook and
returns its `reviewUrl`. The review page IS the deliverable; the raw
`preview-stories` URLs from Step 4 are for your own verification.

**Gate:** Do NOT report the task as done until `display-review` has succeeded,
you have opened the returned `reviewUrl` in the preview browser, and that link is
the final element of your user-facing response.
