---
name: storybook-startup-benchmark
description: Measure Storybook startup time from spawning `storybook dev` until the first story renders in the browser. Use when the user asks about Storybook boot time, server-ready timing, first story render timing, startup regressions, benchmarking with repeat runs, or comparing Storybook versions or feature flags.
allowed-tools: Bash, Read
---

# Storybook Startup Benchmark

## Purpose

Use this skill to build or explain a repeatable benchmark for Storybook startup:

- `server`: process spawn -> Storybook server responds
- `browser`: server responds -> first story rendered
- `total`: process spawn -> first story rendered

## Quick Start

When asked to benchmark Storybook startup:

1. Confirm the boundary:
   - Start timing immediately before spawning `storybook dev`
   - Open Storybook at `/`, not `iframe.html`
   - Stop timing on first story mount plus one `requestAnimationFrame()`
2. Check whether the repo already has a benchmark script. Reuse it if possible.
3. If not, create a Node script that:
   - starts Storybook with `--no-open`
   - waits for the server to respond
   - launches a browser it controls
   - waits for a preview-side render signal
   - prints JSON results
4. Add `--repeat <count>` support with grouped summary stats.

## Measurement Rules

Use these defaults unless the user asks otherwise:

- Start URL: `/`
- Browser path: normal manager page, let Storybook load the preview iframe itself
- Render signal: first preview story mount + one `requestAnimationFrame()`
- Browser launch: external harness launches the browser, not Storybook
- Auto-open: disable Storybook browser auto-open with `storybook dev --no-open`

Do not measure only CLI output. Server listening is not the same as first story rendered.

## Recommended Implementation

### 1. Preview-side signal

Add a small global preview decorator or component that runs once on the first story mount:

- wait one `requestAnimationFrame()`
- set a global value like `window.__sbStartupBenchmark`
- also mirror that value to `window.top` when same-origin
- optionally call `performance.mark('sb:first-story-rendered')`

Preferred payload:

```ts
{
  firstStoryRenderedAt: performance.now(),
  storyId: id
}
```

### 2. Harness behavior

The benchmark script should:

1. Fail fast if the target Storybook port is already in use
2. Spawn Storybook with `--no-open`
3. Start timing immediately before spawn
4. Wait for HTTP readiness on the Storybook URL
5. Launch a controlled browser to `/`
6. Wait for the preview-side signal
7. Print JSON results
8. Kill the full spawned process group during cleanup

### 3. Repeated runs

For `--repeat N`, print:

- per-run results
- summary stats grouped by `server`, `browser`, and `total`
- human-readable durations like `5.2s` or `2m15s`, not raw millisecond field names

Recommended summary fields:

```json
{
  "server": {
    "average": "5.2s",
    "min": "4.8s",
    "max": "6.1s",
    "p95": "6.0s"
  },
  "browser": {
    "average": "1.9s",
    "min": "1.6s",
    "max": "2.4s",
    "p95": "2.3s"
  },
  "total": {
    "average": "7.1s",
    "min": "6.6s",
    "max": "8.2s",
    "p95": "8.1s"
  }
}
```

## Interpretation Guidance

Use these heuristics when explaining results:

- If `server` grows, the regression is likely on the server/build side.
- If `browser` grows, the regression is likely in manager boot, preview boot, or first-story render.
- If averages are close but `p95` grows a lot, the feature likely increases variability or tail latency.
- If newer Storybook without a feature is much faster than older Storybook, but enabling the feature returns timings to older levels, the feature likely erases the newer startup gains.

## Common Pitfalls

- Existing Storybook already running on the benchmark port
- Storybook auto-opening a separate browser window
- Measuring direct `iframe.html` loads instead of normal `/`
- Leaving child Storybook processes alive between runs
- Treating warm repeated runs as cold-start data

If a repeated benchmark reports unrealistically low `server.average`, first check for a stale Storybook server on the same port.

## Tooling Notes

- Prefer a plain Node script for portability.
- For Chrome-family browsers, remote debugging is a practical control path.
- If Storybook CLI flags or behavior are in question, fetch current Storybook docs first.

## Output Style

When reporting results:

- clearly separate `server`, `browser`, and `total`
- call out averages and p95 first, with min/max as supporting bounds
- highlight whether the regression affects common-case latency, tail latency, or both
- avoid claiming root cause unless the benchmark isolates server vs render behavior

## Example Triggers

Use this skill when the user says things like:

- "How can I test Storybook startup time?"
- "Measure from `storybook dev` to first story render"
- "Compare Storybook startup with and without this feature flag"
- "Run 20 startup measurements and summarize averages"
- "Is this startup regression server-side or render-side?"
