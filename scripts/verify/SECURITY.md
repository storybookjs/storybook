# Verify Harness — Security Model

## Threat Model

The verify harness accepts external PR diffs, story content, and repo README text as inputs. Each of these surfaces is a potential prompt-injection vector where a malicious contributor could embed instructions intended to manipulate the Claude-powered reviewer.

**Lethal-trifecta breakers** — at least one must hold to prevent a catastrophic injection:

1. **Limit network access** — block outbound calls so exfiltration is impossible even if the agent is hijacked.
2. **Limit data access** — restrict what files and credentials the agent can read/write.
3. **Secrets are scoped to authoring; the committed-spec runner is `--network=none`.**

The Phase-1 PoC chooses **option 3**: every verification spec is committed to `.verify-recipes/<pr#>.spec.ts` and reviewed as part of the normal PR review process before the harness executes it. Options 1 and 2 are enforced additionally via `.claude/settings.json` deny rules and the `.dockerignore` exclusion list.

---

## Phase 1 — Local PoC (current increment)

### Spec review gate

Before the harness runs, the spec file must be committed to `.verify-recipes/<pr#>.spec.ts`. Standard GitHub PR review covers the spec content, ensuring a trusted contributor has approved what the agent will execute.

### `.claude/settings.json` permission rules

The file `.claude/settings.json` at the repo root enforces allow/deny rules for all Claude Code agent actions. Key deny entries:

```json
"deny": [
  "Bash(curl *)",
  "Bash(wget *)",
  "Bash(rm -rf /*)",
  "Bash(rm -rf ~/**)",
  "Bash(sudo *)",
  "Write(.env)",
  "Write(.env.*)",
  "Write(**/.env)",
  "Write(**/.env.*)",
  "Write(~/.ssh/**)",
  "Write(~/.aws/**)",
  "Write(~/.config/**)",
  "Write(~/.git-credentials)",
  "Write(**/*.pem)",
  "Write(**/*.key)",
  "Read(.env)",
  "Read(~/.ssh/**)",
  "Read(~/.aws/**)"
]
```

See `.claude/settings.json` for the full allow list.

### Spec linting gate

Before executing a spec, lint it:

```bash
yarn --cwd code lint:js:cmd ../.verify-recipes/<pr#>.spec.ts --fix
```

A lint failure aborts the run. This prevents obviously malformed or injected specs from reaching the execution layer.

### Increment 2 notes — Agent-generated recipes

**Spec-review gate unchanged.** The bun generator (`verify-pr-generate.ts`) does not execute its output — it only writes a prompt bundle to `.verify-output/<runId>/prompt-bundle.json` and stops. The `verify-recipe-author` skill writes the generated spec to disk but never executes it. Execution happens only after a human commits the spec to `.verify-recipes/pr-<#>.spec.ts` and the v2 runner is invoked explicitly.

**Lint enforcement lives in the skill, not as ad-hoc CLI invocations.** The skill runs `yarn --cwd code lint:js:cmd ../.verify-recipes/pr-<#>.spec.ts --fix`, retries once on failure by feeding categorized errors (`listener-before-goto`, `attach-pattern`, `imports`) back to the agent, and aborts exit 1 on second failure. The retry policy is expressed declaratively in `scripts/verify/recipe-retry-policy.ts` — the orchestrator contains no hardcoded retry branches.

**Static deny-regex pass** runs before lint and catches blatant prompt-injection or compromised-agent output. Current patterns: `child_process`, `fs.unlink*`, `fs.rm`, `process.exit`, `eval(`, `node:*` imports, `require('child_process')`. The list lives in `scripts/verify/recipe-deny.ts` and can be extended without touching the orchestrator.

**Header-comment provenance.** The skill prepends a block comment to every generated spec containing `generatedAt`, `agentModel`, `prNumber`, `referenceSpecs`, and `triageGlobs`. This provides an audit trail that survives squash-merge. A sidecar `.meta.json` was considered and rejected — it adds review burden and creates a second committed artifact that can drift from the spec (see plan §D8).

