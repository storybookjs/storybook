# PR Verification Harness — v6 (local-first)

Thin orchestrator that compiles `code/core` (and the CLI packages),
boots Storybook against the PR head's compiled artefacts, runs a
committed Playwright spec from `.verify-recipes/`, and emits a JSON
verdict with a replayable trace.

> **v6 reset.** The harness no longer builds a Docker image. The same
> pipeline runs locally and on a GitHub Actions runner. See
> [`SECURITY.md`](./SECURITY.md) for the threat-model note and
> [`RUNBOOK.md`](./RUNBOOK.md) for failure-signal triage.

## Targets

Each recipe declares its execution target via a header comment scanned
in the first 30 lines:

```ts
// @verify-target: internal-ui
// @verify-target: sandbox:react-vite/default-ts
```

| Target | What it boots | When |
|---|---|---|
| `internal-ui` (default when no header) | `yarn storybook:ui:build` once, then `yarn http-server code/storybook-static -p <port>`. | Most fixes — exercise the monorepo's own Storybook UI against the PR head's compiled packages. |
| `sandbox:<template>` | Pre-existing sandbox flow: `snapshotSandbox`, `sanitizeResolutions`, `syncCorePackage` (symlink `code/core/dist` into the sandbox), `bootStorybook`. | Reproducing user-template-specific bugs (rare). |

## Prerequisites

1. **Node.js 22.22.1+** (see repo `.nvmrc`). The entry script is run as
   `node ./scripts/verify-pr.ts` and relies on Node's native TS-strip.
2. **Bun ≥ 1.3** on `PATH` — only required by the Playwright runner
   that spawns `bun x playwright test`. Recipe specs live under
   `.verify-recipes/` and load through Playwright's worker process.
3. **Sandbox cache** at `../storybook-sandboxes/<template>/` if (and
   only if) the recipe declares a `sandbox:<template>` target.
   Bootstrap once: `yarn task sandbox -s task --no-link --template <template>`.
4. **Playwright** is already pinned at `@playwright/test@1.58.2` in
   root devDependencies; no extra install needed.

## Usage

From repo root:

```bash
# Resolve the spec from a PR number — sugar for --recipe-spec
yarn verify-pr 34762

# Or pass an explicit spec path
yarn verify-pr --recipe-spec .verify-recipes/example-smoke.spec.ts

# Or run the default smoke recipe
yarn verify-pr
```

### Flags

| Flag | Purpose |
|------|---------|
| `<PR#>` (positional) | Resolves to `.verify-recipes/pr-<#>.spec.ts`. Overridden by `--recipe-spec`. |
| `--recipe-spec <path>` | Path to the Playwright spec to run. Default: `.verify-recipes/example-smoke.spec.ts`. |
| `--keep-open` | Leave Storybook running on the chosen port after the recipe completes. Used to bootstrap a long-lived session before `--resync`. |
| `--resync` | Recompile NX-affected packages, refresh symlinks, ping `__reload`, and re-run the same spec against an already-running Storybook. **Sandbox target only** — internal-ui rebuilds fast enough that resync adds no value. Requires a prior `--keep-open` session. |
| `--restore-sandbox` | Copy `<sandbox>/.verify-snapshot/{package.json,yarn.lock,.yarnrc.yml}` back. Recovery for mid-mutation crashes. Sandbox target only. |
| `--skip-recipe` | Skip Playwright execution; emit `verdict: "skipped"`; exit 0. |
| `--port <n>` | Port for Storybook (default: `6006`). |
| `--help` | Print usage. |

## Output

Each run writes to `.verify-output/<runId>/`:

```
.verify-output/
└── 2026-05-11T07-58-22-932Z/
    ├── verify-result.json
    ├── playwright-report.json
    └── <spec>-<test-slug>/
        ├── trace.zip
        ├── test-failed-1.png
        └── video.webm
```

Old runs auto-prune at startup — only the last 10 `<runId>` directories survive.

### Replay a trace

```bash
npx playwright show-trace .verify-output/<runId>/<spec>-<test-slug>/trace.zip
```

