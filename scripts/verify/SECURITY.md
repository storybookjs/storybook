# Verify Harness — Security Model (v6)

## Threat surfaces

The harness accepts three inputs:

1. **PR diff** — used by `verify-pr-generate` to build a prompt bundle.
2. **Recipe spec at PR head** — the Playwright file the harness executes.
3. **LLM-authored recipe** — emitted by the `verify-recipe-author`
   skill / CLI based on the prompt bundle.

Each surface is a potential prompt-injection vector. The committed
spec at the PR head is the load-bearing control: nothing executes
until a human has reviewed and merged the spec into the PR.

## Lethal-trifecta breakers

| # | Mitigation | Where enforced |
|---|---|---|
| 1 | **Committed-spec review.** The agent never executes its own output. `verify-pr-generate` writes a prompt bundle and stops. `verify-pr-author` writes the candidate spec to disk and stops. Execution happens only after a human reviews and commits `.verify-recipes/pr-<#>.spec.ts` to the PR. | `.github/workflows/verify-pr.yml` — the `Verify PR` step runs only after `verify-spec-precheck` confirms a committed spec at PR head. |
| 2 | **Scoped API key.** `ANTHROPIC_API_KEY` is mounted **only** on the `Author recipe` workflow step's `env:` block. The `Verify PR` step that executes the committed spec has no API key. | `.github/workflows/verify-pr.yml`. |
| 3 | **Static deny-regex pass.** Catches blatant prompt-injection / compromised-agent output before lint. Patterns: `child_process`, `fs.unlink*`, `fs.rm`, `process.exit`, `eval(`, `node:*` imports, `require('child_process')`. | `scripts/verify/recipe-deny.ts`. |
| 4 | **Scoped lint gate.** `scripts/verify/lint-invocation.ts` runs ESLint with a pinned config against the candidate spec. Failures retry the agent once with categorised errors; a second failure aborts. | `scripts/verify/recipe-author-core.ts`. |
| 5 | **Header-comment provenance.** `verify-pr-author` prepends a block comment with `generatedAt`, `agentModel`, `prNumber`, `referenceSpecs`, `triageGlobs`. Audit trail survives squash-merge. | `scripts/verify/recipe-author-core.ts`. |
| 6 | **Actor-permission gate.** Workflow runs only when the labeller has `write` access on the repo. | `.github/workflows/verify-pr.yml` — `Check actor permission` step. |
| 7 | **Label gate.** `ci:verify` label must be present on a non-draft PR. | `.github/workflows/verify-pr.yml` job-level `if:`. |
| 8 | **`.claude/settings.json` permission rules.** Repo-wide allow/deny entries restrict what local Claude Code agent actions can touch (curl/wget/sudo/`.env`/SSH/AWS/credential files). | `.claude/settings.json`. |

## v6 isolation posture

v6 runs both the authoring step and the verify step on a stock GitHub
Actions ephemeral runner — **the same isolation profile as the existing
Storybook PR CI**, which already executes untrusted contributor code as
part of normal test runs. No Docker, no Verdaccio, no sandbox-runtime.

The previous v5-0 container (`--cap-drop ALL`, `--network=none`,
`--read-only`, `--tmpfs`, `--user 1000:1000`) was dropped because:

- The supply-chain ceremony it added (digest pins, harden-build-context
  overlay, lifecycle-script stripping, Verdaccio publish pipeline) was
  asymmetric to the runtime risk. `enableScripts: false`, the
  committed lockfile, and the `.npmrc` purge already cover that
  surface.
- The container's runtime isolation flags addressed a threat
  (untrusted-PR code execution with cross-tenant blast radius) that
  doesn't apply to a per-PR ephemeral runner.
- BuildKit's layer-isolation behaviour proved fragile across 11
  firetest rounds — `code/core/dist` repeatedly disappeared between
  stages.

## When to add stronger isolation

If the threat model expands to processing third-party PRs at scale
with adversarial recipe authors, wrap the playwright test step in
`sandbox-runtime` (bubblewrap on Linux) — ~10 lines of config per
Anthropic's "Securely deploying AI agents" doc. Do **not** reintroduce
the full Docker + Verdaccio stack.

## Sensitive-path exclusion

Local `.claude/settings.json` deny rules block the Claude Code agent
from reading/writing `.env`, SSH/AWS/GCP/Azure credentials, npm/pypi
auth tokens, PEM/key files, and the git credential store. See
`.claude/settings.json` for the current allow/deny list.

`.dockerignore` keeps the same exclusion set even though no Docker
image is built today — the file is preserved so any future
`docker build` from the repo root (e.g. local debugging) stays safe.
