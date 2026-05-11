# Verify Harness — Runbook

This runbook is the field-debugging guide for the v5-0 containerized verify harness. It maps common CI failure signals to root-cause diagnoses and remediation steps.

## When v5-0 fails in CI — common signals + diagnosis

### Signal: `Harden build context` step failed

**Most likely cause:** `scripts/verify/Dockerfile` diverges between `base.sha` and `head.sha`.

The harden script runs `diff -q scripts/verify/Dockerfile pr-head/scripts/verify/Dockerfile` and refuses to build if the two copies are not byte-identical (BLOCKER #3 step 6). A PR that edits the Dockerfile will trip this guard.

**Diagnosis:**

```bash
git fetch origin "${{ github.event.pull_request.base.sha }}"
git fetch origin "${{ github.event.pull_request.head.sha }}"
git diff "${{ github.event.pull_request.base.sha }}":scripts/verify/Dockerfile \
         "${{ github.event.pull_request.head.sha }}":scripts/verify/Dockerfile
```

If the diff is intentional (e.g. a v5-1 follow-up landing through a PR), it must be merged in two passes: first merge the Dockerfile change to `next`, then rebase the PR so `base.sha` already contains the new Dockerfile. Otherwise the harden-script's "Dockerfile diverges between base.sha and head.sha" check will fail every run.

Secondary causes:
- `.yarn/releases/yarn-4.10.3.cjs` missing or replaced in head — verified by `sha256_check`. Inspect the harden-script log lines `[harden] removing pr-head/.yarn…` and the post-overlay sha256 mismatch.
- A symlink at `pr-head/.yarn`, `pr-head/.yarn/plugins`, or `pr-head/.yarn/releases`. The symlink guard removes them; if removal fails, fix permissions on the runner workspace.

---

### Signal: Smoke step's JSON sentinel is absent or malformed

**Most likely causes (in priority order):**

1. **Image build is broken.** The smoke script's first action is `node "$YARN_BIN" verify-pr --skip-recipe`. If the image is missing `/opt/verify-harness/repo/.yarn/releases/yarn-4.10.3.cjs`, that `node` invocation dies before the sentinel prints.
   - Diagnose: download the failed image step's logs and search for `::error::yarn binary missing at $YARN_BIN` or for the `bun --version` / `node --version` probes in stage 1.
2. **`bootStorybook` attempted to reach the network.** All outbound traffic is blocked by `--network=none`. Any DNS, telemetry, or prebundle probe inside vite/wait-on will timeout silently and the smoke step will exceed the 60 s budget without emitting the sentinel.
   - Diagnose: inspect `/tmp/smoke.log` (captured by `2>&1 | tee /tmp/smoke.log`). Search for `getaddrinfo ENOTFOUND`, `connect ETIMEDOUT`, or warnings from `wait-on`.
   - Mitigation already in place: `STORYBOOK_DISABLE_TELEMETRY=1` baked into the image `ENV`. If a new outbound dependency lands in a `code/core` change, that change is the regression — revert + open an issue.
3. **`VERIFY_HARNESS_IMAGE_DIGEST` is unset or malformed.** The smoke script fails-closed at the source — see `scripts/verify/Dockerfile` stage 4 — exits non-zero when the env is unset or does not match `^sha256:[a-f0-9]{64}$`. Workflow filter additionally rejects the all-zero digest.
   - Diagnose: search the `Smoke test image` step log for `::error::smoke missing VERIFY_HARNESS_IMAGE_DIGEST` or `::error::smoke digest malformed`.

---

### Signal: `head-sha drift` regression appears in `verify-result.json`

**Most likely cause:** the workflow's checkout step is misconfigured — `base.sha` and `head.sha` reference the wrong commits, or the `pr-head` checkout is at a stale ref.

The runner inside the container reads `/opt/verify-harness/HEAD_SHA` (baked at image build from `ARG HEAD_SHA`) and compares it to `VERIFY_HARNESS_EXPECTED_HEAD_SHA` (set by the workflow from `${{ github.event.pull_request.head.sha }}`). A mismatch produces `verdict: "regression"` with `regressionReason: "head-sha drift"`.

**Diagnosis:**

```bash
# In .github/workflows/verify-pr.yml, confirm:
# 1. The PR-head checkout uses ref: ${{ github.event.pull_request.head.sha }}
# 2. The Build harness image step passes HEAD_SHA=${{ github.event.pull_request.head.sha }}
# 3. The Run harness in container step exports
#    VERIFY_HARNESS_EXPECTED_HEAD_SHA="${{ github.event.pull_request.head.sha }}"
grep -nE 'pull_request\.head\.sha|HEAD_SHA|VERIFY_HARNESS_EXPECTED_HEAD_SHA' \
  .github/workflows/verify-pr.yml
```

All three references must resolve to the same commit. A workflow that uses `github.sha` (which on `pull_request_target` resolves to the *base* SHA, not head) for any of the three points is broken — change it to `github.event.pull_request.head.sha`.

Secondary cause:
- `regressionReason: "head-sha file missing"` — `/opt/verify-harness/HEAD_SHA` was never baked. Verify the Dockerfile stage 1.e `RUN echo "$HEAD_SHA" > /opt/verify-harness/HEAD_SHA` line is present and the `--build-arg HEAD_SHA=…` is being passed by the workflow.

---

### Signal: `docker cp` mirror produced empty `.verify-output/`

**Most likely cause:** the `--name` flag on `docker run` and on `docker cp` do not refer to the same container ID.

The mirror step uses `docker cp verify-harness-${{ github.run_id }}:/workspace/.verify-output/. .verify-output/`. The run step must use a matching `--name verify-harness-${{ github.run_id }}`. Iter-2 used `docker ps -a -lq` which could select the wrong container; iter-3 (current) uses `--name` to make selection deterministic.

**Diagnosis:**

```bash
grep -nE 'docker (run|cp).*--name|verify-harness-' .github/workflows/verify-pr.yml
```

Both occurrences must reference `verify-harness-${{ github.run_id }}` (or whatever name the workflow chose). A typo or a missing `--name` flag on `docker run` means `docker cp` will fail with `Error: No such container: verify-harness-…` or — worse, on iter-2-style workflows — select an unrelated container and silently copy nothing.

Secondary causes:
- The container exited before `docker cp` ran and was cleaned up by `--rm`. The `Run harness in container` step must **not** use `--rm` — the mirror step needs the stopped container to still be present. The cleanup `docker rm verify-harness-${{ github.run_id }} || true` runs after the load-bearing copy.
- `.verify-output` on the tmpfs was never written because the runner aborted before `writeResult`. Check the `Run harness in container` step's stdout for an early `[verify] fatal:` line.
