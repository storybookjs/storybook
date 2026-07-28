# Docgen performance methodology

This note is the measurement contract for the per-engine docgen performance suite.
It fixes the metric set, the determinism method, the budget shape, and the CI tiers that the harness and its budgets implement.
The suite measures; it never optimizes.

## Scope

The gated suite runs in plain Node: no browser, no dev server, no Vite.
Where an engine only runs inside a builder plugin in production, the harness calls its extraction logic directly, so the numbers describe the engine rather than the plugin around it.
The budgets table at the end of this note names every engine and its role.

An engine whose cost moves between versions is pinned to one exact version, and its numbers only hold at the version recorded beside them.
`react-docgen-typescript` is measured through the same wrapper as `react-docgen` but carries no budget of its own.
Svelte and web components join when their harnesses land.

## Metrics

Five metrics per engine, all candidates for gating:

- **Cold extraction**: time for the first full extraction in a fresh process.
  For engines that build a TypeScript program, this includes building it.
- **Warm extraction**: time to re-extract one changed component after a simulated save, once the process is warm.
- **Whole-project scan**: time for one batch pass over the entire project.
  Only Compodoc works this way, so this metric applies to Compodoc alone; per-component engines record it as n/a rather than a faked equivalent.
- **Peak memory (transient)**: the memory a save claims above the retained baseline and then gives back, sampled around a forced garbage collection.
- **Leak detection**: how much retained heap is left after the save series, plus how steeply it climbed per save across it.

Compodoc maps onto these differently because it is a fresh CLI process per run: cold extraction and whole-project scan are the same full-project measurement, warm extraction is a second full run after touching one file, and peak memory is the child's peak RSS sampled from outside the process.
Whether the retained-series metrics mean anything for a fresh-process engine is settled when its baselines are recorded; until then its leak cells stay placeholders.

Two harnesses implement this.
`scripts/bench/docgen-memory/` (`yarn bench:docgen-memory`) gates React memory and is the only tier that fails a build today.
`scripts/bench/docgen-perf/` (`yarn bench:docgen-perf`) records all five metrics for every engine and gates nothing yet, because no budget values exist.

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
  That run is the repetition whose cold sample is the median, never the first: repetition 1 pays for a cold module graph and a cold page cache, and measures several times slower than the rest.
  The harness pins one N for all engines and records it with the results; numbers taken at different N are not comparable.
  An engine that fails part-way through its repetitions is reported as failed, never as measured at an N it did not reach.
  `scripts/bench/docgen-perf/aggregate.ts` implements this; the memory gate still runs each configuration exactly once.
- **Series statistics for leak metrics.**
  Retained slope is the slope of a straight line drawn through the whole save series, so no single noisy sample can swing it; retained growth is the difference between the last retained sample and the baseline taken before the run.
  Both read one run's series instead of repeated runs.
  This exists today.
- **Series mean for transient memory.**
  Peak memory (transient) is the mean of the per-save spikes across the save series - not repeated and medianed like cold latency, and not fitted to a line like retained slope.
  Warm latency, transient memory, and the leak metrics all read the same fixed-length series from the same run.
  This exists today in `scripts/bench/docgen-memory/memory-harness.ts`.
- **Fresh process per measurement.**
  Every measured process is spawned fresh so it starts from a clean heap.
  This exists today in `scripts/bench/docgen-memory/gate.ts`.
- **Relative comparison on the same machine.**
  Perf questions are answered by ratios between runs executed sequentially inside a single CI job on one executor, or on one local machine.
  "Same machine" means exactly that; comparing across jobs, runs or PRs is not a comparison at all, because each CI executor is thrown away after its run and the next one is not guaranteed to match it.
  The two standing comparisons are docgen-server flag on vs off, and new engine vs legacy engine, both measured in the same run.
  Paired runs alternate their order across repetitions, so neither a warm cache nor a machine that has heated up consistently favors one side.

## Budget shape

Timing budgets are ratios or slopes, never absolute milliseconds; absolute wall-clock on shared CI executors is too noisy to gate.
A timing ratio divides the median of one side by the median of the other, both measured in the same job.
An engine with a second implementation to compare against uses that pair as its reference; an engine without one gets its reference picked when its baselines are recorded, and until then its timing budget stays a placeholder.

A ratio only means something when both sides did the same work.
Engines resolve types to different depths, and a shallower one finishes faster while documenting less, so speed and thoroughness are easy to mistake for each other.
Every engine therefore reports how many members it documented, the suite prints those counts beside every ratio, warm as well as cold, and a pair whose counts disagree is marked not like-for-like.
A ratio marked not like-for-like must not become a budget.

A member count alone is not always enough.
An engine that records a type's name without ever looking through it documents exactly as many members as one that expands the whole chain, at a fraction of the cost.
Such an engine also reports how many of its documented members carry a type it never resolved, and that count has to agree too before a pair counts as like-for-like.

A ratio also has to be shaped like production before it describes a saving anyone would feel.
Where the harness gives both sides equal work but production would give them unequal work, the ratio compares the engines and nothing else, and that has to be said beside the number.
Where an engine's warm measurement covers the whole project instead of the one member that changed, it is not comparable with a per-member warm count at all.

