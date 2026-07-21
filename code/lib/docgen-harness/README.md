# @storybook/docgen-harness

Internal, unpublished test harness for the SB11 "docgen/snippets beyond React" cycle.
It records legacy docgen and snippet baselines per framework, so the new Open Service Architecture (OSA) engines can be measured against an honest "before" state ("current or better").
Nothing here ships to npm (`private: true`).

## Layout

```text
code/lib/docgen-harness/src/
├── index.ts                      # package entry (the expectCurrentOrBetter comparator lands here)
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
├── angular/            (same shape)
├── svelte/             (same shape)
└── web-components/     (same shape)
```

## Conventions

- One directory per fixture case, auto-discovered via `readdirSync`; snapshots are written with `toMatchFileSnapshot` and only updated through review.
- vue3: exactly one PascalCase SFC per case.
  The filename becomes `displayName` and therefore the component tag in every snippet - never share a filename like `input.vue`.
- Both baseline layers come from one production-faithful `parse()` call per fixture: zero options, plugin-exact `__docgenInfo` attach.
- Snapshots must be deterministic: no timestamps, no absolute paths.
  OS-sensitive engines use OS-suffixed snapshot files (see `compodoc-*.snapshot` in `code/frameworks/angular-vite`).

## Known legacy gaps (vue3)

Thin or empty output is recorded as-is - never "fix" a fixture to make legacy output richer.
The closeable gaps below are pinned as `test.fails` red markers in `src/vue3/vue3-legacy-gaps.test.ts`, asserted against the committed snapshots.
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

## What does not live here

- The performance harness stays under `scripts/` (generalizing `scripts/bench/docgen-memory/`).
- Framework provider code lives in each framework's own package.
