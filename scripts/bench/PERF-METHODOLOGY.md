# Docgen performance methodology

This document sets out how the per-engine docgen performance suite measures things. It elaborates on the metrics we record, the rules that make a run repeatable, the shape a budget may take, and the CIT at that gate.

## Scope

The performance tests run in plain Node.js, and we deliberately decided to not run them in the browser or start a Storybook dev server. We also did not involve the builders to be able to have metrics in place without huge variances between runs. This means, as a side effect, though, that some docgen engines which are currently part of builder plugins have to be called in a way where the extraction logic is called directly. This is so that we measure the docgen engines' performance rather than the performance of Storybooks' whole end-to-end docgen delivery pipeline.

## Metrics

We are collecting five metrics per engine:

1. Cold extraction: that's the time a fresh process takes over its full extraction, including starting the typescript program where an engine needs one.
2. Warm extraction: the time to re-extract one changed component after a simulated save once the process is warm. In theory, an already booted typescript program's delay shouldn't be visible in the warm extraction anymore, and therefore warm extractions are faster than cold ones.
3. Whole project scan: that's the time for one batch pass over the entire project. Currently, only CompuDoc works this way, so the metric applies to CompuDoc for Angular alone.
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

## Budget shape

Timing budgets are ratios or slopes rather than absolute milliseconds because absolute wall clock on a shared CI executor is far too noisy to gate on. A timing ratio divides the median of one side by the median of another. An engine that has a second implementation to compare against (for example, ViewDocktion API vs. ViewComponent meta) uses that pair as its reference. An engine without one has its reference picked when its baselines are recorded.

### Like-to-Like comparison

Ratio only means something when both sides did the same amount of work. Engines, for example, resolve types to different depths, and a shallower one finishes sooner precisely because it documented less, which makes speed and thoroughness very easy to mistake for one another.

Therefore, every engine reports how many members it documented. The suit prints those counts, besides every ratio, warm as well as cold, and any pair whose counts disagree is marked not like-to-like.

A ratio marked that way must never become a budget. Rather, we should make sure that if the performance of an engine decreases (for example, by bumping the engine's version or introducing a new one), CI fails in these scenarios (so that a human can intercept and decide what to do next).

But even a member count of properties is not always enough on its own. An engine that records a type's name but not the type's type doesn't contribute to a fair comparison. Therefore, a documented member's actual type will be recorded and is the second count to agree as well as a pair count for the like-for-like comparison.

### Memory budgets

Memory budgets stay in absolute megabytes, with enough headroom on CI so that the gate is not flaky while still failing hard on real regressions.

## Budgets table skeleton

| Engine                                    | Cold extraction | Warm extraction | Whole-project scan | Peak memory (transient) | Retained growth | Retained slope | Negative control | Tier  |
| ----------------------------------------- | --------------- | --------------- | ------------------ | ----------------------- | --------------- | -------------- | ---------------- | ----- |
| react-legacy (react-docgen, control)      | TBD             | TBD             | n/a                | TBD                     | TBD             | TBD            | TBD              | TBD   |
| react-osa (ComponentMetaManager, control) | TBD             | TBD             | n/a                | 90MB                    | 60MB            | 3MB/save       | OOM (gate.ts)    | daily |
| vue-docgen-api (legacy, current default)  | TBD             | TBD             | n/a                | TBD                     | TBD             | TBD            | TBD              | TBD   |
| vue-component-meta                        | TBD             | TBD             | n/a                | TBD                     | TBD             | TBD            | TBD              | TBD   |
| compodoc                                  | TBD             | TBD             | TBD                | TBD                     | TBD             | TBD            | TBD              | TBD   |
| svelte (stretch)                          | TBD             | TBD             | n/a                | TBD                     | TBD             | TBD            | TBD              | TBD   |
| cem (stretch)                             | TBD             | TBD             | n/a                | TBD                     | TBD             | TBD            | TBD              | TBD   |
