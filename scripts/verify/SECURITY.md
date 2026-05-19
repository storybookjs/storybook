# Verify Harness — Security Model (v6 single-round)

## Threat surfaces

The harness accepts three inputs:

1. **PR diff** — fetched at base-checkout via `gh pr diff`, used by
   `verify-pr-generate` to build a prompt bundle. The diff is contributor-
   authored content fed into the LLM prompt; treat it as a prompt-injection
   vector but never as executable code at author-time.
2. **LLM-authored recipe** — emitted by the SDK dispatch in `verify-pr-author`,
   written to an ephemeral path inside the PR-head workspace
   (`$RUNNER_TEMP/pr-head/.verify-recipes/pr-<#>.spec.ts`). Not committed.
3. **PR-head source tree** — checked out into `$RUNNER_TEMP/pr-head` and
   executed by `yarn install` + `yarn nx compile` + Playwright. This is the
   same untrusted-contributor-code surface that already exists in normal PR
   CI.

The previous v5 / early-v6 model leaned on **committed-spec human review** as
the load-bearing trifecta breaker. v6 single-round drops that step: the agent
authors and executes its own output in the same workflow run, with no
intermediate maintainer commit. Be honest about what fills the gap.

## Lethal-trifecta breakers (single-round)

| # | Mitigation | Where enforced |
|---|---|---|
| 1 | **Scoped API key.** `ANTHROPIC_API_KEY` is mounted **only** on the `Author recipe` step's `env:` block. The `Verify PR` step that executes the recipe has no API key, and no `GITHUB_TOKEN` either. | `.github/workflows/verify-pr.yml`. |
| 2 | **Static deny-regex pass.** A regex *tripwire* (defence-in-depth, not the primary boundary) that blocks blatant prompt-injection / compromised-agent output before the spec lands on disk: subprocess spawning, destructive `fs`/`fsp` calls, `process.exit`, `eval`, dynamic `import()`, Node builtin imports/`require`, and other obfuscation paths. **The authoritative pattern list is `DENY_PATTERNS` in `scripts/verify/recipe-deny.ts` — this row intentionally does not re-enumerate it (it would drift).** Pure function, runs in-process inside the trusted base checkout before the candidate is renamed to its final path. | `scripts/verify/recipe-deny.ts`, called from `scripts/verify/recipe-author-core.ts`. |
| 3 | **Scoped lint gate.** `scripts/verify/lint-invocation.ts` runs ESLint with a pinned config against the candidate spec. Failures retry the agent once with categorised errors; a second failure aborts before the spec is published to the PR-head workspace. | `scripts/verify/recipe-author-core.ts`. |
| 4 | **Listener-before-goto + finally-attach regex checks.** Enforces the recipe-authoring contract structurally — listeners must be registered before `page.goto(...)`; `testInfo.attach('pageErrors'\|'consoleErrors', ...)` must appear inside a `finally` block. Both checked on every dispatched candidate. | `scripts/verify/recipe-author-core.ts`. |
| 5 | **Controlled output path.** `bundle.outputSpecPath` is computed by the trusted `verify-pr-generate` script (resolved from the `--output` flag the workflow passes) and consumed verbatim by `recipe-author-core.ts`. The LLM cannot influence where its output lands — it only fills the `<<<SPEC_START>>>` / `<<<SPEC_END>>>` fence. The path is always inside `$RUNNER_TEMP/pr-head/.verify-recipes/`, so any write stays inside the ephemeral runner workspace. | `scripts/verify-pr-generate.ts` + `scripts/verify/recipe-author-core.ts`. |
| 6 | **Header-comment provenance.** Every authored spec carries a block comment with `generatedAt`, `agentModel`, `runId`, `prNumber`, `referenceSpecs`, `triageGlobs`. Materialised into the runner workspace + uploaded as an artifact, so any post-mortem can replay the exact authoring inputs. | `scripts/verify/recipe-author-core.ts` (`buildProvenanceHeader`). |
| 7 | **Actor-permission gate.** The workflow runs only when the labeller has `write` access on the repo. This is the human-in-the-loop in single-round mode: a maintainer trusts the PR enough to apply `ci:verify`. | `.github/workflows/verify-pr.yml` — `Check actor permission` step. |
| 8 | **Label gate + non-draft.** `ci:verify` label must be present on a non-draft PR. Stops drive-by triggers from contributor-authored label-add events. | `.github/workflows/verify-pr.yml` job-level `if:`. |
| 9 | **Trusted-script provenance.** `verify-pr-generate`, `verify-pr-author`, `recipe-author-core`, `recipe-deny`, `lint-invocation`, `ci/strip-untrusted-secrets.sh` (sourced via `$GITHUB_WORKSPACE`, guarded by an absolute-path + existence check before `source`), the authoring-guide, and the canonical-smoke reference all read from the **base checkout** (the maintainer-merged `next` branch), not the PR head. A malicious PR cannot replace the deny-regex list or the lint config to weaken the gate. | `.github/workflows/verify-pr.yml` step ordering — base is checked out first; PR head is a separate `$RUNNER_TEMP/pr-head` tree. |

