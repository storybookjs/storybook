---
name: storybook-development-workflow
description: Use when making code changes in the Storybook repo — covers the standard workflow for normal changes, addon/framework/renderer work, testing expectations, and code quality rules
---

# Storybook Development Workflow

## For Normal Code Changes

1. Install if needed: `yarn`
2. Compile with NX: `yarn nx run-many -t compile`
3. Make changes
4. Recompile affected packages
5. Validate no TypeScript errors: `yarn nx run-many -t check`
6. Run relevant lint and tests
7. Validate in the internal Storybook UI first, then switch to sandbox or `-c production` only if you need template or CI parity

## For Addon, Framework, or Renderer Work

1. Edit the relevant package under `code/addons/`, `code/frameworks/`, or `code/renderers/`
2. Recompile with NX, starting without `-c production`
3. Generate a matching sandbox
4. Run the relevant test-runner, E2E, or Storybook UI validation flow

## Testing Expectations

- `yarn test` for unit tests
- Storybook UI or Chromatic for visual validation
- `yarn task e2e-tests-dev --start-from auto` for E2E coverage
- `yarn task test-runner-dev --start-from auto` for test-runner scenarios
- `yarn task smoke-test --start-from auto` for smoke checks
- Watch mode: `yarn test:watch` or `yarn storybook:vitest`

When writing tests:

- Export functions that need direct tests
- Test real behavior, not just syntax patterns
- Use coverage when useful: `yarn vitest run --coverage <test-file>`
- Mock external dependencies like file system access and loggers

## Visual Verification

After implementing a feature or fixing a bug, visually verify the result in the browser:

- **With browser access** (e.g. Claude Code with `--chrome` flag / CDP access): Start the Storybook UI (`cd code && yarn storybook:ui`) or a sandbox, navigate to the relevant story or UI area where the change is visible, and take a screenshot to verify the fix or feature yourself. Use browser automation tools to inspect the rendered output and confirm correctness.
- **Without browser access**: Start the Storybook UI or sandbox, then tell the user which story or URL to open in their browser so they can visually verify the change themselves.

In both cases, make sure to navigate to the most relevant story — not just the index page. If a specific story doesn't exist yet for the change, consider adding one.

## Quality and Logging

After changing files:

1. Format with `cd code && oxfmt`
2. Lint with `yarn --cwd code lint:js:cmd <file-relative-to-code-folder> --fix`
3. Run relevant tests before submitting a PR

Use Storybook loggers instead of raw `console.*`:

- Server-side: `storybook/internal/node-logger`
- Client-side: `storybook/internal/client-logger`

Prefer explicit file extensions for relative imports (e.g., `./foo.ts`, `./bar.tsx`). Keep framework-specific imports (`.vue`, `.svelte`) as-is.

The pre-commit hook auto-detects AI agents (via `std-env`) and switches to write mode, so formatting is auto-fixed when agents commit.

Avoid `console.log`, `console.warn`, `console.error` unless importing the logger is not reasonable.