**Spec-name collision = fail unless `--force` is passed.** When `.verify-recipes/pr-<#>.spec.ts` already exists and `--force` is not set, the generator exits 1 with an actionable message. This prevents silent overwrite of a reviewed spec on re-run. The skill re-checks before writing to avoid TOCTOU races.

**`gh pr diff --patch`** — the generator uses the `--patch` flag to fetch full file content, not just a file list, so the agent has line-level context for producing meaningful assertions.

### Deferred: `@anthropic-ai/sandbox-runtime` evaluation

Evaluation of `@anthropic-ai/sandbox-runtime` as an additional isolation layer is **postponed to Phase 2**. Tracked as a follow-up item. Do not attempt the spike in Phase 1.

---

## Phase 2 — CI Action (v4 increment)

Phase 2 introduces two execution paths that share the same recipe-authoring core. Both are gated by `pull_request_target` + the `ci:verify` label + a non-draft PR + an actor-permission check. Only one workflow step (`Author recipe`) ever sees `ANTHROPIC_API_KEY`.

### Secret scope

`ANTHROPIC_API_KEY` lives **only** on the `Author recipe` workflow step's `env:` block. It is **not** present on the `Run harness in container` step. The spec-runner container is launched with `--network=none` and has no API key, so even a fully-compromised reviewer agent producing a hostile spec cannot exfiltrate the key — the container that executes the committed spec has no network and no credential.

### Authoring posture

This increment runs the `Author recipe` step on the **bare GitHub-hosted runner** (no container). The justification: the authoring step writes a spec file that is later subject to human review before any execution, so the trifecta breaker (option 3 — committed-spec review) still holds. Containerizing the authoring step is a **v5 candidate**: shared net-namespace with an Envoy `credential_injector` sidecar so the key never enters the container at all.

### Actor-permission gate

The first step of the `verify` job is `prince-chrismc/check-actor-permissions-action@0000000000000000000000000000000000000000` (40-zero placeholder, pin before activation) with `permission: write`. It runs **before** any step that references secrets. A non-write actor fails the job before the `Author recipe` step can resolve `${{ secrets.ANTHROPIC_API_KEY }}`.

### Trigger gate

- `on: pull_request_target` + `types: [labeled, synchronize]`
- Job-level `if: github.event.pull_request.draft == false && contains(github.event.pull_request.labels.*.name, 'ci:verify')`
- Combined: `ci:verify` label + non-draft + write-permission actor.

### Phase-1 trifecta-breaker preserved

The committed-spec runner step (`Run harness in container`) keeps every Phase-1 isolation primitive:

- `--network=none`
- `--cap-drop ALL`
- `--read-only` rootfs (with `--tmpfs /tmp` and `--tmpfs /workspace/.verify-output`)
- `--security-opt no-new-privileges`
- `--user 1000:1000`
- `--memory 4g --pids-limit 200`
- workspace mounted read-only at `/workspace:ro`
- no `ANTHROPIC_API_KEY` env (the key is scoped to authoring only)

The spec is committed to `.verify-recipes/<pr#>.spec.ts` and reviewed as part of the normal PR review process before this step runs. That review is the lethal-trifecta breaker — option 3 — and remains the load-bearing control even after Phase-2 ships.

### Container shape (committed-spec runner)

```
docker run \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --read-only \
  --tmpfs /tmp:rw,size=100m \
  --tmpfs /workspace/.verify-output:rw,size=500m \
  --network none \
  --memory 4g \
  --pids-limit 200 \
  --user 1000:1000 \
  -v $WORKSPACE:/workspace:ro \
  verify-harness:<pinned-sha>
```

### Workflow trigger