### `verify-result.json` schema (v2)

```jsonc
{
  "schemaVersion": 2,
  "runId": "2026-05-11T07-58-22-932Z",
  "verdict": "verified",
  "template": "internal-ui",
  "storyIds": [],
  "recipeSpecPath": "/abs/path/.verify-recipes/pr-34762.spec.ts",
  "tests": [
    {
      "specPath": "/abs/path/.verify-recipes/pr-34762.spec.ts",
      "title": "addon-docs Preview renders ActionBar without errors",
      "status": "passed",
      "steps": [],
      "pageErrors": [],
      "consoleErrors": [],
      "traceZipPath": "/abs/path/.verify-output/.../trace.zip"
    }
  ],
  "traceZipPaths": ["/abs/path/.verify-output/.../trace.zip"],
  "durations": {
    "bootMs": 4200,
    "recipeMs": 3500,
    "totalMs": 12500
  },
  "createdAt": "2026-05-11T07:58:22.932Z"
}
```

`template` is `"internal-ui"` for the default target, or the sandbox
template (e.g. `"react-vite/default-ts"`) when the recipe declares
`// @verify-target: sandbox:<template>`. `compileMs` and `symlinkMs`
are present only on sandbox runs.

### Verdict semantics

| Verdict | When |
|---------|------|
| `verified` | All tests `passed` AND every test's `pageErrors`/`consoleErrors` are empty. |
| `regression` | Any test failed, or any test reported a pageerror / console.error, or zero tests ran (spec import error). |
| `skipped` | `--skip-recipe` or `--restore-sandbox` mode. |

Exit codes: `0` on `verified` / `skipped`, `1` on `regression`, `130` on SIGINT.

## Writing a recipe

Recipes live in `.verify-recipes/<name>.spec.ts`. They are committed to
the repo and reviewed as part of the normal PR review — the spec at PR
head is the lethal-trifecta breaker (see [`SECURITY.md`](./SECURITY.md)).

The canonical, always-current skeleton is the committed
[`.verify-recipes/example-smoke.spec.ts`](../../.verify-recipes/example-smoke.spec.ts)
— it is the `verified` baseline the harness itself runs, so it cannot
drift from the contract. **Copy that file as your starting point; do not
hand-transcribe a skeleton here.** (A README copy would inevitably drift —
e.g. importing `test`/`expect` from `@playwright/test`, which the
deny-regex rejects, instead of from `./_util.ts`.)

See [`.verify-recipes/_recipe-authoring-guide.md`](../../.verify-recipes/_recipe-authoring-guide.md)
for the full authoring contract (imports, listener-before-goto,
`filterPageErrors`/`filterConsoleErrors`, final assertion).

**Why the slim helper instead of `code/e2e-tests/util.ts`?** Playwright
workers run under Node, which cannot strip the non-erasable TS enums
reached transitively from `code/e2e-tests/util.ts → lib/cli-storybook/src/sandbox-templates.ts`.
The slim `RecipePage` reimplements only the subset (`previewIframe`,
`previewRoot`, `waitUntilLoaded`) without touching that import chain.

## Architecture

