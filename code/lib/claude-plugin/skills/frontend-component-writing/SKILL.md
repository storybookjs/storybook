---
name: frontend-component-writing
description: >-
  Use on EVERY edit to a frontend component, with no exception. Triggers on
  creating or editing any frontend component (React/Vue/Svelte and similar
  *.tsx/.jsx/.ts/.js/.vue/.svelte files) or anything it renders with: props,
  variants, states, markup, layout, styling, CSS/Tailwind/styled-components,
  themes, tokens, icons, or assets. Invoke this even if you believe the change
  is cosmetic-only, internal, a refactor, or has "no behavior change" — that
  judgment is NOT yours to make here; the skill always runs. Ensures every
  component edit is reflected in its Storybook stories by handing off to the
  `stories` skill.
---

# Frontend Component Writing

Frontend components and their Storybook stories must stay in sync. Whenever you
touch a component file — for ANY reason — its stories MUST be created or updated
to match. Do NOT decide for yourself that an edit is "cosmetic", "internal", a
"refactor", or has "no behavior change" and skip the story step: that exemption
does not exist. If you edited a component, the story step runs.

This is a MANDATORY companion step **when Storybook is already set up** in the
project. If Storybook is not installed, do not force it — see "When Storybook is
not installed" below.

## Absolute rules

- After you create or modify a frontend component (add/remove/rename props,
  change variants, states, defaults, markup, or styling) **in a project that has
  Storybook**, you MUST update that component's Storybook stories so they reflect
  the change.
- You MUST NOT write or edit any `*.stories.*` file directly from here. All story
  work goes through the **`stories`** skill, which owns the strict, gated
  Storybook workflow (loading the MCP rules, guaranteeing a running preview, and
  producing a verifiable preview link).
- You MUST NOT report a component change as complete until the corresponding
  story work has been handed off to the `stories` skill and finished.

## Workflow

1. Make the component change the user asked for, following the surrounding
   code's conventions.
2. Determine whether the project has Storybook. If it does NOT, go to "When
   Storybook is not installed" and stop here unless the user opts in.
3. Identify the component's story file (`*.stories.tsx/.ts/.jsx/.js/.vue/.svelte`).
   If one does not exist yet for a new component, it still needs stories.
4. Invoke the **`stories`** skill to create or update the stories for the
   component you just touched. Tell it which component changed and what changed
   (new props, new variants, renamed states, etc.) so it can cover the new
   surface.
5. Let the `stories` skill run its full gated workflow — including producing the
   preview link — and surface that link in your final response.

**Gate:** Do NOT consider the component task done until the `stories` skill has
completed its workflow for every component you created or modified. A component
change without matching, verified stories is not a deliverable.

## When Storybook is not installed

Installing and configuring Storybook is invasive, so it is the **user's choice**.
Never set it up on your own initiative as a side effect of a component change.

Before asking the user anything, check whether they have already declined:

1. **Read the saved decision** at `.claude/storybook-optout.json` (project-local).
   If it exists with `{ "storybookOptOut": true }`, the user has ALREADY refused
   Storybook for this project. Do NOT ask again — silently skip all story work,
   finish the component change, and move on.
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

   Then finish the component change without any story work.
4. **If the user opts in**, set Storybook up via the setup skills
   (`storybook-init` / `storybook-setup`), then resume the Workflow above from
   step 3. If an opt-out file existed from a previous "no", delete it.

**Gate:** Do NOT install Storybook, scaffold `.storybook/`, add Storybook
dependencies, or invoke the setup skills unless the user has explicitly opted in
this time. A saved opt-out MUST be respected on every later invocation without
re-prompting.