## What single-round explicitly gives up

- **No human review of the executed spec.** A maintainer applies `ci:verify`,
  but the spec the agent writes is not reviewed before execution. The deny-
  regex + lint + structural-pattern checks are the only filters between
  agent output and `playwright test` invocation.
- **No replay-by-default in version control.** The spec is artifact-only
  (uploaded as part of `verify-output-pr-<#>-<run_id>`, 14-day retention).
  After the artifact expires, the only authoritative replay path is
  re-running the harness on the same PR sha (regenerates a fresh spec; not
  byte-identical even with a stable model, since `generatedAt` and the
  prompt contents shift).

If either of those is unacceptable for a given PR class, fall back to the
local-dev path: `yarn verify-pr-generate --pr <#>` → invoke the
`verify-recipe-author` skill under human review → commit
`.verify-recipes/pr-<#>.spec.ts` → re-fire `ci:verify`. The skill remains
the supported authoring entry point for ambiguous changes.

## v6 isolation posture

v6 runs the authoring step on the trusted base checkout and wraps every
PR-controlled step — `yarn install`, `yarn nx compile`, `yarn nx run
<tpl>:sandbox`, and the Playwright recipe itself — in
`@anthropic-ai/sandbox-runtime` (`srt`, bubblewrap on Linux). Each `srt`
invocation runs under `env -i` so `ACTIONS_*` tokens and other runner
secrets are stripped before the untrusted process boots. This is
**Layer-2** isolation on top of the Layer-1 controls (deny-regex, ESLint
policy, `enableScripts: false`, committed lockfile, scoped API keys).

The previous v5-0 Docker container (`--cap-drop ALL`, `--network=none`,
`--read-only`, `--tmpfs`, `--user 1000:1000`) was dropped because:

- The supply-chain ceremony it added (digest pins, harden-build-context
  overlay, lifecycle-script stripping, Verdaccio publish pipeline) was
  asymmetric to the runtime risk. `enableScripts: false`, the
  committed lockfile, and the `.npmrc` purge already cover that
  surface.
- BuildKit's layer-isolation behaviour proved fragile across 11
  firetest rounds — `code/core/dist` repeatedly disappeared between
  stages.

`srt` replaces the container with a process-level jail: bubblewrap mount
namespaces give FS isolation without the BuildKit fragility, and its
network policy lets us deny egress everywhere except localhost (so the
Playwright recipe can hit the dev server but the recipe code itself
cannot exfiltrate).

## When to tighten further

`srt` settings live in the workflow under `Build sandbox settings` and
are version-pinned via `npm install -g @anthropic-ai/sandbox-runtime@<v>`
plus a post-install sha256 check (see §pinning-sandbox-runtime). If
sandbox policy needs to tighten, edit those settings and the smoke step
will fail-closed if the jail config drifts.

Network egress from the recipe is restricted by the srt jail
(`allowedDomains: ["localhost", "127.0.0.1"]`). The compile / install
steps still need npm + GitHub access; that traffic is allowed but runs
without `ACTIONS_*` credentials thanks to `env -i`.

## Sensitive-path exclusion

Local `.claude/settings.json` deny rules block the Claude Code agent
from reading/writing `.env`, SSH/AWS/GCP/Azure credentials, npm/pypi
auth tokens, PEM/key files, and the git credential store. These apply to
**local-dev** runs of the `verify-recipe-author` skill. They do **not**
apply to the CI single-round path, which uses the Anthropic SDK directly
(`verify-pr-author --dispatch-mode sdk`) and never instantiates a
Claude Code agent loop.

`.dockerignore` keeps the same exclusion set even though no Docker
image is built today — the file is preserved so any future
`docker build` from the repo root (e.g. local debugging) stays safe.

## §pinning-sandbox-runtime

`@anthropic-ai/sandbox-runtime` (`srt`) is installed via
`npm install -g --ignore-scripts @anthropic-ai/sandbox-runtime@<version>`
inside the `agentic-pr-prepare` composite. Two values must stay in sync
when bumping:

1. `srt-version` — the npm version (e.g. `0.0.51`).
2. `srt-sha256` — sha256 of the resolved `srt` shim at that version,
   used by the composite's fail-closed post-install integrity check.

