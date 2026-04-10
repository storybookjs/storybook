# Feature Pitch: StorybookTestResultReporter

**Date**: 2026-04-10
**Status**: Backlog
**Context**: Discovered during WS1 agentic telemetry revision design

## Problem

When users (or AI agents) run `npx vitest run` directly — not through Storybook's UI test addon — Storybook has no visibility into test results. The `configureVitest` hook in the `storybookTest()` vitest plugin already fires a `test-run` telemetry event that tells us *a run happened*, but not *what the results were*.

## Proposal

Inject a lightweight `StorybookTestResultReporter` into vitest's reporter pipeline via the `configureVitest` hook. This reporter:

1. Implements vitest's `Reporter` interface (specifically `onTestRunEnd`)
2. On test run completion, writes a summary to Storybook's file cache (`node_modules/.cache/storybook/{version}/default/test-run-results/`)
3. Stores both **aggregate stats** and a **per-story result map**
4. Is invisible to the user — no stdout/stderr output, and slowdown must be acceptable

### Cache Entry Shape

```typescript
{
  timestamp: number,
  totalTests: number,
  passedTests: number,
  failedTests: number,
  skippedTests: number,
  unhandledErrors: number,
  durationMs: number,
  reason: string,  // 'passed' | 'failed' | 'interrupted'
  testResults: Record<string, 'pass' | 'fail' | 'skip'>,  // storyId → result
}
```

### Technical Feasibility (Verified)

- The `configureVitest` hook runs **before** reporters are instantiated (vitest resolves reporters from config after all plugin hooks)
- We can push a Reporter instance directly to `context.vitest.config.reporters` — vitest's `createReporters()` passes instances through as-is
- The `onTestRunEnd(testModules, unhandledErrors, reason)` hook provides all needed data
- Story IDs are available in test metadata (set by Storybook's vitest transform)
- Multiple run records can coexist in cache (keyed by `test-run-{timestamp}`)

## Value Propositions

### 1. Prepopulate Test Statuses on Dev Server Launch

When `sb dev` starts, read cached test results and hydrate the sidebar with pass/fail badges immediately — before the user runs any tests. "Your stories passed/failed last time you ran tests." Staleness check: ignore results older than 24h or where the source file mtime is newer than the cached result.

The addon-vitest already has infrastructure to display test states in the sidebar; it would just need to hydrate from cache instead of waiting for a live run.

### 2. AI Agent Feedback Loop

After `sb ai prepare` instructs an agent to run vitest, subsequent CLI boots can read cached results and include them in `ai-prepare-evidence` telemetry — one event per cached run, then flush. This tells us not just "an agent ran tests" but "tests passed/failed at these rates."

### 3. Cross-Tool Result Sharing

Any tool that reads the Storybook cache could display recent test results — CI dashboard integrations, IDE extensions, or future Storybook features.

### 4. Test Regression Detection

Compare current run results against cached previous results to detect regressions without needing a full CI setup. Could power notifications like "3 stories that passed last run are now failing", or complement our "Change Review" project.

### 5. Smart Test Prioritization

Cache historical pass/fail data to inform test ordering — run previously-failing tests first for faster feedback. Vitest already has a sequencer API that could consume this data.

### 6. Flaky Test Highlighting

Show in the UI which tests have had a history of failing locally (possibly via a more elaborate mechanism that users can then commit to git).

## Cost

- One new file (~80-100 lines) implementing the reporter
- One additional reporter instance pushed to vitest config (zero user-visible impact)
- Small cache writes on each test run completion (~1-10KB per run depending on story count)
- No new dependencies