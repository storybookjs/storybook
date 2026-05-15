# agentic-pr-prepare

Universal infrastructure setup for agentic workflows running under
`pull_request_target`: actor-permission gate, base + PR-head manual clones,
toolchain install, sandbox-runtime (srt) install + sha-pin verification,
srt-settings JSON, egress smoke-test, and trusted-harness sync.

This is **half 1 of 2** of the split `verify-pr.yml` infrastructure. The
companion is `agentic-pr-publish`.

## Caller contract

The composite **cannot** declare these — the caller workflow MUST:

1. Trigger on `pull_request_target` (composite `uses: ./.github/actions/...`
   resolves against the **base ref** under PRT, which is load-bearing for
   trust — never lift this to a trigger that resolves against PR-head).
2. Declare a `permissions:` block. Verify-PR needs at least:
   ```yaml
   permissions:
     pull-requests: write
     issues: write
     statuses: write
     contents: write  # side-branch screenshot push (drop if not needed)
   ```
3. Declare a `concurrency:` block. Single-PR:
   ```yaml
   concurrency:
     group: verify-${{ github.event.pull_request.number }}
     cancel-in-progress: true
   ```
   With `strategy.matrix`, include the matrix dim in the key:
   `verify-${{ pr-num }}-${{ matrix.target }}` (matrix-concurrency footgun).
4. Pass `srt-sha256` **inline** with every call. The composite has **no
   default** — this keeps a chore-bump PR carrying the heightened
   workflow-review bar instead of single-approval flipping a composite default.

## Inputs

| Name                   | Required | Default                          | Purpose                                                                                |
|------------------------|----------|----------------------------------|----------------------------------------------------------------------------------------|
| `github-token`         | yes      | —                                | Base + PR-head manual clones.                                                          |
| `base-ref`             | yes      | —                                | `github.event.pull_request.base.ref`.                                                  |
| `base-sha`             | yes      | —                                | `github.event.pull_request.base.sha`.                                                  |
| `pr-head-sha`          | yes      | —                                | `github.event.pull_request.head.sha`.                                                  |
| `repo`                 | yes      | —                                | `github.repository`.                                                                   |
| `srt-version`          | no       | `0.0.51`                         | Pinned `@anthropic-ai/sandbox-runtime` version.                                        |
| `srt-sha256`           | **yes**  | — (no default by design)         | sha256 of the resolved `srt` shim at `srt-version`. Bump via `_srt-sha-probe.yml`.     |
| `srt-allowed-domains`  | no       | localhost + registries + CDNs    | Newline list. Caller may extend.                                                       |
| `srt-allow-write-paths`| no       | `$PR_HEAD_DIR`, `$SANDBOX_TMPDIR`, `/tmp`, `$HOME/.cache`, … | Newline list; env vars expanded at composite runtime.            |
| `srt-deny-read-paths`  | no       | `$HOME/.ssh`, `$HOME/.aws`, …    | Newline list.                                                                          |
| `srt-deny-write-paths` | no       | `$GITHUB_WORKSPACE`, `$GITHUB_WORKSPACE/.git` | Newline list.                                                              |
| `sync-files`           | no       | (empty)                          | Newline-delimited `src:dst` pairs (paths relative). H2 path-validated.                 |
| `sync-trees`           | no       | (empty)                          | Newline-delimited tree paths (relative). H2 path-validated.                            |
| `provenance-secret`    | no       | (empty → per-run random)         | Optional caller-supplied. M2: written to file, not `$GITHUB_ENV`.                      |
| `install-code-deps`    | no       | `true`                           | Pass-through to `setup-node-and-install`.                                              |

### Path-input safety (H2)

`sync-files` and `sync-trees` reject `..`, leading `/`, extra `:`; resolve
realpath and assert under `$PR_HEAD_DIR`. Refuses symlink at destination
before `cp --no-dereference` / `cp -aT`.

### srt-settings JSON emission (H3)

allowWrite / denyRead / denyWrite / allowedDomains arrays are emitted via
`jq -R . | jq -s .` so PR-controllable strings cannot inject JSON keys.

## Outputs

| Name                       | Purpose                                                                                          |
|----------------------------|--------------------------------------------------------------------------------------------------|
| `pr-head-dir`              | Absolute path to untrusted PR-head workspace clone.                                              |
| `srt-settings-path`        | Absolute path to `srt-settings.json`.                                                            |
| `diff-path`                | Absolute path to captured `pr.diff`.                                                             |
| `provenance-secret-path`   | M2: path to file (mode 0600) holding the per-run provenance secret. NOT in `$GITHUB_ENV`.        |

## Side-effects

Writes to `$GITHUB_ENV` (so subsequent caller steps in the same job see them):

- `PR_HEAD_DIR` — absolute path to PR-head workspace
- `SRT_SETTINGS` — absolute path to srt-settings.json
- `CLAUDE_CODE_TMPDIR` — absolute path to sandbox scratch tmpdir

Does **NOT** write `VERIFY_PROVENANCE_SECRET` to `$GITHUB_ENV`. Trusted task
steps load it explicitly: `cat "$(provenance-secret-path)"`.

## Worked example

```yaml
- name: Prepare agentic environment
  id: prep
  uses: ./.github/actions/agentic-pr-prepare
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    base-ref: ${{ github.event.pull_request.base.ref }}
    base-sha: ${{ github.event.pull_request.base.sha }}
    pr-head-sha: ${{ github.event.pull_request.head.sha }}
    repo: ${{ github.repository }}
    srt-version: '0.0.51'
    srt-sha256: '36de38197ac22991c8c9edead4d6184914c8b786e040ecf27bdcf26abd166338'
    sync-files: |
      .verify-recipes/_util.ts:.verify-recipes/_util.ts
    sync-trees: |
      scripts/verify
    provenance-secret: ${{ secrets.VERIFY_PROVENANCE_SECRET }}

- name: Your task
  env:
    PROVENANCE_SECRET_PATH: ${{ steps.prep.outputs.provenance-secret-path }}
  run: |
    VERIFY_PROVENANCE_SECRET="$(cat "$PROVENANCE_SECRET_PATH")" \
      yarn your-thing
```

## Pre-existing architectural debt (C1 — NOT fixed by this composite)

`verify-result.json` (the file the verdict is read from) lives at
`$PR_HEAD_DIR/.verify-out-trusted/verify-result.json` — inside srt's
`allowWrite` set. A malicious PR-added unit test running inside srt can
forge it. The split documented here does NOT make C1 worse; it stays at
its current path so the legitimate writer (`verify-pr.ts`, which itself
runs INSIDE srt) keeps working.

**The architectural fix requires** one of:

1. **Process-split** — orchestrator OUTSIDE srt, only Playwright + dev-server
   spawns wrapped. **Attempted 2026-05-14, failed**: srt uses bubblewrap with
   a fresh network namespace per invocation, so localhost IPC between
   orchestrator (outside) and dispatcher (inside) breaks. Reviving requires
   shared host netns (loses egress policy on dispatcher), host-network bridge
   / Unix socket, or moving dispatcher outside srt (loosens trust on
   PR-modified framework code).
2. **HMAC-bound verdict** — `verify-pr.ts` HMAC-signs the JSON with the
   provenance secret; trusted bash verifies. Requires scrubbing the secret
   from orchestrator env before spawning Playwright + auditing
   `/proc/<pid>/environ` reachability inside srt.

Until that lands, the verdict is trustworthy ONLY when paired with the
side-channel signals (PR comment, telemetry, GitHub run conclusion) that an
attacker would also have to forge. Tracked as separate follow-up.