**Bump procedure** (do NOT edit the composite default — there is none):

1. Update the inline value of `srt-version` in
   `.github/workflows/verify-pr.yml` (the workflow `uses:` block).
2. Run `.github/workflows/_srt-sha-probe.yml` against the new version;
   paste the emitted sha into the workflow's `srt-sha256:` field.
3. Verify the new commit's PR run pulls the new shim cleanly via the
   composite's smoke-test step.

**H1 hardening:** `srt-sha256` has NO default in
`agentic-pr-prepare/action.yml`. Callers MUST pass it inline at the
workflow level. This is intentional — keeps a `chore: bump srt` PR
carrying the heightened workflow-review bar, and prevents a single
approval flipping both `srt-version` and `srt-sha256` default at the
composite level (which would otherwise leave the composite validating
a malicious shim against the matching malicious sha — fail-OPEN).

## §c1-hmac-verdict

The signed verify result lives at the path computed by
`verifyResultPath(runDir)` in `scripts/verify/core.ts` — i.e.
`<runDir>/` + `RESULT_FILENAME` (`verify-result.json`). In CI the run dir
is `$PR_HEAD_DIR/.verify-output/<runId>/`; the orchestrator additionally
publishes a copy at the `VERIFY_RESULT_PATH` the workflow exports. Both
locations are inside the srt `allowWrite` set, because the legitimate
writer (`scripts/verify-pr.ts`) itself runs inside srt and must be able
to write there. This doc deliberately cites the code symbols
(`RESULT_FILENAME` / `verifyResultPath(runDir)` — the single source of
truth for the location, per the contract comments in `core.ts`) rather
than a hardcoded literal so the security rationale cannot silently drift
from where the file actually lands.

**Re-sign invariant (W4):** every trusted post-processor that mutates
`verify-result.json` after it is first signed (vision evidence-check,
the `derive-verdict` unit-test merge, the workflow's `evidenceRetry` jq
annotation) MUST call `signResultFile(resultPath, secret)` from
`scripts/verify/core.ts` immediately after the mutation, so a result
never exists on disk without a matching, current `.sig`. Today these
mutations only survive because `SIGNED_FIELDS` happens to exclude the
touched fields; the re-sign keeps the gate correct even if a future
field is added to `SIGNED_FIELDS`.

Without further controls, a PR-added Playwright spec / unit test running
inside srt could overwrite the file with
`{"verdict":"verified"}` before the trusted publish step reads it,
forging the verdict and triggering the `verified-by-harness` label.

**Mitigation:** HMAC-bound verdict.

- `scripts/verify-pr.ts` reads `VERIFY_PROVENANCE_SECRET` from
  `process.env` at startup, captures it into a local closure value, then
  **deletes the env entry** before spawning any subprocess.
- `scripts/verify/core.ts` exports `signResult()` over a stable subset
  of trust-critical fields (`verdict`, `regressionReason`, `template`,
  `runId`, `tests`, `traceZipPaths`, `recipeSpecPath`,
  `schemaVersion`). `writeResult()` and `writeRegressionResult()` take
  an optional `secret` argument and emit a `<result>.sig` file (hex
  HMAC-SHA256) alongside the JSON.
- `scripts/verify/ci/derive-verdict.ts` (runs in trusted bash, outside
  srt) reads the `.sig` file and validates it against
  `VERIFY_PROVENANCE_SECRET` threaded via env. On mismatch / missing-sig
  with `verdict==verified`, it forcibly downgrades to
  `verdict=regression` with `regressionReason=forgery-detected: …`.
- `scripts/verify/ci/write-compile-failure-stub.ts` also signs its
  stub so the publish gate treats trusted and orchestrator-written
  results uniformly.
- Trusted post-processors (vision evidence-check, retry annotation,
  unit-tests merge) add fields **outside** the signed set, so the
  signature stays valid across post-processing.

**Residual risk (acknowledged):** the orchestrator's
`/proc/<pid>/environ` still reflects the initial exec env at the time
srt started the orchestrator process, because `delete process.env.X`
mutates Node's in-memory env table but does not rewrite the kernel-side
auxv. A recipe sufficiently sophisticated to read
`/proc/<orchestrator_pid>/environ` from inside srt (same pid namespace,
same uid) can still recover the secret. Closing this fully requires
either an exec-shim that re-execs the orchestrator with a clean env
after consuming the secret, or passing the secret via an inheritable
file descriptor (e.g. `3< secret-file`) instead of `env VAR=…`. Tracked
as a follow-up hardening pass; the HMAC alone defeats the naive
file-write forgery vector that motivated the original C1 finding.
