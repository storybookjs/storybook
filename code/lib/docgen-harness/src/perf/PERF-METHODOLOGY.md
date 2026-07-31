# Docgen performance methodology

This document is the measurement contract for the docgen harness. The harness has three separate
lanes because correctness, latency, and memory need different execution rules. Do not reuse a
memory sample as a latency result or turn a descriptive latency run into a gate implicitly.

## Scope and lanes

The harness calls docgen engines directly in Node.js against deterministic synthetic projects. It
does not start Storybook, a browser, or a builder, so the results describe extraction rather than
the full product pipeline.

- **Correctness:** the framework baseline tests compare extracted argTypes and snippets. They are
  the authority on whether an implementation documents at least the committed behavior.
- **Macro latency:** `bench:docgen-perf` measures cold extraction and stateful save trajectories in
  fresh child processes. It is descriptive unless a comparison and budget are explicitly supplied.
- **Resettable latency:** `bench:docgen-latency` uses Tinybench for the narrow Vue current/next
  operation that can create, prime, mutate, measure, and dispose a fresh engine every iteration.
- **Memory:** `bench:docgen-memory` retains the daily post-GC/RSS/OOM regression gate. Forced GC is
  useful here and forbidden in both latency lanes.

Mitata and Vitest benchmark mode are intentionally not used. The macro suite needs process
isolation, ordered stateful saves, package-version provenance, and nonfatal tool preflights rather
than a tight in-process microbenchmark loop. Tinybench is used only where the measured operation is
fully resettable.

## Deterministic workloads

The generators fix component counts, prop counts, type-import chains, and other scenario levers.
Scenario parameters are written into the result artifact. A save mutates a known component and is
applied before re-extraction; save order is part of the workload and must not be shuffled or treated
as independent samples.

Package versions are resolved from the installed package metadata and stored with results. A
current/next version comparison is invalid when both aliases resolve to the same version.

## Fresh-process macro latency

Run from the repository root:

```bash
yarn workspace @storybook/docgen-harness bench:docgen-perf
yarn workspace @storybook/docgen-harness bench:docgen-perf --quick
```

The default selection and repeated `--engine` selection remain supported. Each engine/scenario
repetition runs in a fresh child process. Source children use their existing execution requirement:
native Node.js for the parser children and the jiti import only for the React OSA source child.
Missing optional tools or packages are reported as nonfatal skips; an engine that starts measuring
but does not produce every requested repetition fails.

That preflight rule also applies to an explicit comparison: if either side is unavailable, neither
side runs and no gate verdict is produced. CI jobs that require a timing gate must install both
declared sides; the harness does not turn an unavailable optional tool into a performance failure.

One raw repetition contains:

- one timed cold extraction;
- every timed warm re-extraction in chronological save order; and
- a whole-project scan observation for engines such as Compodoc that naturally report one.

Project generation, applying a save, and disposal are outside the timed region. No latency process
uses `--expose-gc` or asks V8 to collect. Compodoc is normalized to the same raw shape by running
fresh one-shot child processes rather than polling process RSS in the latency suite.

The JSON artifact is owned and versioned by Storybook (`schemaVersion: 1`). It keeps all raw
repetitions and ordered warm observations. Summaries are conveniences, not replacements for raw
data:

- cold and scan summaries use one observation from each fresh process;
- each process contributes the median of its own warm trajectory to the warm headline; and
- the headline is the median of those process-level values.

This avoids pretending saves from one evolving program are independent observations. Results are
written to the existing `docgen-perf/results.json` sandbox location unless `--json` overrides it.
`--quick` uses a smaller smoke workload and fewer descriptive repetitions; its numbers never form a
timing verdict.

The top-level `gating` field is true only for a full paired comparison. It remains false for
descriptive runs and paired `--quick` smoke runs, even though the latter still records its method,
seed, blocks, and configured limit.

## Proving equal work

A faster engine may simply have documented less. Each repetition therefore records documented
member counts for cold extraction and every ordered warm save. Engines that can distinguish
unresolved types also record an opaque-type count.

Before comparing timing, the suite constructs stable cold and warm work profiles across all fresh
processes and reports one of these statuses for each metric:

- `same-work`: cold and every ordered warm signature agree;
- `different-work`: a count, save count, or ordered warm signature differs;
- `unknown-work`: a required count is missing, varies across repetitions, or only one side reports
  an opaque-type count; or
- `same-version`: a version pair resolved identical package versions.

When neither engine reports opaque-type counts, matching documented-member counts can still prove
equal work. When both report opaque-type counts, those counts must match. A timing effect is omitted
unless that metric's result is `same-work` and any required version distinction is valid. A cold
mismatch does not suppress an otherwise valid warm comparison, or vice versa. Descriptive runs
report the statuses but deliberately carry `not-configured` instead of calculating an effect.

## Explicit paired gate