- Trigger: `pull_request_target` + label `ci:verify`
- Actor gate: `check-actor-permissions-action` with `permission: write`
- Concurrency: `group: verify-${pr.number}`, `cancel-in-progress: true`
- Permissions: `pull-requests: write`, `statuses: write` only
- Artifacts: `actions/upload-artifact` with `if: always()`, retention 14 days, name includes `pr#` and `run-id`

### v5 follow-ups (deferred from v4)

- **Envoy `credential_injector` sidecar.** Containerize the `Author recipe` step on a shared net-namespace with an Envoy proxy that injects the API key on outbound `api.anthropic.com` requests. The container itself never holds `ANTHROPIC_API_KEY`; the key lives only in the proxy process. Removes the residual risk that a compromised authoring runtime could read its own env vars.
- **`author_association` gating.** Auto-trigger for `OWNER`/`MEMBER`/`COLLABORATOR` without requiring the `ci:verify` label; external PRs continue to need the explicit label.
- **Containerized authoring runtime.** Drop the bare-runner posture in favor of a containerized authoring step once the Envoy credential-injector is in place.

---

## Phase 3 — Default trigger (deferred)

- Auto-trigger for contributors with `OWNER`, `MEMBER`, or `COLLABORATOR` `author_association`
- External PRs require explicit label `ci:verify`
- NX affected detection prunes the verification set to only changed packages

---

## Defense-in-depth NOT taken (rationale)

| Technique | Reason rejected |
|-----------|----------------|
| gVisor | 10–200× I/O overhead; unacceptable for a harness that builds and runs Storybook |
| Firecracker | Overkill; container + `--network=none` provides adequate isolation |
| TLS-terminating proxy | Domain-fronting residual risk accepted — allowlist endpoints are Cloudflare-fronted; full TLS termination adds complexity without eliminating the risk |

---

## Sensitive-file exclusion table

Paths excluded by `.dockerignore` and/or `.claude/settings.json` deny rules:

| Path | Reason | Enforcement |
|------|--------|-------------|
| `.env` | Contains local secrets and API keys | both |
| `.env.*` | Environment-specific secret overrides | both |
| `**/.env` | Nested env files in monorepo packages | both |
| `**/.env.*` | Nested env variant files | both |
| `~/.ssh/` | SSH private keys and known hosts | both |
| `~/.aws/` | AWS credentials and config | both |
| `~/.config/gcloud/` | GCP credentials | `.dockerignore` |
| `~/.azure/` | Azure credentials | `.dockerignore` |
| `~/.docker/config.json` | Docker registry auth tokens | `.dockerignore` |
| `~/.kube/config` | Kubernetes cluster credentials | `.dockerignore` |
| `.npmrc` | npm auth tokens | `.dockerignore` |
| `.pypirc` | PyPI credentials | `.dockerignore` |
| `**/*-service-account.json` | GCP service account key files | `.dockerignore` |
| `**/*.pem` | TLS/SSL certificates and private keys | both |
| `**/*.key` | Private key files | both |
| `~/.git-credentials` | Git credential store | both |
| `~/.config/**` | General user config (may contain tokens) | `.claude/settings.json deny` |

Row count: **17**

---

## Isolation tech matrix

| Technology | Mechanism | Verdict |
|------------|-----------|---------|
| Linux namespaces + cgroups (Docker `--cap-drop ALL`, `--network none`) | Kernel-level process and network isolation; read-only root filesystem; pid and memory limits | **Chosen — Phase 2** |
| gVisor | Intercepts syscalls via user-space kernel; stronger isolation boundary | Rejected — 10–200× I/O overhead unacceptable |
| Firecracker | Lightweight VMM with hardware-virtualized isolation | Rejected — overkill; container isolation is sufficient |

---

## Verification

Confirm that `.claude/settings.json` deny rules are enforced:

```bash
jq '.permissions.deny[]' .claude/settings.json
```

Expected output lists all deny patterns (curl, wget, rm -rf, sudo, .env paths, SSH/AWS/config paths, credential files, PEM/key files).
