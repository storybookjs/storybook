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
ratio cold legacy/new (vue-component-meta-version/flat): 1.04  [documented members 70 vs 70]  [3.3.2 vs 3.3.8]
ratio warm legacy/new (vue-component-meta-version/flat): 1.01  [documented members 15 vs 15]  [3.3.2 vs 3.3.8]
```

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

This works only for an engine whose child imports the versioned package directly, the way `engines/vue-component-meta.ts` does.
Where the harness reaches the engine through repo source instead - `react-legacy` goes via `loadReactRendererModule` into `code/renderers/react`, which imports `react-docgen` by bare specifier - no child flag can redirect that import, and a version pair needs a different approach entirely.
Declaring `@storybook/react` as a dependency of `@storybook/docgen-harness` is what makes that source reachable in the first place, but it does not make the specifier redirectable: pointing the renderer at a second `react-docgen` would take a module resolution hook registered in the child, which is not built.

Four data edits:

1. An alias in `code/lib/docgen-harness/package.json` pinned to the candidate version.
2. The new id added to the `EngineId` union in `docgen-shared/engine-ids.ts`, which is hand-maintained: a registry entry naming an id that is not in the union does not compile.
3. A second registry entry in `docgen-perf/registry.ts` reusing the same child, with `inDefaultRun: false`, `versionPackage` naming the alias, and the flag that tells the child which install to load.
4. An entry in `CONTROL_PAIRS` in `docgen-perf/ratios.ts` naming the current side as `legacy` and the alias as `next`.

Plus one code edit, unless the child already has it: the child needs a flag that selects the install, which is what `--pin` is on the vue-component-meta child.
That took a small union of allowed values, an extension of the shared option schema, a per-pin scratch directory so the two runs do not share a generated project, and a conditional import of the aliased package.

One easily-missed prerequisite: the *current* side's existing registry entry must declare `versionPackage` too.
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

What we do not have yet is the gate. Once baselines exist, a ratio that moves the wrong way should fail CI, so that a human intercepts and decides what to do next.

### Memory budgets

Memory budgets stay in absolute megabytes, with enough headroom on CI so that the gate is not flaky while still failing hard on real regressions.

## Budgets table skeleton

| Engine                                    | Cold extraction | Warm extraction | Whole-project scan | Peak memory (transient) | Retained growth | Retained slope | Tier  |
| ----------------------------------------- | --------------- | --------------- | ------------------ | ----------------------- | --------------- | -------------- | ----- |
| react-legacy (react-docgen, control)      | TBD             | TBD             | n/a                | TBD                     | TBD             | TBD            | TBD   |
| react-osa (ComponentMetaManager, control) | TBD             | TBD             | n/a                | 90MB                    | 60MB            | 3MB/save       | daily |
| vue-docgen-api (legacy, current default)  | TBD             | TBD             | n/a                | TBD                     | TBD             | TBD            | TBD   |
| vue-component-meta                        | TBD             | TBD             | n/a                | TBD                     | TBD             | TBD            | TBD   |
| compodoc                                  | TBD             | TBD             | TBD                | TBD                     | TBD             | TBD            | TBD   |
| svelte (stretch)                          | TBD             | TBD             | n/a                | TBD                     | TBD             | TBD            | TBD   |
| cem (stretch)                             | TBD             | TBD             | n/a                | TBD                     | TBD             | TBD            | TBD   |
