# Docgen performance methodology

This document sets out how the per-engine docgen performance suite measures things. It elaborates on the metrics we record, the rules that make a run repeatable, the shape a budget may take, and the CI tier a budget is intended to gate once baselines exist.

## Scope

The performance tests run in plain Node.js, and we deliberately decided to not run them in the browser or start a Storybook dev server. We also did not involve the builders to be able to have metrics in place without huge variances between runs. This means, as a side effect, though, that some docgen engines which are currently part of builder plugins have to be called in a way where the extraction logic is called directly. This is so that we measure the docgen engines' performance rather than the performance of Storybooks' whole end-to-end docgen delivery pipeline.

## Metrics

We are collecting five metrics per engine:

1. Cold extraction: that's the time a fresh process takes over its full extraction, including starting the typescript program where an engine needs one.
2. Warm extraction: the time to re-extract one changed component after a simulated save once the process is warm. In theory, an already booted typescript program's delay shouldn't be visible in the warm extraction anymore, and therefore warm extractions are faster than cold ones.
3. Whole project scan: that's the time for one batch pass over the entire project. Currently, only Compodoc works this way, so the metric applies to Compodoc for Angular alone.
4. Peak memory: the memory a save claims above the retained baseline
5. Leak detection: How much retained heap is still held after the save series, together with how steeply it climbed from one save to the next?

The slope is fitted over the save series with the first save excluded.
An engine that re-extracts one component per save releases its whole-project state on that first save, and a fit that includes the step measures the cold-to-steady-state transition instead of the leak trend.
For `react-osa` that is the difference between a strongly negative slope, which hides any leak smaller than the step, and the small positive trend its steady state actually shows in the table below.
One excluded sample is enough: that engine is the only one with a step, and it lands entirely inside the first save.
A scenario therefore needs at least three saves to produce a slope at all - the excluded one, plus the two a line needs - and a scenario configured below that reports no retained metrics and fails its engine rather than quietly reporting a flat trend.

### The two React shapes

Storybook documents React components in two different shapes, and they cost very different things, so the suite measures both rather than averaging them into one misleading number.

`whole-index` is the manifest generator: one batch over every component in the index.
`first-story` is the docgen server's per-request path, where the manager is created on the first eligible request and extracts only the component that story needs; every save then re-extracts that same component.
Both run over the identical generated project, so the only difference is how much of it the cold pass documents.

The save target differs deliberately.
Walking round-robin under `first-story` would document a component the cold pass never touched, so retained heap would climb for the honest reason that the run keeps documenting more - which is indistinguishable from a leak.
Re-touching the one documented component keeps the steady state comparable between the shapes.

Reading both rows together is the point.
`whole-index` is what a full manifest build costs, which is what agent and MCP consumers need.
`first-story` is what a developer waits for before Controls populate, and it is the number to watch when judging whether the docgen server feels fast.

## Determinism method

### Fixed synthetic projects

We are using a generator to generate projects for the different frameworks with a fixed set of component count props per components and also a different set of levers to, for example, cover type imports and the ability of an engine to follow these imports. This is, for example, the case if a TypeScript program is used to infer a type, whereas for Compodoc, which uses static extraction, hits a limit.

### Warmup

Every run goes through one full cold execution pass before a warm extraction is measured.

### Median-of-N for latency

Every latency metric records a median for cold extractions. We need to make sure that these are triggered in fresh processes, so there are n samples that come from n separate spawns, while warm extracts takes the median of the per-save durations inside one run.

### Fresh process per measurement

Every measure process is spawned fresh so that it starts from a clean heap.

### Relative comparison on the same machine

Performance questions are answered by ratios between runs executed on one machine, either on CI or on a local machine. We are not comparing across jobs, runs, or PRs. Two comparisons stand today:

- The docgen server flag: on vs off
- A new engine against its legacy counterpart
  Both are measured inside the same run. Paired runs also alternate their order across repetitions so that neither a warm cache nor a machine that has heated up can consistently favor one side.

The pinned N has to be even for that alternation to cancel anything.
Each side leads on half the repetitions, so an odd N gives one of them the lead once more than the other, and the cold figure is a median, which then lands on a repetition from whichever side led more often.
That would turn the very effect the alternation exists to remove into a systematic bias on the ratio, so the parity is asserted in `ratios.test.ts` rather than left to whoever next edits the constant.

### Comparing an engine against another release of itself

There is a third comparison that follows the same two rules: two installs of one engine, measured against each other rather than against a different engine. This is how we check a version bump, because storing last week's milliseconds and diffing against them today would break the same-machine rule. Both sides run inside the same invocation, in the same alternating order, through the same control pair machinery, so nothing new was needed to compare them.

