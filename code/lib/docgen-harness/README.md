# @storybook/docgen-harness

Internal, unpublished test harness for the SB11 "docgen/snippets beyond React" cycle.
It records legacy docgen and snippet baselines per framework, so the new Open Service Architecture (OSA) engines can be measured against an honest "before" state ("current or better").
Nothing here ships to npm (`private: true`).

## Layout

```text
code/lib/docgen-harness/src/
├── index.ts                      # package entry: the comparator's public surface
├── compare/
│   ├── parse-snapshot.ts         # tokenizer for committed argtypes*.snapshot text (pretty-format, not JSON)
│   ├── argtypes.ts               # per-key argTypes floor rules
│   ├── snippets.ts               # representation-set snippet rules + exhaustive framework dispatch
│   ├── snippets-vue3.ts          # Vue matcher (template block, v-model, slots, default content)
│   ├── snippets-angular.ts       # Angular matcher ([input] / (output) attributes)
│   ├── parse-element.ts          # framework-neutral root-element and attribute scanning
│   ├── expect-current-or-better.ts  # the throwing wrapper
│   ├── is-snapshot-update-run.ts # -u detection shared by both recorders
│   └── types.ts                  # Violation model
├── vue3/
│   ├── vue3-baselines.test.ts    # legacy baseline recorder (argTypes + snippets)
│   ├── vue3-legacy-gaps.test.ts  # test.fails red markers for the closeable legacy gaps
│   ├── vue3-render.test.ts       # portable-stories render smoke test (happy-dom)
│   └── __testfixtures__/
│       └── <fixture-case>/
│           ├── <CaseName>.vue            # the SFC under test; the filename IS the recorded component name
│           ├── input.stories.ts          # real CSF stories driving the snippet baselines
│           ├── *.ts                      # supporting sources some cases need
│           ├── argtypes.snapshot         # normalized StrictArgTypes from the legacy extractArgTypes path
│           └── snippet-<story>.snapshot  # legacy Source-block snippet per named story export
├── angular/
│   ├── angular-baselines.test.ts    # legacy baseline recorder (argTypes both flag states + snippets)
│   ├── angular-legacy-gaps.test.ts  # test.fails red markers for the closeable legacy gaps
│   ├── angular-render.test.ts       # JIT TestBed render smoke test (happy-dom, decorator fixtures)
│   ├── csf-types.ts                 # type-only CSF re-export the fixture stories import
│   └── __testfixtures__/
│       └── <fixture-case>/
│           ├── <case-name>.component.ts    # the component under test; its class name IS the recorded identity
│           ├── input.stories.ts            # real CSF stories driving the snippet baselines
│           ├── *.ts                        # supporting sources some cases need
│           ├── tsconfig.json               # capture-scoped tsconfig for the compodoc run
│           ├── compodoc-input.json         # captured compodoc output the recorder feeds to setCompodocJson
│           ├── aot-cmp.ts                  # signal fixtures only: captured AOT ɵcmp input/output maps
│           ├── argtypes.snapshot           # normalized argTypes, angularFilterNonInputControls OFF
│           ├── argtypes-filtered.snapshot  # same with the filter flag ON
│           └── snippet-<story>.snapshot    # legacy Source-block snippet per named story export
├── svelte/             (planned, same shape - not created yet)
└── web-components/     (planned, same shape - not created yet)
```

## Conventions

- One directory per fixture case, auto-discovered via `readdirSync`; snapshots are written with `toMatchFileSnapshot` and only updated through review.
- vue3: exactly one PascalCase SFC per case.
  The filename becomes `displayName` and therefore the component tag in every snippet - never share a filename like `input.vue`.
- Both baseline layers come from one production-faithful `parse()` call per fixture: zero options, plugin-exact `__docgenInfo` attach.
- angular: one kebab-case `<case-name>.component.ts` per case; the PascalCase class name must byte-match the captured compodoc entry (`findComponentByName` is name-only).
  The recorder drives the full production entry: `setCompodocJson(compodoc-input.json)` then `extractArgTypes(class)`, recorded with `angularFilterNonInputControls` OFF and ON; snippets come from `computesTemplateSourceFromComponent` with `{ ...meta.args, ...story.args }` plus a stub arg per unset output argType, mirroring the actions addon's args enhancer that production always runs.