Not every difference between engines is a timing question.
An engine that takes a shortcut costing fidelity rather than time produces two rows nobody can tell apart, so it belongs in the docgen-harness fixtures that pin engine behavior, not in a bench scenario.

The baseline work records the figures; quoting any here would pin numbers taken at one profile on one machine.
Memory budgets stay absolute megabytes with generous headroom: budgets sit well above observed values so the gate is not flaky, while still failing hard on a real regression.
Every engine must also carry its own negative control - a configuration that must fail, proving the gate can still catch the kind of regression it exists for.
A control names its lever and the one metric it must trip; it does not need to trip every metric, and where no credible lever exists the gap is recorded instead of inventing a control that proves nothing.
The only worked example today is the memory gate's out-of-memory control, and the budgets table below says which engine it covers.
Budgets and controls are derived per engine from that engine's own baseline runs; nothing is ported between engines.

## CI tiers

- **Per PR: report-only.**
  Per-PR perf jobs run in the part of the generated CircleCI config (`scripts/ci/main.ts`) that runs on every build, alongside the package benchmark, which already reports there without gating.
  They report numbers and never fail the build.
- **Daily: the only gating tier.**
  "Daily" names the CircleCI `workflow=daily` pipeline parameter (tier order `normal < merged < daily`, `scripts/ci/utils/types.ts`); daily-only jobs attach in `scripts/ci/main.ts`, where the docgen memory gate already runs.
- **How often daily runs is unproven.**
  The only trigger for the daily tier in version control is the `ci:daily` PR label (`.github/workflows/trigger-circle-ci-workflow.yml`); no scheduled trigger exists in the repo, and no CircleCI-side schedule is confirmed to exist.
  Until that is resolved, gating on the daily tier means gating when someone applies the label.
  The baseline-and-budget work must settle how often it runs before this gate can be called nightly protection.

## User-perceived metrics

Three user-perceived metrics join the suite as report-only extensions of the sandbox bench task; none joins the gated floor.
They need a real dev server and Chromium, so their numbers jump around a lot; they exist to show user-visible impact, not to gate.
All three build on existing tooling and add no new dependencies:

- **Dev-server startup, with the feature on and off.**
  Run the sandbox bench task (`scripts/tasks/bench.ts` driving `scripts/bench/browse.ts` over Playwright/Chromium, with dev-server readiness timings from `scripts/tasks/dev.ts`) twice, docgen-server feature on and off, and report the difference.
  Today only the internal Storybook config reads the on/off switch (`code/.storybook/main.ts`); generated sandboxes do not, so the harness work must inject the feature toggle into the sandbox config before the difference can be measured there.
  No first-class on/off comparison mode exists yet; today this is two runs diffed by hand.
- **Time-to-Controls-populated.**
  Adapt the existing Playwright flow that selects a story, opens the Controls panel, and waits for an args-table cell (`code/e2e-internal/docgen-hot-update.spec.ts`) into a timing measurement, using the elapsed-time pattern from `browse.ts`.
  Today that flow is a pass/fail assertion and records no elapsed time.
- **Docs-page props-table render.**
  `benchAutodocs` in `scripts/bench/browse.ts` times the docs page today, but it only builds a locator for the component description and never waits on it, so the recorded number mostly reflects page load.
  The replacement waits for a props-table element to actually appear; it does not exist yet.

## Budgets table skeleton

The baseline work fills in the values; until then every cell is a placeholder.
The exception is react-osa's memory row, which the docgen memory gate already enforces from `scripts/bench/docgen-shared/budgets.ts`.

| Engine                                    | Cold extraction | Warm extraction | Whole-project scan | Peak memory (transient) | Retained growth | Retained slope | Negative control | Tier       |
| ----------------------------------------- | --------------- | --------------- | ------------------ | ----------------------- | --------------- | -------------- | ---------------- | ---------- |
| react-legacy (react-docgen, control)      | TBD (1.12)      | TBD (1.12)      | n/a                | TBD (1.12)              | TBD (1.12)      | TBD (1.12)     | TBD (1.12)       | TBD (1.12) |
| react-osa (ComponentMetaManager, control)  | TBD (1.12)      | TBD (1.12)      | n/a                | 90MB                    | 60MB            | 3MB/save       | OOM (gate.ts)    | daily      |
| vue-docgen-api (legacy, current default)  | TBD (1.12)      | TBD (1.12)      | n/a                | TBD (1.12)              | TBD (1.12)      | TBD (1.12)     | TBD (1.12)       | TBD (1.12) |
| vue-component-meta                        | TBD (1.12)      | TBD (1.12)      | n/a                | TBD (1.12)              | TBD (1.12)      | TBD (1.12)     | TBD (1.12)       | TBD (1.12) |
| compodoc                                  | TBD (1.12)      | TBD (1.12)      | TBD (1.12)         | TBD (1.12)              | TBD (1.12)      | TBD (1.12)     | TBD (1.12)       | TBD (1.12) |
| svelte (stretch)                          | TBD (1.12)      | TBD (1.12)      | n/a                | TBD (1.12)              | TBD (1.12)      | TBD (1.12)     | TBD (1.12)       | TBD (1.12) |
| cem (stretch)                             | TBD (1.12)      | TBD (1.12)      | n/a                | TBD (1.12)              | TBD (1.12)      | TBD (1.12)     | TBD (1.12)       | TBD (1.12) |
