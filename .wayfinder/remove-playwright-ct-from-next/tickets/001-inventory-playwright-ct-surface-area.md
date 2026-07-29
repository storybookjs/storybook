---
id: "001"
title: Inventory Playwright CT surface area
type: research
status: closed
assignee: agent
blocked_by: []
---

## Question

What is the complete, authoritative inventory of Playwright CT-specific code, docs, CI, and dependencies in this repo — file by file — so removal tickets don't miss cross-links or leave dead exports?

Include: core API (`createPlaywrightTest`), renderer `experimental-playwright` exports, build config entries, docs pages and snippets, doc cross-links, test-storybooks CT fixtures, NX/CI targets, and any sandbox or script references. Explicitly mark what is CT-only vs shared portable-stories / E2E Playwright.

## Resolution

Full file-by-file inventory captured in [research/001-inventory-playwright-ct-surface-area.md](../research/001-inventory-playwright-ct-surface-area.md). CT surface is narrow (~55 references, ~20 fixture files); no sandbox templates or unit tests for `createPlaywrightTest` outside kitchen-sink. Portable stories core and Playwright E2E paths confirmed out of scope.