- angular: signal members (`input()`/`output()`/`model()`) are invisible to JIT - `ɵcmp.inputs`/`ɵcmp.outputs` stay empty without AOT.
  Signal fixtures therefore commit an `aot-cmp.ts`: the runtime `ɵcmp` maps captured from real `ngc` output (@angular/compiler-cli 21.2.17, compiled and loaded once to read the processed maps).
  The recorder attaches it wholesale before snippet generation and asserts the production reader sees its members, so a broken attach fails loudly.
- angular: fixture stories import their CSF types from `src/angular/csf-types.ts`, and `angular-baselines.test.ts` / `angular-render.test.ts` are excluded from the package's vue-tsc program - angular-vite client source is authored under `strict: false` and cannot join this strict program; vitest is those two files' check.
- Snapshots must be deterministic: no timestamps, no absolute paths.
  Committed compodoc captures make OS-suffixed snapshots unnecessary here: no path-sensitive layer is ever snapshotted.

### Compodoc capture procedure (angular)

Captures are pinned to `@compodoc/compodoc@2.0.0`; re-capturing with any other version (signal parsing drifts hard across versions) is a reviewed baseline change, never a silent one.
Compodoc scans every `.ts` under the nearest `package.json` ancestor and ignores tsconfig `include`, so captures run from a staging directory outside any Node package:

1. Copy the case's component and supporting sources (never `input.stories.ts`) plus its `tsconfig.json` into an empty directory outside the repo, e.g. `$(mktemp -d)`.
2. In that directory, run `npx -y @compodoc/compodoc@2.0.0 -p tsconfig.json -e json -d .`.
3. Move the emitted `documentation.json` back into the case directory as `compodoc-input.json`.
4. Run `cd code && yarn fmt:write` - captures are committed in the repo formatter's shape (the `doc-model` precedent), not compodoc's raw indentation.

The result has case-relative `file` fields and no absolute paths; capture plus format is byte-reproducible.

Nothing in the tests detects drift between a fixture's `.ts` sources and its committed `compodoc-input.json`.
Editing a fixture component or its supporting sources therefore always requires a re-capture in the same change.

The signal fixtures' `aot-cmp.ts` maps follow the same rule: they are captured once from real `ngc` output (`@angular/compiler-cli` 21.2.17) by compiling the staged component and reading the emitted class's `ɵcmp.inputs`/`ɵcmp.outputs`, and re-capturing with another Angular version is a reviewed baseline change.
The production reader consumes only each input tuple's first slot and the plain output strings; the remaining tuple slots are carried for shape fidelity only.

## The expectCurrentOrBetter comparator

