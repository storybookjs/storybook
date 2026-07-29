---
id: "005"
title: Remove Playwright CT test fixtures and CI
type: task
status: open
assignee: null
blocked_by: ["001"]
---

## Question

Remove CT kitchen-sink fixtures (`*.playwright.tsx|ts`, `playwright-ct.config.ts`, `@playwright/experimental-ct-*` deps), the `playwright-ct` NX target, and CI jobs in `scripts/ci/test-storybooks.ts` — without breaking remaining Playwright E2E or Vitest kitchen-sink runs.
