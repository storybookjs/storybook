---
name: storybook-stories
description: >-
  Write, create, update, or review Storybook stories. Use whenever the user asks to write, add, or generate stories, to
  write Storybook stories for a component or project, to cover a component with
  stories, or to create or edit any *.stories.* file
  (.stories.tsx/.ts/.jsx/.js/.svelte/.vue) — and when building or changing a UI
  component that should have stories, or before starting or previewing Storybook
  to verify UI. Pulls story-writing guidance from the Storybook MCP, keeps the
  preview running so stories can be verified, and repairs the Claude launch
  config when Storybook is not running.
---

# Storybook Stories

The Storybook MCP is the source of truth for _how_ to write stories. This skill
covers the workflow around it.

NEVER start Storybook with a Bash command or background task — not
`npm run storybook`, not `storybook dev`, not `run_in_background`, not a
detached process. A backgrounded dev server is not a verifiable preview and does
not satisfy this workflow.

## Workflow

1. Before writing or editing a story, call **get-storybook-story-instructions**
   and follow its guidance. Look components up with **list-all-documentation** /
   **get-documentation** rather than assuming props or APIs.
2. ALWAYS make sure the Storybook preview is running so the story can be
   verified — an unverified story is not a deliverable.

   If an MCP tool returns a "Storybook is not running" error, you MUST NOT ignore
   it and MUST NOT write or edit the story from existing patterns. STOP and
   recover first — without asking the user:
   1. Look at `.claude/launch.json` for a launch entry that starts this
      project's Storybook dev server.
   2. If that entry is missing or does not contain the Storybook command, repair
      it first: invoke the **storybook-setup-claude-launch** skill, which creates
      or repairs the `.claude/launch.json` Storybook entry.
   3. Start the preview by launching that `.claude/launch.json` entry through the
      Claude launcher.
   4. Retry the MCP tool call. Only continue once it succeeds. If launch setup
      reports an error, surface it to the user and stop.

3. After changes, call **preview-stories** and share the relevant preview links
   in your final response.
