# Sandbox docgen baselines

One recorded docgen payload per component, captured from a real built sandbox.

The fixture suites next door (`src/angular/__testfixtures__`) prove the extractor against components written to exercise it.
These baselines cover the other half: what the provider actually produces for a whole sandbox, resolved through the real preset chain, story index, and Compodoc run.
That is where component name collisions, unresolvable imports, and tsconfig coverage gaps show up, and none of them are reproducible from a single-component fixture.

## Where the data comes from

`build-storybook` with `features.experimentalDocgenServer` writes one snapshot per component to `storybook-static/services/core/docgen/`.
The recorder reads that directory and keeps only the portable `DocgenPayload` fields, so engine-specific extras (the raw Compodoc entry, roughly 117KB of source text across a stock sandbox) stay out of the repository.
Absolute sandbox paths inside error messages are rewritten to `<sandbox>`, because a sandbox lives somewhere different on every machine and every CI run.

Components referenced through a global rather than an import are skipped.
The monorepo's shared template stories point at `globalThis.__TEMPLATE_COMPONENTS__.*`, which leaves no import to resolve and no scanned file to find, so all of them error by construction and say nothing about docgen.
Skipping them takes the Angular sandbox from 111 recorded components to 37, of which 30 are documented and 7 are Angular classes declared inline in story files.

## Which templates are covered

Every sandbox template whose main config turns on both `experimentalDocgenServer` and `componentsManifest`, read from the template definitions themselves rather than from a list kept here.
Turning those flags on for a template is all it takes to bring it into this coverage, and there is nothing to keep in sync.
A template that is flagged but has nothing recorded yet fails rather than skipping quietly.

## Updating

```bash
yarn task build --template <template> --start-from auto
cd code/lib/docgen-harness
yarn baselines:sandbox            # verify every server-docgen template
yarn baselines:sandbox --update   # re-record
```

Pass `--template <key>` to work on one of them, and `--sandbox <dir>` to point at a sandbox somewhere other than the default location.
CI runs the verify form after building each covered sandbox.

## Reading a failure

The gate is exact-match: any difference from the committed baseline fails the run, including an unambiguous improvement.
There is no "current or better" allowance here, because a sandbox baseline is a recording of what the whole provider chain produces and every move in it is worth a reviewer's eye.

Severity says which kind of failure you are looking at, not whether it blocks.

`regression` means docgen demonstrably got worse: a component or an arg disappeared, a component stopped being documented, or a recorded default is gone.
These want a fix rather than a re-record.

`change` is everything else: a new component, a newly documented one, an added arg, a type that resolved differently, reworded prose.
These are adopted with `--update` once the diff has been read.
