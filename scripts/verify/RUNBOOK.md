# Verify Harness — Runbook (v6)

Field-debugging guide for the v6 local-first verify harness. Maps
common failure signals to root-cause diagnoses and remediation steps,
for both the local AI fix-loop and the CI workflow.

## Retry strategy

The recipe-author flow has exactly **one** retry boundary:

- **Max attempts: 2** — defined by `MAX_RECIPE_ATTEMPTS` in
  `scripts/verify/recipe-author-core.ts` (inlined alongside `ERROR_RULES`).
- **Inner-only.** The TypeScript engine (`runRecipeAuthor`) drives both
  attempts in-process for the sdk-dispatch path. There is **no** outer
  workflow-level retry step; the GitHub Actions YAML does not loop.
- **Stdin-dispatch (skill) path** is the same budget: attempt 1 happens
  inside the skill (one Agent call), the CLI returns exit 75 with a framed
  retry message, and attempt 2 is the skill's second Agent call piped back
  through the CLI with `--retry-of <runId>`. After attempt 2 the CLI emits
  a terminal failure status and exit 1 — never exit 75 again.
- **Deny-regex hits are NOT retried.** They terminate immediately with
  `status: 'deny-regex-hit'`. Retrying a security-blocked spec is unsafe.
- **Extract failures (missing fence markers) consume an attempt** and
  return `status: 'extract-failed'` on exhaustion.

The retry message is built from the categorized ESLint output
(`categorizeEslintViolations`) and includes the new
`verify-recipes/listener-before-goto` and `verify-recipes/attach-pattern`
rules introduced when the ad-hoc regex checks were lifted into the ESLint
plugin under `.verify-recipes/eslint-plugin/`.

## Local AI fix-loop

The expected loop:

```bash
# 1. Make a change locally on the PR head branch.
# 2. Run the harness against the committed spec for that PR.
yarn verify-pr <PR#>
# 3. Inspect verdict + traces; iterate.
```

### Signal: spec-present check fails locally

```
Error: ENOENT: no such file or directory, open '.verify-recipes/pr-<#>.spec.ts'
```

The harness expects `.verify-recipes/pr-<#>.spec.ts` to exist relative
to the repo root. If you haven't authored a spec for the PR yet:

```bash
yarn verify-pr-generate --pr <#> --force
# Then invoke the `verify-recipe-author` skill, or run the CLI:
yarn verify-pr-author --bundle .verify-output/<runId>/prompt-bundle.json
```

The CLI emits `.verify-recipes/pr-<#>.spec.ts`. In local-dev you can
re-run the harness immediately; commit only if you want to capture the
spec in the PR history. CI does **not** require a committed spec — it
authors and executes the recipe in the same run (single-round flow).

### Signal: `Port 6006 already in use by PID(s) <n>`

A side process owns the port. Kill it (the error includes the kill
command) or pass `--port <other>` to the harness.

### Signal: `bootInternalUi failed: timeout`

`yarn storybook:ui:build` finished but `http-server` is not responding
on `:port/index.html`. Most likely:

1. The build produced no `code/storybook-static/index.html`. Run
   `cd code && yarn storybook:ui:build` directly and inspect the
   output.
2. `yarn http-server` isn't on `PATH`. The root devDependency
   `http-server@^14.1.1` resolves it through the yarn binary. Confirm
   `yarn http-server --version` works from the repo root.

### Signal: `bootStorybook failed: …` (sandbox target)

Sandbox-target recipes require `<sandbox>/node_modules/storybook` to
be present. Bootstrap once:

```bash
yarn task sandbox -s task --no-link --template <template>
```

Then re-run. If the sandbox path differs from the default, set
`STORYBOOK_SANDBOX_ROOT` and re-run.

### Signal: verdict is `regression` with `pageErrors: [...]`

The Storybook UI booted, but the recipe captured page errors. Open
the trace:

```bash
npx playwright show-trace .verify-output/<runId>/<spec>-<test-slug>/trace.zip
```

The trace contains the full DOM + console + network timeline. Use it
to locate the failing assertion or runtime error.

### Signal: verdict is `regression` with zero tests

