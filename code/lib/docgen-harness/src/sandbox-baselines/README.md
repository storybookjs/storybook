# Sandbox docgen baselines

One recorded docgen payload per component, captured from a real built sandbox.

The fixture suites next door (`src/angular/__testfixtures__`) prove the extractor against components written to exercise it.
These baselines cover the other half: what the provider actually produces for a whole sandbox, resolved through the real preset chain, story index, and Compodoc run.
That is where component name collisions, unresolvable imports, and tsconfig coverage gaps show up, and none of them are reproducible from a single-component fixture.

## Where the data comes from

`build-storybook` with `features.experimentalDocgenServer` writes one snapshot per component to `storybook-static/services/core/docgen/`.
The recorder reads that directory and keeps only the portable `DocgenPayload` fields, so engine-specific extras (the raw Compodoc entry, roughly 117KB of source text across a stock sandbox) stay out of the repository.
Absolute sandbox paths inside error messages are rewritten to `<sandbox>`, because a sandbox lives somewhere different on every machine and every CI run.

## Updating

```bash
yarn task build --template angular-vite/default-ts --start-from auto
cd code/lib/docgen-harness
yarn baselines:sandbox            # verify
yarn baselines:sandbox --update   # re-record
```

CI runs the verify form after building each sandbox that has a baseline directory here.
Adding a directory is what enables the gate for a template; there is no separate list to keep in sync.

## Reading a failure

Findings come in two severities, and both fail the run.

`regression` means docgen got worse: a component stopped being documented, an arg disappeared, a type lost fidelity, or a recorded component is gone from the build.
These want a fix rather than a re-record.

`change` means the output moved without getting worse: a new component, a newly documented one, an added arg, reworded prose.
These are adopted with `--update` once the diff has been read.
