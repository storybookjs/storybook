---
name: setup-storybook
description: >
  Use when setting up Storybook in a project: writing the initial preview
  configuration, decorators, and example stories for existing components.
  Trigger this skill after `storybook init` has installed Storybook, or
  whenever the user asks to "set up Storybook", "configure Storybook",
  or "write stories for my components".
---

# Storybook Setup

> **Managed by Storybook.** This file is installed and updated by `@storybook/cli`. It is symlinked from `node_modules/@storybook/cli/skills/setup-storybook/SKILL.md`, so it refreshes automatically when you upgrade Storybook. Edit the symlink target only if you know what you're doing — your changes will be overwritten on the next install.

This skill helps you finish setting up Storybook in a project that already has it installed. It does **not** install Storybook from scratch — for that, run `npx storybook init` first.

## How to use this skill

Run the following command and follow its output exactly:

```bash
npx storybook ai prepare
```

This command inspects the project's Storybook configuration and prints a tailored markdown prompt with:

- A project info table (version, renderer, framework, builder, addons, CSF format)
- Renderer-specific documentation links
- Step-by-step instructions for analyzing the codebase, configuring `preview.ts` or `preview.tsx` with the right decorators, writing example stories, and verifying them with Vitest

**Treat the output of `storybook ai prepare` as your authoritative instructions.** Do not improvise setup steps from memory — the command's output is generated from the project's actual configuration and stays in sync with the installed Storybook version.

## When NOT to use this skill

- The user wants to add Storybook to a fresh project → run `npx storybook init` instead
- The user is asking general questions about Storybook → fetch https://storybook.js.org/llms.txt or append `.md` to any docs URL
- The user wants to upgrade Storybook → run `npx storybook upgrade`
