# PR Verification Harness — PoC MVP

Single-shot verification loop for Storybook PRs. Compiles `code/core`, symlinks the built `dist/` into a pre-existing sandbox, boots Storybook, navigates to one canonical story, captures a screenshot, and emits a JSON verdict.

> **Scope:** This is a Proof-of-Concept. It verifies one template (`react-vite/default-ts`) against one story (`example-button--primary`). It does **not** cover sidebar navigation, filesystem mutation, change-detection, manager observation, or multi-step recipes. See [Limitations](#limitations) and the [v2 roadmap](#roadmap-v2).

## Prerequisites

1. **Bun ≥ 1.3** on `PATH`. The script is invoked via `bun` because Storybook's transitive deps (`code/lib/cli-storybook/src/sandbox-templates.ts` → `code/core/src/cli/projectTypes.ts`) include non-erasable TypeScript enums that `node --experimental-strip-types` rejects. Bun handles enums natively.
2. **Sandbox cache present** at `sandbox/react-vite-default-ts/` with `node_modules/storybook` installed. Bootstrap once with:
   ```bash
   yarn task sandbox -s task --no-link --template react-vite/default-ts
   ```
   This is a one-time ~5 min cost. Subsequent runs reuse the NX-cached sandbox.

## Usage

From repo root:

```bash
# Full happy-path run
yarn verify-pr

# Or directly via bun
bun scripts/verify-pr.ts
```

### Flags

| Flag | Purpose |
|------|---------|
| `--keep-open` | Leave Storybook running on `:6006` after capture. Use before `--resync` to bootstrap a long-lived session. |
| `--resync` | Recompile affected packages, refresh symlinks, hard-reload an already-running Storybook (requires a prior `--keep-open` run). |
| `--restore-sandbox` | Copy `<sandbox>/.verify-snapshot/` back over `package.json` / `yarn.lock` / `.yarnrc.yml`. Recovery for mid-mutation crashes. |
| `--no-screenshot` | Skip Playwright capture entirely; emit `verdict: "skipped"`; exit 0. |
| `--help` | Print usage. |

### Examples

```bash
# Verify current state of code/core/
yarn verify-pr

# Iterative dev loop: bootstrap once, edit, resync repeatedly
yarn verify-pr --keep-open
# (edit a file under code/core/src/)
yarn verify-pr --resync
# (edit again)
yarn verify-pr --resync

# Recover after the harness mutated package.json and crashed
yarn verify-pr --restore-sandbox
```

## Output

Each run writes to `.verify-output/<runId>/`:

```
.verify-output/
└── 2026-05-08T22-40-30-123Z/
    ├── verify-result.json     # Verdict + capture metadata + durations
    ├── screenshot-manager.png # Iframe-clipped preview screenshot
    └── console.log            # JSON-encoded { pageErrors, consoleErrors }
```

Old runs auto-prune at startup — only the last 10 `<runId>` directories survive.

### `verify-result.json` schema

```json
{
  "runId": "2026-05-08T22-40-30-123Z",
  "verdict": "verified",
  "template": "react-vite/default-ts",
  "storyIds": ["example-button--primary"],
  "capture": {
    "pageErrors": [],
    "consoleErrors": [],
    "errorDisplayHidden": true,
    "previewHasChildren": true,
    "screenshotPath": ".verify-output/.../screenshot-manager.png"
  },
  "durations": {
    "compileMs": 12340,
    "symlinkMs": 8,
    "bootMs": 14200,
    "captureMs": 3110,
    "totalMs": 30050
  },
  "createdAt": "2026-05-08T22:40:30.123Z"
}
```

### Verdict semantics

| Verdict | When |
|---------|------|
| `verified` | All four signals green: zero `pageErrors`, zero `consoleErrors`, `#sb-errordisplay` hidden, preview iframe has DOM children. |
| `regression` | Any of the four signals failed. |
| `skipped` | `--no-screenshot` was passed, or the run was a `--restore-sandbox` operation. |

Exit codes: `0` on `verified` / `skipped`, `1` on `regression`, `130` on SIGINT.

## Architecture

```
scripts/
├── verify-pr.ts              # Entry — flag parsing, mode dispatch, glue
└── verify/
    ├── core.ts               # Types, run-path math, verdict, prune
    ├── symlink.ts            # ensureSymlinkOrCopy with dangling-heal + EPERM/EEXIST cp fallback
    ├── sandbox.ts            # resolveSandboxDir, snapshot/restore, sanitizeResolutions
    ├── sync.ts               # yarn nx compile core + symlink dist
    ├── boot.ts               # Port preflight, signal handlers, spawn, dual wait-on
    └── capture.ts            # Playwright capture via SbPage from code/e2e-tests/util.ts
```

## Side effects

The harness mutates the sandbox at runtime:

1. **Snapshot first.** On every full run, `<sandbox>/.verify-snapshot/{package.json,yarn.lock,.yarnrc.yml}` is written before any mutation. Recover via `--restore-sandbox` if a run crashes mid-flight.
2. **Resolutions rewrite.** The sandbox's `package.json` `resolutions` field has any `@storybook/*` and `storybook` keys stripped (Yarn Berry resolutions otherwise overwrite symlinks on `yarn install`). Idempotent.
3. **Symlink injection.** `code/core/dist` → `<sandbox>/node_modules/storybook/dist`. On Windows / CI, falls back to `cp`. On `EEXIST` with a dangling target, the harness self-heals (`unlink` + recreate, logged as `[symlink] healed dangling target ...`).

## Verification suite (manual)

To validate the harness itself (not user code), run:

| # | Test | Steps | Expected |
|---|------|-------|----------|
| V-1 | Sanity | `yarn verify-pr` against fresh sandbox | Exit 0; `verdict: "verified"`; screenshot >10KB; <90s |
| V-2 | Regression detection | Inject `throw new Error('VERIFY_HARNESS_TEST')` at top of `code/core/src/manager-api/index.ts`; run; revert | Exit non-zero; `verdict: "regression"`; `pageErrors[]` contains the sentinel |
| V-3 | Resync | `--keep-open` once; edit a file in `code/core/src/manager/`; `--resync` | <15s wall; new `<runId>`; old Storybook process untouched |
| V-4 | Dangling heal | `ln -sfn /tmp/nonexistent <sandbox>/node_modules/storybook/dist`; run | Logs `[symlink] healed dangling target /tmp/nonexistent`; verdict matches V-1 |
| V-5 | Port collision | `python3 -m http.server 6006 &`; run | Non-zero exit; error contains the offending PID + kill command |
| V-6 | SIGINT cleanup | Run; Ctrl-C during boot or capture | Exit 130 within 5s; `lsof -i :6006` empty within 5s; `.verify-snapshot/` populated |
| V-7 | Restore | After a run that mutated `package.json`, run `yarn verify-pr --restore-sandbox` | `package.json` / `yarn.lock` / `.yarnrc.yml` byte-identical to pre-run state |

## Limitations

The PoC explicitly does **not** cover:

- **Manager navigation.** Only `deepLinkToStory` to one canonical story. No sidebar clicks, no docs view, no addon panel interaction.
- **Filesystem mutation mid-run.** No `fs.writeFile` of story files during a run, so no change-detection coverage (e.g. "edit a story → confirm a dot/badge appears in sidebar").
- **Channel event observation.** No listener for `STORY_INDEX_INVALIDATED`, `SET_INDEX`, `STORY_RENDERED`, etc.
- **Manager-frame screenshots.** Capture is iframe-clipped to `#storybook-preview-iframe`. The Manager UI (sidebar, toolbar, addon panel) is excluded from the screenshot.
- **Multi-step recipes.** No verification recipe DSL (no `steps: [navigate, edit-file, wait-for-event, assert-selector]`).
- **Multi-template triage.** Hardcoded to `react-vite/default-ts`. Builder/renderer changes that need cross-builder coverage will false-green.
- **Pixel diffing / baselines.** Tier-1 presence-only; defer Tier-2 to Chromatic.
- **CI integration.** Local-only; no PR comment, no artifact upload, no `pull_request_target` workflow.
- **Auto-bootstrap.** If the sandbox cache is missing, the harness fails loud — it does not run `yarn task sandbox` automatically.
- **Story diff inference.** No `git diff` → story id resolution. The single canonical story is hardcoded.

If a PR's effect is invisible from the iframe of one story (e.g. CLI codemods, sidebar change indicators, DocsPage rendering, addon UIs), this harness will not detect it. See the v2 roadmap for the path to broader coverage.

## Roadmap (v2)

In rough priority order:

1. **Recipe DSL.** Declarative step list (`navigate`, `edit-file`, `wait-event`, `click`, `assert-selector`, `screenshot`) executed by a `recipe.ts` runner. Per-template recipes live in `scripts/verify/recipes/<template>.yaml`. Optional override block in PR descriptions.
2. **Manager-frame captures.** Add a `capture-manager` step that screenshots without iframe clipping, plus a `capture-sidebar` selector-scoped variant.
3. **Filesystem mutation primitives.** `edit-file` step with template substitution. Used to drive change-detection scenarios.
4. **Channel event waits.** `page.evaluate` on `window.__STORYBOOK_ADDONS_CHANNEL__.on(...)` to await indexer events with timeouts.
5. **Multi-template triage.** Path-glob → template set per the routing table in `.omc/research/research-20260508-prverify/report.md` §7.
6. **Diff-inferred recipes.** `git diff --name-only` → `*.stories.*` → `toId()` from `csf-tools` for dynamic story selection.
7. **CI integration.** `pull_request_target` + label gate + `check-actor-permissions-action`; artifact upload + `gh pr comment`.
8. **Network restriction.** `container: { network: none }` in CI; defense-in-depth Chrome flags locally.
9. **Chromatic Tier-2.** Pixel-diff layer delegated to Chromatic; replaces in-repo baselines.

## References

- Plan: [`.omc/plans/pr-verify-poc-mvp.md`](../../.omc/plans/pr-verify-poc-mvp.md)
- Research: [`.omc/research/research-20260508-prverify/report.md`](../../.omc/research/research-20260508-prverify/report.md)
- SbPage utility: [`code/e2e-tests/util.ts`](../../code/e2e-tests/util.ts)
- Lifted symlink helper origin: [`scripts/tasks/sandbox-parts.ts:43-79`](../tasks/sandbox-parts.ts)
- wait-on pattern origin: [`scripts/tasks/dev.ts:92-107`](../tasks/dev.ts)
