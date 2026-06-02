---
name: stories
description: Write, create, update, or review Storybook stories for a component or a whole project. Use whenever the user asks to write, add, or generate stories, to write Storybook stories for a component or project, to cover a component with stories, or to create or edit any *.stories.* file (.stories.tsx/.ts/.jsx/.js/.svelte/.vue) — and when building or changing a UI component that should have stories, or before starting or previewing Storybook to verify UI. Pulls story-writing guidance from the Storybook MCP and keeps the preview running so stories can be verified.
---

# Storybook Stories

The Storybook MCP is the source of truth for _how_ to write stories. This skill
covers the workflow around it.

## Workflow

1. Before writing or editing a story, call **get-storybook-story-instructions**
   and follow its guidance. Look components up with **list-all-documentation** /
   **get-documentation** rather than assuming props or APIs.
2. ALWAYS make sure the Storybook preview is running so the story can be
   verified. If the MCP reports Storybook is not running, start it before
   continuing — an unverified story is not a deliverable.
3. After changes, call **preview-stories** and share the relevant preview links
   in your final response.

## Starting the preview (Codex)

If Storybook is not running, start the project's existing dev script as a
background task from the Storybook invocation directory and open it in Codex's
in-app browser, then retry the MCP tool call. If Storybook is not configured yet,
use the `init` skill; if it is outdated, use `upgrade`.
