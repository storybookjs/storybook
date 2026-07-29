---
id: "003"
title: Remove core Playwright CT API
type: task
status: open
assignee: null
blocked_by: ["001", "002"]
---

## Question

Remove `createPlaywrightTest` and all `@storybook/*/experimental-playwright` exports from core and renderers (react, vue3, svelte), including build-config and package.json export entries. Ensure portable-stories core remains intact for Vitest.
