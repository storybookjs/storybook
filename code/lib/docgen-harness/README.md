# @storybook/docgen-harness

A private test harness for the "docgen beyond React" work.
It records what the legacy docgen pipelines produce today - extracted argTypes and generated code snippets - as reviewed snapshots, and holds the upcoming OSA engines to "current or better" against them.
Nothing here ships to npm.

## How to use it

```bash
yarn test code/lib/docgen-harness      # from the repo root
yarn test code/lib/docgen-harness -u   # re-record after an intentional change, then review the diff
```

Each framework has three test files:

- `*-baselines.test.ts` records argTypes and snippets per fixture and self-compares every committed baseline through the comparator.
- `*-legacy-gaps.test.ts` pins known legacy defects as `test.fails` red markers. They turn into hard requirements once `baseline-path.ts` flips from `'legacy'` to `'osa'`.
- `*-render.test.ts` smoke-mounts the fixtures.

vue3 has a second recorder, `vue3-component-meta-baselines.test.ts`, because Vue ships two production docgen engines.
It drives the opt-in `vue-component-meta` path (`docgen: 'vue-component-meta'` in vue3-vite) over the same fixtures and writes `cm-`-prefixed snapshots.

## Layout

```text
src/
├── index.ts                      # the comparator's public surface
├── compare/
│   ├── argtypes.ts               # per-key argTypes rules
│   ├── snippets.ts               # snippet rules + framework dispatch
│   ├── snippets-vue3.ts          # Vue matcher
│   ├── snippets-angular.ts       # Angular matcher
│   ├── parse-element.ts          # root-element and attribute scanning
│   ├── parse-snapshot.ts         # parser for committed argtypes*.snapshot text
│   ├── expect-current-or-better.ts
│   ├── is-snapshot-update-run.ts
│   └── types.ts
├── vue3/
│   ├── vue3-baselines.test.ts
│   ├── vue3-component-meta-baselines.test.ts
│   ├── vue3-legacy-gaps.test.ts
│   ├── vue3-render.test.ts
│   └── __testfixtures__/<case>/  # SFC, input.stories.ts, argtypes.snapshot, snippet-<story>.snapshot,
│                                 # cm-argtypes.snapshot, cm-snippet-<story>.snapshot
├── angular/
│   ├── angular-baselines.test.ts
│   ├── angular-legacy-gaps.test.ts
│   ├── angular-provider-seam.test.ts
│   ├── angular-render.test.ts
│   ├── compodoc-parsing-parity.test.ts
│   ├── csf-types.ts
│   └── __testfixtures__/<case>/  # component, stories, compodoc-input.json, aot-cmp.ts (signal cases),
│                                 # argtypes.snapshot, argtypes-filtered.snapshot, snippet-<story>.snapshot
├── svelte/                       # planned
├── web-components/               # planned
└── perf/                         # the performance bench, see below
    ├── PERF-METHODOLOGY.md       # the measurement contract
    ├── docgen-perf/              # per-engine latency and memory suite, plus its engines/ and generators/
    ├── docgen-memory/            # the docgen-server memory regression gate
    └── docgen-shared/            # sampling, stats, budgets and paths shared by both
```

## The comparator

`expectCurrentOrBetter` fails when a candidate loses anything a committed baseline records, and passes improvements.

