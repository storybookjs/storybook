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
│   ├── vue3-legacy-gaps.test.ts
│   ├── vue3-render.test.ts
│   └── __testfixtures__/<case>/  # SFC, input.stories.ts, argtypes.snapshot, snippet-<story>.snapshot
├── angular/
│   ├── angular-baselines.test.ts
│   ├── angular-legacy-gaps.test.ts
│   ├── angular-render.test.ts
│   ├── csf-types.ts
│   └── __testfixtures__/<case>/  # component, stories, compodoc-input.json, aot-cmp.ts (signal cases),
│                                 # argtypes.snapshot, argtypes-filtered.snapshot, snippet-<story>.snapshot
├── svelte/                       # planned
└── web-components/               # planned
```

## The comparator

`expectCurrentOrBetter` fails when a candidate loses anything a committed baseline records, and passes improvements.

- argTypes: every baseline key, description, default value, and type must survive.
  A type may only change by normalized deep equality or a clear improvement - a catch-all becoming structured, a literal union gaining members.
  `required`, `table.category`, `jsDocTags`, `control`/`action`, and description/default contents are deliberately not compared; each would lock in a recorded lie (#28706) or engine-specific vocabulary.
- Snippets: represented binding names are compared as sets, so formatting can never fail, but a lost binding does.
- Acceptance: there is no allowlist file.
  The committed baseline is the allowlist - accept an intentional change by re-recording with `-u` and reviewing the diff.
- The recorders read each committed file before its snapshot call, so a `-u` re-record still compares the fresh output against the last committed text.
  Regressions fail with named violations; improvements pass.
- The committed `argtypes*.snapshot` files are pretty-format text, not JSON.
  `parseArgTypesSnapshot` reads them back and verifies itself by re-serializing every parse byte-for-byte; anything outside that grammar throws.
- Adding a framework: extend the `Framework` union and compilation fails at the switch in `snippets.ts` until the new matcher exists.

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
- `model()` records one input plus a synthesized `${name}Change` output.
- Snippets use only the first comma-separated selector; attribute selectors are mangled to bare attributes.

## Issue-linked cases (angular)

- #28706 -> `decorator-io-basics/`: TS-optional inputs must record `required: false`. Red markers.
- #9721 -> `jsdoc-tags/`: member JSDoc tags must reach `table.jsDocTags` structurally. Red marker.
- #33779 (not reproduced) -> `decorator-union-enum/`: the reported union collapse does not occur at compodoc 2.0.0; regression baseline, no marker.
- #29697 (not reproduced) -> `signal-io/`: aliased signal inputs record under their alias at 2.0.0; regression baseline, no marker.
- #22007 -> `properties-methods-noise/`: the filter flag's origin case, and the fixture where both flag states meaningfully differ.

## What does not live here

- The performance harness stays under `scripts/`.
- Framework provider code lives in each framework's own package.