Like-for-like still applies here, and it earns its keep. A newer version that legitimately documents more members costs more, and we want that to show up as a member count mismatch rather than as a regression.

One failure is specific to this shape.
The two aliases are always separate installs, but they can still resolve to the same published version, and a single caret range is enough for that to happen.
Then we compare a version against itself and get a ratio of roughly one, which reads exactly like a clean result.
So both resolved versions are printed beside every ratio, and two equal ones are called out as not being a comparison at all.

A bump proposed in a pull request is fully covered by this. Catching a regression on the day it ships is not, because nothing here fetches the newest published version on its own, so moving the candidate forward still waits on a person or on a scheduled job that does not exist yet.

#### Running a version comparison

The pair that exists today is `vue-component-meta` against `vue-component-meta-next`, which are two installs of one package: the second is an alias in `code/lib/docgen-harness/package.json` pinned to an exact version.

**1. Point the alias at the version you want to test.**
Edit `code/lib/docgen-harness/package.json` and install, so the candidate is on disk:

```jsonc
"vue-component-meta": "^3.2.7",                          // the current side
"vue-component-meta-next": "npm:vue-component-meta@3.3.8" // the candidate, pinned exactly
```

```bash
yarn install
```

Pin the candidate exactly rather than with a range.
A range on both sides can resolve to one install, and then the run compares an engine against itself.

**2. Run both sides in one invocation, naming each explicitly.**
From `code/lib/docgen-harness/`:

```bash
yarn bench:docgen-perf --engine vue-component-meta --engine vue-component-meta-next
```

Both ids are required.
`vue-component-meta-next` is out of the default run because it carries no budget row, and a control pair only produces a ratio when both of its sides measured in the same invocation - naming one gives you a table row and no comparison.
Add `--quick` for a smoke run that proves the wiring; its numbers are marked non-comparable and must not be read as a result.

**3. Read the three guards on the ratio lines before reading the ratio.**
A real run prints one cold and one warm line per scenario:

```text
ratio cold (vue-component-meta over vue-component-meta-next, flat): 1.04  [documented members 70 vs 70]  [3.3.2 vs 3.3.8]
ratio warm (vue-component-meta over vue-component-meta-next, flat): 1.01  [documented members 15 vs 15]  [3.3.2 vs 3.3.8]
```

Both engines are named on the line, and a header above the block says which way the division goes, so no one has to remember which side of a pair is which.

- **Two different versions.**
  `[3.3.2 vs 3.3.8]` is what says two different versions were actually compared.
  `[both sides resolved 3.3.8 - NOT a comparison]` means the current side's range drifted onto the pin, and the roughly-1.00 ratio beside it means nothing.
  Pin the current side too, or move the candidate.
- **Equal work.**
  A bare `[documented members 70 vs 70]` with no note after it is like-for-like.
  A `NOT like-for-like` note means the two sides did not do equal work, and the note says which way: `documented more` / `documented less` is a difference in member counts, while `same members, but ...` is the subtler one, where the counts agree and the two versions resolved different amounts of the type graph behind them.
  Either way the ratio is measuring a behaviour change rather than a cost change, and that behaviour change is the finding.
- **Above 1.00 is the candidate winning.**
  The ratio is the current side's median over the candidate's, so `1.04` means the candidate was 4% faster on that scenario.
  A number below 1.00 is the candidate costing more.

An engine whose package does not resolve is reported as skipped with a reason rather than measured, so a forgotten `yarn install` cannot quietly turn into a missing comparison.

#### Adding a version pair for another engine

This works for an engine that reaches its docgen package by specifier: a child that imports it, the way `engines/vue-component-meta.ts` does, or a CLI the engine spawns, the way `engines/compodoc.ts` does.
Where the harness reaches the engine through repo source instead - `react-legacy` goes via `loadReactRendererModule` into `code/renderers/react`, which imports `react-docgen` by bare specifier - no child flag can redirect that import, and a version pair needs a different approach entirely.
Declaring `@storybook/react` as a dependency of `@storybook/docgen-harness` is what makes that source reachable in the first place, but it does not make the specifier redirectable: pointing the renderer at a second `react-docgen` would take a module resolution hook registered in the child, which is not built.

Four data edits:

