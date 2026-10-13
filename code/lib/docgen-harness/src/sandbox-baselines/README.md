# Sandbox docgen baselines

One recorded docgen payload per component, captured from a real built sandbox.

The fixture suites next door (`src/angular/__testfixtures__`) prove the extractor against components written to exercise it.
These baselines cover the other half: what the provider actually produces for a whole sandbox, resolved through the real preset chain, story index, and Compodoc run.
That is where component name collisions, unresolvable imports, and tsconfig coverage gaps show up, and none of them are reproducible from a single-component fixture.

## Where the data comes from

`build-storybook` with `features.docgenServer` writes one snapshot per component to `storybook-static/services/core/docgen/`.
The recorder reads that directory and keeps only the portable `DocgenPayload` fields, so engine-specific extras (the raw Compodoc entry, roughly 117KB of source text across a stock sandbox) stay out of the repository.
Absolute sandbox paths inside error messages are rewritten to `<sandbox>`, because a sandbox lives somewhere different on every machine and every CI run.

Components referenced through a global rather than an import are skipped.
The monorepo's shared template stories point at `globalThis.__TEMPLATE_COMPONENTS__.*`, which leaves no import to resolve and no scanned file to find, so all of them error by construction and say nothing about docgen.
Skipping them takes the Angular sandbox from 111 recorded components to 37, of which 30 are documented and 7 are Angular classes declared inline in story files.

## Which templates are covered

Every supported default-on sandbox template whose main config turns on `componentsManifest` without explicitly disabling `docgenServer`, read from the template definitions themselves rather than from a list kept here.
Turning on `componentsManifest` for a supported template is all it takes to bring it into this coverage, and there is nothing to keep in sync.
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

## Comparing legacy and server builds

Run these commands from `code/lib/docgen-harness`. Build both versions at the same repository SHA, with legacy docgen on the base version and server docgen on the head version.

```bash
yarn baselines:sandbox --capture legacy --static /repo/storybook-static --out /captures/before
yarn baselines:sandbox --capture server --static /repo/storybook-static --out /captures/after
yarn baselines:sandbox --compare /captures/before /captures/after --framework svelte --report /captures/report
```

Capture and compare cannot be combined or used with `--template`, `--sandbox` or `--update`. Comparison supports `svelte`, `vue3`, `angular` and `web-components`.

Each capture has one JSON file per component with its id, name, description, argTypes and stories keyed by story id. Each story records a snippet string or `null`. Absolute project paths become `<root>`. `capture.json` records the engine, installed Storybook version, repository remote, SHA and capture time. The output directory must be empty. The static directory must be directly under the project root containing `package.json`. The installed `storybook` package must resolve from that project, including workspace hoisting.

The legacy capture serves the static build on localhost and uses Playwright Chromium. Install it with `yarn playwright install chromium` if needed. It calls the preview's component extractors and listens for `SNIPPET_RENDERED` before each render. `--snippet-timeout <milliseconds>` changes the default 1000 ms wait. Stories that do not emit a snippet in time record `"timeout"`; baseline timeouts are excluded from snippet comparison and counted in the report. Server capture reads `services/core/docgen` and `services/core/story-docs` directly.

Comparison collects all argument and snippet regressions. Missing components fail; added components are reported as gains. A baseline snippet with no candidate snippet fails. Component descriptions must remain present. Captures with different repositories or SHAs are rejected.

`--waivers /path/waivers.json` accepts an array such as:

```json
[
  {
    "componentId": "button",
    "storyId": "button--primary",
    "violation": "lost-representation",
    "reason": "The static printer cannot resolve this binding",
    "approvedBy": "Review Lead"
  }
]
```

Omit `storyId` for component argument violations. A waiver matches the exact component, optional story and violation kind. Reasons and approvers must be nonempty. An unmatched waiver fails the run. The checked-in `waivers.json` starts empty; waivers require review approval.

`report.md` contains the repository summary and violation table for the PR body. `report.json` includes build metadata, component and story counts, timeouts, gains, violations, waivers and stale waivers. The command exits with code 1 for unwaived violations or stale waivers. Attach both capture directories and the reports as PR artifacts; do not commit third-party repositories or their captures.
