# PR Verification Harness — v2 (raw Playwright)

Thin orchestrator that compiles `code/core`, symlinks the built `dist/` into a pre-existing sandbox, boots Storybook, spawns `bun x playwright test` against a committed spec under `.verify-recipes/`, and emits a JSON verdict with a replayable trace.

> **Scope:** Increment 1 covers raw-Playwright execution of a single canonical smoke spec (`example-smoke.spec.ts`) plus Phase-1 security hardening (`.claude/settings.json` deny rules, `.dockerignore`, `SECURITY.md`, gated GitHub Actions workflow). Agent-generated specs from PR diffs are deferred to Increment 2. See [Limitations](#limitations) and [Roadmap](#roadmap).

## Prerequisites

1. **Bun ≥ 1.3** on `PATH`. The entry script (`scripts/verify-pr.ts`) is invoked via `bun` because Storybook's transitive deps (`code/lib/cli-storybook/src/sandbox-templates.ts` → `code/core/src/cli/projectTypes.ts`) include non-erasable TypeScript enums that `node --experimental-strip-types` rejects.
2. **Sandbox cache present** at `../storybook-sandboxes/react-vite-default-ts/` with `node_modules/storybook` installed. Bootstrap once:
   ```bash
   yarn task sandbox -s task --no-link --template react-vite/default-ts
   ```
   This is a one-time ~5 min cost. Subsequent runs reuse the NX-cached sandbox.
3. **Playwright** is already pinned at `@playwright/test@1.58.2` in root devDependencies; no extra install needed.

## Usage

From repo root:

```bash
# Full happy-path run with the default smoke spec
yarn verify-pr

# Or directly via bun
bun scripts/verify-pr.ts
```

### Flags

| Flag | Purpose |
|------|---------|
| `--recipe-spec <path>` | Path to the Playwright spec to run. Default: `.verify-recipes/example-smoke.spec.ts`. |
| `--keep-open` | Leave Storybook running on `:6006` after the recipe completes. Used to bootstrap a long-lived session before `--resync`. |
| `--resync` | Recompile NX-affected packages, refresh symlinks, ping `__reload`, and re-run the same spec against an already-running Storybook (requires a prior `--keep-open` session). |
| `--restore-sandbox` | Copy `<sandbox>/.verify-snapshot/{package.json,yarn.lock,.yarnrc.yml}` back. Recovery for mid-mutation crashes. |
| `--skip-recipe` | Skip Playwright execution; emit `verdict: "skipped"`; exit 0. (Replaces the v1 `--no-screenshot`.) |
| `--port <n>` | Port for Storybook (default: `6006`). Use to avoid collisions with side processes that already occupy 6006. |
| `--help` | Print usage. |

### Examples

```bash
# Default smoke spec
yarn verify-pr

# Custom recipe
yarn verify-pr --recipe-spec .verify-recipes/pr-34701.spec.ts

# Iterative dev loop
yarn verify-pr --keep-open
# (edit code/core/src/…)
yarn verify-pr --resync

# Recover after the harness mutated package.json and crashed
yarn verify-pr --restore-sandbox
```

## Output

Each run writes to `.verify-output/<runId>/`:

```
.verify-output/
└── 2026-05-11T07-58-22-932Z/
    ├── verify-result.json                                # Verdict + per-test details + durations
    ├── playwright-report.json                            # Raw Playwright JSON reporter output
    └── <spec>-<test-slug>/
        ├── trace.zip                                     # Replayable Playwright trace
        ├── test-failed-1.png                             # Screenshots (on failure)
        └── video.webm                                    # Video (retain-on-failure)
```

Old runs auto-prune at startup — only the last 10 `<runId>` directories survive.

### Replay a trace

```bash
npx playwright show-trace .verify-output/<runId>/<spec>-<test-slug>/trace.zip
```

(Or use the `traceZipPaths` array in `verify-result.json` to get the exact paths.)

### `verify-result.json` schema (v2)

```jsonc
{
  "schemaVersion": 2,
  "runId": "2026-05-11T07-58-22-932Z",
  "verdict": "verified",
  "template": "react-vite/default-ts",
  "storyIds": ["example-button--primary"],
  "recipeSpecPath": "/abs/path/.verify-recipes/example-smoke.spec.ts",
  "tests": [
    {
      "specPath": "/abs/path/.verify-recipes/example-smoke.spec.ts",
      "title": "example-button--primary renders without runtime errors",
      "status": "passed",
      "steps": [],
      "pageErrors": [],
      "consoleErrors": [],
      "traceZipPath": "/abs/path/.verify-output/.../trace.zip"
    }
  ],
  "traceZipPaths": ["/abs/path/.verify-output/.../trace.zip"],
  "durations": {
    "compileMs": 31000,
    "symlinkMs": 8,
    "bootMs": 14000,
    "recipeMs": 4100,
    "totalMs": 49500
  },
  "createdAt": "2026-05-11T07:58:22.932Z"
}
```

### Verdict semantics

| Verdict | When |
|---------|------|
| `verified` | All tests `passed` AND every test's `pageErrors`/`consoleErrors` are empty. |
| `regression` | Any test failed, or any test reported a pageerror / console.error, or zero tests ran (spec import error). |
| `skipped` | `--skip-recipe` or `--restore-sandbox` mode. |

Exit codes: `0` on `verified` / `skipped`, `1` on `regression`, `130` on SIGINT.

## Writing a recipe

Recipes live in `.verify-recipes/<name>.spec.ts`. They are committed to the repo and reviewed as part of the PR — this is the Phase-1 prompt-injection breaker (see [`SECURITY.md`](./SECURITY.md)).

Example skeleton (uses the slim helper, `.verify-recipes/_util.ts`):

```ts
import { expect, test } from '@playwright/test';
import { RecipePage } from './_util.ts';

test('my recipe', async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  // CRITICAL: register listeners BEFORE the first page.goto.
  page.on('pageerror', (err) => pageErrors.push(err.stack ?? err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const baseURL =
    process.env.STORYBOOK_URL ?? testInfo.project.use.baseURL ?? 'http://localhost:6006';

  try {
    await page.goto(`${baseURL}/?path=/story/example-button--primary`);
    await new RecipePage(page, expect).waitUntilLoaded();
    // ...assertions...
  } finally {
    await testInfo.attach('pageErrors', {
      body: JSON.stringify(pageErrors),
      contentType: 'application/json',
    });
    await testInfo.attach('consoleErrors', {
      body: JSON.stringify(consoleErrors),
      contentType: 'application/json',
    });
  }

  expect(pageErrors).toEqual([]);
});
```

**Why the slim helper instead of `code/e2e-tests/util.ts`?** Playwright's worker processes run under Node, which cannot strip the non-erasable TS enums reached transitively from `code/e2e-tests/util.ts → lib/cli-storybook/src/sandbox-templates.ts`. The slim `RecipePage` reimplements only the subset (`previewIframe`, `previewRoot`, `waitUntilLoaded`) without touching that import chain. Recipes stay portable; e2e tests keep their richer `SbPage`.

## Architecture

```
scripts/
├── verify-pr.ts              # Entry — flag parsing, mode dispatch, glue
├── verify-pr-generate.ts     # Entry — prompt-bundle emitter for agent-generated recipes
└── verify/
    ├── core.ts               # Types, run-paths, schema v2, parsePlaywrightReport, computeVerdict, prune
    ├── runner.ts             # Spawns `bun x playwright test`, parses report for trace.zip paths
    ├── playwright.config.ts  # testDir/.verify-recipes, outputDir=VERIFY_RUN_DIR, JSON reporter, trace 'on'
    ├── symlink.ts            # ensureSymlinkOrCopy with dangling-heal + EPERM/EEXIST cp fallback
    ├── sandbox.ts            # resolveSandboxDir, snapshot/restore, sanitizeResolutions
    ├── sync.ts               # yarn nx compile core + symlink dist
    ├── boot.ts               # Port preflight, signal handlers, spawn, dual wait-on
    ├── triage.ts             # triageReferenceSpecs(changedPaths) — glob matching via minimatch
    ├── agent-prompt.ts       # buildRecipeAuthorPrompt(...) — assembles the prompt bundle sections
    ├── recipe-deny.ts        # assertNoDeniedPatterns(source) — static deny-regex pass
    ├── recipe-retry-policy.ts # RECIPE_RETRY_POLICY declarative config (maxAttempts, errorCategories)
    └── recipes/
        └── triage-table.ts   # TRIAGE_ROUTES — path-glob → reference-spec mappings
.verify-recipes/
├── _util.ts                  # Slim Playwright helper (recipe-local; no SbPage enum chain)
├── _recipe-authoring-guide.md # Agent-readable authoring guide (imports, listener rules, attach pattern)
├── example-smoke.spec.ts     # Default smoke spec (canonical 'verified' baseline)
└── .gitkeep
```

## Side effects

Same as v1:

1. **Snapshot first.** Every full run writes `<sandbox>/.verify-snapshot/{package.json,yarn.lock,.yarnrc.yml}` before any mutation. Recover via `--restore-sandbox`.
2. **Resolutions rewrite.** `@storybook/*` and `storybook` keys are stripped from the sandbox's `package.json` `resolutions` field (otherwise Yarn Berry overwrites the symlink on `yarn install`). Idempotent.
3. **Symlink injection.** `code/core/dist` → `<sandbox>/node_modules/storybook/dist`. Windows / CI fall back to `cp`. Dangling targets self-heal (`unlink` + recreate, logged as `[symlink] healed dangling target ...`).

## Security

See [`SECURITY.md`](./SECURITY.md) for the phase-gated threat model:

- **Phase 1 (current):** committed spec review + `.claude/settings.json` deny rules + spec lint gate
- **Phase 2 (deferred):** container isolation + Envoy credential-injector proxy + `pull_request_target` actor gate
- **Phase 3 (deferred):** `author_association` auto-trigger + NX-affected scoping

Sandbox-runtime (`@anthropic-ai/sandbox-runtime`) evaluation is tracked as a Phase-2 follow-up.

## Verification suite (manual)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| V-1 | Sanity | `yarn verify-pr` against fresh sandbox | Exit 0; `verdict: "verified"`; `trace.zip` >100KB; <90s |
| V-2 | Regression detection | Inject `throw new Error('VERIFY_HARNESS_TEST')` at top of `code/core/src/manager-api/index.ts`; run; revert | Exit non-zero; verdict `regression` OR compile-stage abort with sentinel surfaced in stderr |
| V-3 | Resync | `--keep-open` once; edit a file in `code/core/src/manager/`; `--resync` | <15s wall; new `<runId>`; old Storybook process untouched |
| V-4 | Dangling heal | `ln -sfn /tmp/nonexistent <sandbox>/node_modules/storybook/dist`; run | Logs `[symlink] healed dangling target /tmp/nonexistent`; verdict matches V-1 |
| V-5 | Port collision | `python3 -m http.server 6006 &`; run | Non-zero exit; error contains offending PID + kill command |
| V-6 | SIGINT cleanup | Run; Ctrl-C during boot or recipe | Exit 130 within 5s; `lsof -i :6006` empty within 5s; `.verify-snapshot/` populated |
| V-7 | Restore | After a run that mutated `package.json`, run `yarn verify-pr --restore-sandbox` | `package.json` / `yarn.lock` / `.yarnrc.yml` byte-identical to pre-run state |

## Limitations

The Increment-1 harness still does not cover:

- **Filesystem mutation mid-run.** Recipes can do this themselves with `fs.writeFileSync`, but no harness-level primitives yet (Increment 2).
- **Multi-template triage.** Hardcoded to `react-vite/default-ts`.
- **Pixel diffing / baselines.** Tier-1 presence-only; defer Tier-2 to Chromatic.
- **CI activation.** The workflow at `.github/workflows/verify-pr.yml` is committed with `if: false` until Phase 2 launches.
- **Auto-bootstrap.** If the sandbox cache is missing, the harness fails loud — it does not run `yarn task sandbox` automatically.

## Roadmap

In rough priority order:

- **Done in v3 — Agent-generated recipes (Increment 2).** `gh pr diff` → triage routing → agent emits `.verify-recipes/pr-<#>.spec.ts` → spec committed after human review → harness runs via `--recipe-spec`. See [Increment 2 — Four-Step Flow](#increment-2--four-step-flow) below.

1. **Manager-frame captures.** Add full-page screenshot capture beyond the iframe clip.
2. **Channel-event waits.** `page.evaluate` on `window.__STORYBOOK_ADDONS_CHANNEL__.on(...)` to await indexer events.
3. **Multi-template triage.** Path-glob → template set per `.omc/research/research-20260508-prverify/report.md` §7.
4. **CI activation (Phase 2).** Container-isolated execution + Envoy proxy + actor permission gate + artifact upload + `gh pr comment`. Requires migrating the recipe-author skill to direct Anthropic SDK (no Claude Code dependency).
5. **Chromatic Tier-2.** Pixel-diff layer delegated to Chromatic; replaces in-repo baselines.

## Increment 2 — Four-Step Flow

Increment 2 ships `yarn verify-pr-generate`, which produces a per-PR Playwright spec via an OMC executor agent. The four steps are:

1. **Generate the prompt bundle.**
   ```bash
   yarn verify-pr-generate --pr <#>
   ```
   Fetches PR metadata and diff via `gh`, applies triage routing (see `scripts/verify/recipes/triage-table.ts`), assembles the prompt, enforces the spec-name collision policy (see below), writes `.verify-output/<runId>/prompt-bundle.json`, and prints the next-step command. Use `--force` to overwrite an existing `.verify-recipes/pr-<#>.spec.ts`.

2. **Run the `verify-recipe-author` skill on the prompt bundle.**
   The skill (`.claude/skills/verify-recipe-author/SKILL.md`) dispatches the OMC executor agent (model: opus) with the assembled prompt, extracts the generated spec from the agent reply, runs a static deny-regex pass (`scripts/verify/recipe-deny.ts`), prepends the header-comment provenance block, lints the candidate with `yarn --cwd code lint:js:cmd` (allowing at most one retry on lint failure), writes `.verify-recipes/pr-<#>.spec.ts`, and emits `.verify-output/<runId>/result.json`.

3. **Human reviews and commits the spec.**
   Review the diff of `.verify-recipes/pr-<#>.spec.ts` before committing. This is the lethal-trifecta-breaker — the agent never executes its own output. See [`SECURITY.md`](./SECURITY.md).

4. **Run the committed spec.**
   ```bash
   yarn verify-pr --recipe-spec .verify-recipes/pr-<#>.spec.ts
   ```
   Runs the committed spec via the v2 runner and emits `verify-result.json` with the verdict.

### Spec-name collision

When `.verify-recipes/pr-<#>.spec.ts` already exists and `--force` is not passed, the generator exits 1 with an actionable message. Pass `--force` to explicitly overwrite a previously reviewed spec on re-run.

### Header-comment provenance

The skill prepends a block comment to every generated spec:

```ts
// verify-pr-generate: {
//   generatedAt: "<ISO timestamp>",
//   agentModel: "<model id, e.g. opus>",
//   prNumber: <#>,
//   referenceSpecs: ["<rel path>", ...],
//   triageGlobs: ["<glob>", ...]
// }
```

This provides an audit trail that survives squash-merge. No sidecar metadata file is written to the PR tree.

### Triage routing

Changed-file paths are matched against `scripts/verify/recipes/triage-table.ts`. Matched entries supply reference specs from `code/e2e-tests/` that the agent uses as authoring examples. When no paths match, the generator logs `triage: empty → using canonical smoke pattern only` and proceeds with `example-smoke.spec.ts` as the sole reference.

### Diff truncation

- Per-file cap: 500 lines.
- Total-file cap: 20 files. Triage-matched files are included first; remaining files are ordered by `additions desc`, then `path asc`. Elided files are listed in a summary printed to stderr and embedded in the prompt.
- Hard cap: 5 MB raw diff. If exceeded the generator aborts with an actionable error.

### Authoring guide

The agent-readable authoring rules live at `.verify-recipes/_recipe-authoring-guide.md`. They cover the output contract, listener-before-goto rule, attach pattern, `RecipePage` API, selector guidance, and what to avoid.

### Deferred

- `--commit-range <a..b>` flag. Only `--pr <#>` is supported today.
- Phase-2 CI activation requires migrating to direct Anthropic SDK; today the skill couples to Claude Code's `Agent` tool.

## References

- Security model: [`SECURITY.md`](./SECURITY.md)
- Original plan: [`.omc/plans/pr-verify-poc-mvp.md`](../../.omc/plans/pr-verify-poc-mvp.md)
- Research: [`.omc/research/research-20260508-prverify/report.md`](../../.omc/research/research-20260508-prverify/report.md)
- Existing e2e patterns: [`code/e2e-tests/`](../../code/e2e-tests/)
- CI workflow scaffold (gated): [`.github/workflows/verify-pr.yml`](../../.github/workflows/verify-pr.yml)