1. An alias in `code/lib/docgen-harness/package.json` pinned to the candidate version, named `<package>-<suffix>`.
2. The new id added to the `EngineId` union in `docgen-shared/engine-ids.ts`, which is hand-maintained: a registry entry naming an id that is not in the union does not compile.
3. A second registry entry in `docgen-perf/registry.ts` reusing the same child, with `inDefaultRun: false` and `pin` naming the alias.
4. An entry in `CONTROL_PAIRS` in `docgen-perf/ratios.ts` naming the current side as `legacy` and the alias as `next`.

The registry's `pin` is the whole mechanism: it reaches the child as `--pin <specifier>`, is what `preflight` resolves, and is the version reported with the results.
Nothing about it is engine-specific.

Plus one code edit, unless the engine already takes a pin.
A spawned-CLI engine resolves its pin itself and needs nothing more; `CompodocEngine` takes one in its constructor.
A child-harness engine has to accept `--pin` and import that specifier rather than a hard-coded one, which is three lines at the child - the flag, one schema entry, and `importPinned` in place of a static import.
`importPinned` checks the pin resolves to the package the harness measures before loading it, since an alias keeps the aliased package's own name.
Only the named install is ever imported, so the other copy never sits on the measured heap, and the resolved specifier also names the scratch directory so the two runs do not share a generated project.

One easily-missed prerequisite: the *current* side's existing registry entry must declare `pin` too, naming the canonical package.
`versionNote` prints nothing unless both sides resolved a version, so without it every ratio line silently loses its version note - and with it the guard against both sides resolving to the same version.

Nothing else changes: aggregation, member counts and the ordering alternation are already shared by every pair.
A pair that shares an engine with another pair is fine, because the alternation reverses the whole engine list and so flips every pair at once.

## Budget shape

Timing budgets are ratios or slopes rather than absolute milliseconds because absolute wall clock on a shared CI executor is far too noisy to gate on. A timing ratio divides the median of one side by the median of another. An engine that has a second implementation to compare against (for example, `vue-docgen-api` against `vue-component-meta`) uses that pair as its reference. An engine without one has its reference picked when its baselines are recorded.

### Like-for-like comparison

A ratio only means something when both sides did the same amount of work. Engines resolve types to different depths, and a shallower one finishes sooner precisely because it documented less, which makes speed and thoroughness very easy to mistake for one another.

Therefore, every engine reports how many members it documented, and the suite prints those counts beside every ratio, warm as well as cold. Where the two sides disagree, we do not just flag the ratio, we say which way it went, because the direction is what tells you how to read the number. An engine that documented less is fast for the wrong reason and its ratio is worthless. An engine that documented more and still won has a ratio that undersells it. Only a pair that did equal work may ever become a budget.

Cold and warm get their own verdict, since a pair can document the same members on the cold pass and different ones on the save it was timed on. When either side reports no count at all we record that as unknown rather than treating it as agreement, because marking a pair equal on the strength of a number nobody measured is exactly how a bad ratio would slip through.

Even the member count is not enough on its own. An engine that records a type's name without ever looking through it documents exactly as many members as one that expanded the whole chain, and it does so at a fraction of the cost. So an engine that works that way also reports how many of its documented members carry a type it never resolved, and that second count has to agree as well before the two sides count as having done equal work.

A cross-engine ratio therefore only becomes a budget once the suite has certified the pair as like-for-like, and today none of the pairs qualifies.
The Vue pair is genuinely unequal: `vue-component-meta` documents several times the members `vue-docgen-api` does, so its higher cost is thoroughness rather than slowness.
The React pair is undecided rather than unequal, because neither React engine reports a member count, and a missing count is not agreement.
Making that pair gateable means teaching both React children to count what they documented, which is worth doing and has not been done.

### The incrementality ratio

There is one timing budget that needs no second engine.
Warm over cold, for a single engine, compares two figures from the same process over the same project, which makes it like-for-like by construction and immune to the member-count question entirely.

It also measures the thing users feel.
A cold extraction happens once at startup; a warm one happens on every save, and it is only fast because the engine re-extracts the component that changed instead of redoing the whole project.
When that breaks, the warm figure climbs toward the cold one, and the ratio catches it whatever the absolute numbers on the day happen to be.

## The gate

`yarn bench:docgen-perf-gate` runs the suite once at the pinned profile and asserts every recorded budget against the results.

Four rules exist so that a green gate means something:

- A run marked non-comparable - the `--quick` smoke profile - fails rather than passing on numbers that were never meant to be compared.
- An empty budget table fails, because a gate that asserts nothing should not report success.
- A scenario the run measured with no budget row fails. The gate can only assert the rows it has, so without this a new scenario would run every night protected by nothing. It fails until its baseline is recorded, which is the run that produces the number to budget.
- An engine that carries a budget but skipped or failed fails the gate. Skipping is legitimate on a laptop missing an optional tool; on the gate it means the thing being protected did not run.