`src/compare/` enforces "current or better" mechanically: nothing a committed baseline records may be lost, and improvements pass.
For argTypes it is a per-key floor: a baseline key, description presence, default-value presence, or type must survive into the candidate; types may change only by normalized deep equality or an enumerated improvement (an `other` catch-all becoming structured, enum/union member supersets, recursive object/array widening).
`required`, `table.category`, `table.jsDocTags`, `control`/`action`, `table.type.summary`, and description/default contents are deliberately not compared - each would entrench a recorded lie (#28706's `required: true`) or lateral engine vocabulary.
For snippets it is a representation floor: represented names (bindings, slots, default content) are compared as sets, so attribute order, whitespace, and quote style cannot fail; a name the baseline represents must stay represented, a candidate-only representation is an improvement, and a declared arg absent from both sides is a baseline-encoded accepted delta.
Committed `argtypes*.snapshot` files are pretty-format output, not JSON: `parseArgTypesSnapshot` tokenizes them (literal raw newlines and unescaped inner quotes in strings, bare `undefined`/`NaN`) and throws on anything outside that grammar - a silently dropped entry would loosen the floor invisibly.
Both recorders run the checks per fixture on every baseline file, reading the committed text BEFORE its `toMatchFileSnapshot` call: under `-u` the match call rewrites the file, so the comparator judges the fresh output against the last committed text exactly when a flip re-record needs regressions surfaced.
A parser round-trip (`parsed toEqual live`) guards the tokenizer on every normal and CI run; it skips files a `-u` run rewrites and re-arms on the next normal run.
Acceptance is the reviewed snapshot update: there is no allowlist file, the committed baseline IS the allowlist, and a wanted deviation lands by re-recording under `-u` and reviewing the diff.
Red markers and the comparator divide the work: markers pin specific closeable gaps and harden on the `BASELINE_PATH` flip, while the comparator is the general floor with no gap knowledge - a marker closing shows up as a passing improvement, and any unrelated loss still fails.
Each framework's snippet matcher lives in its own `snippets-<framework>.ts`; the dispatch in `snippets.ts` is an exhaustive switch, so adding a member to the `Framework` union fails compilation there until the new framework's matcher exists.

## Known legacy gaps (vue3)

Thin or empty output is recorded as-is - never "fix" a fixture to make legacy output richer.
Most closeable gaps below are pinned as `test.fails` red markers in `src/vue3/vue3-legacy-gaps.test.ts`, asserted against the committed snapshots.
Not every bullet has a marker: component-level docblocks, the recursive-type stub, and the runtime-array `type: undefined` baseline are documented here only.
`src/vue3/baseline-path.ts` declares which path produced the baselines: flipping `BASELINE_PATH` from `'legacy'` to `'osa'` on re-record hardens every marker into a plain requirement.

- Accepted delta: OSA snippets are static, so live Controls updates do not re-render them.
  Everything else is held to "current or better".
- Snippets never render event handlers; function args are silently dropped.
- `table.jsDocTags` stays `undefined` (vue-docgen-api puts tags into a separate `tags` object the pipeline never reads); component-level docblocks are not captured at all in script-setup SFCs.
- Literal-string unions never become an `enum` sbType, and the values keep their quote characters.
- Array- and intersection-typed props record the stringified `convert()` fallback: `Array([object Object])` / `intersection([object Object],[object Object])`.
- Function-typed runtime props are classified as `function` only via a signature-regex coincidence in the shared converter.
- Reactive-props-destructure defaults are invisible; only `withDefaults()` is extracted.
- `defineModel('name')` named models are entirely invisible (no prop, no event); snippets render a bare attribute instead of `v-model:name`.
- Scoped-slot binding types are never extracted, only their names.
- Bigints beyond `Number.MAX_SAFE_INTEGER` lose precision in snippets (`BigInt(<bare digits>)`).
- Thin baselines by design: `Pick`-composed props record `{}`, recursive types a name-only stub, runtime array props `type: undefined`.
- `defineProps<ReturnType<typeof useComposable>>()` does not even build in the legacy toolchain, so no baseline can exist for it.
- A statement-block event expression in the template (`@click="{ (a = true), (b = false); }"`) crashes `parse()` outright (#23851), so no baseline can exist for it either.

## Issue-linked cases (vue3)

Fixture cases reproducing open GitHub issues, to verify and close them when the OSA Vue engine lands.
Each line has a matching red marker in `vue3-legacy-gaps.test.ts`.

- #11774, #12331 -> `cross-file-runtime-props/`: an imported runtime props object must resolve to real prop argTypes (legacy records `{}`).
- #12331, #22187 -> `cross-file-props-spread/`: props spread from an imported function call must be extracted (legacy sees only the inline prop).
- #12850, #23470 -> `prop-slot-name-collision/`: a prop arg must render as a prop attribute even when a slot shares its name (legacy drops the slot argType and reroutes the prop value into slot content).
- #19394 -> `runtime-multi-constructor/`: `type: [String, Number]` must become a structured union sbType (legacy records `other` with `"string|number"`).
- #20593 -> `runtime-proptype-cast/`: literal unions behind `PropType` casts must keep their options (legacy collapses them to plain `string`).
- #24270 (partial) -> `define-slots-literal-bindings/`: `defineSlots` literal binding types must be extracted (legacy records `unknown`).
  The issue's primary report - a generated snippet binding the child to the parent's whole args object - is not reproduced here; this fixture's snippet already renders the destructured binding correctly, so closing the marker does not verify #24270 itself.
- #26465 (partial) -> `slots/` (existing case): scoped-slot binding types must be extracted (legacy records `{ entry: unknown; index: unknown }`).
  The issue reports the `vue-component-meta` engine losing slot doc comments, defaults, and HMR; these baselines record the `vue-docgen-api` path, so the marker covers only the binding-type symptom, not the issue's own repro.
- #29354 -> `cross-file-union-alias/`: imported literal-union aliases must unfold to their options (legacy records the alias name only).
- #30045 -> `type-intersection-whole/`: an intersection as the whole `defineProps<>` type argument must resolve its props (legacy extracts none).

## Known legacy gaps (angular)

Same rules as vue3: thin or wrong output is recorded as-is, closeable gaps carry `test.fails` markers in `src/angular/angular-legacy-gaps.test.ts`, and `src/angular/baseline-path.ts` hardens them on the `'osa'` flip.

- Accepted deltas (the documented v1 scope of the OSA snippet work, no markers): snippets are bindings-only - no ng-content children, no banana-in-a-box for `model()`, functions and explicit `undefined` interpolate raw, outputs always render `(name)="name($event)"`.
- Every decorator input records `required: true` - compodoc never emits `optional`, not even for TS-`?` members (#28706).
- Number-typed inputs without a literal default record an invented `NaN` default (`Number(undefined)`); numeric expression defaults like `5 * 60 * 1000` also collapse to `NaN`, losing the source text.
- Non-numeric expression defaults record raw source strings (`Math.max(1, 3)`).
- JSDoc tags never reach argTypes structurally: `@deprecated` vanishes entirely (#9721 tracks displaying it), `@see`/custom tag text leaks into the description prose, and `@default` values keep their quotes and a trailing newline.
- `function`, `any`, and generic (`T`, `T[]`) type strings collapse to `{ name: 'other', value: 'empty-enum' }`.
- Literal unions, alias unions, and TS enums all RESOLVE to enum sbTypes at compodoc 2.0.0 (it double-quotes union type strings, which makes them JSON-parseable) - the #33779 collapse does not reproduce at this version.
- Cross-file inheritance is fully resolved: inherited `@Input`/`@Output` members land in the component's own capture entries (a regression baseline, not a gap).
- With `angularFilterNonInputControls` OFF, `properties`/`methods`/`view child` sections surface as argTypes - including private fields - which is why the flag exists (#22007); ON restricts to inputs, and the model() `${name}Change` synthesis survives it by design.
- `model()` records the patched shape: one input entry plus a synthesized `${name}Change` output with no `table.defaultValue`; boolean-typed entries without defaults record `defaultValue.summary: false` from the cast quirk.
- Snippets use only the first comma-separated selector, and attribute selectors are mangled to bare attributes (`button[x]` -> `<button x>`).

## Issue-linked cases (angular)

- #28706 -> `decorator-io-basics/`: TS-optional decorator inputs must record `required: false` (legacy: `required: true` everywhere, plus the invented `NaN` default). Red markers in `angular-legacy-gaps.test.ts`.
- #9721 -> `jsdoc-tags/`: `@deprecated` props must surface in docs, which needs member JSDoc tags to reach `table.jsDocTags` structurally (legacy: nothing structured; `@deprecated` is lost). Red marker.
- #33779 (not reproduced) -> `decorator-union-enum/`: the reported union-controls collapse does not occur at the pinned compodoc 2.0.0 - all three union/enum inputs resolve to enum sbTypes, recorded as an engine-swap regression baseline; no marker.
- #29697 (not reproduced) -> `signal-io/`: the aliased `input(_, { alias })` records under its alias at 2.0.0, so the reported alias blindness does not occur; regression baseline, no marker.
- #22007 -> `properties-methods-noise/`: the filter flag's origin case; both flag states are recorded, and this is the fixture where they meaningfully differ.

## What does not live here

- The performance harness stays under `scripts/` (generalizing `scripts/bench/docgen-memory/`).
- Framework provider code lives in each framework's own package.
