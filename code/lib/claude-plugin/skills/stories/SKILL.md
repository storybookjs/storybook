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

- You MUST NOT write or edit a story from memory or existing patterns. The
  `get-storybook-story-instructions` output is the only acceptable source for
  imports, structure, and conventions.
- You MUST NOT start Storybook with a Bash command or background task — not
  `npm run storybook`, not `storybook dev`, not `run_in_background`, not a
  detached process. A backgrounded dev server is not a verifiable preview and
  does NOT satisfy this workflow.
- You MUST NOT report a story as done until its preview link has been produced
  and verified (Step 4) AND the review page has been published and opened
  (Step 5). An unverified story, or a change with no review page, is not a
  deliverable.
- Any Storybook dev server URL you show the user (a `preview-stories` URL, a
  story permalink, the Storybook root, an `iframe.html` link — any
  `http(s)://…` pointing at the running Storybook) MUST first be navigated to in
  the preview browser. Do NOT paste a URL you have not opened and confirmed
  renders. If navigation fails, fix it or report the failure — never hand over
  an unopened link.

## Step 1 — Load the rules (before touching any story file)


### Follow the MCP's own workflow first

If the Storybook MCP is reachable through the MCP-proxy, it serves its own
**server instructions** describing the authoritative tool workflow (routing,
documentation lookup, previewing, working on stories, verification). When those
instructions are available, read them and follow them **carefully and exactly** —
they take precedence over any general assumption you might make about the tools.
The gated steps below operate _within_ that MCP-provided workflow; they do not
replace it. If the MCP exposes no instructions (proxy unavailable or Storybook
not registered), fall back to the steps below.


Call **get-storybook-story-instructions** and read it fully. Look components up
with **list-all-documentation** / **get-documentation** rather than assuming
props or APIs.

**Gate:** Do NOT create or edit any `*.stories.*` file until this tool has
returned and you are following its output. If you have not called it this task,
you are not allowed to write a story yet — go back and call it now.

## Step 2 — Guarantee a running preview

The Storybook preview MUST be running so the story can be verified.

If any MCP tool returns a "Storybook is not running" error, you MUST NOT ignore
it and MUST NOT proceed to write the story. STOP and recover — without asking the
user:

1. Inspect `.claude/launch.json` for a launch entry that starts this project's
   Storybook dev server.
    If: 
      - the `.claude/launch.json` file does not exist
      - no such entry exists
      - the storybook entry does not use `autoPort`
    repair it first: invoke the **storybook-setup-claude-launch** skill, which creates or repairs the `.claude/launch.json` Storybook entry.     
2. Start the preview by launching that `.claude/launch.json` entry through the
   Claude launcher (never via Bash/background, per the Absolute rules).
3. Retry the MCP tool call.

**Gate:** Do NOT proceed to Step 3 until an MCP tool call succeeds against a
running Storybook. If launch setup reports an error, surface it to the user and
STOP.

## Step 3 — Write the story

Create or edit the story strictly following the Step 1 instructions.

**Gate:** Every story you touched must conform to the
`get-storybook-story-instructions` output. If anything is unclear, re-read it
rather than guessing.

## Step 4 — Preview and verify

Produce a preview for every story you touched with **preview-stories** (prefer
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

- Group the stories you touched into `collections` covering the **visual
  cascade** of the change: the changed component itself, the components that
  import it, and the pages/containers that render them. Don't ship a
  single-collection review unless the component is genuinely standalone.
- Every `storyId` you pass MUST come from a tool result this session
  (`get-changed-stories`, `get-stories-by-component`, or `list-all-documentation`).
  `display-review` validates every ID against the live index and rejects the
  whole review if any are unknown — never invent IDs.
- Provide `title`, `description`, and `changedFiles` (the files you edited, most
  central first).

Because the `reviewUrl` is a page, you MUST navigate the preview browser to it
(just like any other Storybook URL, per the Absolute rules) — do not merely
print it. Then surface it to the user as the very last thing in your response,
under its own heading (e.g. `## 👀 Review your changes`) as a markdown link, with
nothing after it.

**Gate:** Do NOT report the task as done until `display-review` has succeeded,
you have opened the returned `reviewUrl` in the preview browser, and that link is
the final element of your user-facing response.