```
scripts/
├── verify-pr.ts              # Entry — flag parsing, target dispatch, glue
├── verify-pr-generate.ts     # Entry — prompt-bundle emitter (Increment 2)
├── verify-pr-author.ts       # Entry — shared recipe-author core (Increment 3)
└── verify/
    ├── core.ts               # Types, run-paths, schema v2, parsePlaywrightReport, computeVerdict, prune
    ├── runner.ts             # Spawns `bun x playwright test`, parses report for trace.zip paths
    ├── playwright.config.ts  # testDir=.verify-recipes, outputDir=VERIFY_RUN_DIR, JSON reporter, trace 'on'
    ├── target.ts             # `// @verify-target:` header parser (default: internal-ui)
    ├── internal-ui.ts        # storybook:ui:build + http-server boot for the internal-ui target
    ├── symlink.ts            # ensureSymlinkOrCopy with dangling-heal + EPERM/EEXIST cp fallback
    ├── sandbox.ts            # resolveSandboxDir, snapshot/restore, sanitizeResolutions (sandbox target)
    ├── sync.ts               # yarn nx compile core + symlink dist (sandbox target)
    ├── boot.ts               # Port preflight, signal handlers, spawn sandbox storybook (sandbox target)
    ├── triage.ts             # triageReferenceSpecs(changedPaths) — glob matching via minimatch
    ├── agent-prompt.ts       # buildRecipeAuthorPrompt(...) — assembles the prompt bundle sections
    ├── recipe-author-core.ts # Shared local/CI recipe-author core (incl. retry policy)
    ├── recipe-deny.ts        # assertNoDeniedPatterns(source) — static deny-regex pass
    ├── lint-invocation.ts    # Scoped ESLint invocation for agent-generated specs
    ├── agent-dispatch.ts     # Direct @anthropic-ai/sdk dispatcher (CI path)
    └── recipes/
        └── triage-table.ts   # TRIAGE_ROUTES — path-glob → reference-spec mappings