Cross-engine ratios are printed on every run but gated on by nothing, because no pair has been certified as doing equal work.
The rule that only a like-for-like pair may become a budget lives here rather than in the gate; the check that enforces it belongs with the first pair that earns one.

The gate then proves its own failure detection: it runs the suite a second time with an engine that always fails, and requires that run to come back non-zero.
Without that, a gate whose failure path had silently broken would be indistinguishable from a gate that keeps passing because nothing is wrong.

### When it runs

On CircleCI's daily tier, which is triggered by the `ci:daily` label on a pull request.
Nothing schedules that tier, so this is on-demand protection rather than nightly protection.
A regression that lands on a Tuesday is caught whenever someone next asks for a daily run, not overnight.

### Memory budgets

Memory budgets stay in absolute megabytes, with enough headroom on CI so that the gate is not flaky while still failing hard on real regressions.

## Recorded baselines

Measured on a CircleCI `sb_node_22_classic` medium+ executor at the pinned profile (N=6); the exact Node version is recorded in the run's own `results.json`.
Milliseconds are context, never a budget: the same suite runs three to four times faster on an Apple-silicon laptop, which is exactly why nothing gates on them.

| Engine / scenario                  | Cold   | Warm   | Scan   | Peak transient | Retained growth | Retained slope |
| ---------------------------------- | ------ | ------ | ------ | -------------- | --------------- | -------------- |
| react-legacy/whole-index           | 1722ms | 13ms   | n/a    | 2.3MB          | -4.1MB          | 0.01MB/save    |
| react-legacy/first-story           | 96ms   | 19ms   | n/a    | 2.6MB          | 1.6MB           | 0.12MB/save    |
| react-osa/whole-index              | 2353ms | 45ms   | n/a    | 13.8MB         | -82.9MB         | 0.10MB/save    |
| react-osa/first-story              | 1142ms | 48ms   | n/a    | 9.8MB          | 1.3MB           | 0.19MB/save    |
| vue-docgen-api/flat                | 153ms  | 3ms    | n/a    | 0.4MB          | 0.2MB           | 0.01MB/save    |
| vue-docgen-api/workspace           | 105ms  | 3ms    | n/a    | 0.4MB          | 0.2MB           | 0.02MB/save    |
| vue-docgen-api/base-type-touch     | 109ms  | 6ms    | n/a    | 0.9MB          | 0.1MB           | 0.02MB/save    |
| vue-component-meta/flat            | 997ms  | 79ms   | n/a    | 9.4MB          | 3.7MB           | 0.20MB/save    |
| vue-component-meta/workspace       | 1060ms | 84ms   | n/a    | 12.8MB         | 3.6MB           | 0.19MB/save    |
| vue-component-meta/base-type-touch | 1044ms | 84ms   | n/a    | 12.9MB         | 3.0MB           | 0.25MB/save    |
| compodoc/default                   | 1315ms | 1336ms | 1315ms | 216.0MB        | n/a             | n/a            |

### Pair ratios from the same run

Each ratio divides the first engine's median by the second's, so above 1.00 means the second engine was faster.
None of them is gated on, for the reasons under "Like-for-like comparison" above.

| Pair (first over second)               | Scenario        | Cold | Warm | Equal work?                                     |
| -------------------------------------- | --------------- | ---- | ---- | ----------------------------------------------- |
| react-legacy over react-osa            | whole-index     | 0.73 | 0.29 | unknown - neither React engine reports counts   |
| react-legacy over react-osa            | first-story     | 0.08 | 0.40 | unknown - neither React engine reports counts   |
| vue-docgen-api over vue-component-meta | flat            | 0.15 | 0.04 | no - 80 vs 320 cold, 0 vs 17 warm               |
| vue-docgen-api over vue-component-meta | workspace       | 0.10 | 0.04 | no - 50 vs 350 cold, 0 vs 37 warm               |
| vue-docgen-api over vue-component-meta | base-type-touch | 0.10 | 0.07 | no - 50 vs 350 cold, 5 vs 45 warm               |

The Vue rows are all `NOT like-for-like` in the new engine's favour: it documents four to seven times as many members on the cold pass, and more still on the save each was timed on - 5 against 45 on `base-type-touch`, and 0 against 17 and 37 on the other two, where `vue-docgen-api` documented nothing at all.
So every one of those ratios understates the new engine.
The React rows say `unknown` rather than agreeing, because neither React engine reports a member count at all.
Nothing in the version-pair row appears here: `vue-component-meta-next` is out of the default run, so a version comparison only exists in the output of the run that explicitly asked for it.