- argTypes: every baseline key, description, default value, and type must survive.
  A type may only change by normalized deep equality or a clear improvement - a catch-all becoming structured, a literal union gaining members.
  About half the corpus records `other`, where the legacy engine parked free text it could not resolve (`TreeNode`, `Array([object Object])`, `{ theme: string; dense: boolean }`).
  Such a stub accepts a candidate that adds populated structure (an empty enum/union/object is not an improvement) or resolves it to the scalar or single literal it already named; an unrelated scalar or literal is a lateral change and fails.
  Only the three markers that record nothing at all accept any candidate: `empty-enum`, `undefined`, and the empty string - today's Angular and Vue spellings, so adding a framework means revisiting that list.
  A resolution the rule cannot recognize (legacy `TSFunctionType` becoming a `function` sbType, say) fails rather than guessing; re-record and review the diff.
  A recorded `table.type.summary` must survive (dropping it is a violation), but its text may change freely outside `strictTable`.
  `required`, `table.category`, `jsDocTags`, `control`/`action`, and description/default contents are deliberately not compared (except `required` under `strictTable`); each would lock in a recorded lie (#28706) or engine-specific vocabulary.
- Snippets: represented binding names are compared as sets, so formatting can never fail, but a lost binding does.
  Directive spelling is normalized, so `:x`/`v-bind:x`, `@x`/`v-on:x`, `#x`/`v-slot:x`, and any `.modifier` all read as the same name.
  The Angular comparison additionally gates root-element identity: the tag name must match and bare (valueless) attributes - the mangled attribute-selector markers - must survive.
- Acceptance: there is no allowlist file.
  The committed baseline is the allowlist - accept an intentional change by re-recording with `-u` and reviewing the diff.
- The recorders read each committed file and run every gate BEFORE the snapshot call, so a `-u` run refuses to queue a regressed recording and stays red until the code is fixed.
  Regressions fail with named violations; improvements pass.
- The committed `argtypes*.snapshot` files are pretty-format text, not JSON.
  `parseArgTypesSnapshot` reads them back, verifies itself by re-serializing every parse byte-for-byte, and rejects any parsed string carrying the writer-ambiguous entry-boundary shape.
  A string whose unescaped write is byte-identical to real entry boundaries cannot be detected at parse time; the recorders' parsed-vs-live proofs guard that case on normal and CI runs, and on `-u` runs against the exact bytes queued for writing.
- Adding a framework: extend the `Framework` union and compilation fails at the switch in `snippets.ts` until the new matcher exists.

### Trust model

The comparator machine-checks a deliberate subset: baseline arg names, description presence, default presence, `table.type.summary` presence, and type fidelity for argTypes; represented binding names, root-element identity, and bare-attribute survival for Angular snippets.
Everything else - description/default/summary text, `table.category`, `control`/`action`, per-arg `jsDocTags`, added args - is caught only by the byte-exact snapshot diffs reviewed at `-u` time, or by the sandbox gate's `change` findings.
Two flags scope trust to where the baseline earns it: `legacyBaseline` (only on legs whose baseline is a legacy compodoc recording) waives the raw `false`/`NaN`/`null` defaults that pipeline invents, and `strictTable` (only on the ACM self-ratchet, whose baseline the same engine recorded) additionally gates `table.type.summary` text changes and `table.type.required` true->false flips.
The sandbox baseline gate runs in the daily CI tier, so a whole-project regression can merge green and surface up to a day later, detached from the offending PR.
Known-accepted blind spots: enum members whose quoted and bare spellings collide normalize to the same member (`'"small"'` reads as `small`), and `\r`/`\r\n` in extracted strings are LF-normalized by vitest at write time, so a CR-bearing extraction can never record green (perma-loud, never silent).

## The vue-component-meta recorder (vue3)

`vue3-component-meta-baselines.test.ts` replicates the vue3-vite vite plugin's meta processing exactly - checker options, empty-meta skip, nested-schema pruning, exposed de-duplication, and the vue-docgen-api event-description backfill - so the `cm-` snapshots show what a `vue-component-meta` user actually gets today.
Keeping that copy in step with `frameworks/vue3-vite/src/plugins/vue-component-meta.ts` is manual; nothing detects drift.

- The `cm-` prefix keeps each recorder's stale-snippet guard scoped to its own files.
- `sourceFiles` records `<sfc>` because production stores the absolute module id and snapshots must stay path-free; nothing downstream reads it.
- Like the legacy recorder, it self-compares every committed baseline through the comparator, so a checker or plugin change that loses extraction quality fails with named violations instead of landing as an unremarkable diff.
  Whether the OSA Vue engine is also held to these baselines - rather than only to the legacy ones - is a separate, later decision.
- Plugin and checker changes land here as reviewed snapshot diffs instead of silent drift - #35565 (`schema: true`) moved 17 of the 25 `cm-argtypes.snapshot` files and left every `cm-snippet-*` byte-identical.
  The recorded state is whatever the lockfile resolves `vue-component-meta` to (3.3.9 today), so a dependency bump is a reviewed baseline change too.

## Adding a fixture

One directory per case; the recorders discover it automatically.
The first run of a brand-new fixture fails once (snapshot files flush at suite end) - run it again and commit.
Record thin or wrong legacy output as-is; never "improve" a fixture to make the legacy result look better.
Snapshots must stay deterministic: no timestamps, no absolute paths.

- vue3: one PascalCase SFC (the filename becomes the component tag in every snippet) plus `input.stories.ts`.
- angular: one kebab-case `<case>.component.ts` (the class name must match the compodoc capture exactly) plus `input.stories.ts` and a captured `compodoc-input.json`.
  Signal fixtures also commit an `aot-cmp.ts` with the `ɵcmp` input/output maps, captured once from real `ngc` output - JIT leaves them empty.
  Stories import their CSF types from `src/angular/csf-types.ts`; the two runtime test files are excluded from the vue-tsc program because angular-vite client source is not strict-clean.

### Capturing compodoc input (angular)

Captures are pinned to `@compodoc/compodoc@2.0.0`.
Re-capturing with any other version is a reviewed baseline change - signal parsing drifts hard across versions.
Compodoc scans everything under the nearest `package.json` and ignores tsconfig `include`, so capture from a staging directory outside any Node package:

1. Copy the component and its supporting sources (never `input.stories.ts`) plus the case `tsconfig.json` into an empty directory, e.g. `$(mktemp -d)`.
2. Run `npx -y @compodoc/compodoc@2.0.0 -p tsconfig.json -e json -d .` there.
3. Move the emitted `documentation.json` back as `compodoc-input.json`.
4. Run `cd code && yarn fmt:write`.

Nothing detects drift between a fixture's sources and its committed capture, so editing a component always means re-capturing in the same change.

## Known legacy gaps (vue3)

- Accepted delta: OSA snippets are static, so live Controls updates do not re-render them.
- Snippets never render event handlers; function args are silently dropped.
- `table.jsDocTags` stays `undefined`; component-level docblocks are not captured in script-setup SFCs.
- Literal-string unions never become an `enum` sbType, and the values keep their quote characters.
- Array- and intersection-typed props record the stringified `convert()` fallback (`Array([object Object])`).
- Reactive-props-destructure defaults are invisible; only `withDefaults()` is extracted.
- `defineModel('name')` named models are invisible; snippets render a bare attribute instead of `v-model:name`.
- Scoped-slot binding types are never extracted, only their names.
- `defineExpose` members record no type at all - name and description only, where `vue-component-meta` resolves the same members to `number` and `() => void`.
- Bigints beyond `Number.MAX_SAFE_INTEGER` lose precision in snippets.
- Thin baselines by design: `Pick`-composed props record `{}`, recursive types a name-only stub, runtime array props `type: undefined`.
- `defineProps<ReturnType<typeof useComposable>>()` does not build in the legacy toolchain; a statement-block event expression crashes `parse()` outright (#23851). No baselines can exist for either.

## Issue-linked cases (vue3)

Fixtures reproducing open GitHub issues, to verify and close them when the OSA Vue engine lands.
Each has a red marker in `vue3-legacy-gaps.test.ts`.

- #11774, #12331 -> `cross-file-runtime-props/`: imported runtime props must resolve to real argTypes (legacy records `{}`).
- #12331, #22187 -> `cross-file-props-spread/`: props spread from an imported call must be extracted.
- #12850, #23470 -> `prop-slot-name-collision/`: a prop must render as a prop attribute even when a slot shares its name.
- #19394 -> `runtime-multi-constructor/`: `type: [String, Number]` must become a structured union.
- #20593 -> `runtime-proptype-cast/`: literal unions behind `PropType` casts must keep their options.
- #24270 (partial) -> `define-slots-literal-bindings/`: `defineSlots` literal binding types must be extracted; the issue's own snippet repro is not covered here.
- #26465 (partial) -> `slots/`: scoped-slot binding types must be extracted; the marker covers only this symptom, not the issue's `vue-component-meta` repro.
- #26465 (not reproduced) -> `define-slots-with-props/`: the issue's own repro - documented `withDefaults` props plus `defineSlots` losing all prop meta under `vue-component-meta` - does not occur at 3.3.9.
  `cm-argtypes.snapshot` records descriptions, defaults, and slot docs fully intact; a regression baseline, no marker.
  The issue's secondary HMR symptom is dev-server behavior outside this harness's reach.
- #29354 -> `cross-file-union-alias/`: imported literal-union aliases must unfold to their options.
- #30045 -> `type-intersection-whole/`: an intersection as the whole `defineProps<>` argument must resolve its props.

## Known legacy gaps (angular)

- Accepted deltas, no markers: snippets are bindings-only - no ng-content children, no banana-in-a-box for `model()`, functions and `undefined` interpolate raw.
- Every decorator input records `required: true`; compodoc never emits `optional` (#28706).
- Number-typed inputs without a literal default record an invented `NaN` default; numeric expression defaults collapse to `NaN` too.
- Non-numeric expression defaults record raw source strings (`Math.max(1, 3)`).
- JSDoc tags never reach argTypes structurally: `@deprecated` vanishes (#9721), `@see` text leaks into the description, `@default` values keep quotes and a trailing newline.
- `function`, `any`, and generic type strings collapse to `{ name: 'other', value: 'empty-enum' }`.
- Literal unions, alias unions, and TS enums all resolve to enum sbTypes at compodoc 2.0.0 - the #33779 collapse does not reproduce at this version.
- Cross-file inheritance is fully resolved (a regression baseline, not a gap).
- With `angularFilterNonInputControls` off, `properties`/`methods`/`view child` sections surface as argTypes, including private fields (#22007); on restricts to inputs.
- `model()` records one input plus a synthesized `${name}Change` output; the compodoc quirk behind that is written up in `code/lib/angular-compodoc/README.md`.
- Snippets use only the first comma-separated selector; attribute selectors are mangled to bare attributes.

## Issue-linked cases (angular)

- #28706 -> `decorator-io-basics/`: TS-optional inputs must record `required: false`. Red markers.
- #9721 -> `jsdoc-tags/`: member JSDoc tags must reach `table.jsDocTags` structurally. Red marker.
- #33779 (not reproduced) -> `decorator-union-enum/`: the reported union collapse does not occur at compodoc 2.0.0; regression baseline, no marker.
- #29697 (not reproduced) -> `signal-io/`: aliased signal inputs record under their alias at 2.0.0; regression baseline, no marker.
- #22007 -> `properties-methods-noise/`: the filter flag's origin case, and the fixture where both flag states meaningfully differ. The ACM engine closes it: `propsTable: 'api'` (its default) drops private and `#` properties and methods plus `@internal` members, while keeping `protected` members and every declared input and output, so the `acm-` baselines record fewer rows than the legacy ones on purpose.

## The performance bench

`src/perf/` measures how fast the docgen engines are and how much memory they hold, which is the other half of the "docgen beyond React" question the snapshot comparator above answers for correctness.
It is a set of CLIs rather than part of this package's exported API, so nothing in `src/perf/` is re-exported from `src/index.ts`.

All commands run from `code/lib/docgen-harness`:

```bash
yarn bench:docgen-perf            # per-engine cold/warm latency and memory, full profile (~1 min)
yarn bench:docgen-perf --quick    # smoke profile; its numbers are marked non-comparable
yarn bench:docgen-perf-gate       # the same suite, plus budget assertions - what the CI gate runs
yarn bench:docgen-memory          # the docgen-server memory regression gate
```

`bench:docgen-perf` generates synthetic projects under the shared sandbox directory, runs each engine in its own child process, and writes a results JSON next to them.
The generated trees are left on disk so you can open what was measured, and each engine/scenario owns one directory that the generator wipes before it writes.
That makes two bench runs at once clobber each other - one wipes a tree the other is mid-way through reading - so run them one at a time.
`bench:docgen-memory` asserts both that re-extraction is leak-free and that the program-recycle fix still flips a tight-heap run from OOM to survival.

### Running one engine, or one that is out of the default run

```bash
yarn bench:docgen-perf --engine react-osa                       # one engine
yarn bench:docgen-perf --engine react-legacy --engine react-osa # a control pair, one invocation
yarn bench:docgen-perf --json /tmp/results.json                 # where the results land
```

The default run is `react-legacy`, `react-osa`, `vue-docgen-api`, `vue-component-meta` and `compodoc`.
Two ids sit outside it and only measure when named: `react-legacy-rdt` (the `react-docgen-typescript` parser) and `vue-component-meta-next` (the version-pair alias).
A ratio only appears when both sides of a control pair measured in the same invocation, so naming one side gives you a table row and no comparison.

Compodoc is skipped with a message when its CLI does not resolve; every other engine reads from the workspace, so a missing one is a failure rather than a skip.

### The two React shapes

The React engines run every scenario twice, because Storybook documents components in two shapes that cost very different things:

- `whole-index` - one batch over every component, what the manifest generator does.
- `first-story` - the single component a request asks for, what the docgen server does. This is the number a developer waits for before Controls populate.

The cold ratio between the React engines is 0.73 over the index and 0.08 over the first story; reading only one of them gives a misleading picture of the engine's cost.

### Comparing two releases of one engine

`vue-component-meta-next` is an alias in this package's `package.json`, pinned to an exact version.
Point it at the version you want to test, `yarn install`, then run both sides in one invocation:

```bash
yarn bench:docgen-perf --engine vue-component-meta --engine vue-component-meta-next
```

Pin the candidate exactly rather than with a range - two caret ranges can resolve to one install, and then the run compares an engine against itself.
The suite prints both resolved versions beside every ratio and calls out two equal ones as not being a comparison at all.

The mechanism is not Vue-specific: an engine entry declares which install it measures, the child imports that specifier instead of a hard-coded package, and a pair is two entries differing only in that field.
`PERF-METHODOLOGY.md` has the steps for setting one up on another engine, and the one case it does not cover.
`PERF-METHODOLOGY.md` walks through reading those guard lines, and through adding a pair for another engine.

### The gate and its budgets

Both gates run on CircleCI's daily tier, which is triggered on demand by the `ci:daily` label on a pull request - nothing schedules it, so this is not nightly protection.

`bench:docgen-perf-gate` runs the suite at the pinned profile, asserts the budgets in `src/perf/docgen-shared/budgets.ts`, and then proves its own failure detection by running a deliberately failing engine and requiring that run to come back non-zero.
It writes into the sandbox directory by default; CI passes `--out ./perf-results` so the results can be stored as a build artifact.

It refuses to report a green gate on a `--quick` run, on an empty budget table, or when a budgeted engine skipped or failed - each of those would look like protection while asserting nothing.

Budgets are ratios and absolute megabytes, never raw milliseconds, because wall clock on a shared CI executor is far too noisy to gate on.
Change one only against numbers measured on CI, and record where they came from in `PERF-METHODOLOGY.md`.

Read `src/perf/PERF-METHODOLOGY.md` before changing a metric, a budget, or a version pair.
It is the contract these numbers are only meaningful under.

The bench also carries unit tests for its own aggregation, reporting and generator logic, so `yarn test code/lib/docgen-harness` runs those alongside the fixture comparisons.

## What does not live here

- Framework provider code lives in each framework's own package.