.verify-recipes/
├── _util.ts                  # Slim Playwright helper (recipe-local; no SbPage enum chain)
├── _recipe-authoring-guide.md # Agent-readable authoring guide
└── example-smoke.spec.ts     # Default smoke spec (canonical 'verified' baseline)
```

## Side effects (sandbox target only)

1. **Snapshot first.** Every sandbox-target run writes
   `<sandbox>/.verify-snapshot/{package.json,yarn.lock,.yarnrc.yml}`
   before any mutation. Recover via `--restore-sandbox`.
2. **Resolutions rewrite.** `@storybook/*` and `storybook` keys are
   stripped from the sandbox's `package.json` `resolutions` field
   (otherwise Yarn Berry overwrites the symlink on `yarn install`).
   Idempotent.
3. **Symlink injection.** `code/core/dist` →
   `<sandbox>/node_modules/storybook/dist`. Windows / CI fall back to
   `cp`. Dangling targets self-heal.

The `internal-ui` target has no sandbox side effects — it builds
`code/storybook-static/` and serves it; nothing in the repo tree is
mutated outside `.verify-output/`.

## Environment overrides

| Variable                       | Effect                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `VERIFY_AGENT_MODEL`           | Overrides the default `claude-opus-4-7[1m]` hint baked into `prompt-bundle.json` (`agentModel`).             |
| `VERIFY_MAX_COST_USD`          | Per-run cost cap (default `$2.00`). Aborts dispatch when the estimate exceeds the cap.                       |
| `ANTHROPIC_BASE_URL`           | Optional override; restricted to `https://*.anthropic.com/` via `assertAnthropicBaseUrl`.                    |
| `VERIFY_PROVENANCE_SECRET`     | When set, HMAC-signs the trusted-boundary `verify-result.json` verdict (consumed by `derive-verdict.ts`). The spec provenance header is informational only — deny-regex + scoped lint are the load-bearing controls on the untrusted spec. |
| `VERIFY_PR_AUTHOR_STUB_REPLY`  | Absolute path to a fixture file used by tests; bypasses the live Anthropic call.                             |
| `VERIFY_INCLUDE_SOURCE_DUMP`   | `1` to append full source dumps of touched non-stories files to the prompt.                                  |

## Security

See [`SECURITY.md`](./SECURITY.md). v6 single-round drops the
committed-spec human review. Load-bearing controls become:
`ANTHROPIC_API_KEY` scoped to the `Author recipe` step only, static
deny-regex (`recipe-deny.ts`), scoped lint, structural pattern checks
(listener-before-goto, finally-attach), controlled `outputSpecPath` set
by trusted base scripts, actor-permission gate (`write` access required
to apply `ci:verify`), and label-gate on non-draft PRs.

## CI

[`/.github/workflows/verify-pr.yml`](../../.github/workflows/verify-pr.yml).
Triggered by the `ci:verify` label on a non-draft PR opened by a
write-permission actor. Single-round workflow shape:

1. `Check actor permission` (≥ write).
2. Checkout base SHA + install root deps + setup Bun.
3. Manual `git clone` PR head into `$RUNNER_TEMP/pr-head/`
   (submodule-safe; never writes auth into `pr-head/.git`).
4. `gh pr diff` → `/tmp/pr.diff`.
5. `yarn verify-pr-generate --pr <#> --force --output
   $PR_HEAD_DIR/.verify-recipes/pr-<#>.spec.ts` — trusted base scripts
   read trusted authoring-guide + canonical-smoke and emit the prompt
   bundle with the ephemeral output path baked in.
6. `yarn verify-pr-author --bundle …` (ANTHROPIC_API_KEY scoped here)
   dispatches the LLM, runs deny-regex + lint, and renames the
   candidate spec onto `$PR_HEAD_DIR/.verify-recipes/pr-<#>.spec.ts`.
7. **Verify PR** (working-directory = `$PR_HEAD_DIR`):
   ```bash
   yarn install --immutable
   yarn playwright install --with-deps chromium
   yarn nx compile core
   yarn nx run-many -t compile
   yarn verify-pr --recipe-spec ".verify-recipes/pr-${PR_NUMBER}.spec.ts"
   ```
8. Read verdict from `verify-result.json`. On `verified`, apply
   `verified-by-harness` label. Push screenshots to the
   `_verify-screenshots` side branch, upload artefacts, post PR
   comment with verdict + inline screenshots.

The runner is a GitHub Actions ephemeral VM, but every PR-controlled
step (install, compile, recipe execution) runs inside
`@anthropic-ai/sandbox-runtime` (`srt`, bubblewrap on Linux) with
`env -i` stripping runner secrets — Layer-2 isolation on top of the
Layer-1 deny-regex + ESLint + `enableScripts: false` controls. The
authored spec lives inside the ephemeral runner workspace only; it is
uploaded as part of the artefact bundle for replay but never committed
to any branch. See `scripts/verify/SECURITY.md` for the full posture.

## Increment 2 — prompt-bundle generation

`yarn verify-pr-generate --pr <#>` produces
`.verify-output/<runId>/prompt-bundle.json` containing PR metadata,
truncated diff, triage matches, and reference specs. Truncation rules:

- Per-file cap: 500 lines.
- Total-file cap: 20 files. Triage-matched files first; remainder
  ordered by `additions desc`, then `path asc`.
- Hard cap: 5 MB raw diff.

When `.verify-recipes/pr-<#>.spec.ts` already exists, the generator
exits 1 unless `--force` is passed.

## Increment 3 — two execution paths

Both share `scripts/verify/recipe-author-core.ts`:

| Path | Dispatch | Used by |
|---|---|---|
| Local / interactive | `verify-recipe-author` skill → OMC executor subagent | Day-to-day PoC iteration |
| CI / headless | `yarn verify-pr-author --bundle … --dispatch-mode sdk` (direct `@anthropic-ai/sdk`) | `.github/workflows/verify-pr.yml` step `Author recipe` |

The core encapsulates: deny-regex pass, provenance header, lint
invocation, retry-policy lookup, framed-retry emission on **exit 75**
(stable contract — see the inlined `ERROR_RULES` table in `recipe-author-core.ts`), and final atomic
rename of the candidate onto `bundle.outputSpecPath` (local-dev →
`.verify-recipes/pr-<#>.spec.ts`; CI single-round →
`$PR_HEAD_DIR/.verify-recipes/pr-<#>.spec.ts`).
`VERIFY_PR_AUTHOR_STUB_REPLY` env stubs the agent reply for parity
tests across paths.

## References

- Security model: [`SECURITY.md`](./SECURITY.md)
- Field debugging: [`RUNBOOK.md`](./RUNBOOK.md)
- Recipe authoring contract: [`.verify-recipes/_recipe-authoring-guide.md`](../../.verify-recipes/_recipe-authoring-guide.md)
- Existing e2e patterns: [`code/e2e-tests/`](../../code/e2e-tests/)
- CI workflow: [`/.github/workflows/verify-pr.yml`](../../.github/workflows/verify-pr.yml)