A timing gate is opt-in and runs exactly one named pair:

```bash
yarn workspace @storybook/docgen-harness bench:docgen-perf \
  --compare vue-component-meta-version \
  --seed 42 --repetitions 10 --max-regression 0.10
```

Available pair names live in `docgen-perf/comparison.ts`. `--max-regression` is a required
fractional candidate slowdown; `0.10` permits at most 10%. Repetitions are paired blocks, must be
even, and must be at least 10. Omitting `--seed` creates and prints a random 32-bit seed, which is
stored in the artifact so the schedule can be replayed.

The Vue current/next pair is the initial gateable workload. The React pair currently has unknown
work counts, and the cross-engine Vue pair currently performs different work; selecting either as
a full gate therefore produces `invalid-gate` until its adapters can prove equivalence.

For each scenario, a stable derived seed builds two-block strata. Each stratum contains one block
that runs control then candidate and one that runs candidate then control; the seed decides which
comes first. The two sides of every block remain adjacent. Only a complete two-sided block is
published.

For block `i`, the effect sample is:

```text
d_i = log(candidate_i / control_i)
```

Cold uses the block's cold observations. Warm uses one trajectory median per side and block. The
reported candidate/control estimate is `exp(mean(d))`; its two-sided 95% interval is
`exp(mean(d) +/- t_0.975,n-1 * standardError(d))`.

The 95% level describes each scenario/metric interval, not a family-wise confidence level for the
whole command. A future CI policy that treats many cells as one statistical decision must declare a
primary cell or add an explicit multiple-comparison correction rather than relabel these intervals.

Let `L = 1 + maxRegression`:

- lower interval bound greater than `L`: `regression` and a failing exit status;
- upper interval bound at or below `L`: `within-budget`; and
- interval overlapping `L`: `inconclusive`, not a failure.

Invalid configuration, incomplete data, unequal/unknown work, or a same-version pair produces an
invalid gate and fails without publishing a timing effect. A paired `--quick` run remains a smoke
result even though the CLI still requires an explicit budget.

## Resettable Tinybench lane

Run the isolated Vue version benchmark with:

```bash
yarn workspace @storybook/docgen-harness bench:docgen-latency
yarn workspace @storybook/docgen-harness bench:docgen-latency --quick
yarn workspace @storybook/docgen-harness bench:docgen-latency --iterations 20
```

The full workload uses 15 iterations per pin and quick uses exactly 3; custom runs require at least
2 so their uncertainty fields are not derived from one observation. For every iteration and pin,
the harness:

1. constructs a fresh synchronous `vue-component-meta` engine;
2. performs cold extraction to prime it;
3. applies save 1 outside the timer;
4. times only synchronous re-extraction; and
5. verifies the work signature and disposes the engine.

Tinybench is configured with `iterations: K`, `time: 0`, no warmup, retained samples, no task
concurrency, and throwing errors. Tasks explicitly set `async: false` so registration cannot invoke
the measured function while probing whether it returns a promise. The command checks exactly K
engines and K retained samples per pin, equivalent work within and across pins, complete task
results, and distinct resolved versions.

The output is descriptive and not a timing gate. A narrow mapper copies only Storybook's latency
summary fields and retained samples into a versioned JSON artifact; Tinybench-native task objects
are never the persistent contract. The default artifact lives at `docgen-latency/results.json` in
the shared sandbox directory. Tinybench executes the two tasks sequentially in the recorded order,
so these distributions are shadow data; the harness deliberately does not turn them into a
current/candidate ratio or confidence claim between pins.

## Daily memory gate

Run:

```bash
yarn workspace @storybook/docgen-harness bench:docgen-memory
```

The memory lane intentionally samples after forced GC to detect retained heap growth and separately
tracks transient/RSS pressure. Its fresh-process gate preserves two protections:

- changed-scope steady state stays below the existing retained-growth, transient-memory, and
  retained-slope budgets; and
- under the fixed heap cap, recycling enabled must survive while the otherwise identical recycling
  disabled negative control must fail with a V8 heap-OOM signature.

Memory samples remain ordered by save. Do not alter the budgets, heap cap, RSS behavior, or OOM
positive/negative controls as part of latency work.

## Changing the harness

When adding an engine or version pair:

1. add its id and registry adapter, preserving the child's native or jiti requirement;
2. record its package version when an installed package provides the implementation;
3. emit documented-member counts for cold and every warm save, plus opaque-type counts where the
   engine can compute them faithfully;
4. add the comparison pair only when both sides share identical scenarios and parameters; and
5. test scheduling, raw-result completeness, work mismatch/version collision, effect direction,
   interval boundaries, and reporting.

Never gate stored milliseconds from another machine or historical run. Timing budgets apply only
to explicit paired observations from the same invocation. Keep correctness changes in the baseline
lane and memory changes in the memory lane so each signal retains its intended meaning.
