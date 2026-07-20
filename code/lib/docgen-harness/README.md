# @storybook/docgen-harness

Internal, unpublished test harness for the SB11 "docgen/snippets beyond React" cycle.
It records legacy-path docgen and snippet baselines per framework and compares Open Service Architecture (OSA) output against them, enforcing the "current or better" correctness bar.
Nothing here ships to npm (`private: true`); the package exists so fixture, recorder, seam-test, and comparator work across frameworks starts on one shared structure.

## The `__testfixtures__` layout

One subdirectory per framework under `src/`, named after the package that owns the framework's docgen path.
Directories materialize when their first fixtures land; empty placeholder directories are intentionally not committed.

```text
code/lib/docgen-harness/src/
├── index.ts                      # package entry (the expectCurrentOrBetter comparator lands here)
├── vue3/
│   └── __testfixtures__/
│       └── <fixture-case>/
│           ├── input.*           # the fixture component / story source
│           └── *.snapshot        # recorded baselines, written via toMatchFileSnapshot
├── angular/            (same shape)
├── svelte/             (same shape)
└── web-components/     (same shape)
```

## Conventions

- The directory name is exactly `__testfixtures__`, colocated next to the test files that consume it.
  Precedents: `code/renderers/react/src/componentManifest/__testfixtures__`, `code/core/src/docs-tools/argTypes/convert/__testfixtures__`.
- Fixture cases use the per-case-subdirectory style: one directory per case containing an `input.<ext>` plus recorded `*.snapshot` outputs, auto-discovered with `readdirSync`.
  Precedents to read before writing recorders: `code/renderers/web-components/src/docs/web-components-properties.test.ts`, `code/frameworks/angular-vite/src/client/docs/angular-properties.test.ts`.
- Framework subdirectory names mirror the owning package directories: `vue3`, `angular`, `svelte`, `web-components`.
  Angular is a framework package rather than a renderer; which Angular package supplies the legacy engine is decided when its level-1 recorder lands.
- Snapshots must be deterministic: no timestamps and no absolute paths.
  Engines whose output is path- or OS-sensitive use OS-suffixed snapshot files.
  Precedent: `compodoc-{posix,windows,undefined}.snapshot` in `code/frameworks/angular-vite/src/client/docs/__testfixtures__/` (the Angular OSA slice targets `angular-vite`; the same pattern exists in `code/frameworks/angular/`).
- Baseline updates go through the reviewed-snapshot-update workflow of `toMatchFileSnapshot`; there are no separate allowlist files.

## What does not live here

- The performance harness generalizes `scripts/bench/docgen-memory/` and stays under `scripts/`, with its own CI wiring.
- Framework provider code lives in each framework's own package, following the pattern of `code/renderers/react/src/docgen/`.
