# Docgen performance methodology

This note sets out how the per-engine docgen performance suite measures things, and what its numbers are allowed to mean.
It fixes the metrics we record, the rules that make a run repeatable, the shape a budget may take, and the CI tier that gates — all of which the harness and its budgets then implement.
The suite only measures; it never optimizes.

## Scope

The gated suite runs in plain Node, with no browser, no dev server and no Vite involved.
Several engines only run inside a builder plugin in production, and in those cases the harness calls the extraction logic directly, so the numbers describe the engine rather than the plugin wrapped around it.
The budgets table at the end of this note names every engine and the role it plays.

Where an engine's cost moves between versions we pin it to one exact version, and its numbers then only hold at the version recorded beside them.
`react-docgen-typescript` is measured through the same wrapper as `react-docgen`, though it carries no budget of its own.
Svelte and web components join once their harnesses land.

## Metrics

Five metrics per engine, all candidates for gating:

- **Cold extraction**: the time a fresh process takes over its first full extraction, including building the TypeScript program where an engine needs one.
- **Warm extraction**: the time to re-extract one changed component after a simulated save, once the process is warm.
- **Whole-project scan**: the time for one batch pass over the entire project.
  Only Compodoc works this way, so the metric applies to Compodoc alone and per-component engines record it as n/a rather than inventing a faked equivalent.
- **Peak memory (transient)**: the memory a save claims above the retained baseline and then gives back, sampled around a forced garbage collection.
- **Leak detection**: how much retained heap is still held after the save series, together with how steeply it climbed from one save to the next.

Compodoc maps onto these differently because it runs as a fresh CLI process each time: cold extraction and whole-project scan are the same full-project measurement, warm extraction is a second full run after touching one file, and peak memory is the child's peak RSS sampled from outside the process.
Whether the retained-series metrics mean anything at all for a fresh-process engine gets settled when its baselines are recorded, and until then its leak cells stay placeholders.

Two harnesses implement all of this between them.
`scripts/bench/docgen-memory/`, run with `yarn bench:docgen-memory`, gates React memory and is the only thing here that can fail a build today.
`scripts/bench/docgen-perf/`, run with `yarn bench:docgen-perf`, records all five metrics for every engine but gates nothing yet, simply because no budget values exist to gate against.

## Determinism method

- **Fixed synthetic projects.**
  Inputs come from a generator with fixed parameters — component count, props per component, levers for how type-heavy the code is — rather than from any real-world checkout, and that generator already exists as `scripts/bench/docgen-memory/generate-project.ts`.
- **Warmup.**
  Every run opens with one full cold pass, which doubles as the cold-extraction sample and is excluded from every warm sample that follows.
  The refresh mode of `scripts/bench/docgen-memory/memory-harness.ts` already works this way, while live mode skips the warmup by design.
- **Median-of-N for latency.**
  Every latency metric records a median rather than a single-run number.
  Cold extraction and whole-project scan each yield one sample per fresh process, so their N samples come from N separate spawns, while warm extraction takes the median of the per-save durations inside one run's save series.
  The run it reads is the repetition whose cold sample came out as the median, never the first, because repetition 1 pays for a cold module graph and a cold page cache and measures several times slower than the rest.
  One N is pinned for all engines and recorded with the results, since numbers taken at different N are not comparable, and an engine that fails part-way through its repetitions is reported as failed rather than as measured at an N it never reached.
  `scripts/bench/docgen-perf/aggregate.ts` implements all of this, while the memory gate still runs each configuration exactly once.
- **Series statistics for leak metrics.**
  Retained slope is the slope of a straight line drawn through the whole save series, so that no single noisy sample can swing it, while retained growth is simply the difference between the last retained sample and the baseline taken before the run.
  Both read one run's series rather than repeated runs, and both exist today.
- **Series mean for transient memory.**
  Peak memory (transient) is the mean of the per-save spikes across the save series, so it is neither repeated and medianed like cold latency nor fitted to a line like retained slope.
  Warm latency, transient memory and the leak metrics all read that same fixed-length series from the same run, as `scripts/bench/docgen-memory/memory-harness.ts` does today.
- **Fresh process per measurement.**
  Every measured process is spawned fresh so that it starts from a clean heap, which is what `scripts/bench/docgen-memory/gate.ts` already does.
- **Relative comparison on the same machine.**
  Performance questions are answered by ratios between runs executed one after another inside a single CI job on one executor, or on one local machine.
  "Same machine" means exactly that: comparing across jobs, runs or PRs is not a comparison at all, because each CI executor is thrown away after its run and the next one is not guaranteed to match it.
  Two comparisons stand today — the docgen-server flag on against off, and a new engine against its legacy counterpart — and both are measured inside the same run.
  Paired runs also alternate their order across repetitions, so that neither a warm cache nor a machine that has heated up can consistently favor one side.

## Budget shape

Timing budgets are ratios or slopes rather than absolute milliseconds, because absolute wall-clock on a shared CI executor is far too noisy to gate on.
A timing ratio divides the median of one side by the median of the other, with both measured in the same job.
An engine that has a second implementation to compare against uses that pair as its reference, and an engine without one has its reference picked when its baselines are recorded, leaving its timing budget a placeholder until then.

A ratio only means something when both sides did the same amount of work.
Engines resolve types to different depths, and a shallower one finishes sooner precisely because it documented less, which makes speed and thoroughness very easy to mistake for one another.
Every engine therefore reports how many members it documented, the suite prints those counts beside every ratio, warm as well as cold, and any pair whose counts disagree is marked not like-for-like.
A ratio marked that way must never become a budget.