```jsonc
{ "verdict": "regression", "tests": [] }
```

Playwright loaded the spec file but ran zero tests. Almost always a
spec-import error. Look for a Playwright-side `TypeError` in the
runner log (search for `[runner]` prefixed lines in the console
output). Common causes:

- Imported a `node:*` module — banned by the deny-regex.
- Imported `@storybook/*` directly — pulls the non-erasable enum chain.
- Used `test.skip` / `test.only` / `describe(...)` — the contract is
  exactly one `test(...)` call.

### Signal: `--resync` rejected

```
[verify] --resync only applies to sandbox-target recipes.
```

`--resync` exists for the sandbox target's slow boot path. The
internal-ui target rebuilds fast enough that resync adds no value.
Just re-run `yarn verify-pr <PR#>`.

### Recovery: sandbox in a broken state

If the harness crashed mid-mutation against the sandbox:

```bash
yarn verify-pr <PR#> --restore-sandbox
```

Restores `<sandbox>/package.json`, `yarn.lock`, `.yarnrc.yml` from
`<sandbox>/.verify-snapshot/`.

## CI workflow

### Signal: `Verify PR` step fails with `yarn install` errors

The `Verify PR` step runs inside `pr-head/`, which is a fresh clone of
the PR head SHA. The install pulls from the head's lockfile under
`enableScripts: false` (set by `.yarnrc.yml`). Common failure modes:

- **Head's lockfile is stale relative to its `package.json`** — the
  PR author needs to run `yarn install` and commit the updated
  `yarn.lock`.
- **Head added a new workspace package that the base lockfile didn't
  see** — same fix on the PR author's side.
- **Network-flake on a registry mirror** — re-run the workflow.

### Signal: `Verify PR` step fails with `yarn nx run-many -t compile`

A package's compile target broke on the PR head. Reproduce locally:

```bash
git fetch origin <PR-head-SHA>
git checkout <PR-head-SHA>
yarn install --immutable
yarn nx run-many -t compile -p core,cli,create-storybook
```

If the compile fails for the same reason locally, the PR has a
genuine compile regression. If it passes locally but fails in CI,
inspect cache state — `yarn nx reset` can rule out stale cache.

### Signal: PR comment renders "No verdict produced …"

In single-round mode the workflow failed before `verify-pr` could write
a verdict. Most common causes:

- **`Author recipe` step failed.** Deny-regex match, lint failure on
  both attempts, or extract-failure (LLM did not emit
  `<<<SPEC_START>>>…<<<SPEC_END>>>` fence). The author script's
  `result.json` under `.verify-output/<runId>/` (base checkout — uploaded
  as part of the artefact bundle) has the exact failure status.
- **`Verify PR` step failed before `writeResult`.** Compile error,
  Playwright install failure, or boot failure. The step's stdout has
  the trace; `pr-head/.verify-output/` will be empty.

### Signal: `Apply verified-by-harness label` is skipped

The label step gates on `verdict == 'verified'`. Any other verdict
(`regression`, `missing`, `skipped`) correctly skips the label.
Inspect `pr-head/.verify-output/*/verify-result.json` via the artefact
bundle to see the actual verdict + regressionReason.

### Signal: PR comment renders `Error reading verdict: …`

The `github-script` step caught an exception while resolving the
verdict path. Almost always means `pr-head/.verify-output/` is missing
or empty — the `Verify PR` step probably failed before
`writeResult(...)` ran. The runtime error itself is in the `Verify
PR` step's stdout, not the comment.

## Artefacts

Every run uploads `pr-head/.verify-output/` with a 14-day retention.
Path: from the workflow run page, the `verify-output-pr-<#>-<runId>`
zip contains every `runId/` subdirectory the harness produced. Each
contains:

- `verify-result.json` — the verdict.
- `playwright-report.json` — raw Playwright JSON reporter output.
- `<spec>-<test-slug>/trace.zip` — Playwright trace, replayable via
  `npx playwright show-trace <trace.zip>`.
- `<spec>-<test-slug>/*.png` and `*.webm` — screenshots / video on
  failure.

The trace is almost always the fastest path to diagnosis. Start there
before re-reading workflow logs.
