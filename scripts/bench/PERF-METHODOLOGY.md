# Docgen performance methodology

This note is the measurement contract for the per-engine docgen performance suite.
It fixes the metric set, the determinism method, the budget shape, and the CI tiers that the harness and its budgets implement.
The suite measures; it never optimizes.

## Scope

The gated suite runs in plain Node: no browser, no dev server, no Vite.
Each engine is measured through a directly callable entry point:

- React, new engine: `ComponentMetaManager.batchExtract` (`code/renderers/react/src/componentManifest/componentMeta/ComponentMetaManager.ts`).
  `buildDocgenPayload` (`code/renderers/react/src/docgen/buildDocgen.ts`) wraps it with story-file resolution and argTypes conversion, so it measures more work than the bare legacy parse calls; `batchExtract` is the metric of record.
- React, legacy engines: `getReactDocgen` (`code/renderers/react/src/componentManifest/reactDocgen.ts`) and `parseWithReactDocgenTypescript` (`code/renderers/react/src/componentManifest/reactDocgenTypescript.ts`).
  The live legacy paths are builder plugins - a Vite plugin or a webpack loader, some third-party - and cannot run standalone; these wrappers share their extraction logic without being byte-identical to any of them, so legacy numbers describe the engines, not the builder pipelines.
  Both wrappers cache per file for the life of the process and expose only global invalidation; a simulated save must invalidate before re-parsing or the warm sample is a cache hit.
  `react-docgen` is the budgeted legacy control; `react-docgen-typescript` is measurable through the same wrappers but carries no budget row.
- Angular: a standalone Compodoc CLI run.
- Vue, Svelte, and web components: their extraction engines are plain functions callable from Node; exact entry points get pinned when each engine's harness lands.

## Metrics

Five metrics per engine, all candidates for gating:

- **Cold extraction**: time for the first full extraction in a fresh process.
  For engines that build a TypeScript program, this includes building it.
- **Warm extraction**: time to re-extract one changed component after a simulated save, once the process is warm.
- **Whole-project scan**: time for one batch pass over the entire project.
  Only Compodoc works this way, so this metric applies to Compodoc alone; per-component engines record it as n/a rather than a faked equivalent.
- **Peak memory (transient)**: the allocation spike a save causes above the retained baseline, sampled around forced GC.
- **Leak detection**: retained-heap growth after the save series, plus the least-squares slope of retained heap over that series.

Compodoc maps onto these differently because it is a fresh CLI process per run: cold extraction and whole-project scan are the same full-project measurement, warm extraction is a second full run after touching one file, and peak memory is the child's peak RSS sampled from outside the process.
Whether the retained-series metrics mean anything for a fresh-process engine is settled when its baselines are recorded; until then its leak cells stay placeholders.

The memory and leak half exists today in `scripts/bench/docgen-memory/` (`yarn bench:docgen-memory` from `scripts/`).
The latency half is new: the current harness measures per-save duration but throws it away, so recording cold, warm, and scan timings is work for the per-engine harness.

## Determinism method

- **Fixed synthetic projects.**
  Inputs come from a generator with fixed parameters (component count, props per component, type-heaviness levers), never from real-world checkouts.
  The existing generator is `scripts/bench/docgen-memory/generate-project.ts`.
- **Warmup.**
  Every run starts with one full cold pass.
  That pass is the cold-extraction sample and is excluded from all warm samples.
  This exists today in the refresh mode of `scripts/bench/docgen-memory/memory-harness.ts`; live mode skips it by design.
- **Median-of-N for latency.**
  Each latency metric records a median, never a single-run number.
  Cold extraction and whole-project scan yield one sample per fresh process, so their N samples come from N spawns.
  Warm extraction records the median of the per-save durations inside a single run's save series.
  The harness pins one N for all engines and records it with the results; numbers taken at different N are not comparable.
  None of this exists today - the current gate runs each configuration exactly once.
- **Series statistics for leak metrics.**
  Retained slope is a least-squares fit over the save series; retained growth is the delta between the final retained sample and the pre-run baseline.
  Both read one run's series instead of repeated runs.
  This exists today.
- **Series mean for transient memory.**
  Peak memory (transient) is the mean of the per-save spikes across the save series - not repeated and medianed like cold latency, not slope-fitted like retained slope.
  Warm latency, transient memory, and the leak metrics all read the same fixed-length series from the same run.
  This exists today in `scripts/bench/docgen-memory/memory-harness.ts`.
- **Fresh process per measurement.**
  Every measured process is spawned fresh so it starts from a clean heap.
  This exists today in `scripts/bench/docgen-memory/gate.ts`.
- **Relative comparison on the same machine.**
  Perf questions are answered by ratios between runs executed sequentially inside a single CI job on one executor, or on one local machine.
  "Same machine" means exactly that; cross-job, cross-run, and cross-PR comparisons are non-comparisons because CI executors are ephemeral and not guaranteed identical.
  The two standing comparisons are docgen-server flag on vs off, and new engine vs legacy engine, both measured in the same run.
  Paired runs alternate their order across repetitions so cache warming and thermal drift do not consistently favor one side.