Even a member count is not always enough on its own.
An engine that records a type's name without ever looking through it will document exactly as many members as one that expands the whole chain, and it will do so at a fraction of the cost.
An engine that works that way therefore also reports how many of its documented members carry a type it never resolved, and that second count has to agree as well before a pair counts as like-for-like.

A ratio also has to be shaped like production before it describes a saving anyone would actually feel.
Where the harness hands both sides equal work but production would hand them unequal work, the ratio compares the two engines and nothing more, and that limitation has to be stated beside the number.
Where an engine's warm measurement covers the whole project rather than the single member that changed, it is not comparable with a per-member warm count at all.

Not every difference between engines is a timing question in the first place.
An engine that takes a shortcut costing fidelity rather than time will produce two rows nobody can tell apart, so that difference belongs in the docgen-harness fixtures that pin engine behavior rather than in a bench scenario.

The baseline work records the actual figures, and quoting any of them here would only pin numbers taken at one profile on one machine.
Memory budgets stay in absolute megabytes with generous headroom, sitting well above observed values so the gate is not flaky while still failing hard on a real regression.
Every engine must also carry its own negative control: a configuration that is supposed to fail, proving the gate can still catch the kind of regression it exists for.
A control names its lever and the single metric it must trip — it does not need to trip every metric — and where no credible lever exists we record the gap instead of inventing a control that proves nothing.
The only worked example so far is the memory gate's out-of-memory control, and the budgets table below says which engine it covers.
Budgets and controls are both derived per engine from that engine's own baseline runs, and nothing is ported from one engine to another.

## CI tiers

- **Per PR: report-only.**
  Per-PR perf jobs run in the part of the generated CircleCI config (`scripts/ci/main.ts`) that runs on every build, alongside the package benchmark, which already reports there without gating.
  They report numbers and never fail the build.
- **Daily: the only gating tier.**
  "Daily" names the CircleCI `workflow=daily` pipeline parameter, with the tier order running `normal < merged < daily` (`scripts/ci/utils/types.ts`), and daily-only jobs attach in `scripts/ci/main.ts` where the docgen memory gate already runs.
- **How often daily runs is unproven.**
  The only trigger for the daily tier that exists in version control is the `ci:daily` PR label (`.github/workflows/trigger-circle-ci-workflow.yml`); no scheduled trigger lives in the repo, and no CircleCI-side schedule has been confirmed either.
  Until that is resolved, gating on the daily tier really means gating whenever someone remembers to apply the label.
  The baseline-and-budget work has to settle how often it runs before this gate can honestly be called nightly protection.

## User-perceived metrics

Three user-perceived metrics join the suite as report-only extensions of the sandbox bench task, and none of them joins the gated floor.
Because they need a real dev server and Chromium their numbers jump around a great deal, which is why they exist to show user-visible impact rather than to gate on it.
All three build on tooling we already have and add no new dependencies:

- **Dev-server startup, with the feature on and off.**
  Run the sandbox bench task twice, once with the docgen-server feature on and once with it off, and report the difference; the task is `scripts/tasks/bench.ts` driving `scripts/bench/browse.ts` over Playwright and Chromium, with dev-server readiness timings coming from `scripts/tasks/dev.ts`.
  Today only the internal Storybook config reads that on/off switch (`code/.storybook/main.ts`) and generated sandboxes do not, so the harness work has to inject the feature toggle into the sandbox config before the difference can be measured there.
  No first-class comparison mode exists yet either, so for now this is two runs diffed by hand.
- **Time-to-Controls-populated.**
  Adapt the existing Playwright flow that selects a story, opens the Controls panel and waits for an args-table cell (`code/e2e-internal/docgen-hot-update.spec.ts`) into a timing measurement, using the elapsed-time pattern from `browse.ts`.
  Today that flow is a pass/fail assertion and records no elapsed time at all.
- **Docs-page props-table render.**
  `benchAutodocs` in `scripts/bench/browse.ts` times the docs page today, but it only builds a locator for the component description and never actually waits on it, so the recorded number mostly reflects page load.
  The replacement waits for a props-table element to appear, and it does not exist yet.

## Budgets table skeleton

The baseline work fills in the values, so until then every cell is a placeholder.
The one exception is react-osa's memory row, which the docgen memory gate already enforces from `scripts/bench/docgen-shared/budgets.ts`.

| Engine                                    | Cold extraction | Warm extraction | Whole-project scan | Peak memory (transient) | Retained growth | Retained slope | Negative control | Tier  |
| ----------------------------------------- | --------------- | --------------- | ------------------ | ----------------------- | --------------- | -------------- | ---------------- | ----- |
| react-legacy (react-docgen, control)      | TBD             | TBD             | n/a                | TBD                     | TBD             | TBD            | TBD              | TBD   |
| react-osa (ComponentMetaManager, control) | TBD             | TBD             | n/a                | 90MB                    | 60MB            | 3MB/save       | OOM (gate.ts)    | daily |
| vue-docgen-api (legacy, current default)  | TBD             | TBD             | n/a                | TBD                     | TBD             | TBD            | TBD              | TBD   |
| vue-component-meta                        | TBD             | TBD             | n/a                | TBD                     | TBD             | TBD            | TBD              | TBD   |
| compodoc                                  | TBD             | TBD             | TBD                | TBD                     | TBD             | TBD            | TBD              | TBD   |
| svelte (stretch)                          | TBD             | TBD             | n/a                | TBD                     | TBD             | TBD            | TBD              | TBD   |
| cem (stretch)                             | TBD             | TBD             | n/a                | TBD                     | TBD             | TBD            | TBD              | TBD   |
