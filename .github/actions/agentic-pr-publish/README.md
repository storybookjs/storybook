# agentic-pr-publish

Universal post-task publishing for agentic workflows: read verdict, push
screenshots to a side branch, append telemetry, stage + upload artifacts.

This is **half 2 of 2** of the split `verify-pr.yml` infrastructure.

## Caller contract

The composite **cannot** declare these — the caller workflow MUST:

1. Run under `pull_request_target` (composite resolves against base ref).
2. Wrap the `uses:` step in `if: always()` if the caller wants publish to
   run on prior-step failure. M1: composite-level `if:` does NOT cascade to
   sub-steps, but every sub-step inside this composite that needs
   prior-step-failure tolerance already carries explicit `if: always()`.
3. Thread `result-path` from the task step that wrote `verify-result.json`
   (e.g. `${{ steps.verify.outputs.result-path }}`). Do not glob
   PR-writable directories to find it — that's the C1 forgery surface.
4. Declare `permissions:` block at least:
   ```yaml
   permissions:
     pull-requests: write
     contents: write    # side-branch screenshot push (omit if skip-screenshots)
   ```

## Inputs

| Name                       | Required | Default                  | Purpose                                                                |
|----------------------------|----------|--------------------------|------------------------------------------------------------------------|
| `github-token`             | yes      | —                        | Side-branch push.                                                      |
| `pr-number`                | yes      | —                        | PR number.                                                             |
| `run-id`                   | yes      | —                        | `github.run_id`.                                                       |
| `repo`                     | yes      | —                        | `github.repository`.                                                   |
| `result-path`              | yes      | —                        | Trusted absolute path to `verify-result.json`.                         |
| `pr-head-dir`              | no       | `env.PR_HEAD_DIR`        | Inherited from prepare composite.                                      |
| `screenshot-source-dir`    | no       | `<pr-head-dir>/.verify-output` | Where `push-screenshots.ts` scans for PNGs.                      |
| `dispatch-dirs`            | no       | `<pr-head-dir>/.verify-output\n<workspace>/.verify-output` | Newline list. Passed as repeated `--dispatch-dir`.    |
| `telemetry-webhook-url`    | no       | (empty → no-op)          | Telemetry sink.                                                        |
| `telemetry-webhook-token`  | no       | (empty → no-op)          | Telemetry auth.                                                        |
| `artifact-name-prefix`     | no       | `verify-output`          | Final artifact name = `<prefix>-pr-<pr-number>-<run-id>`.              |
| `retention-days`           | no       | `14`                     | Artifact retention.                                                    |
| `skip-screenshots`         | no       | `false`                  | `true` → skip side-branch push (callers without PNG output).           |
| `skip-telemetry`           | no       | `false`                  | `true` → telemetry no-op regardless of webhook secrets.                |

## Outputs

| Name                       | Purpose                                                                                       |
|----------------------------|-----------------------------------------------------------------------------------------------|
| `verdict`                  | Verdict from `derive-verdict.ts` (`verified` / `regression` / `evidence-missing` / `missing`).|
| `screenshot-urls-path`     | **H4**: absolute path to FILE containing screenshot URLs JSON. Read with `fs.readFileSync` in caller; do not interpolate into shell.|

## H4: screenshot-urls indirection

Composite output is a **file path**, not a heredoc-encoded JSON string. The
caller's `actions/github-script` step reads:

```js
const path = process.env.SCREENSHOT_URLS_PATH;
const items = JSON.parse(fs.readFileSync(path, 'utf-8'));
```

Closes the heredoc-terminator-injection surface that exists if `screenshot-urls`
were a single-line composite output piped through `<<EOF` markers.

## M1: `if: always()` everywhere

Composite-level `if:` does not cascade to sub-steps. Every sub-step inside
the composite that mirrors a current `if: always()` step in the original
workflow has `if: always()` declared on the sub-step itself:

- Read verdict (`derive-verdict.ts`)
- Push screenshots (gated additionally by verdict ≠ missing/empty)
- Append telemetry (same gate)
- Stage artifacts
- Upload artifacts

## M3: token / secret threading

`github-token`, `telemetry-webhook-*` are passed to inner `run:` blocks via
`env:` mapping only — never interpolated into the shell command literal.

## Worked example

```yaml
- name: Publish agentic results
  id: pub
  if: always()
  uses: ./.github/actions/agentic-pr-publish
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    pr-number: ${{ github.event.pull_request.number }}
    run-id: ${{ github.run_id }}
    repo: ${{ github.repository }}
    result-path: ${{ steps.verify.outputs.result-path }}
    telemetry-webhook-url: ${{ secrets.TELEMETRY_AGENTIC_VERIFICATION_WEBHOOK_URL }}
    telemetry-webhook-token: ${{ secrets.TELEMETRY_AGENTIC_VERIFICATION_WEBHOOK_TOKEN }}

- name: Post PR comment
  if: always()
  env:
    SCREENSHOT_URLS_PATH: ${{ steps.pub.outputs.screenshot-urls-path }}
  uses: actions/github-script@…
  with:
    script: |
      const fs = require('fs');
      const urls = process.env.SCREENSHOT_URLS_PATH
        ? JSON.parse(fs.readFileSync(process.env.SCREENSHOT_URLS_PATH, 'utf-8'))
        : [];
      // …render comment…

- name: Fail job if verdict != verified
  if: always() && steps.pub.outputs.verdict != 'verified'
  run: exit 1
```
