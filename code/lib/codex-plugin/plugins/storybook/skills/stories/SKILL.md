---
name: stories
description: Write, create, update, or review Storybook stories for a component or a whole project. Use whenever the user asks to write, add, or generate stories, to write Storybook stories for a component or project, to cover a component with stories, or to create or edit any *.stories.* file (.stories.tsx/.ts/.jsx/.js/.svelte/.vue) — and when building or changing a UI component that should have stories, or before starting or previewing Storybook to verify UI. Pulls story-writing guidance from the Storybook MCP and keeps the preview running so stories can be verified.
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

- You MUST NOT write or edit a story from memory or existing patterns. The
  `get-storybook-story-instructions` output is the only acceptable source for
  imports, structure, and conventions.
- You MUST NOT report a story as done until its preview link has been produced
  (Step 4). An unverified story is not a deliverable.

## Step 1 — Load the rules (before touching any story file)

Call **get-storybook-story-instructions** and read it fully. Look components up
with **list-all-documentation** / **get-documentation** rather than assuming
props or APIs.

**Gate:** Do NOT create or edit any `*.stories.*` file until this tool has
returned and you are following its output. If you have not called it this task,
you are not allowed to write a story yet — go back and call it now.

## Step 2 — Guarantee a running preview

The Storybook preview MUST be running so the story can be verified.

If any MCP tool returns a "Storybook is not running" error, you MUST NOT ignore
it and MUST NOT proceed to write the story. STOP and recover:

1. Start the project's existing Storybook dev script as a background task from
   the Storybook invocation directory, and open it in Codex's in-app browser.
2. Use that invocation directory as the `cwd` for MCP tool calls.
3. Retry the MCP tool call. If Storybook is not configured yet, use the `init`
   skill; if it is outdated, use the `upgrade` skill.

**Gate:** Do NOT proceed to Step 3 until an MCP tool call succeeds against a
running Storybook.

## Step 3 — Write the story

Create or edit the story strictly following the Step 1 instructions.

**Gate:** Every story you touched must conform to the
`get-storybook-story-instructions` output. If anything is unclear, re-read it
rather than guessing.

## Step 4 — Verify and share links

After changes, call **preview-stories** and include the relevant preview links in
your final user-facing response.

**Gate:** Do NOT claim the task is complete until preview links exist for the
stories you created or changed.