Four things in these tables are worth reading twice.


Compodoc's warm figure is its cold figure, because it re-runs the whole project on every invocation.
That is what it does by design, so it carries no incrementality budget; its peak memory, an order of magnitude above every other engine, is the number worth watching.

`react-osa` reports negative retained growth on `whole-index`, and that is the engine working correctly rather than a measurement artefact.
The baseline is sampled straight after the cold pass, when the engine still holds state sized for the whole project.
The first save re-extracts a single component, that whole-project state is released, and retained heap drops by around 83MB in one step and then stays flat.
So the growth figure measures the distance from the cold-pass peak down to the steady state, and it is negative wherever the cold pass built whole-project state that the first save then releases.
That is the two `whole-index` rows and nothing else: the `first-story` rows never build that state, and the Vue engines hold little enough of it that the growing component type outweighs whatever they release.

The React pair's cold ratio depends entirely on which shape you ask about.
Over `whole-index` it sits at 0.73 - the two engines are within half an order of magnitude when documenting everything.
Over `first-story` it drops to 0.08, because `react-docgen` answers one component without building a program at all while `react-osa` has to construct one first.
That gap is the startup cost of the new engine, and it was invisible while the suite only measured the whole-index shape.
The warm ratios move the other way between shapes, 0.29 over the index against 0.40 over the first story, but both stay well under 1.00: `react-legacy` re-parses one component in 13ms and 19ms against `react-osa`'s 45ms and 48ms, so the legacy parser is the cheaper warm path in either shape.
What the first-story warm ratio says is that `react-osa` loses far less ground once its program exists than the 0.08 cold ratio suggests.

And the retained slope is higher on `first-story` for both engines (0.12 and 0.19, against 0.01 and 0.10) without either of them leaking.
Every save adds a prop to the component it touches, and in this shape that is the same component every time, so its type genuinely grows across the run.
The slope there measures that growth as well as any leak, which is why its budget is no tighter than the whole-index one.

### Budgets

Recorded in `docgen-shared/budgets.ts`, keyed by engine and scenario, above the observed value by whatever margin that metric's own noise demands.

| Engine / scenario                  | Warm/cold ratio | Peak transient | Retained growth | Retained slope | Tier  |
| ---------------------------------- | --------------- | -------------- | --------------- | -------------- | ----- |
| react-legacy/whole-index           | 0.05            | 15MB           | 2MB             | 0.1MB/save     | daily |
| react-legacy/first-story           | 0.60            | 15MB           | 10MB            | 1MB/save       | daily |
| react-osa/whole-index              | 0.08            | 45MB           | -50MB           | 0.5MB/save     | daily |
| react-osa/first-story              | 0.15            | 30MB           | 10MB            | 1MB/save       | daily |
| vue-docgen-api/flat                | 0.08            | 4MB            | 3MB             | 0.2MB/save     | daily |
| vue-docgen-api/workspace           | 0.10            | 4MB            | 3MB             | 0.2MB/save     | daily |
| vue-docgen-api/base-type-touch     | 0.25            | 4MB            | 3MB             | 0.2MB/save     | daily |
| vue-component-meta/flat            | 0.20            | 40MB           | 20MB            | 1.5MB/save     | daily |
| vue-component-meta/workspace       | 0.22            | 40MB           | 20MB            | 1.5MB/save     | daily |
| vue-component-meta/base-type-touch | 0.25            | 40MB           | 20MB            | 1.5MB/save     | daily |
| compodoc/default                   | none            | 400MB          | n/a             | n/a            | daily |
| svelte (stretch)                   | TBD             | TBD            | TBD             | TBD            | TBD   |
| cem (stretch)                      | TBD             | TBD            | TBD             | TBD            | TBD   |

Retained growth is a signed ceiling rather than a multiple of what was observed, because the number it bounds can be negative.
`react-osa/whole-index` measures -82.9MB, and the regression worth catching there is the engine no longer releasing its whole-project state, which would land near 0MB and pass any positive budget.
Its budget is therefore -50MB: the run has to still drop at least that far to be green.

`react-legacy-rdt` and `vue-component-meta-next` are measurable but carry no budget: neither runs by default, and a budget on something CI never runs would be decoration.
The two stretch rows wait on engines that do not exist yet.

The docgen-memory gate keeps its own, heavier `react-osa` row (90MB transient, 60MB growth, 3MB/save) over a 600-component project.
It measures the same shape and the same save scope as `react-osa/whole-index` above; only the project size differs, which is why its budgets sit so much higher.