## Budget shape

Timing budgets are ratios or slopes, never absolute milliseconds; absolute wall-clock on shared CI executors is too noisy to gate.
A timing ratio divides the median of one side by the median of the other, both measured in the same job.
The calibration reference for React is the legacy-vs-new-engine ratio measured in the same run on the same machine.
Engines without a second implementation in the same job get their timing reference picked when their baselines are recorded; until then their timing budgets stay placeholders.
Memory budgets stay absolute megabytes with generous headroom: budgets sit well above observed values so the gate is not flaky, while still failing hard on a real regression.
Every engine must also carry its own negative control - a configuration that must fail, proving the gate can catch the regression class it exists for.
A control names its lever and the one metric it must trip; it does not need to trip every metric, and where no credible lever exists the gap is recorded instead of inventing a hollow control.
The only worked example today is the React memory gate's out-of-memory control.
Budgets and controls are derived per engine from that engine's own baseline runs; nothing is ported between engines.

## CI tiers

- **Per PR: report-only.**
  Per-PR perf jobs attach to the unconditional job block of the generated CircleCI config (`scripts/ci/main.ts`), where the package benchmark job already runs on every build without gating.
  They report numbers and never fail the build.
- **Daily: the only gating tier.**
  "Daily" names the CircleCI `workflow=daily` pipeline parameter (tier order `normal < merged < daily`, `scripts/ci/utils/types.ts`); daily-only jobs attach in `scripts/ci/main.ts`, where the docgen memory gate already runs.
- **The daily cadence is unproven.**
  The only trigger for the daily tier in version control is the `ci:daily` PR label (`.github/workflows/trigger-circle-ci-workflow.yml`); no scheduled trigger exists in the repo, and no CircleCI-side schedule is confirmed to exist.
  Until that is resolved, gating on the daily tier means gating when someone applies the label.
  The baseline-and-budget work must settle the cadence before this gate can be described as nightly protection.

## User-perceived metrics

Three user-perceived metrics join the suite as report-only extensions of the sandbox bench task; none joins the gated floor.
They need a real dev server and Chromium, which makes them variance-heavy; they exist to show user-visible impact, not to gate.
All three build on existing tooling and add no new dependencies:

- **Dev-server startup delta.**
  Run the sandbox bench task (`scripts/tasks/bench.ts` driving `scripts/bench/browse.ts` over Playwright/Chromium, with dev-server readiness timings from `scripts/tasks/dev.ts`) twice, docgen-server feature on and off, and report the delta.
  Today only the internal Storybook config reads the on/off switch (`code/.storybook/main.ts`); generated sandboxes do not, so the harness work must inject the feature toggle into the sandbox config before the delta can be measured there.
  No first-class on/off comparison mode exists yet; today this is two runs diffed by hand.
- **Time-to-Controls-populated.**
  Adapt the existing Playwright flow that selects a story, opens the Controls panel, and waits for an args-table cell (`code/e2e-internal/docgen-hot-update.spec.ts`) into a timing probe, using the elapsed-time pattern from `browse.ts`.
  Today that flow is a pass/fail assertion and records no elapsed time.
- **Docs-page props-table render.**
  `benchAutodocs` in `scripts/bench/browse.ts` times the docs page today, but its wait on the component description text is a locator construction with no real wait condition, so the recorded number mostly reflects page load.
  The probe waits on a props-table element with a real wait condition; it does not exist yet.

## Budgets table skeleton

The baseline work fills in the values; until then every cell is a placeholder.

| Engine                                    | Cold extraction | Warm extraction | Whole-project scan | Peak memory (transient) | Retained growth | Retained slope | Negative control | Tier       |
| ----------------------------------------- | --------------- | --------------- | ------------------ | ----------------------- | --------------- | -------------- | ---------------- | ---------- |
| react-legacy (react-docgen, control)      | TBD (1.12)      | TBD (1.12)      | n/a                | TBD (1.12)              | TBD (1.12)      | TBD (1.12)     | TBD (1.12)       | TBD (1.12) |
| react-osa (react-component-meta, control) | TBD (1.12)      | TBD (1.12)      | n/a                | TBD (1.12)              | TBD (1.12)      | TBD (1.12)     | TBD (1.12)       | TBD (1.12) |
| vue-component-meta                        | TBD (1.12)      | TBD (1.12)      | n/a                | TBD (1.12)              | TBD (1.12)      | TBD (1.12)     | TBD (1.12)       | TBD (1.12) |
| compodoc                                  | TBD (1.12)      | TBD (1.12)      | TBD (1.12)         | TBD (1.12)              | TBD (1.12)      | TBD (1.12)     | TBD (1.12)       | TBD (1.12) |
| svelte (stretch)                          | TBD (1.12)      | TBD (1.12)      | n/a                | TBD (1.12)              | TBD (1.12)      | TBD (1.12)     | TBD (1.12)       | TBD (1.12) |
| cem (stretch)                             | TBD (1.12)      | TBD (1.12)      | n/a                | TBD (1.12)              | TBD (1.12)      | TBD (1.12)     | TBD (1.12)       | TBD (1.12) |
